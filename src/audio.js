// Tiny WebAudio synth so we have juicy sounds without any asset files.
let ac = null;
export function initAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(f0, f1, dur, type = 'square', vol = 0.15, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.15, freq = 1200, type = 'highpass', delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const arp = (notes, step, type, vol) => notes.forEach((f, i) => tone(f, f, 0.18, type, vol, i * step));
export function sfx(name) {
  switch (name) {
    case 'swing': noise(0.12, 0.07, 1800); break;
    case 'hit': tone(200, 60, 0.12, 'square', 0.18); noise(0.08, 0.15, 800); break;
    case 'bighit': tone(130, 40, 0.28, 'sawtooth', 0.25); noise(0.2, 0.22, 500, 'lowpass'); break;
    case 'hurt': tone(320, 90, 0.22, 'sawtooth', 0.16); break;
    case 'dodge': tone(700, 1200, 0.12, 'sine', 0.1); break;
    case 'roll': noise(0.18, 0.08, 900, 'bandpass'); break;
    case 'rep': tone(380, 620, 0.09, 'triangle', 0.14); break;
    case 'coin': tone(900, 900, 0.07, 'square', 0.07); tone(1350, 1350, 0.12, 'square', 0.07, 0.06); break;
    case 'buy': arp([520, 660, 880], 0.07, 'square', 0.08); break;
    case 'warn': tone(160, 110, 0.35, 'sawtooth', 0.07); break;
    case 'slam': tone(100, 28, 0.45, 'sawtooth', 0.3); noise(0.35, 0.25, 400, 'lowpass'); break;
    case 'pickup': arp([440, 554, 660], 0.06, 'triangle', 0.14); break;
    case 'hatch': arp([392, 494, 587, 784, 988], 0.09, 'square', 0.09); break;
    case 'win': arp([523, 659, 784, 1047, 1319], 0.1, 'square', 0.1); break;
    case 'down': tone(300, 40, 0.7, 'sawtooth', 0.2); break;
    case 'rank': arp([392, 523, 659, 784], 0.08, 'triangle', 0.16); break;
  }
}
