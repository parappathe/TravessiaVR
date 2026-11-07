// Robô da Capivara Atravessa: planeja a travessia olhando o futuro (o mundo é previsível, como
// para um jogador atento), mas com limites humanos: no máximo um pulo a cada HUMAN.gap segundos,
// margem de segurança maior que a do jogo (não passa raspando) e replaneja só de tempos em tempos.
// Usado nos testes (prova que toda fase dá para vencer) e no dev.autoplay. Sem navegador.
import { DT, TOP, RIVER, HOMES, CAPY, COLS } from './sim.js';

export const HUMAN = { gap: 0.3, half: 0.43, margin: 0.05, horizon: 14, replan: 1.2 };
const ACTIONS = ['up', 'left', 'right', null, 'down'];
const D = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

export function makeRobot() {
  return {
    plan: null, next: 0, lastPlan: -9,
    reset() { this.plan = null; this.next = 0; this.lastPlan = -9; },
    step(game) {
      if (game.over || game.freeze > 0 || !game.alive) { this.plan = null; return { hop: null }; }
      const t = game.t;
      let s = this.plan?.[this.next];
      // hora do próximo passo do plano: confere se está onde o plano esperava
      if (s && t + 1e-9 >= s.t && (Math.abs(s.x - game.x) > 0.35 || s.y !== game.y || t - this.lastPlan > HUMAN.replan)) s = null;
      if (!s) {
        if (this.plan && this.next < this.plan.length && t + 1e-9 < this.plan[this.next].t) return { hop: null };
        this.plan = search(game, game.x, game.y, t);
        this.next = 0; this.lastPlan = t;
        if (!this.plan || !this.plan.length) { this.plan = null; return { hop: emergency(game) }; }
        s = this.plan[0];
      }
      if (t + 1e-9 >= s.t) { this.next++; return { hop: s.a }; }
      return { hop: null };
    },
  };
}

// se não achou caminho: pula para onde não morre agora nem logo depois
function emergency(game) {
  for (const a of ['up', null, 'left', 'right', 'down']) {
    const [x, y] = land(game, game.x, game.y, a, game.t);
    if (y == null) continue;
    let ok = true;
    for (let k = 0; k <= 6 && ok; k++) { if (game.hazard(x, y, game.t + k * 0.05, HUMAN.half, HUMAN.margin)) ok = false; }
    if (ok) return a;
  }
  return null;
}

// onde a capivara cai ao pular de (x, y) na direção a (sem considerar perigo)
function land(game, x, y, a, t) {
  if (!a) return [x, y];
  const [dx, dy] = D[a];
  let nx = x + dx, ny = y + dy;
  if (ny < 0 || ny > TOP || nx < -0.2 || nx > COLS - 1 + 0.2) return [null, null];
  if (ny === TOP) return [nx, ny];
  if (!RIVER.includes(ny)) nx = Math.max(0, Math.min(COLS - 1, Math.round(nx)));
  return [nx, ny];
}

// busca em largura no tempo: estados (x, y) a cada HUMAN.gap segundos
function search(game, x0, y0, t0) {
  const step = HUMAN.gap, maxN = Math.round(HUMAN.horizon / step);
  let layer = [{ x: x0, y: y0, path: [] }];
  const seen = new Set();
  let best = null;
  for (let n = 0; n < maxN && layer.length; n++) {
    const t = t0 + n * step + DT;
    const next = [];
    // primeiro os mais adiantados (chega antes nas tocas)
    layer.sort((a, b) => b.y - a.y);
    for (const s of layer) {
      for (const a of ACTIONS) {
        let [x, y] = land(game, s.x, s.y, a, t);
        if (y == null) continue;
        if (y === TOP) {
          const r = game.homeResult(x, t + DT);
          if (r.ok && game.heronAt(t + 0.6) !== r.i) return [...s.path, { t, a, x: s.x, y: s.y }];
          continue;
        }
        // simula até o próximo pulo, conferindo o perigo com margem de gente
        let dead = false;
        const sub = 6;
        for (let k = 0; k <= sub; k++) {
          const tk = t + (k * step) / sub;
          if (game.hazard(x, y, tk, HUMAN.half, HUMAN.margin)) { dead = true; break; }
          if (k < sub && RIVER.includes(y)) { const p = game.platformAt(x, y, tk, HUMAN.margin); if (p) x += p.v * step / sub; }
        }
        if (dead) continue;
        // não dá para ficar parado demais (o relógio da vida acaba)
        if (t + step - t0 > game.lifeT - 0.5) continue;
        const key = `${y}:${Math.round(x * 3)}:${n}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ns = { x, y, path: [...s.path, { t, a, x: s.x, y: s.y }] };
        next.push(ns);
        if (!best || y > best.y) best = ns;
      }
    }
    // poda: guarda os mais promissores
    next.sort((a, b) => b.y - a.y);
    layer = next.slice(0, 400);
  }
  // não achou a toca no horizonte: vai até o mais adiantado
  return best ? best.path : null;
}
void HOMES; void CAPY;
