"use strict";
/* VoxPro Live — real-time vocal processor. Waves-style chain, live from the phone mic. */

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const SCALES = [
  { id:"major", label:"Major" }, { id:"minor", label:"Minor" },
  { id:"majorPent", label:"Maj Pent" }, { id:"minorPent", label:"Min Pent" },
  { id:"blues", label:"Blues" }, { id:"chromatic", label:"Chromatic" },
];
const PRESETS = {
  natural:   { label:"Natural",    tune:{on:true, strength:45, retune:30}, deess:{on:true, amount:30}, comp:{on:true, amount:30}, warmth:50, clarity:40, reverb:30, delay:8 },
  pop:       { label:"Modern Pop", tune:{on:true, strength:85, retune:60}, deess:{on:true, amount:45}, comp:{on:true, amount:55}, warmth:40, clarity:55, reverb:30, delay:12 },
  hardtune:  { label:"Hard Tune",  tune:{on:true, strength:100, retune:100}, deess:{on:true, amount:50}, comp:{on:true, amount:60}, warmth:35, clarity:60, reverb:22, delay:14 },
  ballad:    { label:"Warm Ballad",tune:{on:true, strength:60, retune:35}, deess:{on:true, amount:40}, comp:{on:true, amount:35}, warmth:70, clarity:35, reverb:45, delay:18 },
  radio:     { label:"Radio Ready",tune:{on:true, strength:90, retune:75}, deess:{on:true, amount:55}, comp:{on:true, amount:75}, warmth:45, clarity:65, reverb:20, delay:10 },
};
const DEFAULT_STATE = {
  key: 0, scale: "major", preset: "pop", monitor: true,
  tune: { on:true, strength:85, retune:60 },
  deess: { on:true, amount:45 },
  comp: { on:true, amount:55 },
  warmth: 40, clarity: 55, reverb: 30, delay: 12,
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
let live = false, meterFreq = null, meterLevel = 0;

function makeImpulse(seconds, decay) {
  const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
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
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
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
      if (e.data && e.data.type === "meter") { meterFreq = e.data.freq; meterLevel = e.data.level; }
    };

    comp = ctx.createDynamicsCompressor();
    warmthF = ctx.createBiquadFilter(); warmthF.type = "lowshelf"; warmthF.frequency.value = 200;
    presenceF = ctx.createBiquadFilter(); presenceF.type = "peaking"; presenceF.frequency.value = 3200; presenceF.Q.value = 1;
    airF = ctx.createBiquadFilter(); airF.type = "highshelf"; airF.frequency.value = 10000;
    master = ctx.createGain();
    reverbSend = ctx.createGain();
    convolver = ctx.createConvolver(); convolver.buffer = makeImpulse(1.8, 2.6);
    delaySend = ctx.createGain();
    delayN = ctx.createDelay(1); delayN.delayTime.value = 0.27;
    fbGain = ctx.createGain(); fbGain.gain.value = 0.32;

    src.connect(vox);
    vox.connect(comp); comp.connect(warmthF); warmthF.connect(presenceF);
    presenceF.connect(airF); airF.connect(master); master.connect(ctx.destination);
    airF.connect(reverbSend); reverbSend.connect(convolver); convolver.connect(master);
    airF.connect(delaySend); delaySend.connect(delayN);
    delayN.connect(fbGain); fbGain.connect(delayN); delayN.connect(master);

    pushSettings(); applyFx();
    master.gain.value = S.monitor ? 1 : 0;
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
  vox = null; ctx = null; stream = null; meterFreq = null;
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
  }});
}

function applyFx() {
  if (!ctx) return;
  const c = S.comp.on ? S.comp.amount / 100 : 0;
  comp.threshold.value = -6 - c * 30;
  comp.ratio.value = 1 + c * 7;
  comp.attack.value = 0.004; comp.release.value = 0.2; comp.knee.value = 12;
  warmthF.gain.value = (S.warmth / 100) * 9;
  presenceF.gain.value = (S.clarity / 100) * 6;
  airF.gain.value = (S.clarity / 100) * 7;
  reverbSend.gain.value = (S.reverb / 100) * 0.9;
  delaySend.gain.value = (S.delay / 100) * 0.7;
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
  requestAnimationFrame(drawMeter);
}

let lastNoteDom = 0;
setInterval(() => {
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

/* ---------------- UI wiring ---------------- */
document.querySelectorAll("nav button").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById(b.dataset.screen).classList.add("active");
  });
});
document.getElementById("goLive").addEventListener("click", goLive);

const keysEl = document.getElementById("keys");
NOTE_NAMES.forEach((n, i) => {
  const b = document.createElement("button");
  b.textContent = n;
  if (i === S.key) b.classList.add("sel");
  b.addEventListener("click", () => {
    S.key = i; save(); pushSettings();
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
    S.scale = s.id; save(); pushSettings();
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

function applyPreset(id) {
  const p = PRESETS[id];
  if (!p) return;
  S.preset = id;
  S.tune = JSON.parse(JSON.stringify(p.tune));
  S.deess = JSON.parse(JSON.stringify(p.deess));
  S.comp = JSON.parse(JSON.stringify(p.comp));
  S.warmth = p.warmth; S.clarity = p.clarity; S.reverb = p.reverb; S.delay = p.delay;
  save(); pushSettings(); applyFx(); renderChain();
  presetsEl.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x.dataset.preset === id));
}

/* chain screen */
const STAGES = [
  { id:"tune", name:"Tune", sub:"Waves Tune-style pitch correction", sliders:[
    { key:"strength", label:"Strength" }, { key:"retune", label:"Retune speed" } ] },
  { id:"deess", name:"De-Ess", sub:"Tames harsh S sounds", sliders:[ { key:"amount", label:"Amount" } ] },
  { id:"comp", name:"Compress", sub:"RVox-style vocal glue", sliders:[ { key:"amount", label:"Amount" } ] },
  { id:"tone", name:"Tone", sub:"Warmth + clarity EQ", sliders:[
    { key:"warmth", label:"Warmth", root:true }, { key:"clarity", label:"Clarity", root:true } ] },
  { id:"space", name:"Space", sub:"Reverb + delay", sliders:[
    { key:"reverb", label:"Reverb", root:true }, { key:"delay", label:"Delay", root:true } ] },
];
function getVal(stage, key, root) { return root ? S[key] : S[stage][key]; }
function setVal(stage, key, root, v) { if (root) S[key] = v; else S[stage][key] = v; }

function renderChain() {
  const host = document.getElementById("stages");
  host.innerHTML = "";
  STAGES.forEach(st => {
    const hasToggle = !["tone","space"].includes(st.id);
    const on = hasToggle ? S[st.id].on : true;
    const div = document.createElement("div");
    div.className = "stage" + (on ? " on" : "");
    let html = `<div class="stage-head"><div class="stage-name">${st.name}<small>${st.sub}</small></div>`;
    if (hasToggle) html += `<button class="toggle${on ? " on" : ""}" data-stage="${st.id}" aria-pressed="${on}"><span></span></button>`;
    html += `</div>`;
    st.sliders.forEach(sl => {
      const v = getVal(st.id, sl.key, sl.root);
      html += `<div class="slider-row"><label>${sl.label}</label>` +
        `<input type="range" min="0" max="100" value="${v}" data-stage="${st.id}" data-key="${sl.key}" data-root="${sl.root ? 1 : 0}">` +
        `<output>${v}</output></div>`;
    });
    div.innerHTML = html;
    host.appendChild(div);
  });
  host.querySelectorAll(".toggle").forEach(t => {
    t.addEventListener("click", () => {
      const st = t.dataset.stage;
      S[st].on = !S[st].on; save(); pushSettings(); applyFx(); renderChain();
    });
  });
  host.querySelectorAll('input[type=range]').forEach(r => {
    r.addEventListener("input", () => {
      const v = parseInt(r.value, 10);
      setVal(r.dataset.stage, r.dataset.key, r.dataset.root === "1", v);
      r.nextElementSibling.textContent = v;
      S.preset = "custom";
      presetsEl.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
      save(); pushSettings(); applyFx();
    });
  });
}
renderChain();

document.getElementById("monitorToggle").addEventListener("click", function() {
  S.monitor = !S.monitor; save();
  this.classList.toggle("on", S.monitor);
  this.setAttribute("aria-pressed", S.monitor);
  if (ctx && master) master.gain.value = S.monitor ? 1 : 0;
});
if (!S.monitor) {
  const t = document.getElementById("monitorToggle");
  t.classList.remove("on"); t.setAttribute("aria-pressed", "false");
}

drawMeter();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
