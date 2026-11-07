// Testes automáticos: node tests/run.js (ou npm test). Não tocam som nem usam navegador.
import { Game, DT, LIVES, HOMES, ROAD, RIVER, SAFE, TOP, COLS, HOP, FREEZE, TURTLE, TRAIN, STORM, POINTS } from '../js/sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD, starsFor } from '../js/levels.js';
import { makeRobot, HUMAN } from '../js/robot.js';

let fails = 0, count = 0;
function ok(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU:', msg); } }
const run = (g, sec, inp = { hop: null }) => { const evs = []; for (let i = 0; i < Math.round(sec / DT); i++) { g.step(typeof inp === 'function' ? inp(g) : inp); evs.push(...g.events); } return evs; };
const has = (evs, type) => evs.some(e => e.type === type);
const hop = (g, dir) => { g.cd = 0; g.step({ hop: dir }); return g.events; };
// jogo vazio: sem carros nem plataformas (para montar cenas)
function quiet(level = 0, opts = {}) {
  const g = new Game(level, opts);
  for (const r of [...ROAD, ...RIVER]) if (g.lanes[r]) g.lanes[r].objs = [];
  g.L = { ...g.L, heron: false, snake: 0 };
  g.boss = null;
  return g;
}

console.log('Fases');
{
  ok(LEVELS.length === 12 && WORLDS.length === 3, '12 fases em 3 mundos');
  LEVELS.forEach((L, i) => {
    ok(L.world === Math.floor(i / LEVELS_PER_WORLD), `fase ${i + 1} no mundo certo`);
    ok(!!L.boss === (i % 4 === 3), `fase ${i + 1}: chefe só na 4ª de cada mundo`);
    ok(L.road.length === 5 && L.river.length === 5, `fase ${i + 1}: 5 faixas de estrada e 5 de rio`);
    ok(L.river.every(s => ['log', 'turtle', 'jacare'].includes(s.t)) && L.road.every(s => ['car', 'moto', 'trator', 'truck', 'rail'].includes(s.t)), `fase ${i + 1}: tipos certos em cada faixa`);
    // todo rio tem plataforma suficiente (pelo menos 1/4 da faixa coberta)
    ok(L.river.every(s => s.n * s.len >= 5), `fase ${i + 1}: rio com plataformas suficientes`);
  });
  ok(starsFor(0) === 3 && starsFor(1) === 2 && starsFor(2) === 1, 'estrelas pelas vidas perdidas');
  ok(HOMES.length === 5 && HOMES.every(h => h >= 0 && h < COLS), '5 tocas dentro da maquete');
}

console.log('Pulos');
{
  const g = quiet(0);
  ok(g.x === 6 && g.y === 0, 'começa na calçada, no meio');
  let e = hop(g, 'up');
  ok(g.y === 1 && has(e, 'hop') && g.score === POINTS.step, 'pula para a frente e ganha pontos');
  hop(g, 'down');
  ok(g.y === 0 && g.score === POINTS.step, 'voltar não dá ponto de novo');
  hop(g, 'down');
  ok(g.y === 0, 'não sai da maquete por trás');
  g.x = 0; hop(g, 'left');
  ok(g.x === 0, 'não sai pelo lado');
  g.x = 6; g.cd = 0;
  g.step({ hop: 'up' }); g.step({ hop: 'up' });
  ok(g.y === 1, 'espera um pouquinho entre pulos');
  run(g, HOP.cooldown);
  g.step({ hop: 'up' });
  ok(g.y === 2, 'depois do intervalo pula de novo');
}

console.log('Estrada');
{
  const g = new Game(0, { seed: 1 });
  // põe a capivara na faixa 1 bem onde vai passar um carro
  const o = g.objectsAt(1, g.t + 0.5)[0];
  g.x = Math.round(Math.max(0, Math.min(12, o.x))); g.y = 1;
  let died = false;
  for (let i = 0; i < 6 / DT && !died; i++) { g.step({ hop: null }); if (g.events.some(e => e.type === 'death' && e.reason === 'hit')) died = true; }
  ok(died, 'carro atropela a capivara parada na faixa');
  // hazard bate com objectsAt
  const h = new Game(2, { seed: 4 });
  let agree = true;
  for (let k = 0; k < 200; k++) {
    const t = k * 0.13, row = 1 + (k % 5);
    for (const ob of h.objectsAt(row, t)) {
      const cx = Math.round(ob.x + ob.len / 2 - 0.5);
      if (cx >= 0 && cx <= 12 && !h.hazard(cx, row, t)) agree = false;
    }
  }
  ok(agree, 'meio de um veículo sempre é perigo');
  ok(new Game(0).objectsAt(1, 0).length === LEVELS[0].road[0].n, 'faixa com a quantidade certa de carros');
}

console.log('Rio');
{
  const g = quiet(0);
  g.y = 7; g.x = 6;
  let e = run(g, 0.05);
  ok(e.some(x => x.type === 'death' && x.reason === 'water'), 'cair na água mata');
  // em cima de uma tora: é levada junto
  const h = new Game(0, { seed: 2 });
  const row = 8, t = h.t;
  const log = h.objectsAt(row, t).find(o => o.x > 1 && o.x + o.len < 11);
  if (log) {
    h.y = row; h.x = log.x + 1;
    const x0 = h.x;
    run(h, 1);
    ok(h.alive && h.y === row && Math.abs(h.x - (x0 + LEVELS[0].river[1].v * 1)) < 0.05, 'tora leva a capivara junto');
  } else ok(false, 'achou tora no meio do rio');
  // levada para fora da maquete
  const k = new Game(0, { seed: 2 });
  k.y = 8; k.x = 12.3;
  const pl = k.objectsAt(8, k.t);
  k.lanes[8].objs = [{ x0: 12.3 - 1 - k.offset(k.lanes[8], k.t), ph: 0 }];
  e = run(k, 2);
  ok(e.some(x => x.type === 'death' && x.reason === 'carried'), 'tora que sai da maquete leva a capivara junto (morre)');
  void pl;
  // tartaruga mergulha
  const d = new Game(4, { seed: 1 });
  const lane = d.lanes[7];
  ok(lane.dive, 'fase 5 tem tartarugas que mergulham');
  const o = lane.objs[0];
  const tUnder = (TURTLE.under[0] + 0.3) - o.ph + TURTLE.cycle * 3;
  const obj = d.objectsAt(7, tUnder)[0];
  ok(obj.sub === 2 && !d.platformAt(obj.x + 0.5, 7, tUnder), 'tartaruga mergulhada não segura ninguém');
  const tUp = 1 - o.ph + TURTLE.cycle * 3;
  const ob2 = d.objectsAt(7, tUp)[0];
  ok(ob2.sub === 0 && !!d.platformAt(ob2.x + 0.5, 7, tUp), 'tartaruga na superfície segura');
  // jacaré: corpo segura, cabeça morde
  const j = new Game(4, { seed: 3 });
  const tj = 5;
  const jac = j.objectsAt(9, tj).find(o => o.x > 0 && o.x < 9);
  if (jac) {
    const head = jac.v >= 0 ? jac.x + 2 : jac.x, tail = jac.v >= 0 ? jac.x : jac.x + 2;
    ok(j.hazard(head, 9, tj) === 'jacare', 'cabeça do jacaré morde');
    ok(j.hazard(tail, 9, tj) === null, 'rabo do jacaré segura');
  } else ok(false, 'achou jacaré');
}

console.log('Tocas');
{
  const g = quiet(0);
  g.y = 11; g.x = HOMES[2];
  g.lanes[11].objs = [{ x0: -1000, ph: 0 }];
  let e = hop(g, 'up');
  ok(has(e, 'home') && g.homes[2] && g.score > POINTS.home, 'chegar na toca enche a toca e dá pontos');
  run(g, 1);
  ok(g.y === 0 && g.x === 6 && g.alive, 'depois volta para a calçada');
  const h = quiet(0);
  h.y = 11; h.x = 2.5;
  e = hop(h, 'up');
  ok(e.some(x => x.type === 'death' && x.reason === 'bush'), 'pular no mato entre as tocas mata');
  const k = quiet(0);
  k.homes[1] = true; k.y = 11; k.x = HOMES[1];
  e = hop(k, 'up');
  ok(e.some(x => x.type === 'death' && x.reason === 'bush'), 'toca já cheia não aceita outra');
  // garça na toca
  const m = new Game(4, { seed: 2 });
  let tH = -1;
  for (let t = 0; t < 30 && tH < 0; t += 0.1) if (m.heronAt(t) >= 0) tH = t;
  ok(tH >= 0, 'garça aparece nas tocas do mangue');
  const r = m.homeResult(HOMES[m.heronAt(tH)], tH);
  ok(!r.ok && r.reason === 'heron', 'toca com garça mata');
  // todas as tocas: vence
  const w = quiet(0);
  w.homes = [true, true, true, true, false];
  w.y = 11; w.x = HOMES[4];
  e = hop(w, 'up');
  ok(w.over && w.result.won && w.result.stars === 3 && has(e, 'won'), 'enchendo as 5 tocas vence');
}

console.log('Vidas e tempo');
{
  const g = quiet(0);
  g.lifeT = 0.05;
  let e = run(g, 0.1);
  ok(e.some(x => x.type === 'death' && x.reason === 'time') && g.lives === LIVES - 1, 'tempo acabou: perde vida');
  run(g, FREEZE + 0.1);
  ok(g.alive && g.y === 0 && g.lifeT > 20, 'volta para a calçada com o tempo cheio');
  const h = quiet(0, { lives: 1 });
  h.y = 7;
  e = run(h, 0.1);
  ok(h.over && !h.result.won && has(e, 'lost'), 'última vida: fim de jogo');
}

console.log('Chefes e extras');
{
  // cobra no canteiro
  const s = new Game(5, { seed: 1 });
  const sn = s.snakeAt(3);
  ok(sn && s.hazard(sn.x + 0.5, SAFE, 3) === 'snake', 'cobra no canteiro mata');
  ok(new Game(0).snakeAt(3) === null, 'sem cobra na fazenda');
  // trem
  const tr = new Game(3, { seed: 1 });
  let tRun = -1, tWarn = -1;
  for (let t = 0; t < 20; t += 0.05) { const a = tr.trainAt(t); if (a.front != null && a.front > 3 && a.front < 9 && tRun < 0) tRun = t; if (a.warn && tWarn < 0) tWarn = t; }
  ok(tRun >= 0 && tr.hazard(Math.round(tr.trainAt(tRun).front - 1), TRAIN.row, tRun) === 'train', 'trem atropela quem está no trilho');
  ok(tWarn >= 0, 'o sinal do trem pisca antes');
  // sucuri
  const su = new Game(7, { seed: 1 });
  const S = su.sucuriAt(1.5);
  ok(S && RIVER.includes(S.row) && su.hazard(S.head - S.dir * 0.5, S.row, 1.5) === 'sucuri', 'sucuri no rio mata');
  const rows = new Set(); for (let t = 0; t < 40; t += 1) rows.add(su.sucuriAt(t).row);
  ok(rows.size === 5, 'sucuri passa pelas 5 fileiras do rio');
  // tempestade: correnteza inverte
  const st = new Game(11, { seed: 1 });
  const ln = st.lanes[7];
  ok(st.laneSpeed(ln, 1) === ln.v && st.laneSpeed(ln, STORM.half + 1) === -ln.v, 'na tempestade o rio inverte');
  ok(st.stormWarn(STORM.half - 0.5) && !st.stormWarn(1), 'aviso antes de inverter');
  ok(Math.abs(st.offset(ln, STORM.half * 2) - 0) < 1e-9, 'a correnteza vai e volta (posição contínua)');
  // fruta dá bônus
  const f = quiet(0);
  let tF = -1; for (let t = 0; t < 30 && tF < 0; t += 0.1) if (f.fruitAt(t) >= 0) tF = t;
  ok(tF >= 0 && f.homeResult(HOMES[f.fruitAt(tF)], tF).fruit, 'fruta aparece numa toca');
}

console.log('Robô (limites humanos)');
{
  const SEEDS = [1, 2, 3, 4, 5];
  let allOk = true;
  for (let i = 0; i < LEVELS.length; i++) {
    const res = [];
    for (const seed of SEEDS) {
      const g = new Game(i, { seed });
      const bot = makeRobot();
      let steps = 0;
      while (!g.over && steps < 300 / DT) { g.step(bot.step(g)); steps++; }
      res.push(g.result || { won: false, stars: 0, livesLost: 9, time: 300 });
    }
    const won = res.filter(r => r.won).length, two = res.filter(r => r.stars >= 2).length;
    const t = Math.round(res.reduce((s, r) => s + r.time, 0) / res.length);
    console.log(`  fase ${String(i + 1).padStart(2)} ${LEVELS[i].name.padEnd(20)} venceu ${won}/${SEEDS.length}  2+ estrelas ${two}/${SEEDS.length}  vidas perdidas: ${res.map(r => r.livesLost).join(' ')}  ~${t} s`);
    if (won < SEEDS.length || two < SEEDS.length - 1) allOk = false;
  }
  ok(allOk, 'robô vence todas as fases em todas as sementes, com 2 estrelas ou mais em quase todas');
  ok(HUMAN.gap >= 0.3 && HUMAN.half > 0.4, 'limites do robô são humanos');
}

console.log(fails ? `\n${fails} de ${count} verificações FALHARAM` : `\nTudo certo (${count} verificações)`);
process.exit(fails ? 1 : 0);
void TOP;
