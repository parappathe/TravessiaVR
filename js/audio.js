// Sons sintetizados na hora (sem arquivos), com áudio 3D (PannerNode HRTF) para o que passa na
// maquete, e uma musiquinha de fliperama por mundo (viola caipira de onda quadrada e zabumba).
// Só começa depois de um clique, tecla ou da entrada no VR (regra do navegador).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// [baixo/zabumba (16 passos), melodia (16 passos), passos por segundo]
const SONGS = [
  [[48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 60, 0, 55, 0, 50, 0], [76, 79, 84, 79, 76, 0, 74, 76, 77, 81, 84, 81, 79, 0, 76, 0], 8],
  [[45, 0, 0, 52, 0, 0, 45, 0, 41, 0, 0, 48, 0, 0, 43, 0], [69, 0, 72, 74, 76, 0, 74, 72, 69, 0, 67, 0, 69, 72, 69, 0], 7],
  [[40, 0, 47, 0, 40, 0, 47, 0, 36, 0, 43, 0, 38, 0, 45, 0], [64, 67, 71, 0, 74, 71, 67, 0, 60, 64, 67, 0, 69, 67, 64, 0], 6.5],
];

export class Sfx {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.last = {}; this.song = 0; this.playing = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.09 : 0;
      this.musicBus.connect(this.master);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 50);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05); }
  setMusic(v) { this.musicOn = v; if (this.musicBus) this.musicBus.gain.setTargetAtTime(v ? 0.09 : 0, this.ctx.currentTime, 0.1); }
  setSong(i, playing) { this.song = i; this.playing = playing; }

  schedule() {
    const c = this.ctx;
    if (!c) return;
    const [bass, mel, rate] = SONGS[this.song];
    const dt = 1 / rate;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
    while (this.nextT < c.currentTime + 0.2) {
      const k = this.step % 16, t = this.nextT - c.currentTime;
      if (this.playing) {
        if (bass[k]) { this.tone(NOTE(bass[k]), dt * 0.8, { type: 'triangle', vol: 0.9, at: t, bus: this.musicBus, attack: 0.01 }); this.tone(70, 0.12, { type: 'sine', vol: 0.8, at: t, slide: 0.5, bus: this.musicBus }); }
        if (mel[k]) { this.tone(NOTE(mel[k]), dt * 0.7, { type: 'square', vol: 0.14, at: t, bus: this.musicBus }); this.tone(NOTE(mel[k] - 12), dt * 0.7, { type: 'sawtooth', vol: 0.05, at: t, bus: this.musicBus }); }
        // triângulo: aberto no tempo, abafado no contratempo
        this.tone(k % 2 ? 4200 : 5200, k % 2 ? 0.03 : 0.12, { type: 'sine', vol: k % 2 ? 0.08 : 0.14, at: t, bus: this.musicBus });
      }
      this.step++;
      this.nextT += dt;
    }
  }

  setListener(p, f, u) {
    const L = this.ctx?.listener;
    if (!L) return;
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setValueAtTime(p.x, t); L.positionY.setValueAtTime(p.y, t); L.positionZ.setValueAtTime(p.z, t);
      L.forwardX.setValueAtTime(f.x, t); L.forwardY.setValueAtTime(f.y, t); L.forwardZ.setValueAtTime(f.z, t);
      L.upX.setValueAtTime(u.x, t); L.upY.setValueAtTime(u.y, t); L.upZ.setValueAtTime(u.z, t);
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  }
  out(pos, ref = 2, bus = null) {
    const c = this.ctx;
    if (bus) return bus;
    if (!pos) return this.master;
    const p = c.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = 50; p.rolloffFactor = 0.8;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; }
    else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(this.master);
    return p;
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.005, pos = null, ref, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(pos, ref, bus));
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', pos = null, ref, slide = 0, bus = null } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    if (!this.nbuf) {
      this.nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.nbuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out(pos, ref, bus));
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  gate(key, gap) {
    const t = this.ctx?.currentTime ?? 0;
    if (t - (this.last[key] || -9) < gap) return false;
    this.last[key] = t;
    return true;
  }

  // ---------- jogo ----------
  hop(pos) { this.tone(520, 0.08, { type: 'square', vol: 0.09, slide: 1.6, pos, ref: 0.6 }); }
  car(pos, kind) { if (!this.gate('car' + kind, 0.6)) return; const f = kind === 'truck' ? 70 : kind === 'trator' ? 55 : kind === 'moto' ? 160 : 110; this.tone(f, 0.5, { type: 'sawtooth', vol: 0.05, slide: 0.8, pos, ref: 0.4 }); }
  horn(pos) { if (this.gate('horn', 2)) { this.tone(440, 0.25, { type: 'square', vol: 0.08, pos, ref: 0.6 }); this.tone(554, 0.25, { type: 'square', vol: 0.06, pos, ref: 0.6 }); } }
  splash(pos) { this.noise(0.6, { vol: 0.45, freq: 900, q: 0.6, slide: 0.4, pos, ref: 0.6 }); this.tone(300, 0.3, { type: 'sine', vol: 0.15, slide: 0.4, pos, ref: 0.6 }); }
  squash(pos) { this.noise(0.25, { vol: 0.5, freq: 500, q: 0.8, pos, ref: 0.6 }); this.tone(180, 0.3, { type: 'square', vol: 0.15, slide: 0.5, pos, ref: 0.6 }); }
  chomp(pos) { [0, 0.12].forEach(a => this.noise(0.08, { vol: 0.5, freq: 1800, q: 2, at: a, pos, ref: 0.6 })); }
  hiss(pos) { this.noise(0.6, { vol: 0.25, freq: 5000, q: 1, pos, ref: 0.6 }); }
  bird(pos) { [0, 0.12, 0.24].forEach(a => this.tone(1800, 0.08, { type: 'sine', vol: 0.06, slide: 0.7, at: a, pos, ref: 0.6 })); }
  train(pos) { if (this.gate('train', 1)) { this.tone(392, 0.5, { type: 'sawtooth', vol: 0.12, pos, ref: 1 }); this.tone(466, 0.5, { type: 'sawtooth', vol: 0.1, at: 0.05, pos, ref: 1 }); this.noise(1.5, { vol: 0.3, freq: 300, q: 0.6, type: 'lowpass', pos, ref: 1 }); } }
  bell(pos) { if (this.gate('bell', 0.4)) this.tone(1320, 0.15, { type: 'triangle', vol: 0.08, pos, ref: 0.6 }); }
  thunder() { this.noise(1.6, { vol: 0.5, freq: 300, q: 0.5, type: 'lowpass', slide: 0.5 }); }
  timeOut() { [72, 67, 60].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: 'square', vol: 0.1, at: i * 0.15 })); }
  home(pos) { [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.14, { type: 'square', vol: 0.11, at: i * 0.08, pos, ref: 1 })); }
  fruit(pos) { [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.1, { type: 'triangle', vol: 0.1, at: i * 0.05, pos, ref: 1 })); }
  death() { [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.2, { type: 'square', vol: 0.1, at: 0.2 + i * 0.13, slide: 0.95 })); }
  warn() { if (this.gate('warn', 0.5)) this.tone(NOTE(81), 0.12, { type: 'square', vol: 0.08 }); }
  coinStart() { [83, 88].forEach((n, i) => this.tone(NOTE(n), i ? 0.4 : 0.08, { type: 'square', vol: 0.12, at: i * 0.08 })); }
  won() { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, at: i * 0.12 })); }
  lost() { [67, 66, 65, 64, 52].forEach((n, i) => this.tone(NOTE(n), i === 4 ? 0.8 : 0.25, { type: 'square', vol: 0.12, at: i * 0.22 })); }
  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  star(n) { this.tone(NOTE(84 + n * 4), 0.3, { vol: 0.12, type: 'triangle' }); }
}
