// ===========================================
// Network — PeerJS WebRTC Wrapper
// ===========================================

const Network = (() => {
  // Networking constants — adjust these if you need different room code format
  // or want to point at different STUN servers
  const NETWORK_CONFIG = {
    ROOM_CODE_LENGTH: 6,
    ROOM_CODE_CHARS: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", // no confusable chars
    PEER_PREFIX: "p2p-shooter-",
    // Verbose logging locally, silent in production
    PEER_DEBUG: typeof location !== "undefined" && location.hostname === "localhost" ? 2 : 0,
    ICE_SERVERS: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:3478" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:3478" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
    OPEN_POLL_INTERVAL_MS:  100,
    OPEN_POLL_LOG_EVERY:     10,  // log once per second (10 × 100 ms)
    OPEN_POLL_MAX_ATTEMPTS: 150,  // give up after ~15 s
  };

  let peer = null;
  let conn = null;
  let isHost = false;
  let callbacks = {};
  let openPollTimer = null;
  let connected = false;
  let lastRoomCode = null;
  // Peers we explicitly .destroy() — keeps their async 'close' from firing onPeerClosed
  const intentionallyDestroyedPeers = new Set();

  // Reliable-over-unreliable messaging: add a unique _rid and send 3×;
  // receiver deduplicates via the ring buffer below
  let reliableMsgSeq = 0;
  const seenRids = new Set();
  const ridHistory = []; // capped at 128 entries to bound memory

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

  // Attach signaling-level lifecycle handlers to a Peer object.
  // All callbacks reference the module-level `callbacks` object so they
  // stay current even after restoreHost/restoreGuest updates it.
  function attachPeerLifecycleHandlers(peerObj) {
    peerObj.on("disconnected", () => {
      console.log("[Net] Signaling WS disconnected — auto-reconnecting...");
      if (peerObj && !peerObj.destroyed) {
        peerObj.reconnect();
      }
    });

    peerObj.on("close", () => {
      console.log("[Net] Peer fully destroyed");
      // Drop stale events from peers that have been replaced by a newer peer instance
      if (peerObj !== peer) return;
      // Skip callback when we caused the destroy ourselves (e.g. restoreHost/restoreGuest)
      if (intentionallyDestroyedPeers.has(peerObj)) {
        intentionallyDestroyedPeers.delete(peerObj);
        return;
      }
      if (callbacks.onPeerClosed) callbacks.onPeerClosed();
    });
  }

  // Create a host peer with an explicit room code (called on fresh create or reload-resume)
  function createHostWithCode(roomCode, cbs) {
    isHost = true;
    connected = false;
    callbacks = cbs;
    lastRoomCode = roomCode;
    const peerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;

    console.log("[Net] Creating host peer with code:", peerId);
    peer = new Peer(peerId, PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Host peer open, id:", id);
      if (callbacks.onReady) callbacks.onReady(roomCode);
    });

    peer.on("connection", (connection) => {
      console.log("[Net] Host received connection from guest");
      conn = connection;
      const capturedConn = conn;
      setTimeout(() => setupConnection(capturedConn), 0);
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

  function setLastRoomCode(code) {
    lastRoomCode = code;
  }

  // Create a host peer with an auto-generated room code
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
      // Capture conn now; the module-level `conn` may be replaced before the timeout fires
      const capturedConn = conn;
      setTimeout(() => setupConnection(capturedConn), 0);
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

  // Join an existing room as a guest
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
        reliable: false,   // unordered + unreliable = true UDP; eliminates head-of-line blocking
        serialization: "json",
      });
      // Capture conn now; the module-level `conn` may be replaced before the timeout fires
      const capturedConn = conn;
      setTimeout(() => setupConnection(capturedConn), 0);
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

  // Re-register the same room after backgrounding.
  // Reuses the existing Peer when possible to avoid 'unavailable-id' errors
  // (PeerJS server holds stale IDs for ~60 s after a TCP drop).
  function restoreHost(roomCode, cbs) {
    clearPollTimer();
    // Close old DataConnection so its stale events don't trigger new callbacks
    if (conn) {
      conn.close();
      conn = null;
    }
    connected = false;
    isHost = true;
    callbacks = cbs;
    lastRoomCode = roomCode;
    const peerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;

    // --- Reuse existing peer if it's alive with the correct ID ---
    if (peer && !peer.destroyed && peer.id === peerId) {
      console.log("[Net] Reusing host peer:", peerId, "open:", peer.open, "disconnected:", peer.disconnected);
      if (peer.disconnected) {
        // Signaling WS dropped — reconnect it; the existing 'open' +
        // 'connection' handlers from the original creation still work
        // because they reference the module-level `callbacks`.
        peer.reconnect();
      } else if (peer.open) {
        // Peer is fully alive, ready to accept guest connections
        if (callbacks.onReady) callbacks.onReady(roomCode);
      }
      // else: peer is still initializing from a previous attempt;
      // its 'open' handler will fire onReady when it connects.
      return;
    }

    // --- Must create a new peer (wrong ID or destroyed) ---
    if (peer && !peer.destroyed) {
      intentionallyDestroyedPeers.add(peer);
      peer.destroy();
    }

    console.log("[Net] Creating host peer:", peerId);
    peer = new Peer(peerId, PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Host peer open, id:", id);
      if (callbacks.onReady) callbacks.onReady(lastRoomCode);
    });

    peer.on("connection", (connection) => {
      console.log("[Net] Host received guest connection");
      conn = connection;
      const capturedConn = conn;
      setTimeout(() => setupConnection(capturedConn), 0);
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

  // Reconnect to the host after backgrounding.
  // Reuses the existing Peer to avoid creating redundant signaling connections.
  function restoreGuest(roomCode, cbs) {
    clearPollTimer();
    // Close old DataConnection so its stale events don't trigger new callbacks
    if (conn) {
      conn.close();
      conn = null;
    }
    connected = false;
    isHost = false;
    callbacks = cbs;
    lastRoomCode = roomCode;
    const hostPeerId = NETWORK_CONFIG.PEER_PREFIX + roomCode;

    // --- Reuse existing peer if it's alive ---
    if (peer && !peer.destroyed) {
      console.log("[Net] Reusing guest peer:", peer.id, "open:", peer.open, "disconnected:", peer.disconnected);
      if (peer.open) {
        // Peer is alive — connect to host directly
        console.log("[Net] Guest connecting to host:", hostPeerId);
        conn = peer.connect(hostPeerId, { reliable: false, serialization: "json" });
        const capturedConn = conn;
        setTimeout(() => setupConnection(capturedConn), 0);
      } else if (peer.disconnected) {
        // Signaling WS dropped — reconnect it; the existing 'open' handler
        // from the original joinGame/restoreGuest creation will fire and
        // call peer.connect() using `lastRoomCode` (module-level).
        peer.reconnect();
      }
      // else: peer still initializing from a previous attempt;
      // its 'open' handler will connect when ready.
      return;
    }

    // --- Must create a new peer (destroyed or null) ---
    console.log("[Net] Creating guest peer...");
    peer = new Peer(PEER_CONFIG);

    peer.on("open", (id) => {
      console.log("[Net] Guest peer open, id:", id, "connecting to:", hostPeerId);
      const targetId = NETWORK_CONFIG.PEER_PREFIX + lastRoomCode;
      conn = peer.connect(targetId, { reliable: false, serialization: "json" });
      const capturedConn = conn;
      setTimeout(() => setupConnection(capturedConn), 0);
    });

    peer.on("error", (err) => {
      console.error("[Net] Guest peer error:", err.type, err.message);
      const msg =
        err.type === "peer-unavailable"
          ? "Room not found. Host may have left."
          : err.message || "Connection error";
      if (callbacks.onError) callbacks.onError(msg);
    });

    attachPeerLifecycleHandlers(peer);
  }

  // Mark the data channel as connected (guards against double-fire)
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

  // Poll for conn.open as a fallback for environments where the 'open' event
  // doesn't always fire reliably. Stops itself once the connection opens or fails.
  function startOpenPoll(connRef) {
    clearPollTimer();
    let attempts = 0;
    openPollTimer = setInterval(() => {
      attempts++;

      // Log state every second
      if (attempts % NETWORK_CONFIG.OPEN_POLL_LOG_EVERY === 0) {
        const dcState = connRef && connRef._dc ? connRef._dc.readyState : "no _dc";
        const pcState =
          connRef && connRef.peerConnection
            ? connRef.peerConnection.connectionState
            : "no pc";
        const iceState =
          connRef && connRef.peerConnection
            ? connRef.peerConnection.iceConnectionState
            : "no pc";
        console.log(
          `[Net] Poll #${attempts}: conn.open=${connRef?.open}, dc=${dcState}, pc=${pcState}, ice=${iceState}`,
        );
      }

      // Guard: skip if this connection is no longer the active one
      if (connRef !== conn) {
        clearPollTimer();
        return;
      }

      if (connRef && connRef.open) {
        console.log("[Net] Poll: conn.open=true after", attempts, "checks");
        markConnected();
        return;
      }

      // Check underlying DataChannel
      if (connRef && connRef._dc && connRef._dc.readyState === "open") {
        console.log("[Net] Poll: _dc open after", attempts, "checks");
        markConnected();
        return;
      }

      // Check underlying PeerConnection
      if (connRef && connRef.peerConnection) {
        const pc = connRef.peerConnection;
        if (
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected"
        ) {
          // PC connected but DataChannel not open yet — wait a bit more
          if (attempts > 5 && connRef._dc) {
            console.log("[Net] PC connected, dc state:", connRef._dc.readyState);
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

  // Wire connection event handlers.
  // Takes an explicit connRef instead of reading the module-level `conn` to
  // prevent stale-reference bugs when the connection is replaced mid-flight.
  function setupConnection(connRef) {
    console.log("[Net] Setting up connection, conn.open:", connRef.open);

    // Immediate check
    if (connRef === conn && connRef.open) {
      markConnected();
    }

    // Event-based detection
    connRef.on("open", () => {
      console.log("[Net] conn 'open' event fired");
      if (connRef === conn) markConnected();
    });

    connRef.on("data", (data) => {
      if (!connected && connRef === conn) {
        console.log("[Net] Got data before open event — marking connected");
        markConnected();
      }
      if (connRef !== conn) return;
      // Deduplicate reliably-sent messages (they arrive up to 3×)
      if (data._rid) {
        if (seenRids.has(data._rid)) return;
        seenRids.add(data._rid);
        ridHistory.push(data._rid);
        if (ridHistory.length > 128) seenRids.delete(ridHistory.shift());
      }
      if (callbacks.onData) callbacks.onData(data);
    });

    connRef.on("close", () => {
      console.log("[Net] Connection closed");
      clearPollTimer();
      // Guard: ignore close events from stale connections that have been replaced
      if (connRef === conn && callbacks.onDisconnected) callbacks.onDisconnected();
    });

    connRef.on("error", (err) => {
      console.error("[Net] Connection error:", err);
      // Guard: ignore error events from stale connections that have been replaced
      if (connRef === conn && callbacks.onError)
        callbacks.onError(err.message || "Connection error");
    });

      // Also listen directly on the underlying DataChannel — on the guest
      // side _dc may not exist yet at this point, so the poll above covers it
    if (connRef._dc) {
      console.log("[Net] _dc exists at setup, state:", connRef._dc.readyState);
      connRef._dc.addEventListener("open", () => {
        console.log("[Net] _dc 'open' event fired directly");
        if (connRef === conn) markConnected();
      });
    }

    // Monitor underlying PeerConnection ICE state
    if (connRef.peerConnection) {
      console.log("[Net] peerConnection exists at setup");
      connRef.peerConnection.addEventListener("connectionstatechange", () => {
        console.log(
          "[Net] PC connectionState:",
          connRef.peerConnection.connectionState,
        );
      });
      connRef.peerConnection.addEventListener("iceconnectionstatechange", () => {
        console.log(
          "[Net] PC iceConnectionState:",
          connRef.peerConnection.iceConnectionState,
        );
      });
      // Watch for datachannel event (host side)
      connRef.peerConnection.addEventListener("datachannel", (e) => {
        console.log("[Net] PC datachannel event, state:", e.channel.readyState);
        e.channel.addEventListener("open", () => {
          console.log("[Net] PC datachannel opened directly");
          if (connRef === conn) markConnected();
        });
      });
    }

    // Start polling as fallback, bound to this specific connection instance
    startOpenPoll(connRef);
  }

  // Send data to the peer. Silently drops if the channel isn't open yet.
  function send(data) {
    if (conn && conn.open) {
      conn.send(data);
    } else {
      console.debug("[Net] send() dropped — no open connection", data?.type);
    }
  }

  function disconnect() {
    clearPollTimer();
    connected = false;
    isHost = false;
    lastRoomCode = null;
    if (conn) {
      conn.close();
      conn = null;
    }
    if (peer) {
      intentionallyDestroyedPeers.add(peer);
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

  // Send a critical message reliably over the unreliable channel.
  // Stamps a unique _rid and sends up to 3 times; receiver deduplicates by _rid.
  function sendReliable(data) {
    const rid = (++reliableMsgSeq) + "-" + Date.now();
    const payload = Object.assign({}, data, { _rid: rid });
    send(payload);
    setTimeout(() => { if (conn && conn.open) conn.send(payload); }, 40);
    setTimeout(() => { if (conn && conn.open) conn.send(payload); }, 95);
  }

  return {
    createHost,
    createHostWithCode,
    joinGame,
    restoreHost,
    restoreGuest,
    send,
    sendReliable,
    disconnect,
    getIsHost,
    isConnected,
    getLastRoomCode,
    setLastRoomCode,
    generateRoomCode,
  };
})();
