// ===========================================
// Sound — Procedural Audio via Web Audio API
// ===========================================

const Sound = (() => {
  let audioCtx = null;
  let muted = false;
  let pendingSounds = [];

  // ---- Initialization ----
  function init() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("[Sound] Web Audio API not supported:", e);
    }
    muted = localStorage.getItem("p2p-muted") === "true";
    updateMuteButton();
  }

  function resume() {
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  // ---- Mute Control ----
  function toggleMute() {
    muted = !muted;
    localStorage.setItem("p2p-muted", muted);
    updateMuteButton();
  }

  function isMuted() {
    return muted;
  }

  function updateMuteButton() {
    const btn = document.getElementById("muteBtn");
    if (!btn) return;
    const iconOn = btn.querySelector("#icon-sound-on");
    const iconOff = btn.querySelector("#icon-sound-off");
    if (iconOn && iconOff) {
      if (muted) {
        iconOn.style.display = "none";
        iconOff.style.display = "";
      } else {
        iconOn.style.display = "";
        iconOff.style.display = "none";
      }
    }
  }

  // ---- Stereo Panning from x position ----
  function calcPan(x) {
    if (x == null || typeof CONFIG === "undefined") return 0;
    // Map x from [0, CANVAS_WIDTH] to [-1, 1]
    return Math.max(-1, Math.min(1, (x / CONFIG.CANVAS.WIDTH) * 2 - 1));
  }

  // ---- Helper: create connected gain + panner ----
  function createOutput(pan, volume) {
    if (!audioCtx) return null;
    const gain = audioCtx.createGain();
    gain.gain.value = volume || 0.3;
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(audioCtx.destination);
    return { gain, panner, dest: gain }; // connect sources to `dest`
  }

  // ---- Synth Functions ----

  // Shoot — square wave 880→440Hz sweep, 80ms
  function synthShoot(pan) {
    const out = createOutput(pan, 0.15);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.linearRampToValueAtTime(440, t + 0.08);
    out.gain.gain.setValueAtTime(0.15, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.08);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Hit — white noise burst + bandpass, 100ms
  function synthHit(pan) {
    const out = createOutput(pan, 0.25);
    if (!out) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * 0.1,
      audioCtx.sampleRate,
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 1.5;
    out.gain.gain.setValueAtTime(0.25, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.1);
    src.connect(filter);
    filter.connect(out.dest);
    src.start(t);
    src.stop(t + 0.1);
  }

  // Death — sawtooth 400→80Hz descending sweep, 400ms
  function synthDeath(pan) {
    const out = createOutput(pan, 0.3);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    out.gain.gain.setValueAtTime(0.3, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + 0.41);
  }

  // Explosion — white noise burst + low sine rumble, 500ms
  function synthExplosion(pan) {
    const t = audioCtx.currentTime;

    // Noise burst
    const noiseOut = createOutput(pan, 0.35);
    if (!noiseOut) return;
    const buf = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * 0.3,
      audioCtx.sampleRate,
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    noiseOut.gain.gain.setValueAtTime(0.35, t);
    noiseOut.gain.gain.linearRampToValueAtTime(0, t + 0.3);
    src.connect(filter);
    filter.connect(noiseOut.dest);
    src.start(t);
    src.stop(t + 0.3);

    // Low rumble
    const rumbleOut = createOutput(pan, 0.25);
    if (!rumbleOut) return;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    rumbleOut.gain.gain.setValueAtTime(0.25, t);
    rumbleOut.gain.gain.linearRampToValueAtTime(0, t + 0.5);
    osc.connect(rumbleOut.dest);
    osc.start(t);
    osc.stop(t + 0.51);
  }

  // Freeze — sine 300→1200Hz ascending sweep, 300ms
  function synthFreeze(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + 0.31);
  }

  // Countdown tick — sine beep 600Hz, 150ms
  function synthCountdown(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 600;
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Go — sine chord 800+1000+1200Hz, 300ms
  function synthGo(pan) {
    const out = createOutput(pan, 0.15);
    if (!out) return;
    const t = audioCtx.currentTime;
    [800, 1000, 1200].forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    out.gain.gain.setValueAtTime(0.15, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.3);
  }

  // Respawn — triangle wave rising arpeggio 200→400→600→800Hz, 250ms
  function synthRespawn(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const notes = [200, 400, 600, 800];
    const step = 0.06;
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t + i * step);
      osc.stop(t + i * step + step);
    });
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.25);
  }

  // Maze change — filtered noise sweep low→high, 400ms
  function synthMazeChange(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * 0.4,
      audioCtx.sampleRate,
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 0.4);
    filter.Q.value = 2;
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    src.connect(filter);
    filter.connect(out.dest);
    src.start(t);
    src.stop(t + 0.4);
  }

  // Game over — sawtooth 500→100Hz slow descent, 800ms
  function synthGameOver(pan) {
    const out = createOutput(pan, 0.25);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.8);
    out.gain.gain.setValueAtTime(0.25, t);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.8);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + 0.81);
  }

  // Victory — square wave 8-bit fanfare C5-E5-G5-C6, 600ms
  function synthVictory(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const step = 0.14;
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t + i * step);
      osc.stop(t + i * step + step + 0.02);
    });
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.setValueAtTime(0.2, t + 0.55);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.6);
  }

  // Connected — two-tone sine 880Hz then 1100Hz, 200ms
  function synthConnected(pan) {
    const out = createOutput(pan, 0.2);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 880;
    osc1.connect(out.dest);
    osc1.start(t);
    osc1.stop(t + 0.1);
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 1100;
    osc2.connect(out.dest);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.2);
    out.gain.gain.setValueAtTime(0.2, t);
    out.gain.gain.setValueAtTime(0.2, t + 0.18);
    out.gain.gain.linearRampToValueAtTime(0, t + 0.2);
  }

  // ---- Sound ID → synth function map ----
  const SYNTHS = {
    shoot: synthShoot,
    hit: synthHit,
    death: synthDeath,
    explosion: synthExplosion,
    freeze: synthFreeze,
    countdown: synthCountdown,
    go: synthGo,
    respawn: synthRespawn,
    mazeChange: synthMazeChange,
    gameOver: synthGameOver,
    victory: synthVictory,
    connected: synthConnected,
  };

  // ---- Public: play a sound (queues for network broadcast) ----
  function play(soundId, x, y) {
    if (muted || !audioCtx) return;
    const fn = SYNTHS[soundId];
    if (!fn) return;
    const pan = calcPan(x);
    fn(pan);
    // Queue for host→guest broadcast
    pendingSounds.push({ id: soundId, x: x, y: y });
  }

  // ---- Public: flush pending sounds for network broadcast ----
  function flushPending() {
    if (pendingSounds.length === 0) return undefined;
    const batch = pendingSounds;
    pendingSounds = [];
    return batch;
  }

  // ---- Public: play sounds received from host (no re-queue) ----
  function playRemote(sounds) {
    if (muted || !audioCtx || !sounds) return;
    sounds.forEach((s) => {
      const fn = SYNTHS[s.id];
      if (!fn) return;
      fn(calcPan(s.x));
    });
  }

  // ---- Public API ----
  return {
    init,
    resume,
    toggleMute,
    isMuted,
    play,
    flushPending,
    playRemote,
  };
})();
