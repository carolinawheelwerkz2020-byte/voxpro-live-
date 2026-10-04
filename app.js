"use strict";
/* VoxPro Live — real-time vocal processor. Waves-style chain, live from the phone mic. */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = [
  { id:"major", label:"Major" }, { id:"minor", label:"Minor" },
  { id:"majorPent", label:"Maj Pent" }, { id:"minorPent", label:"Min Pent" },
  { id:"blues", label:"Blues" }, { id:"chromatic", label:"Chromatic" },
];
const PRESETS = {
  natural:   { label:"Natural",    tune:{on:true, strength:45, retune:30}, gate:{on:true, amount:30}, deess:{on:true, amount:30}, comp:{on:true, amount:30}, sat:{on:true, amount:25}, warmth:50, clarity:40, reverb:30, delay:8, doubler:20, duck:25, harmony:{on:true, amount:20}, transpose:0 },
  pop:       { label:"Modern Pop", tune:{on:true, strength:85, retune:60}, gate:{on:true, amount:30}, deess:{on:true, amount:45}, comp:{on:true, amount:55}, sat:{on:true, amount:35}, warmth:40, clarity:55, reverb:30, delay:12, doubler:25, duck:35, harmony:{on:true, amount:30}, transpose:0 },
  hardtune:  { label:"Hard Tune",  tune:{on:true, strength:100, retune:100}, gate:{on:true, amount:30}, deess:{on:true, amount:50}, comp:{on:true, amount:60}, sat:{on:true, amount:45}, warmth:35, clarity:60, reverb:22, delay:14, doubler:15, duck:30, harmony:{on:true, amount:15}, transpose:0 },
  ballad:    { label:"Warm Ballad",tune:{on:true, strength:60, retune:35}, gate:{on:true, amount:30}, deess:{on:true, amount:40}, comp:{on:true, amount:35}, sat:{on:true, amount:30}, warmth:70, clarity:35, reverb:45, delay:18, doubler:30, duck:40, harmony:{on:true, amount:30}, transpose:0 },
  radio:     { label:"Radio Ready",tune:{on:true, strength:90, retune:75}, gate:{on:true, amount:30}, deess:{on:true, amount:55}, comp:{on:true, amount:75}, sat:{on:true, amount:40}, warmth:45, clarity:65, reverb:20, delay:10, doubler:30, duck:30, harmony:{on:true, amount:30}, transpose:0 },
};
/* Style pack — one-tap artist-vibe chains. Vibe names only, no artist endorsements implied. */
const STYLES = {
  toliver:  { label:"Toliver Wave", tune:{on:true, strength:100, retune:90}, gate:{on:true, amount:30}, deess:{on:true, amount:45}, comp:{on:true, amount:55}, sat:{on:true, amount:35}, warmth:45, clarity:65, reverb:55, delay:22, doubler:35, duck:40, harmony:{on:true, amount:35}, transpose:0 },
  croon:    { label:"6AM Croon",    tune:{on:true, strength:70, retune:55}, gate:{on:true, amount:30}, deess:{on:true, amount:40}, comp:{on:true, amount:50}, sat:{on:true, amount:30}, warmth:60, clarity:45, reverb:40, delay:18, doubler:30, duck:35, harmony:{on:true, amount:30}, transpose:0 },
  rage:     { label:"Rage Mode",    tune:{on:true, strength:100, retune:100}, gate:{on:true, amount:30}, deess:{on:true, amount:50}, comp:{on:true, amount:60}, sat:{on:true, amount:50}, warmth:35, clarity:70, reverb:35, delay:28, doubler:25, duck:35, harmony:{on:true, amount:20}, transpose:0 },
  soul:     { label:"Trap Soul",    tune:{on:true, strength:55, retune:40}, gate:{on:true, amount:30}, deess:{on:true, amount:40}, comp:{on:true, amount:45}, sat:{on:true, amount:30}, warmth:70, clarity:40, reverb:45, delay:15, doubler:25, duck:40, harmony:{on:true, amount:35}, transpose:0 },
  monster:  { label:"Dungeon Monster", tune:{on:true, strength:90, retune:80}, gate:{on:true, amount:30}, deess:{on:true, amount:45}, comp:{on:true, amount:60}, sat:{on:true, amount:55}, warmth:50, clarity:40, reverb:40, delay:20, doubler:20, duck:35, harmony:{on:true, amount:15}, transpose:-7 },
  chipmunk: { label:"Chipmunk Soul", tune:{on:true, strength:85, retune:70}, gate:{on:true, amount:30}, deess:{on:true, amount:45}, comp:{on:true, amount:50}, sat:{on:true, amount:35}, warmth:45, clarity:60, reverb:35, delay:20, doubler:25, duck:35, harmony:{on:true, amount:25}, transpose:7 },
  metalcore:{ label:"Metalcore Cleans", tune:{on:true, strength:85, retune:70}, gate:{on:true, amount:35}, deess:{on:true, amount:50}, comp:{on:true, amount:80}, sat:{on:true, amount:55}, warmth:45, clarity:60, reverb:40, delay:15, doubler:30, duck:40, harmony:{on:true, amount:25}, transpose:0 },
  anthem:   { label:"Stadium Anthem", tune:{on:true, strength:80, retune:65}, gate:{on:true, amount:30}, deess:{on:true, amount:45}, comp:{on:true, amount:65}, sat:{on:true, amount:40}, warmth:50, clarity:60, reverb:60, delay:25, doubler:40, duck:45, harmony:{on:true, amount:40}, transpose:0 },
};
const DEFAULT_STATE = {
  key: 0, scale: "major", preset: "pop", monitor: true,
  volume: 80, feedbackGuard: true, tipDismissed: false,
  inGain: 0, delayTime: 0.27, bpm: null, transpose: 0,
  gate: { on: true, amount: 30 },
  tune: { on:true, strength:85, retune:60 },
  deess: { on:true, amount:45 },
  comp: { on:true, amount:55 },
  sat: { on:true, amount:35 },
  warmth: 40, clarity: 55, reverb: 30, delay: 12, doubler: 25, duck: 35,
  harmony: { on: true, amount: 30 },
};

let S = load();
function load() {
  try {
    const raw = localStorage.getItem("voxpro.v1");
    if (raw) return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(raw));
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function save() { try { localStorage.setItem("voxpro.v1", JSON.stringify(S)); } catch (e) {} }

/* ---------------- audio engine ---------------- */
let ctx = null, vox = null, stream = null;
let comp, warmthF, presenceF, airF, master, reverbSend, convolver, delaySend, delayN, fbGain;
let micHP, limiter, outGain, inTrim, shaper, dblSend;
let live = false, meterFreq = null, meterLevel = 0, meterGate = 1;
let outAnalyser = null, outAnalyserBuf = null;
let duckEnv = 0, revBase = 0, dlyBase = 0;
let freezeHeld = false;

/** Soft-clip saturation curve; k<=0 gives a clean linear pass. */
function makeDriveCurve(k) {
  const n = 256, curve = new Float32Array(n);
  if (k <= 0) { for (let i = 0; i < n; i++) curve[i] = (i / (n - 1)) * 2 - 1; return curve; }
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

function makeImpulse(ac, seconds, decay) {
  const rate = ac.sampleRate, len = Math.floor(rate * seconds);
  const buf = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

async function goLive() {
  if (live) return stopLive();
  const btn = document.getElementById("goLive");
  try {
    setStatus("idle", "Starting…");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: S.feedbackGuard, noiseSuppression: false, autoGainControl: false }
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    if (ctx.state === "suspended") await ctx.resume();
    await ctx.audioWorklet.addModule("worklet.js");

    const src = ctx.createMediaStreamSource(stream);
    vox = new AudioWorkletNode(ctx, "voxpro-vocal", {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    });
    vox.port.onmessage = (e) => {
      if (e.data && e.data.type === "meter") { meterFreq = e.data.freq; meterLevel = e.data.level; meterGate = e.data.gate != null ? e.data.gate : 1; }
    };

    comp = ctx.createDynamicsCompressor();
    warmthF = ctx.createBiquadFilter(); warmthF.type = "lowshelf"; warmthF.frequency.value = 200;
    presenceF = ctx.createBiquadFilter(); presenceF.type = "peaking"; presenceF.frequency.value = 3200; presenceF.Q.value = 1;
    airF = ctx.createBiquadFilter(); airF.type = "highshelf"; airF.frequency.value = 10000;
    master = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.12;
    outGain = ctx.createGain();
    micHP = ctx.createBiquadFilter(); micHP.type = "highpass"; micHP.frequency.value = 100;
    inTrim = ctx.createGain();
    shaper = ctx.createWaveShaper(); shaper.oversample = "2x";
    reverbSend = ctx.createGain();
    convolver = ctx.createConvolver(); convolver.buffer = makeImpulse(ctx, 1.8, 2.6);
    delaySend = ctx.createGain();
    delayN = ctx.createDelay(1); delayN.delayTime.value = 0.27;
    fbGain = ctx.createGain(); fbGain.gain.value = 0.32;
    // Doubler: two short modulated delays for Waves-style vocal thickening
    dblSend = ctx.createGain();
    [
      { dt: 0.020, lfo: 0.45, depth: 0.0022, pan: -0.8 },
      { dt: 0.031, lfo: 0.62, depth: 0.0018, pan: 0.8 },
    ].forEach(v => {
      const d = ctx.createDelay(0.1); d.delayTime.value = v.dt;
      const lfo = ctx.createOscillator(); lfo.frequency.value = v.lfo;
      const lg = ctx.createGain(); lg.gain.value = v.depth;
      lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
      const g = ctx.createGain(); g.gain.value = 0.5;
      const p = ctx.createStereoPanner(); p.pan.value = v.pan;
      dblSend.connect(d); d.connect(g); g.connect(p); p.connect(master);
    });
    airF.connect(dblSend);

    src.connect(micHP); micHP.connect(inTrim); inTrim.connect(vox);
    vox.connect(comp); comp.connect(shaper); shaper.connect(warmthF); warmthF.connect(presenceF);
    presenceF.connect(airF); airF.connect(master);
    master.connect(limiter); limiter.connect(outGain);
    outAnalyser = ctx.createAnalyser(); outAnalyser.fftSize = 256;
    outAnalyserBuf = new Uint8Array(outAnalyser.fftSize);
    outGain.connect(outAnalyser); outAnalyser.connect(ctx.destination);
    airF.connect(reverbSend); reverbSend.connect(convolver); convolver.connect(master);
    airF.connect(delaySend); delaySend.connect(delayN);
    delayN.connect(fbGain); fbGain.connect(delayN); delayN.connect(master);

    pushSettings(); applyFx();
    outGain.gain.value = S.monitor ? S.volume / 100 : 0;
    showLatency();

    live = true;
    btn.textContent = "■ Stop"; btn.classList.add("stop");
    setStatus("live", "Live");
    document.getElementById("liveHint").textContent =
      "You're live — sing and hear the tuned vocal in real time. Adjust key, scale or preset as you go.";
  } catch (err) {
    console.error(err);
    setStatus("idle", "Ready");
    alert("Couldn't start the mic. " + (err && err.message ? err.message : err));
  }
}

function stopLive() {
  live = false;
  try { if (vox) vox.disconnect(); } catch (e) {}
  try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { if (ctx) ctx.close(); } catch (e) {}
  vox = null; ctx = null; stream = null; meterFreq = null; outAnalyser = null;
  freezeHeld = false;
  const fz = document.getElementById("freezeBtn");
  if (fz) { fz.classList.remove("held"); fz.textContent = "❄ Hold to Freeze"; }
  const btn = document.getElementById("goLive");
  btn.textContent = "🎤 Go Live"; btn.classList.remove("stop");
  setStatus("idle", "Ready");
  document.getElementById("latency").textContent = "—";
}

function setStatus(cls, text) {
  const el = document.getElementById("status");
  el.className = "status " + cls;
  document.getElementById("statusText").textContent = text;
}

function pushSettings() {
  if (!vox) return;
  vox.port.postMessage({ type: "settings", settings: {
    tune: S.tune.on, strength: S.tune.strength / 100, retune: S.tune.retune / 100,
    maxShift: 3, key: S.key, scale: S.scale, deEss: S.deess.on ? S.deess.amount / 100 : 0,
    transpose: S.transpose || 0, gate: S.gate.on ? S.gate.amount / 100 : 0,
    freeze: freezeHeld, harmony: S.harmony.on ? S.harmony.amount / 100 : 0,
  }});
}

function applyFx() {
  if (!ctx) return;
  const c = S.comp.on ? S.comp.amount / 100 : 0;
  comp.threshold.value = -6 - c * 30;
  comp.ratio.value = 1 + c * 7;
  comp.attack.value = 0.004; comp.release.value = 0.2; comp.knee.value = 12;
  const driveK = S.sat.on ? 1 + (S.sat.amount / 100) * 8 : 0;
  shaper.curve = makeDriveCurve(driveK);
  inTrim.gain.value = Math.pow(10, S.inGain / 20);
  delayN.delayTime.value = S.delayTime;
  dblSend.gain.value = ((S.doubler || 0) / 100) * 0.8;
  warmthF.gain.value = (S.warmth / 100) * 9;
  presenceF.gain.value = (S.clarity / 100) * 6;
  airF.gain.value = (S.clarity / 100) * 7;
  revBase = (S.reverb / 100) * 0.9; reverbSend.gain.value = revBase;
  dlyBase = (S.delay / 100) * 0.7; delaySend.gain.value = dlyBase;
}

function showLatency() {
  const el = document.getElementById("latency");
  const sub = document.getElementById("latencySub");
  let ms = null;
  if (ctx && typeof ctx.outputLatency === "number") ms = ctx.outputLatency * 1000;
  else if (ctx && typeof ctx.baseLatency === "number") ms = ctx.baseLatency * 1000;
  el.textContent = ms === null ? "—" : Math.round(ms) + " ms";
  sub.textContent = ms === null
    ? "Couldn't read device latency"
    : "Device output latency (Bluetooth adds ~200ms on top)";
}

/* ---------------- pitch meter ---------------- */
const canvas = document.getElementById("meter");
const mctx = canvas.getContext("2d");
function hzToMidi(hz) { return 69 + 12 * Math.log2(hz / 440); }

function drawMeter() {
  const W = canvas.width, H = canvas.height;
  mctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.92, R = H * 0.78;
  // ticks
  mctx.lineWidth = 3;
  for (let c = -100; c <= 100; c += 10) {
    const a = Math.PI + (c / 100) * (Math.PI / 2.4);
    const inner = Math.abs(c) <= 15 ? R - 26 : R - 16;
    mctx.strokeStyle = Math.abs(c) <= 15 ? "#34d399" : "#24344f";
    mctx.beginPath();
    mctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    mctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    mctx.stroke();
  }
  // level bar
  const lw = Math.min(1, meterLevel) * (W - 40);
  mctx.fillStyle = "#123c5f";
  mctx.fillRect(20, H - 18, W - 40, 8);
  mctx.fillStyle = "#38bdf8";
  mctx.fillRect(20, H - 18, lw, 8);

  if (meterFreq && live) {
    const midi = hzToMidi(meterFreq);
    const near = Math.round(midi);
    let cents = Math.round((midi - near) * 100);
    cents = Math.max(-100, Math.min(100, cents));
    const a = Math.PI + (cents / 100) * (Math.PI / 2.4);
    mctx.strokeStyle = Math.abs(cents) <= 15 ? "#34d399" : "#f87171";
    mctx.lineWidth = 6; mctx.lineCap = "round";
    mctx.beginPath(); mctx.moveTo(cx, cy);
    mctx.lineTo(cx + Math.cos(a) * (R - 34), cy + Math.sin(a) * (R - 34)); mctx.stroke();
    mctx.fillStyle = "#0d1420";
    mctx.beginPath(); mctx.arc(cx, cy, 14, 0, 7); mctx.fill();
    mctx.strokeStyle = "#38bdf8"; mctx.lineWidth = 3; mctx.stroke();
  }
  // Xvox-style ducking: the space sends dip under the vocal so words stay clear
  if (live && ctx && reverbSend) {
    const target = Math.min(1, meterLevel * 2);
    duckEnv += (target - duckEnv) * (target > duckEnv ? 0.4 : 0.03);
    const dg = 1 - ((S.duck || 0) / 100) * Math.min(1, duckEnv);
    const t = ctx.currentTime;
    reverbSend.gain.setTargetAtTime(revBase * dg, t, 0.05);
    delaySend.gain.setTargetAtTime(dlyBase * dg, t, 0.05);
  }
  requestAnimationFrame(drawMeter);
}

let lastNoteDom = 0;
function updateScreens() {
  const gs = document.getElementById("gateScreen");
  if (gs) gs.textContent = !live ? "STANDBY" : (!S.gate.on ? "BYPASSED" : (meterGate < 0.5 ? "SHUT" : "OPEN"));
  const df = document.getElementById("dynMeterFill");
  if (df) df.style.width = (Math.min(1, meterLevel) * 100).toFixed(1) + "%";
  const gr = document.getElementById("grScreen");
  if (gr) gr.textContent = "GR " + (!live || !comp ? "--" : comp.reduction.toFixed(1) + "dB");
  const ts = document.getElementById("toneScreen");
  if (ts) ts.textContent = "WARM " + S.warmth + " · AIR " + S.clarity;
  const ss = document.getElementById("spaceScreen");
  if (ss) ss.textContent = "REV " + S.reverb + " · DLY " + S.delay;
  const fs = document.getElementById("fxScreen");
  if (fs) {
    const t = S.transpose || 0;
    fs.textContent = "TRANS " + (t >= 0 ? "+" : "") + t + " · HARM " + (S.harmony.on ? S.harmony.amount : "OFF");
  }
  const of = document.getElementById("outMeterFill");
  if (of) {
    let ol = 0;
    if (live && outAnalyser && outAnalyserBuf) {
      outAnalyser.getByteTimeDomainData(outAnalyserBuf);
      let sum = 0;
      for (let i = 0; i < outAnalyserBuf.length; i++) {
        const v = (outAnalyserBuf[i] - 128) / 128;
        sum += v * v;
      }
      ol = Math.min(1, Math.sqrt(sum / outAnalyserBuf.length) * 2.4);
    }
    of.style.width = (ol * 100).toFixed(1) + "%";
  }
}
setInterval(() => {
  updateScreens();
  if (!live || !meterFreq) {
    document.getElementById("noteName").textContent = "—";
    const c = document.getElementById("cents");
    c.textContent = "+0¢"; c.className = "";
    return;
  }
  const midi = hzToMidi(meterFreq);
  const near = Math.round(midi);
  const name = NOTE_NAMES[((near % 12) + 12) % 12] + (Math.floor(near / 12) - 1);
  const cents = Math.round((midi - near) * 100);
  document.getElementById("noteName").textContent = name;
  const c = document.getElementById("cents");
  c.textContent = (cents >= 0 ? "+" : "") + cents + "¢";
  c.className = Math.abs(cents) <= 15 ? "dead" : (cents > 0 ? "sharp" : "flat");
}, 200);

/* ---------------- dashboard UI wiring ---------------- */

/* Live | Studio mode switch */
const modeLiveBtn = document.getElementById("modeLive");
const modeStudioBtn = document.getElementById("modeStudio");
function setMode(m) {
  const liveMode = m === "live";
  modeLiveBtn.classList.toggle("active", liveMode);
  modeStudioBtn.classList.toggle("active", !liveMode);
  document.getElementById("dash-live").classList.toggle("active", liveMode);
  document.getElementById("dash-studio").classList.toggle("active", !liveMode);
}
modeLiveBtn.addEventListener("click", () => setMode("live"));
modeStudioBtn.addEventListener("click", () => setMode("studio"));

document.getElementById("goLive").addEventListener("click", () => { setMode("live"); goLive(); });

const keysEl = document.getElementById("keys");
NOTE_NAMES.forEach((n, i) => {
  const b = document.createElement("button");
  b.textContent = n;
  if (i === S.key) b.classList.add("sel");
  b.addEventListener("click", () => {
    S.key = i; save(); pushSettings(); markCustom();
    keysEl.querySelectorAll("button").forEach((x, j) => x.classList.toggle("sel", j === i));
  });
  keysEl.appendChild(b);
});

const scalesEl = document.getElementById("scales");
SCALES.forEach(s => {
  const b = document.createElement("button");
  b.textContent = s.label;
  if (s.id === S.scale) b.classList.add("sel");
  b.addEventListener("click", () => {
    S.scale = s.id; save(); pushSettings(); markCustom();
    scalesEl.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x.textContent === s.label));
  });
  scalesEl.appendChild(b);
});

const presetsEl = document.getElementById("presets");
Object.entries(PRESETS).forEach(([id, p]) => {
  const b = document.createElement("button");
  b.textContent = p.label;
  if (id === S.preset) b.classList.add("sel");
  b.addEventListener("click", () => applyPreset(id));
  b.dataset.preset = id;
  presetsEl.appendChild(b);
});

/** Any manual tweak drops the factory-preset highlight. */
function markCustom() {
  S.preset = "custom";
  presetsEl.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
}

function applyPreset(id) {
  const p = PRESETS[id] || STYLES[id];
  if (!p) return;
  S.preset = id;
  S.tune = JSON.parse(JSON.stringify(p.tune));
  S.gate = JSON.parse(JSON.stringify(p.gate));
  S.deess = JSON.parse(JSON.stringify(p.deess));
  S.comp = JSON.parse(JSON.stringify(p.comp));
  S.sat = JSON.parse(JSON.stringify(p.sat));
  S.warmth = p.warmth; S.clarity = p.clarity; S.reverb = p.reverb; S.delay = p.delay;
  S.doubler = p.doubler != null ? p.doubler : 25;
  S.duck = p.duck != null ? p.duck : 35;
  S.harmony = JSON.parse(JSON.stringify(p.harmony || { on: true, amount: 30 }));
  S.transpose = p.transpose || 0;
  save(); pushSettings(); applyFx(); syncDashboard();
  const ps = document.getElementById("presetScreen");
  if (ps) ps.textContent = p.label.toUpperCase();
  presetsEl.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x.dataset.preset === id));
}

/* style pack chips */
const stylesEl = document.getElementById("stylePresets");
Object.entries(STYLES).forEach(([id, p]) => {
  const b = document.createElement("button");
  b.textContent = p.label;
  b.addEventListener("click", () => {
    applyPreset(id);
    stylesEl.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
    presetsEl.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
  });
  stylesEl.appendChild(b);
});

/* --- generic control binders --- */
function setToggleVisual(btn, on) {
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", on);
}
function bindToggle(id, key) {
  const btn = document.getElementById(id);
  setToggleVisual(btn, S[key].on);
  btn.addEventListener("click", () => {
    S[key].on = !S[key].on;
    setToggleVisual(btn, S[key].on);
    markCustom(); save(); pushSettings(); applyFx();
  });
}
function bindSlider(id, outId, get, set, fmt) {
  const el = document.getElementById(id);
  const out = document.getElementById(outId);
  const show = () => { el.value = get(); out.textContent = fmt ? fmt(get()) : get(); };
  show();
  el.addEventListener("input", () => {
    const v = parseInt(el.value, 10);
    set(v);
    // dragging a stage's slider re-enables that stage
    if (id === "gateAmount") S.gate.on = true;
    if (id === "deessAmount") S.deess.on = true;
    if (id === "compAmount") S.comp.on = true;
    if (id === "satAmount") S.sat.on = true;
    if (id === "harmAmount") S.harmony.on = true;
    markCustom(); save(); pushSettings(); applyFx(); syncToggles();
    show();
  });
  return show;
}
function syncToggles() {
  setToggleVisual(document.getElementById("harmToggle"), S.harmony.on);
  setToggleVisual(document.getElementById("gateToggle"), S.gate.on);
  setToggleVisual(document.getElementById("deessToggle"), S.deess.on);
  setToggleVisual(document.getElementById("compToggle"), S.comp.on);
  setToggleVisual(document.getElementById("satToggle"), S.sat.on);
}

/* Tune panel */
const showAt = bindSlider("atKnob", "atOut",
  () => S.tune.strength,
  (v) => { S.tune.on = true; S.tune.strength = v; S.tune.retune = v; });
const showTranspose = bindSlider("transposeKnob", "transposeOut",
  () => S.transpose || 0,
  (v) => { S.transpose = v; },
  (v) => (v > 0 ? "+" : "") + v + "st");

/* Dynamics panel */
bindToggle("gateToggle", "gate");
bindToggle("deessToggle", "deess");
bindToggle("compToggle", "comp");
const showGate = bindSlider("gateAmount", "gateOut", () => S.gate.amount, (v) => { S.gate.amount = v; });
const showDeess = bindSlider("deessAmount", "deessOut", () => S.deess.amount, (v) => { S.deess.amount = v; });
const showComp = bindSlider("compAmount", "compOut", () => S.comp.amount, (v) => { S.comp.amount = v; });

/* Tone panel */
const showWarmth = bindSlider("warmthSlider", "warmthOut", () => S.warmth, (v) => { S.warmth = v; });
const showClarity = bindSlider("claritySlider", "clarityOut", () => S.clarity, (v) => { S.clarity = v; });

/* Space panel */
const showReverb = bindSlider("reverbSlider", "reverbOut", () => S.reverb, (v) => { S.reverb = v; });
const showDelay = bindSlider("delaySlider", "delayOut", () => S.delay, (v) => { S.delay = v; });
const showDuck = bindSlider("duckSlider", "duckOut", () => S.duck, (v) => { S.duck = v; });
const showDoubler = bindSlider("doublerSlider", "doublerOut", () => S.doubler || 0, (v) => { S.doubler = v; });

/* Voice FX panel */
bindToggle("satToggle", "sat");
const showSat = bindSlider("satAmount", "satOut", () => S.sat.amount, (v) => { S.sat.amount = v; });

bindToggle("harmToggle", "harmony");
const showHarm = bindSlider("harmAmount", "harmOut", () => S.harmony.amount, (v) => { S.harmony.amount = v; });

/* Freeze: momentary hold-to-sustain button. Sends straight to the worklet. */
const freezeBtn = document.getElementById("freezeBtn");
function setFreeze(on) {
  if (on === freezeHeld) return;
  freezeHeld = on;
  freezeBtn.classList.toggle("held", on);
  freezeBtn.textContent = on ? "❄ Frozen — let go to release" : "❄ Hold to Freeze";
  if (vox) vox.port.postMessage({ type: "settings", settings: { freeze: on } });
}
freezeBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); setFreeze(true); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
  freezeBtn.addEventListener(ev, () => setFreeze(false)));
freezeBtn.addEventListener("contextmenu", (e) => e.preventDefault());

/* tap tempo for the delay */
let taps = [], tapReset = null;
document.getElementById("tapBtn").addEventListener("click", () => {
  const now = performance.now();
  taps.push(now);
  if (taps.length > 6) taps.shift();
  const out = document.getElementById("tapOut");
  if (taps.length >= 3) {
    const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    if (iv > 200 && iv < 2000) {
      const bpm = Math.round(60000 / iv);
      S.bpm = bpm;
      S.delayTime = (60 / bpm) * 0.75; // dotted eighth
      if (ctx && delayN) delayN.delayTime.value = S.delayTime;
      save();
      out.textContent = bpm + " BPM · " + Math.round(S.delayTime * 1000) + "ms";
    }
  } else {
    out.textContent = "tap…";
  }
  clearTimeout(tapReset);
  tapReset = setTimeout(() => { taps = []; }, 2500);
});

/** Push the whole state into every dashboard control. */
function syncDashboard() {
  showAt(); showTranspose();
  showGate(); showDeess(); showComp();
  showWarmth(); showClarity();
  showReverb(); showDelay(); showDuck(); showDoubler();
  showSat(); showHarm(); syncToggles();
}

/* --- custom presets --- */
function getCustomPresets() {
  try { return JSON.parse(localStorage.getItem("voxpro.custom.v1") || "{}"); }
  catch (e) { return {}; }
}
function renderCustomChips() {
  const el = document.getElementById("customPresets");
  el.innerHTML = "";
  const all = getCustomPresets();
  const names = Object.keys(all);
  if (names.length === 0) {
    el.innerHTML = `<span class="card-sub">None yet — dial in a sound and save it.</span>`;
    return;
  }
  names.forEach(name => {
    const chip = document.createElement("span");
    chip.className = "custom-chip";
    const label = document.createElement("button");
    label.textContent = name;
    label.addEventListener("click", () => applyCustomPreset(name));
    const del = document.createElement("button");
    del.textContent = "✕"; del.className = "chip-x"; del.setAttribute("aria-label", "Delete " + name);
    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const a = getCustomPresets(); delete a[name];
      localStorage.setItem("voxpro.custom.v1", JSON.stringify(a));
      renderCustomChips();
    });
    chip.appendChild(label); chip.appendChild(del);
    el.appendChild(chip);
  });
}
function applyCustomPreset(name) {
  const ps0 = document.getElementById("presetScreen");
  if (ps0) ps0.textContent = name.toUpperCase();
  const s = getCustomPresets()[name];
  if (!s) return;
  const c = JSON.parse(JSON.stringify(s));
  S.tune = c.tune; S.deess = c.deess; S.comp = c.comp; S.sat = c.sat || { on: false, amount: 0 };
  S.warmth = c.warmth; S.clarity = c.clarity; S.reverb = c.reverb; S.delay = c.delay;
  S.doubler = c.doubler || 0; S.transpose = c.transpose || 0;
  S.gate = c.gate || { on: true, amount: 30 };
  S.duck = c.duck != null ? c.duck : 35;
  S.harmony = c.harmony || { on: true, amount: 30 };
  S.preset = "custom";
  save(); pushSettings(); applyFx(); syncDashboard();
  presetsEl.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
}
document.getElementById("presetSaveBtn").addEventListener("click", () => {
  const nameEl = document.getElementById("presetName");
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  const all = getCustomPresets();
  all[name] = JSON.parse(JSON.stringify({
    tune: S.tune, deess: S.deess, comp: S.comp, sat: S.sat,
    warmth: S.warmth, clarity: S.clarity, reverb: S.reverb, delay: S.delay,
    doubler: S.doubler || 0, transpose: S.transpose || 0,
    gate: S.gate, duck: S.duck,
  }));
  localStorage.setItem("voxpro.custom.v1", JSON.stringify(all));
  nameEl.value = "";
  renderCustomChips();
});
renderCustomChips();


document.getElementById("monitorToggle").addEventListener("click", function() {
  S.monitor = !S.monitor; save();
  this.classList.toggle("on", S.monitor);
  this.setAttribute("aria-pressed", S.monitor);
  if (ctx && outGain) outGain.gain.value = S.monitor ? S.volume / 100 : 0;
});
if (!S.monitor) {
  const t = document.getElementById("monitorToggle");
  t.classList.remove("on"); t.setAttribute("aria-pressed", "false");
}

const volSlider = document.getElementById("volSlider");
volSlider.value = S.volume;
document.getElementById("volOut").textContent = S.volume;
volSlider.addEventListener("input", () => {
  S.volume = parseInt(volSlider.value, 10); save();
  document.getElementById("volOut").textContent = S.volume;
  if (ctx && outGain && S.monitor) outGain.gain.value = S.volume / 100;
});

const fbGuard = document.getElementById("fbGuardToggle");
if (!S.feedbackGuard) { fbGuard.classList.remove("on"); fbGuard.setAttribute("aria-pressed", "false"); }
fbGuard.addEventListener("click", () => {
  S.feedbackGuard = !S.feedbackGuard; save();
  fbGuard.classList.toggle("on", S.feedbackGuard);
  fbGuard.setAttribute("aria-pressed", S.feedbackGuard);
});

const fbTip = document.getElementById("fbTip");
if (!S.tipDismissed) fbTip.hidden = false;
document.getElementById("fbTipX").addEventListener("click", () => {
  S.tipDismissed = true; save(); fbTip.hidden = true;
});

const inGainSlider = document.getElementById("inGainSlider");
inGainSlider.value = S.inGain || 0;
document.getElementById("inGainOut").textContent = (S.inGain || 0) + "dB";
inGainSlider.addEventListener("input", () => {
  S.inGain = parseInt(inGainSlider.value, 10); save();
  document.getElementById("inGainOut").textContent = S.inGain + "dB";
  if (ctx && inTrim) inTrim.gain.value = Math.pow(10, S.inGain / 20);
});

/* ---------------- Studio: upload -> tune -> save ---------------- */
let studioBuf = null;       // { mono, sampleRate, name, duration }
let studioRendered = null;  // AudioBuffer with FX
let studioSrcNode = null, playbackCtx = null;

function setStudioStatus(t) { document.getElementById("studioStatus").textContent = t || ""; }
function scaleLabel() { const s = SCALES.find(x => x.id === S.scale); return s ? s.label : S.scale; }
function presetLabel() {
  if (S.preset === "custom") return "Custom";
  return PRESETS[S.preset] ? PRESETS[S.preset].label : S.preset;
}
function updateStudioSettingsLine() {
  document.getElementById("studioSettingsLine").textContent =
    "Tuning to " + NOTE_NAMES[S.key] + " " + scaleLabel() + " · " + presetLabel() +
    " — change key, scale or preset on the dashboard.";
}
function studioSettings() {
  return {
    tune: S.tune.on, strength: S.tune.strength / 100, retune: S.tune.retune / 100,
    maxShift: 3, key: S.key, scale: S.scale, transpose: S.transpose || 0,
    gate: S.gate.on ? S.gate.amount / 100 : 0,
    harmony: S.harmony.on ? S.harmony.amount / 100 : 0,
    clarity: S.clarity / 100, warmth: S.warmth / 100,
    deEss: S.deess.on ? S.deess.amount / 100 : 0,
    compression: S.comp.on ? S.comp.amount / 100 : 0,
    reverb: S.reverb / 100, delay: S.delay / 100, gain: 0,
  };
}

document.getElementById("studioFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  setStudioStatus("Loading file…");
  try {
    const ab = await f.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const tmp = new AC();
    const decoded = await tmp.decodeAudioData(ab);
    tmp.close();
    const ch0 = decoded.getChannelData(0);
    let mono;
    if (decoded.numberOfChannels > 1) {
      const ch1 = decoded.getChannelData(1);
      mono = new Float32Array(ch0.length);
      for (let i = 0; i < mono.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
    } else {
      mono = Float32Array.from(ch0);
    }
    studioBuf = { mono, sampleRate: decoded.sampleRate, name: f.name, duration: decoded.duration };
    studioRendered = null;
    document.getElementById("studioResult").hidden = true;
    document.getElementById("studioFileInfo").textContent =
      f.name + " · " + decoded.duration.toFixed(1) + "s · " + (decoded.sampleRate / 1000).toFixed(1) + "kHz";
    document.getElementById("studioProcess").disabled = false;
    updateStudioSettingsLine();
    setStudioStatus("");
  } catch (err) {
    setStudioStatus("Couldn't read that file. Try WAV, MP3 or M4A.");
  }
});

async function renderOfflineFx(tunedMono, sampleRate, harm) {
  const len = tunedMono.length;
  const off = new OfflineAudioContext(2, len, sampleRate);
  const buf = off.createBuffer(1, len, sampleRate);
  buf.getChannelData(0).set(tunedMono);
  const src = off.createBufferSource(); src.buffer = buf;
  const c = S.comp.on ? S.comp.amount / 100 : 0;
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -6 - c * 30; comp.ratio.value = 1 + c * 7;
  comp.attack.value = 0.004; comp.release.value = 0.2; comp.knee.value = 12;
  const sh = off.createWaveShaper(); sh.oversample = "2x";
  sh.curve = makeDriveCurve(S.sat.on ? 1 + (S.sat.amount / 100) * 8 : 0);
  const wf = off.createBiquadFilter(); wf.type = "lowshelf"; wf.frequency.value = 200; wf.gain.value = (S.warmth / 100) * 9;
  const pf = off.createBiquadFilter(); pf.type = "peaking"; pf.frequency.value = 3200; pf.Q.value = 1; pf.gain.value = (S.clarity / 100) * 6;
  const af = off.createBiquadFilter(); af.type = "highshelf"; af.frequency.value = 10000; af.gain.value = (S.clarity / 100) * 7;
  const mst = off.createGain();
  const verb = off.createConvolver(); verb.buffer = makeImpulse(off, 1.8, 2.6);
  const rSend = off.createGain(); rSend.gain.value = (S.reverb / 100) * 0.9;
  const dly = off.createDelay(2); dly.delayTime.value = S.delayTime || 0.27;
  const fb = off.createGain(); fb.gain.value = 0.32;
  const dSend = off.createGain(); dSend.gain.value = (S.delay / 100) * 0.7;
  // Doubler voices (same as live)
  const dblSend = off.createGain(); dblSend.gain.value = ((S.doubler || 0) / 100) * 0.8;
  [
    { dt: 0.020, lfo: 0.45, depth: 0.0022, pan: -0.8 },
    { dt: 0.031, lfo: 0.62, depth: 0.0018, pan: 0.8 },
  ].forEach(v => {
    const d = off.createDelay(0.1); d.delayTime.value = v.dt;
    const lfo = off.createOscillator(); lfo.frequency.value = v.lfo;
    const lg = off.createGain(); lg.gain.value = v.depth;
    lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
    const g = off.createGain(); g.gain.value = 0.5;
    const p = off.createStereoPanner(); p.pan.value = v.pan;
    dblSend.connect(d); d.connect(g); g.connect(p); p.connect(mst);
  });
  src.connect(comp); comp.connect(sh); sh.connect(wf); wf.connect(pf); pf.connect(af); af.connect(mst); mst.connect(off.destination);
  af.connect(dblSend);
  // Studio harmonies: panned background singers through the same FX chain
  const hm = (S.harmony.on ? S.harmony.amount / 100 : 0);
  if (harm && hm > 0.01 && harm.harm1 && harm.harm2) {
    [[harm.harm1, -0.5], [harm.harm2, 0.5]].forEach(([h, pan]) => {
      const hb = off.createBuffer(1, len, sampleRate);
      hb.getChannelData(0).set(h);
      const hs = off.createBufferSource(); hs.buffer = hb;
      const hg = off.createGain(); hg.gain.value = hm;
      const hp = off.createStereoPanner(); hp.pan.value = pan;
      hs.connect(hg); hg.connect(hp); hp.connect(comp);
      hs.start();
    });
  }
  af.connect(rSend); rSend.connect(verb); verb.connect(mst);
  af.connect(dSend); dSend.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(mst);
  // Studio ducking: automate the space sends against the vocal envelope
  const duckAmt = (S.duck || 0) / 100;
  const rBase = (S.reverb / 100) * 0.9, dBase = (S.delay / 100) * 0.7;
  rSend.gain.value = rBase; dSend.gain.value = dBase;
  if (duckAmt > 0.01) {
    const curve = makeDuckCurve(tunedMono, sampleRate, duckAmt);
    const dur = len / sampleRate;
    const rc = new Float32Array(curve.length), dc = new Float32Array(curve.length);
    for (let i = 0; i < curve.length; i++) { rc[i] = rBase * curve[i]; dc[i] = dBase * curve[i]; }
    rSend.gain.setValueCurveAtTime(rc, 0, dur);
    dSend.gain.setValueCurveAtTime(dc, 0, dur);
  }
  src.start();
  return off.startRendering();
}

/** Vocal envelope -> ducking curve: 1 when silent, (1-duck) at full voice. */
function makeDuckCurve(mono, sampleRate, duck) {
  const win = Math.max(1, Math.floor(sampleRate * 0.05));
  const n = Math.ceil(mono.length / win);
  const curve = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    let p = 0;
    const start = i * win, end = Math.min(start + win, mono.length);
    for (let j = start; j < end; j += 4) {
      const a = Math.abs(mono[j]);
      if (a > p) p = a;
    }
    if (p > peak) peak = p;
    curve[i] = p;
  }
  if (peak > 1e-6) {
    for (let i = 0; i < n; i++) curve[i] = 1 - duck * Math.min(1, curve[i] / peak);
  } else {
    curve.fill(1);
  }
  return curve;
}

document.getElementById("studioProcess").addEventListener("click", async () => {
  if (!studioBuf || typeof VoxStudio === "undefined") return;
  const btn = document.getElementById("studioProcess");
  btn.disabled = true;
  document.getElementById("studioResult").hidden = true;
  stopStudioPlayback();
  try {
    updateStudioSettingsLine();
    const res = await VoxStudio.processTake(studioBuf.mono, studioBuf.sampleRate, studioSettings(), setStudioStatus);
    setStudioStatus("Adding effects…");
    await new Promise(r => setTimeout(r, 30));
    studioRendered = await renderOfflineFx(res.tuned, studioBuf.sampleRate, res);
    document.getElementById("studioStats").textContent =
      "In tune: " + Math.round(res.beforePct * 100) + "% → " + Math.round(res.afterPct * 100) + "%" +
      (res.corrected ? "" : " (already in tune — nothing to fix)");
    document.getElementById("studioResult").hidden = false;
    setStudioStatus("Done. Play it or save the WAV.");
  } catch (err) {
    console.error(err);
    setStudioStatus("Processing failed: " + (err && err.message ? err.message : err));
  }
  btn.disabled = false;
});

function ensurePlaybackCtx() {
  if (!playbackCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    playbackCtx = new AC();
  }
  if (playbackCtx.state === "suspended") playbackCtx.resume();
  return playbackCtx;
}
function stopStudioPlayback() {
  try { if (studioSrcNode) studioSrcNode.stop(); } catch (e) {}
  studioSrcNode = null;
  document.getElementById("studioStop").disabled = true;
  document.getElementById("studioPlay").disabled = false;
}
document.getElementById("studioPlay").addEventListener("click", () => {
  if (!studioRendered) return;
  stopStudioPlayback();
  const ac = ensurePlaybackCtx();
  studioSrcNode = ac.createBufferSource();
  studioSrcNode.buffer = studioRendered;
  studioSrcNode.connect(ac.destination);
  studioSrcNode.onended = () => { studioSrcNode = null; stopStudioPlayback(); };
  studioSrcNode.start();
  document.getElementById("studioStop").disabled = false;
  document.getElementById("studioPlay").disabled = true;
});
document.getElementById("studioStop").addEventListener("click", stopStudioPlayback);

function audioBufferToWav(ab) {
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, n = ab.length;
  const chs = [];
  for (let c = 0; c < nCh; c++) chs.push(ab.getChannelData(c));
  const bytes = 44 + n * nCh * 2;
  const buf = new ArrayBuffer(bytes), v = new DataView(buf);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); v.setUint32(4, bytes - 8, true); wstr(8, "WAVE"); wstr(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * 2, true);
  v.setUint16(32, nCh * 2, true); v.setUint16(34, 16, true);
  wstr(36, "data"); v.setUint32(40, n * nCh * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}
document.getElementById("studioDownload").addEventListener("click", () => {
  if (!studioRendered || !studioBuf) return;
  const blob = audioBufferToWav(studioRendered);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const base = studioBuf.name.replace(/\.[^.]+$/, "") || "voxpro";
  a.download = base + "-tuned.wav";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
updateStudioSettingsLine();

drawMeter();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
