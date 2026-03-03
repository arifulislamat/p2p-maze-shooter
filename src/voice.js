// ===========================================
// Voice — Optional Voice Chat (PeerJS Media Calls)
// ===========================================
//
// Architecture:
//   - Runs alongside the existing data connection using PeerJS media calls
//     (peer.call / peer.on('call')).  Both the media call and the data channel
//     share the same STUN/TURN infrastructure — no extra network config needed.
//   - Voice is OFF by default.  The user clicks #micBtn to enable, which calls
//     getUserMedia() and initiates (host) or listens for (guest) a media call.
//   - State is persisted in localStorage('p2p-voice-enabled') so the preference
//     survives page reloads.
//   - Remote audio is played through a hidden <audio> element whose volume is
//     synced with Sound.isMuted() — muting game sound also mutes voice.
//
// Public API (called by game.js):
//   Voice.init()                      — once on DOMContentLoaded
//   Voice.toggle()                    — mic button onclick
//   Voice.startCall(peer, remotePeerId) — host: initiate after data connected
//   Voice.listenForCall(peer)          — guest: arm listener after data connected
//   Voice.cleanup()                    — on disconnect / returnToLobby
//   Voice.syncMuteState()              — called by Sound.toggleMute()
//   Voice.isEnabled()                  — returns voiceEnabled boolean
//   Voice.isConnected()                — returns voiceConnected boolean

const Voice = (() => {
  let localStream    = null;   // MediaStream from getUserMedia
  let mediaCall      = null;   // active PeerJS MediaConnection
  let remoteAudio    = null;   // <audio> element for remote playback
  let voiceEnabled   = false;  // user's toggle preference (persisted)
  let voiceConnected = false;  // true once remote audio is flowing
  let callHandler    = null;   // ref to current peer.on('call') listener

  // ---- Init ----------------------------------------------------------------

  function init() {
    // Create the hidden audio element for the remote stream.
    // Do NOT set autoplay — iOS ignores it outside a user gesture.
    // We unlock it explicitly inside toggle() instead.
    remoteAudio = document.createElement("audio");
    remoteAudio.playsInline = true;
    remoteAudio.muted = true;       // start muted so iOS lets us call play()
    remoteAudio.style.display = "none";
    document.body.appendChild(remoteAudio);

    // Restore persisted preference
    voiceEnabled = localStorage.getItem("p2p-voice-enabled") === "true";
    updateMicButton();
  }

  // ---- Button / UI ---------------------------------------------------------

  function updateMicButton() {
    const btn     = document.getElementById("micBtn");
    if (!btn) return;
    const iconOff = document.getElementById("icon-mic-off");
    const iconOn  = document.getElementById("icon-mic-on");

    if (iconOff && iconOn) {
      if (voiceEnabled) {
        iconOff.style.display = "none";
        iconOn.style.display  = "";
      } else {
        iconOff.style.display = "";
        iconOn.style.display  = "none";
      }
    }

    if (voiceConnected) {
      btn.classList.add("voice-active");
    } else {
      btn.classList.remove("voice-active");
    }
  }

  function showToast(msg) {
    console.warn("[Voice]", msg);
    const toast = document.createElement("div");
    toast.className = "voice-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // ---- Microphone ----------------------------------------------------------

  // Create a silent MediaStream.  PeerJS requires a real MediaStream for both
  // peer.call() and call.answer() — passing null causes the call to fail
  // silently.  A silent stream lets us establish the WebRTC media channel so
  // the *remote* player's audio can flow to us even when our mic is off.
  function createSilentStream() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    oscillator.connect(dest);
    oscillator.start();
    // Mute the track so no actual sound is transmitted
    dest.stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    return dest.stream;
  }

  async function acquireMic() {
    if (localStream) return true; // already have it
    // getUserMedia requires a secure context (HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Voice chat requires HTTPS");
      return false;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      return true;
    } catch (e) {
      console.warn("[Voice] getUserMedia failed:", e.name, e.message);
      const msg =
        e.name === "NotAllowedError" || e.name === "PermissionDeniedError"
          ? "Microphone permission denied"
          : e.name === "NotFoundError" || e.name === "DevicesNotFoundError"
          ? "No microphone found"
          : e.name === "NotReadableError" || e.name === "TrackStartError"
          ? "Microphone in use by another app"
          : e.name === "SecurityError"
          ? "Voice chat requires HTTPS"
          : "Microphone unavailable (" + e.name + ")";
      showToast(msg);
      return false;
    }
  }

  function releaseMic() {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      localStream = null;
    }
  }

  // ---- Media call ----------------------------------------------------------

  function closeMediaCall() {
    if (mediaCall) {
      try { mediaCall.close(); } catch (_) {}
      mediaCall = null;
    }
    voiceConnected = false;
    if (remoteAudio) remoteAudio.srcObject = null;
    updateMicButton();
  }

  function attachCallHandlers(call) {
    mediaCall = call;

    call.on("stream", (stream) => {
      handleRemoteStream(stream);
    });

    call.on("close", () => {
      if (mediaCall === call) {
        voiceConnected = false;
        if (remoteAudio) remoteAudio.srcObject = null;
        updateMicButton();
      }
    });

    call.on("error", (e) => {
      console.warn("[Voice] Media call error:", e);
    });
  }

  function handleRemoteStream(stream) {
    if (!remoteAudio) return;
    remoteAudio.srcObject = stream;
    // Unmute now that we have a real stream (was muted during the iOS unlock)
    remoteAudio.muted = false;
    remoteAudio.play().catch((e) =>
      console.warn("[Voice] Audio play() rejected:", e)
    );
    voiceConnected = true;
    syncMuteState();
    updateMicButton();
  }

  // ---- Public API ----------------------------------------------------------

  // Toggle voice on/off — wired to #micBtn onclick.
  // Enabling: request mic permission.  If already connected to a peer, also
  //   initiate (host) or arm (guest) the media call immediately so enabling
  //   voice mid-game works without waiting for the next onConnected event.
  // Disabling: close the active media call and stop local tracks.
  async function toggle() {
    voiceEnabled = !voiceEnabled;
    localStorage.setItem("p2p-voice-enabled", String(voiceEnabled));

    if (voiceEnabled) {
      // iOS audio unlock — call play() on the still-muted audio element RIGHT
      // NOW while we are inside a user gesture.  This pre-authorises the element
      // so that the later play() call from the WebRTC 'stream' event (which is
      // NOT a user gesture) is allowed by iOS Safari.
      if (remoteAudio) {
        remoteAudio.muted = true;
        remoteAudio.play().catch(() => {});
      }

      const ok = await acquireMic();
      if (!ok) {
        // Failed — revert the toggle
        voiceEnabled = false;
        localStorage.setItem("p2p-voice-enabled", "false");
        updateMicButton();
        return;
      }

      // If we're already in a live game, kick off the call right now rather
      // than waiting for the next onConnected hook (which has already fired).
      if (
        typeof Network !== "undefined" &&
        Network.isConnected()
      ) {
        const vPeer = Network.getPeer();
        if (Network.getIsHost()) {
          const vConn = Network.getConnection();
          if (vPeer && vConn) await startCall(vPeer, vConn.peer);
        } else {
          // Guest: arm listener locally, then tell the host we're ready so it
          // can (re-)initiate the call.  Without this signal the host has no
          // way to know the guest just enabled their mic.
          if (vPeer) listenForCall(vPeer);
          Network.send({ type: "voice_request" });
        }
      }
    } else {
      closeMediaCall();
      releaseMic();
    }

    updateMicButton();
  }

  // Host: initiate a media call to the guest after the data channel opens.
  // game.js calls this from setupHostRoom's "ready" handler and from
  // attemptReconnect's onConnected.
  async function startCall(peer, remotePeerId) {
    // Proceed even if voiceEnabled is false on this side — the other player may
    // have their mic on, and we still need to make the call so their audio can
    // flow back to us.  Only attempt real mic acquisition if the user enabled
    // voice; otherwise use a silent dummy stream so PeerJS has a valid
    // MediaStream (it rejects null).
    if (!localStream && voiceEnabled) {
      const ok = await acquireMic();
      if (!ok) {
        // Mic denied — fall through to use a silent stream
      }
    }
    const streamToSend = localStream || createSilentStream();
    closeMediaCall(); // clean up any stale call first
    try {
      const call = peer.call(remotePeerId, streamToSend);
      if (!call) {
        console.warn("[Voice] peer.call() returned null — is the peer open?");
        return;
      }
      attachCallHandlers(call);
      console.log("[Voice] Host initiated call to", remotePeerId);
    } catch (e) {
      console.warn("[Voice] peer.call() threw:", e);
    }
  }

  // Guest: arm the peer.on('call') listener after the data channel opens.
  // game.js calls this from joinOnlineGame's onConnected and from
  // attemptReconnect's onConnected.
  function listenForCall(peer) {
    // Always arm, regardless of voiceEnabled — a player can receive remote
    // audio without having their own mic turned on.  When a call arrives we
    // answer with localStream (if we have one) or null (receive-only).
    // Remove any stale handler before re-registering (prevents duplicates on
    // reconnects where the same Peer instance is reused).
    if (callHandler) {
      try { peer.off("call", callHandler); } catch (_) {}
    }
    callHandler = async (call) => {
      // Only request mic if the player has explicitly enabled voice on their
      // side.  Otherwise answer with a silent dummy stream so the WebRTC media
      // channel establishes and the remote player's audio can reach us.
      if (!localStream && voiceEnabled) {
        await acquireMic();
      }
      const streamToSend = localStream || createSilentStream();
      closeMediaCall();
      try {
        call.answer(streamToSend);
      } catch (e) {
        console.warn("[Voice] call.answer() threw:", e);
      }
      attachCallHandlers(call);
      console.log("[Voice] Guest answered incoming call");
    };
    peer.on("call", callHandler);
    console.log("[Voice] Guest listening for incoming call");
  }

  // Full teardown — called on disconnect and when returning to lobby.
  // Does NOT reset voiceEnabled so the user's preference is preserved.
  function cleanup() {
    closeMediaCall();
    releaseMic();
    callHandler = null;
    updateMicButton();
  }

  // Sync remote audio volume with the game's mute state.
  // Called by Sound.toggleMute() so muting game audio also silences voice.
  function syncMuteState() {
    if (!remoteAudio) return;
    remoteAudio.volume =
      typeof Sound !== "undefined" && Sound.isMuted() ? 0 : 1;
  }

  function isEnabled()   { return voiceEnabled;   }
  function isConnected() { return voiceConnected;  }

  return {
    init,
    toggle,
    startCall,
    listenForCall,
    handleRemoteStream,
    cleanup,
    syncMuteState,
    isEnabled,
    isConnected,
  };
})();
