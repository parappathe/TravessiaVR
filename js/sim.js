// Regras da Capivara Atravessa. Sem navegador e sem Three.js (os testes rodam no Node).
//
// Tudo que se move é função do tempo (sem estado escondido): a posição de cada carro, tora,
// tartaruga, jacaré, cobra, trem e sucuri sai de `objectsAt(row, t)` e o perigo num ponto sai de
// `hazard(x, y, t)`. Assim o robô consegue prever o futuro igual um jogador atento.
import { Rng } from './vec.js';
import { LEVELS, WORLDS, starsFor } from './levels.js';

export const DT = 1 / 120;
export const COLS = 13, ROWS = 13;
export const XMIN = -4, WRAP = 21;           // os objetos dão a volta fora da maquete
export const ROAD = [1, 2, 3, 4, 5], SAFE = 6, RIVER = [7, 8, 9, 10, 11], TOP = 12;
export const HOMES = [1, 4, 6, 8, 11];
export const LIVES = 3;
export const HOP = { cooldown: 0.2, time: 0.14 };
export const FREEZE = 1.2;
export const CAPY = { half: 0.33, start: [6, 0] };
export const PLAT_MARGIN = 0.25;             // quanto a capivara pode ficar para fora da tora sem cair
export const TURTLE = { cycle: 6, warn: [3.4, 4.2], under: [4.2, 5.4] };
export const HERON = { cycle: 9, on: [3, 7] };
export const FRUIT = { cycle: 11, on: [2, 7] };
export const TRAIN = { period: 7, run: 2.0, warn: 1.5, speed: 30, len: 26, row: 3 };
export const SUCURI = { seg: 4, len: 4, speed: 17 / 4 };
export const STORM = { half: 6, warn: 1.0 };
export const POINTS = { step: 10, home: 50, perSecond: 10, fruit: 200, allHomes: 1000, life: 1000 };
const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

const wrapX = (x) => XMIN + (((x - XMIN) % WRAP) + WRAP) % WRAP;
const mod = (a, n) => ((a % n) + n) % n;

export class Game {
  constructor(levelIndex = 0, opts = {}) {
    this.levelIndex = levelIndex;
    const L = this.L = LEVELS[levelIndex];
    this.W = WORLDS[L.world];
    const rng = this.rng = new Rng(opts.seed ?? 1);
    // fileiras: 1-5 estrada, 7-11 rio; cada objeto com posição inicial e fase própria
    this.lanes = [];
    const spec = { ...Object.fromEntries(ROAD.map((r, i) => [r, L.road[i]])), ...Object.fromEntries(RIVER.map((r, i) => [r, L.river[i]])) };
    for (let row = 0; row < ROWS; row++) {
      const s = spec[row];
      if (!s) { this.lanes[row] = null; continue; }
      const off = rng.range(0, WRAP);
      const objs = [];
      for (let k = 0; k < s.n; k++) objs.push({ x0: XMIN + k * WRAP / s.n + off, ph: k * 1.7 + rng.range(0, 2) });
      this.lanes[row] = { ...s, river: RIVER.includes(row), objs };
    }
    this.boss = L.boss || null;
    this.heronOrder = shuffle([0, 1, 2, 3, 4], rng);
    this.fruitOrder = shuffle([0, 1, 2, 3, 4], rng);
    this.trainPh = rng.range(0, 3);
    this.lives = opts.lives ?? LIVES;
    this.livesLost = 0;
    this.score = 0;
    this.t = 0;
    this.events = [];
    this.over = false;
    this.result = null;
    this.homes = [false, false, false, false, false];
    this.freeze = 0;
    this.cd = 0;
    this.respawn();
  }

  get left() { return this.homes.filter(h => !h).length; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  respawn() {
    this.x = CAPY.start[0]; this.y = CAPY.start[1];
    this.maxRow = 0;
    this.lifeT = this.W.time;
    this.alive = true;
    this.hopT = 1;
    this.from = [this.x, this.y];
  }

  // ---------- mundo em função do tempo ----------
  // deslocamento acumulado de uma faixa (na Tempestade o rio inverte a cada STORM.half segundos)
  offset(lane, t) {
    if (this.boss === 'storm' && lane.river) {
      const m = mod(t, STORM.half * 2);
      return lane.v * (m < STORM.half ? m : STORM.half * 2 - m);
    }
    return lane.v * t;
  }
  laneSpeed(lane, t) {
    if (this.boss === 'storm' && lane.river) return mod(t, STORM.half * 2) < STORM.half ? lane.v : -lane.v;
    return lane.v;
  }
  stormWarn(t) {
    if (this.boss !== 'storm') return false;
    const m = mod(t, STORM.half);
    return m > STORM.half - STORM.warn;
  }
  turtlePhase(o, t) { return mod(t + o.ph, TURTLE.cycle); }
  objectsAt(row, t) {
    const lane = this.lanes[row];
    if (!lane || lane.t === 'rail') return [];
    const off = this.offset(lane, t), v = this.laneSpeed(lane, t);
    return lane.objs.map((o, k) => {
      const x = wrapX(o.x0 + off);
      let sub = 0;
      if (lane.t === 'turtle' && lane.dive) {
        const m = this.turtlePhase(o, t);
        sub = m >= TURTLE.under[0] && m < TURTLE.under[1] ? 2 : m >= TURTLE.warn[0] && m < TURTLE.under[0] ? 1 : 0;
      }
      return { k, x, len: lane.len, kind: lane.t, v, sub };
    });
  }
  heronAt(t) {
    if (!this.L.heron) return -1;
    const m = mod(t, HERON.cycle);
    if (m < HERON.on[0] || m >= HERON.on[1]) return -1;
    return this.heronOrder[Math.floor(t / HERON.cycle) % 5];
  }
  fruitAt(t) {
    const m = mod(t, FRUIT.cycle);
    if (m < FRUIT.on[0] || m >= FRUIT.on[1]) return -1;
    const h = this.fruitOrder[Math.floor(t / FRUIT.cycle) % 5];
    return h === this.heronAt(t) ? -1 : h;
  }
  snakeAt(t) {
    if (!this.L.snake) return null;
    const m = mod(t * this.L.snake, 22);
    const x = m < 11 ? m : 22 - m;           // vai e volta pelo canteiro
    return { x: x - 0.5, len: 2, dir: m < 11 ? 1 : -1 };
  }
  trainAt(t) {
    if (this.boss !== 'train') return null;
    const m = mod(t + this.trainPh, TRAIN.period);
    if (m < TRAIN.run) { const front = -6 + m * TRAIN.speed; return { front, x: front - TRAIN.len, len: TRAIN.len, warn: false }; }
    return { warn: m > TRAIN.period - TRAIN.warn, front: null };
  }
  sucuriAt(t) {
    if (this.boss !== 'sucuri') return null;
    const seg = Math.floor(t / SUCURI.seg), r = mod(seg, 8);
    const row = 7 + (r < 4 ? r : 8 - r);
    const dir = seg % 2 ? -1 : 1;
    const m = mod(t, SUCURI.seg);
    const head = dir > 0 ? -2.5 + m * SUCURI.speed : 14.5 - m * SUCURI.speed;
    const tail = head - dir * SUCURI.len;
    // a próxima fileira (para a tela avisar)
    const r2 = mod(seg + 1, 8);
    return { row, head, x: Math.min(head, tail), len: SUCURI.len, dir, next: 7 + (r2 < 4 ? r2 : 8 - r2) };
  }

  // plataforma que segura quem está em (x, row) no tempo t (rio). margin < 0 é mais exigente.
  platformAt(x, row, t, margin = PLAT_MARGIN) {
    for (const o of this.objectsAt(row, t)) {
      if (o.sub === 2) continue;
      if (x >= o.x - 0.5 - margin && x <= o.x + o.len - 0.5 + margin) return o;
    }
    return null;
  }
  // o que mata quem está em (x, y) no tempo t? (null = nada). half = meia-largura da capivara
  hazard(x, y, t, half = CAPY.half, margin = PLAT_MARGIN) {
    if (x < -0.45 || x > COLS - 1 + 0.45) return 'carried';
    const lane = this.lanes[y];
    if (lane && !lane.river && lane.t !== 'rail') {
      for (const o of this.objectsAt(y, t)) if (x + half > o.x - 0.5 + 0.08 && x - half < o.x + o.len - 0.5 - 0.08) return 'hit';
    }
    if (y === TRAIN.row && this.boss === 'train') {
      const tr = this.trainAt(t);
      if (tr.front != null && x + half > tr.x - 0.5 && x - half < tr.front - 0.5) return 'train';
    }
    if (y === SAFE) {
      const s = this.snakeAt(t);
      if (s && x + half > s.x - 0.5 + 0.1 && x - half < s.x + s.len - 0.5 - 0.1) return 'snake';
    }
    if (lane?.river) {
      const su = this.sucuriAt(t);
      if (su && su.row === y && x + half > su.x - 0.5 && x - half < su.x + su.len - 0.5) return 'sucuri';
      const p = this.platformAt(x, y, t, margin);
      if (!p) return 'water';
      if (p.kind === 'jacare') {
        const hx = p.v >= 0 ? p.x + 2 : p.x;  // a cabeça vai na frente
        if (x >= hx - 0.5 - 0.1 && x <= hx + 0.5 + 0.1) return 'jacare';
      }
    }
    return null;
  }
  // resultado de pular para a fileira das tocas em x
  homeResult(x, t) {
    const i = HOMES.findIndex(h => Math.abs(x - h) < 0.55);
    if (i < 0 || this.homes[i]) return { ok: false, reason: 'bush', i };
    if (this.heronAt(t) === i) return { ok: false, reason: 'heron', i };
    return { ok: true, i, fruit: this.fruitAt(t) === i };
  }

  // ---------- passo ----------
  // input: { hop: 'up' | 'down' | 'left' | 'right' | null }
  step(input) {
    this.events = [];
    if (this.over) return;
    this.t += DT;
    this.hopT = Math.min(1, this.hopT + DT / HOP.time);
    if (this.freeze > 0) {
      this.freeze -= DT;
      if (this.freeze <= 0) { this.respawn(); this.emit('respawn', {}); }
      return;
    }
    this.cd = Math.max(0, this.cd - DT);
    const hop = input?.hop;
    if (hop && this.cd <= 0 && DIRS[hop]) this.doHop(hop);
    if (this.over || this.freeze > 0) return;
    // levado pela correnteza
    const lane = this.lanes[this.y];
    if (lane?.river) {
      const p = this.platformAt(this.x, this.y, this.t);
      if (p) this.x += p.v * DT;
    }
    const h = this.hazard(this.x, this.y, this.t);
    if (h) { this.die(h); return; }
    this.lifeT -= DT;
    if (this.lifeT <= 0) this.die('time');
  }

  doHop(dir) {
    const [dx, dy] = DIRS[dir];
    let nx = this.x + dx, ny = this.y + dy;
    if (ny < 0 || ny > TOP) return;
    if (nx < -0.2 || nx > COLS - 1 + 0.2) return;
    this.cd = HOP.cooldown;
    this.from = [this.x, this.y];
    this.hopT = 0;
    if (ny === TOP) {
      const r = this.homeResult(nx, this.t);
      this.x = r.i >= 0 ? HOMES[r.i] : Math.round(nx); this.y = ny;
      this.emit('hop', { dir, x: this.x, y: this.y });
      if (!r.ok) { this.die(r.reason); return; }
      this.homes[r.i] = true;
      const bonus = POINTS.home + POINTS.perSecond * Math.floor(this.lifeT) + (r.fruit ? POINTS.fruit : 0);
      this.score += bonus;
      this.emit('home', { i: r.i, fruit: r.fruit, bonus, x: this.x, y: this.y });
      if (this.homes.every(Boolean)) { this.score += POINTS.allHomes; this.finish(true); return; }
      this.freeze = 0.6;               // pausinha e volta para a calçada
      this.alive = true;
      this.homeFreeze = true;
      return;
    }
    if (!RIVER.includes(ny)) nx = Math.max(0, Math.min(COLS - 1, Math.round(nx)));
    this.x = nx; this.y = ny;
    if (ny > this.maxRow) { this.maxRow = ny; this.score += POINTS.step; }
    this.emit('hop', { dir, x: this.x, y: this.y });
  }

  die(reason) {
    this.lives--; this.livesLost++;
    this.alive = false;
    this.emit('death', { reason, x: this.x, y: this.y, lives: this.lives });
    if (this.lives <= 0) { this.finish(false); return; }
    this.freeze = FREEZE;
  }

  finish(won) {
    this.over = true;
    const bonus = won ? this.lives * POINTS.life : 0;
    this.score += bonus;
    this.result = { won, stars: won ? starsFor(this.livesLost) : 0, score: this.score, bonus, time: this.t, livesLost: this.livesLost, lives: this.lives, homes: this.homes.filter(Boolean).length };
    this.emit(won ? 'won' : 'lost', {});
  }
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
