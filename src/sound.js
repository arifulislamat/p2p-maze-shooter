// ===========================================
// Sound — Procedural Audio via Web Audio API
// ===========================================

const Sound = (() => {
  // ---- All sound tuning in one place ----
  // Volumes are 0–1. Frequencies are Hz. Durations are seconds.
  const SOUND_CONFIG = {
    shoot: {
      volume: 0.15,
      freqStart: 880, freqEnd: 440,
      duration: 0.09,
    },
    hit: {
      volume: 0.25,
      filterFreq: 1500, filterQ: 1.5,
      duration: 0.1,
    },
    death: {
      volume: 0.3,
      freqStart: 400, freqEnd: 80,
      duration: 0.4,
    },
    explosion: {
      noiseVolume: 0.35,
      noiseFreqStart: 2000, noiseFreqEnd: 200,
      noiseDuration: 0.3,
      rumbleVolume: 0.25,
      rumbleFreqStart: 60, rumbleFreqEnd: 30,
      rumbleDuration: 0.5,
    },
    freeze: {
      volume: 0.2,
      freqStart: 300, freqEnd: 1200,
      duration: 0.3,
    },
    countdown: {
      volume: 0.2,
      freq: 600,
      duration: 0.15,
    },
    go: {
      volume: 0.15,
      freqs: [800, 1000, 1200],
      duration: 0.3,
    },
    respawn: {
      volume: 0.2,
      freqs: [200, 400, 600, 800],
      stepDuration: 0.06,
      totalDuration: 0.25,
    },
    mazeChange: {
      volume: 0.2,
      filterFreqStart: 200, filterFreqEnd: 4000,
      filterQ: 2,
      duration: 0.4,
    },
    gameOver: {
      volume: 0.25,
      freqStart: 500, freqEnd: 100,
      duration: 0.8,
    },
    victory: {
      volume: 0.2,
      // C5, E5, G5, C6
      freqs: [523, 659, 784, 1047],
      stepDuration: 0.14,
    },
    connected: {
      volume: 0.2,
      freq1: 880, freq2: 1100,
      stepDuration: 0.1,
    },
  };

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

  // Shoot — quick square-wave freq sweep
  function synthShoot(pan) {
    const cfg = SOUND_CONFIG.shoot;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const d = cfg.duration - 0.01; // ramp duration slightly shorter than stop time
    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(cfg.freqStart, t);
    osc.frequency.linearRampToValueAtTime(cfg.freqEnd, t + d);
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + d);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + cfg.duration);
  }

  // Hit — white noise burst through a bandpass filter
  function synthHit(pan) {
    const cfg = SOUND_CONFIG.hit;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * cfg.duration, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = cfg.filterFreq;
    filter.Q.value = cfg.filterQ;
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    src.connect(filter);
    filter.connect(out.dest);
    src.start(t);
    src.stop(t + cfg.duration);
  }

  // Death — sawtooth descending sweep
  function synthDeath(pan) {
    const cfg = SOUND_CONFIG.death;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(cfg.freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(cfg.freqEnd, t + cfg.duration);
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + cfg.duration + 0.01);
  }

  // Explosion — filtered noise burst layered with a low sub-bass rumble
  function synthExplosion(pan) {
    const cfg = SOUND_CONFIG.explosion;
    const t = audioCtx.currentTime;

    // High-frequency crunch
    const noiseOut = createOutput(pan, cfg.noiseVolume);
    if (!noiseOut) return;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * cfg.noiseDuration, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cfg.noiseFreqStart, t);
    filter.frequency.exponentialRampToValueAtTime(cfg.noiseFreqEnd, t + cfg.noiseDuration);
    noiseOut.gain.gain.setValueAtTime(cfg.noiseVolume, t);
    noiseOut.gain.gain.linearRampToValueAtTime(0, t + cfg.noiseDuration);
    src.connect(filter);
    filter.connect(noiseOut.dest);
    src.start(t);
    src.stop(t + cfg.noiseDuration);

    // Sub-bass rumble
    const rumbleOut = createOutput(pan, cfg.rumbleVolume);
    if (!rumbleOut) return;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(cfg.rumbleFreqStart, t);
    osc.frequency.exponentialRampToValueAtTime(cfg.rumbleFreqEnd, t + cfg.rumbleDuration);
    rumbleOut.gain.gain.setValueAtTime(cfg.rumbleVolume, t);
    rumbleOut.gain.gain.linearRampToValueAtTime(0, t + cfg.rumbleDuration);
    osc.connect(rumbleOut.dest);
    osc.start(t);
    osc.stop(t + cfg.rumbleDuration + 0.01);
  }

  // Freeze — icy ascending sine sweep
  function synthFreeze(pan) {
    const cfg = SOUND_CONFIG.freeze;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(cfg.freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(cfg.freqEnd, t + cfg.duration);
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + cfg.duration + 0.01);
  }

  // Countdown tick
  function synthCountdown(pan) {
    const cfg = SOUND_CONFIG.countdown;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = cfg.freq;
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + cfg.duration + 0.01);
  }

  // Go — ascending sine chord
  function synthGo(pan) {
    const cfg = SOUND_CONFIG.go;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    cfg.freqs.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t);
      osc.stop(t + cfg.duration);
    });
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
  }

  // Respawn — rising arpeggio
  function synthRespawn(pan) {
    const cfg = SOUND_CONFIG.respawn;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    cfg.freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t + i * cfg.stepDuration);
      osc.stop(t + i * cfg.stepDuration + cfg.stepDuration);
    });
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.totalDuration);
  }

  // Maze change — filtered noise sweep low to high
  function synthMazeChange(pan) {
    const cfg = SOUND_CONFIG.mazeChange;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * cfg.duration, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(cfg.filterFreqStart, t);
    filter.frequency.exponentialRampToValueAtTime(cfg.filterFreqEnd, t + cfg.duration);
    filter.Q.value = cfg.filterQ;
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    src.connect(filter);
    filter.connect(out.dest);
    src.start(t);
    src.stop(t + cfg.duration);
  }

  // Game over — sawtooth descending sweep
  function synthGameOver(pan) {
    const cfg = SOUND_CONFIG.gameOver;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(cfg.freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(cfg.freqEnd, t + cfg.duration);
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.linearRampToValueAtTime(0, t + cfg.duration);
    osc.connect(out.dest);
    osc.start(t);
    osc.stop(t + cfg.duration + 0.01);
  }

  // Victory — 8-bit fanfare arpeggio (C5-E5-G5-C6)
  function synthVictory(pan) {
    const cfg = SOUND_CONFIG.victory;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const totalDuration = cfg.freqs.length * cfg.stepDuration;
    cfg.freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(out.dest);
      osc.start(t + i * cfg.stepDuration);
      osc.stop(t + i * cfg.stepDuration + cfg.stepDuration + 0.02);
    });
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.setValueAtTime(cfg.volume, t + totalDuration - 0.05);
    out.gain.gain.linearRampToValueAtTime(0, t + totalDuration);
  }

  // Connected — two-tone ping
  function synthConnected(pan) {
    const cfg = SOUND_CONFIG.connected;
    const out = createOutput(pan, cfg.volume);
    if (!out) return;
    const t = audioCtx.currentTime;
    const s = cfg.stepDuration;
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = cfg.freq1;
    osc1.connect(out.dest);
    osc1.start(t);
    osc1.stop(t + s);
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = cfg.freq2;
    osc2.connect(out.dest);
    osc2.start(t + s);
    osc2.stop(t + s * 2);
    out.gain.gain.setValueAtTime(cfg.volume, t);
    out.gain.gain.setValueAtTime(cfg.volume, t + s * 2 - 0.02);
    out.gain.gain.linearRampToValueAtTime(0, t + s * 2);
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
