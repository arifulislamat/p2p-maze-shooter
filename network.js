// ===========================================
// Network — PeerJS WebRTC Wrapper
// ===========================================

const Network = (() => {
  const NETWORK_CONFIG = {
    ROOM_CODE_LENGTH: 6,
    ROOM_CODE_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    PEER_PREFIX: "p2p-shooter-",
    PEER_DEBUG: 2,
    ICE_SERVERS: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    OPEN_POLL_INTERVAL_MS: 100,
    OPEN_POLL_LOG_EVERY: 10,
    OPEN_POLL_MAX_ATTEMPTS: 150,
    RECONNECT_MAX_ATTEMPTS: 5,
    RECONNECT_DELAY_MS: 2000,
  };

  let peer = null;
  let conn = null;
  let isHost = false;
  let callbacks = {};
  let openPollTimer = null;
  let connected = false;
  let lastRoomCode = null;

  // Generate a room code (no confusable chars)
  function generateRoomCode() {
    let code = "";
    for (let i = 0; i < NETWORK_CONFIG.ROOM_CODE_LENGTH; i++) {
      code +=
        NETWORK_CONFIG.ROOM_CODE_CHARS[
          Math.floor(Math.random() * NETWORK_CONFIG.ROOM_CODE_CHARS.length)
        ];
    }
    return code;
  }

  const PEER_CONFIG = {
    debug: NETWORK_CONFIG.PEER_DEBUG, // PeerJS debug level (0=none, 1=errors, 2=warnings, 3=all)
    config: {
      iceServers: NETWORK_CONFIG.ICE_SERVERS,
    },
  };

  // ---- Attach signaling-level lifecycle handlers to a peer ----
  function attachPeerLifecycleHandlers(peerObj) {
    peerObj.on("disconnected", () => {
      console.log("[Net] Signaling WS disconnected — auto-reconnecting...");
      if (peerObj && !peerObj.destroyed) {
        peerObj.reconnect();
      }
    });

    peerObj.on("close", () => {
      console.log("[Net] Peer fully destroyed");
      if (callbacks.onPeerClosed) callbacks.onPeerClosed();
    });
  }

  // ---- Host: create a room and wait for guest ----
  function createHost(cbs) {
    isHost = true;
    connected = false;
    callbacks = cbs;
    const roomCode = generateRoomCode();
    lastRoomCode = roomCode;
    const peerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;

    console.log("[Net] Creating host peer:", peerId);
    peer = new Peer(peerId, PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Host peer open, id:", id);
      if (callbacks.onReady) callbacks.onReady(roomCode);
    });

    peer.on("connection", (connection) => {
      console.log("[Net] Host received connection from guest");
      conn = connection;
      // Defer setup to let PeerJS finish its internal message processing
      setTimeout(() => setupConnection(), 0);
    });

    peer.on("error", (err) => {
      console.error("[Net] Host peer error:", err.type, err.message);
      const msg =
        err.type === "unavailable-id"
          ? "Room code already in use. Try again."
          : err.message || "Connection error";
      if (callbacks.onError) callbacks.onError(msg);
    });

    attachPeerLifecycleHandlers(peer);
  }

  // ---- Guest: join an existing room ----
  function joinGame(roomCode, cbs) {
    isHost = false;
    connected = false;
    callbacks = cbs;
    lastRoomCode = roomCode.toUpperCase().trim();

    console.log("[Net] Creating guest peer...");
    peer = new Peer(PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Guest peer open, id:", id);
      const peerId = NETWORK_CONFIG.PEER_PREFIX + lastRoomCode;
      console.log("[Net] Connecting to host:", peerId);
      conn = peer.connect(peerId, {
        reliable: true,
        serialization: "json",
      });
      // Defer setup to let PeerJS finish its internal message processing
      setTimeout(() => setupConnection(), 0);
    });

    peer.on("error", (err) => {
      console.error("[Net] Guest peer error:", err.type, err.message);
      const msg =
        err.type === "peer-unavailable"
          ? "Room not found. Check the code and try again."
          : err.message || "Connection error";
      if (callbacks.onError) callbacks.onError(msg);
    });

    attachPeerLifecycleHandlers(peer);
  }

  // ---- Host: restore a room with the same room code (after backgrounding) ----
  function restoreHost(roomCode, cbs) {
    clearPollTimer();
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    conn = null;
    connected = false;
    isHost = true;
    callbacks = cbs;
    lastRoomCode = roomCode;
    const peerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;

    console.log("[Net] Restoring host peer:", peerId);
    peer = new Peer(peerId, PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Host peer restored, id:", id);
      if (callbacks.onReady) callbacks.onReady(roomCode);
    });

    peer.on("connection", (connection) => {
      console.log("[Net] Restored host received guest connection");
      conn = connection;
      setTimeout(() => setupConnection(), 0);
    });

    peer.on("error", (err) => {
      console.error("[Net] Restored host peer error:", err.type, err.message);
      const msg =
        err.type === "unavailable-id"
          ? "Room code already in use. Try again."
          : err.message || "Connection error";
      if (callbacks.onError) callbacks.onError(msg);
    });

    attachPeerLifecycleHandlers(peer);
  }

  // ---- Guest: restore connection to a host (after backgrounding) ----
  function restoreGuest(roomCode, cbs) {
    clearPollTimer();
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    conn = null;
    connected = false;
    isHost = false;
    callbacks = cbs;
    lastRoomCode = roomCode;

    console.log("[Net] Restoring guest peer...");
    peer = new Peer(PEER_CONFIG);

    peer.on("open", (id) => {
      const peerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;
      console.log("[Net] Guest peer restored, connecting to:", peerId);
      conn = peer.connect(peerId, { reliable: true, serialization: "json" });
      setTimeout(() => setupConnection(), 0);
    });

    peer.on("error", (err) => {
      console.error("[Net] Restored guest peer error:", err.type, err.message);
      const msg =
        err.type === "peer-unavailable"
          ? "Room not found. Host may have left."
          : err.message || "Connection error";
      if (callbacks.onError) callbacks.onError(msg);
    });

    attachPeerLifecycleHandlers(peer);
  }

  // ---- Mark as connected (deduplicated) ----
  function markConnected() {
    if (connected) return;
    connected = true;
    clearPollTimer();
    console.log("[Net] ✓ DataChannel OPEN — connected!");
    if (typeof Sound !== "undefined")
      Sound.play(
        "connected",
        CONFIG.CANVAS.WIDTH / 2,
        CONFIG.CANVAS.HEIGHT / 2,
      );
    if (callbacks.onConnected) callbacks.onConnected();
  }

  // ---- Poll for conn.open as fallback ----
  function startOpenPoll() {
    clearPollTimer();
    let attempts = 0;
    openPollTimer = setInterval(() => {
      attempts++;

      // Log state every second
      if (attempts % NETWORK_CONFIG.OPEN_POLL_LOG_EVERY === 0) {
        const dcState = conn && conn._dc ? conn._dc.readyState : "no _dc";
        const pcState =
          conn && conn.peerConnection
            ? conn.peerConnection.connectionState
            : "no pc";
        const iceState =
          conn && conn.peerConnection
            ? conn.peerConnection.iceConnectionState
            : "no pc";
        console.log(
          `[Net] Poll #${attempts}: conn.open=${conn?.open}, dc=${dcState}, pc=${pcState}, ice=${iceState}`,
        );
      }

      if (conn && conn.open) {
        console.log("[Net] Poll: conn.open=true after", attempts, "checks");
        markConnected();
        return;
      }

      // Check underlying DataChannel
      if (conn && conn._dc && conn._dc.readyState === "open") {
        console.log("[Net] Poll: _dc open after", attempts, "checks");
        markConnected();
        return;
      }

      // Check underlying PeerConnection
      if (conn && conn.peerConnection) {
        const pc = conn.peerConnection;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected"
        ) {
          // PC connected but DataChannel not open yet — wait a bit more
          if (attempts > 5 && conn._dc) {
            console.log("[Net] PC connected, dc state:", conn._dc.readyState);
          }
        }
        if (
          pc.connectionState === "failed" ||
          pc.iceConnectionState === "failed"
        ) {
          console.error("[Net] ICE connection failed!");
          clearPollTimer();
          if (callbacks.onError)
            callbacks.onError("Connection failed — try again");
          return;
        }
      }

      if (attempts > NETWORK_CONFIG.OPEN_POLL_MAX_ATTEMPTS) {
        console.error("[Net] Connection poll timed out (15s)");
        clearPollTimer();
        if (callbacks.onError)
          callbacks.onError("Connection timed out — try again");
      }
    }, NETWORK_CONFIG.OPEN_POLL_INTERVAL_MS);
  }

  function clearPollTimer() {
    if (openPollTimer) {
      clearInterval(openPollTimer);
      openPollTimer = null;
    }
  }

  // ---- Set up connection event handlers ----
  function setupConnection() {
    console.log("[Net] Setting up connection, conn.open:", conn.open);

    // Immediate check
    if (conn.open) {
      markConnected();
    }

    // Event-based detection
    conn.on("open", () => {
      console.log("[Net] conn 'open' event fired");
      markConnected();
    });

    conn.on("data", (data) => {
      if (!connected) {
        console.log("[Net] Got data before open event — marking connected");
        markConnected();
      }
      if (callbacks.onData) callbacks.onData(data);
    });

    conn.on("close", () => {
      console.log("[Net] Connection closed");
      clearPollTimer();
      if (callbacks.onDisconnected) callbacks.onDisconnected();
    });

    conn.on("error", (err) => {
      console.error("[Net] Connection error:", err);
      if (callbacks.onError)
        callbacks.onError(err.message || "Connection error");
    });

    // Also monitor the underlying DataChannel directly if available
    if (conn._dc) {
      console.log("[Net] _dc exists at setup, state:", conn._dc.readyState);
      conn._dc.addEventListener("open", () => {
        console.log("[Net] _dc 'open' event fired directly");
        markConnected();
      });
    }

    // Monitor underlying PeerConnection ICE state
    if (conn.peerConnection) {
      console.log("[Net] peerConnection exists at setup");
      conn.peerConnection.addEventListener("connectionstatechange", () => {
        console.log(
          "[Net] PC connectionState:",
          conn.peerConnection.connectionState,
        );
      });
      conn.peerConnection.addEventListener("iceconnectionstatechange", () => {
        console.log(
          "[Net] PC iceConnectionState:",
          conn.peerConnection.iceConnectionState,
        );
      });
      // Watch for datachannel event (host side)
      conn.peerConnection.addEventListener("datachannel", (e) => {
        console.log("[Net] PC datachannel event, state:", e.channel.readyState);
        e.channel.addEventListener("open", () => {
          console.log("[Net] PC datachannel opened directly");
          markConnected();
        });
      });
    }

    // Start polling as fallback
    startOpenPoll();
  }

  // ---- Send data to peer ----
  function send(data) {
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  // ---- Clean up ----
  function disconnect() {
    clearPollTimer();
    connected = false;
    if (conn) {
      conn.close();
      conn = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
    callbacks = {};
  }

  function getIsHost() {
    return isHost;
  }

  function isConnected() {
    return connected && conn && conn.open;
  }

  function getLastRoomCode() {
    return lastRoomCode;
  }

  return {
    createHost,
    joinGame,
    restoreHost,
    restoreGuest,
    send,
    disconnect,
    getIsHost,
    isConnected,
    getLastRoomCode,
  };
})();
