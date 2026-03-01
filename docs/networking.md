# Networking

How the P2P connection works, what each message type does, and how reconnection is handled.

---

## The Basic Model

Two players connect directly via WebRTC (no relay server after the initial handshake). One player is the **host**, the other is the **guest**.

- The **host** runs the full physics simulation. It is the source of truth for all positions, health, scores, and entity state.
- The **guest** sends its key inputs to the host and displays whatever the host sends back. It does not run its own physics for movement — it just renders what it receives.

This is called a **host-authoritative** model. It prevents cheating and keeps both players perfectly in sync, at the cost of the guest seeing its own movement roughly one round-trip away.

To hide that latency, the guest creates its own bullets locally the moment it presses space — so shooting feels instant. The bullet positions get corrected by the host within the next frame.

---

## How Connections Are Made

1. The host clicks **Create Game Room**. The game generates a 6-character room code and registers with a PeerJS signaling server using `p2p-shooter-XXXXXX` as the peer ID.
2. The host shares the room code (or URL) with the guest.
3. The guest enters the code and clicks **Join**. PeerJS's signaling server performs the initial WebRTC handshake (exchanging ICE candidates and SDP offers).
4. Once the DataChannel opens, the guest sends a `ready` message. The host waits for this before starting the game — without the handshake, the host might send the `config` message before the guest's handler is ready.
5. The host sends `config` which triggers `startOnlineGame()` on the guest side.

The signaling server is only used for the initial connection setup. Once the DataChannel is open, all traffic flows directly between the two browsers.

---

## Message Types

All messages are JSON objects sent over the DataChannel.

### High frequency (60 Hz)

| Type | Direction | What it contains |
|---|---|---|
| `input` | guest → host | Guest's current key state (`up`, `down`, `left`, `right`, `shoot`) |
| `host_input` | host → guest | Host's key state + authoritative P1 and P2 positions, directions, and a `seq` counter |

The guest drops any `host_input` packet whose `seq` is not greater than the last seen sequence number. This discards out-of-order packets (common with unreliable delivery).

### Authority corrections (10 Hz)

| Type | Direction | What it contains |
|---|---|---|
| `correction` | host → guest | Both players' health/score/alive, positions, bombs, zombies, health packs, explosions, weapon pickups, speed boosts, game state, countdown value |

The guest snaps authority state (health, score, alive, game state) immediately. Positions are redundant with `host_input` but included so the 10 Hz correction can fill gaps.

### One-time / critical messages

| Type | Direction | What it contains |
|---|---|---|
| `ready` | guest → host | Signals the DataChannel is open and the guest's handler is wired |
| `config` | host → guest | Selected maze key and maze order; triggers `startOnlineGame()` on guest |
| `resync` | host → guest | Maze key, maze order, mazes played, match start time, maze rotation start — used for mid-game rejoins without resetting scores |
| `state` | host → guest | Full entity snapshot: both players, all bullets, bombs, zombies, health packs, pickups, scores, sounds |
| `restart_request` | host → guest | Tells the guest to restart the match |
| `sounds` | host → guest | Batched sound events for the guest to play locally (included in `state`) |

---

## Reliable-Over-Unreliable Messaging

The DataChannel uses **unreliable** delivery (UDP semantics) to avoid head-of-line blocking on the 60 Hz stream. But some messages — `config`, `resync`, `ready`, `restart_request` — must not be lost.

For those, `Network.sendReliable()` stamps a unique `_rid` (reliable ID) and sends the message **three times** — immediately, at +40 ms, and at +95 ms. The receiver keeps a 128-entry ring buffer of seen `_rid` values and silently drops duplicates.

This gives reliable delivery without switching the entire channel to ordered/reliable mode.

---

## Reconnection

**What triggers it:** The DataChannel fires a `close` or `error` event while the game is still running. The guest also self-triggers reconnect after `DATA_TIMEOUT_MS` (5 s) with no data received from the host — this catches silent crashes where no close event fires.

**What happens:**

1. `handleDisconnect()` is called. If the game is actively playing, it enters `STATE.RECONNECTING` and starts a 75-second countdown.
2. Every 3 seconds, `Network.restoreHost()` or `Network.restoreGuest()` is called. These functions **reuse the existing Peer** object — they only close the DataConnection, not the Peer itself. This avoids the `unavailable-id` error that occurs when you try to re-register a peer ID that the signaling server still thinks is live (the server TTL is ~60 s).
3. A `visibilitychange` listener triggers the same flow when the tab comes back to the foreground — handles the common mobile case where the OS suspends background tabs.
4. On success: the host sends `resync` + a full state broadcast. The guest resumes playing from the current game state.
5. On timeout (75 s): `handleDisconnect()` falls through to `returnToLobby()`.

**Why 75 seconds?** PeerJS's signaling server keeps a peer ID alive for approximately 60 seconds after the WebSocket drops. The reconnect window must outlast that TTL so the peer can re-register with the same ID.

---

## Session Persistence (Page Reload)

When the game starts, it saves `{ role, roomCode }` to `sessionStorage`. On page load, `Game.rejoinSession()` reads this and automatically reconnects — the host re-registers the same peer ID, the guest reconnects and resumes.

The session is also updated every 100 ms (at the same rate as authority corrections) with the full match state — maze order, scores, timers. If the host reloads mid-match, it restores this state and the match continues from where it left off.

The session is cleared when returning to the lobby so a stale session doesn't pull you back into a finished game.

---

## STUN / NAT Traversal

The game uses 5 Google STUN servers for ICE negotiation. STUN is sufficient for most home and mobile connections.

If you're deploying this behind a corporate firewall or very strict NAT, WebRTC may fail to connect. In that case, add TURN servers to `NETWORK_CONFIG.ICE_SERVERS`:

```javascript
{
  urls: "turn:your-turn-server.example.com:3478",
  username: "yourusername",
  credential: "yourpassword",
}
```

TURN servers relay traffic when direct P2P is blocked. They require hosting your own (coturn is the common open-source option).
