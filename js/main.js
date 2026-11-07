// Liga as regras (sim.js) à tela, ao Quest (controles e mãos) e ao mouse/teclado.
import * as THREE from '../vendor/three/three.module.js';
import { Game, DT, LIVES, COLS, ROWS, TOP, HOMES, RIVER } from './sim.js';
import { LEVELS, WORLDS, LEVELS_PER_WORLD } from './levels.js';
import { makeRobot } from './robot.js';
import { buildWorld, Board, cellPos, CELL, TABLE, THEMES } from './scene.js';
import { Panel, Label, C as UI } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave, rankOf, addScore } from './save.js';

const save = loadSave();
const sfx = new Sfx();
sfx.on = save.sound;
sfx.musicOn = save.music;
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIDES = ['left', 'right'];
const BOSS_NAME = { train: 'Trem', sucuri: 'Sucuri', storm: 'Tempestade' };
const DEATH_MSG = {
  hit: 'Atropelada!', water: 'Caiu na água!', carried: 'A correnteza levou para fora!', jacare: 'O jacaré mordeu!',
  snake: 'A cobra pegou!', sucuri: 'A sucuri pegou!', train: 'O trem passou por cima!', bush: 'Toca errada: só nas tocas vazias!',
  heron: 'A garça estava na toca!', time: 'Acabou o tempo!',
};

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_QUEST ? 1 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const world = buildWorld();
const { scene } = world;
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.02, 120);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
const PC_CAM = new THREE.Vector3(0, 1.62, 0.12);
const board = new Board(scene);

const panel = new Panel(0.9);
const fpsLabel = new Label(0.12);
fpsLabel.mesh.position.set(0.16, -0.14, -0.6);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);
const msgLabel = new Label(0.9, 1024, 128);
scene.add(msgLabel.mesh);
msgLabel.mesh.visible = false;

// ---------- Estado ----------
let app = 'menu';
let mode = 'level';
let level = 0;
let game = null;
let robot = makeRobot();
let demo = true;
let msg = null;
let doneTimer = 0;
let lastResult = null, newRecord = false;
let pendingHop = null;
const arcade = { score: 0, lives: LIVES, rank: -1, over: false, letters: [0, 0, 0], slot: 0 };
const unlocked = (i) => i === 0 || !!save.done[i - 1];
const nextLevel = () => { let n = 0; while (n < LEVELS.length - 1 && save.done[n]) n++; return n; };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function newGame(lv, opts = {}) {
  level = clamp(lv, 0, LEVELS.length - 1);
  const L = LEVELS[level];
  world.setTheme(L.world);
  game = new Game(level, opts);
  board.build(game, THEMES[L.world]);
  robot.reset();
  pendingHop = null;
  acc = 0;
  sfx.setSong(L.world, !demo);
}
function startLevel(lv, m = mode) {
  mode = m;
  demo = false;
  arcade.counted = false;
  newGame(lv, { seed: Math.floor(Math.random() * 1e6), lives: mode === 'arcade' ? arcade.lives : LIVES });
  app = 'playing';
  doneTimer = 0;
  panel.hide();
  const L = LEVELS[level], W = WORLDS[L.world];
  const head = level % LEVELS_PER_WORLD === 0 ? `${W.name}. ${W.hint}` : L.boss ? `Chefe: ${L.name}!` : `Fase ${level + 1}: ${L.name}`;
  showMsg(head, 5, '#fbf6e6');
  sfx.coinStart();
  updateHint();
}
function startArcade() { arcade.score = 0; arcade.lives = LIVES; arcade.rank = -1; arcade.over = false; startLevel(0, 'arcade'); }
function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); }
  else if (app === 'paused') { app = 'playing'; panel.hide(); }
  sfx.setSong(LEVELS[level].world, app === 'playing');
  updateHint();
}
function goMenu() {
  app = 'menu';
  demo = !renderer.xr.isPresenting;
  newGame(nextLevel(), { seed: Math.floor(Math.random() * 1e6) });
  showScreen('main');
  updateHint();
}
function showMsg(text, t = 2, color = '#ffe14a') { msg = { text, t, color }; }
const pad6 = (n) => String(Math.max(0, Math.round(n))).padStart(6, '0');
const totalStars = () => Object.values(save.done).reduce((s, d) => s + (d.stars || 0), 0);

// ---------- Menus ----------
function showScreen(name) {
  const vr = renderer.xr.isPresenting;
  placePanel();
  panel.show((p) => {
    if (name === 'main') {
      p.title('Capivara Atravessa', 76, 70);
      p.text('Leve a capivarinha pela estrada e pelo rio até as 5 tocas.', 512, 136, { size: 25, color: UI.dim });
      const next = nextLevel();
      p.button(save.done[0] ? `Continuar: fase ${next + 1}` : 'Começar', () => startLevel(next, 'level'), 262, 172, 500, 86, { size: 38 });
      p.button('Fliperama (as 12 seguidas)', () => startArcade(), 262, 272, 500, 74, { size: 30 });
      p.button('Escolher fase', () => showScreen('levels'), 262, 360, 245, 70, { size: 28 });
      p.button('Recordes', () => showScreen('scores'), 517, 360, 245, 70, { size: 28 });
      p.button('Como jogar', () => showScreen('help'), 262, 444, 500, 66, { size: 28 });
      const opt = (label, key, x, after) => p.button(`${label}: ${save[key] ? 'sim' : 'não'}`, () => { save[key] = !save[key]; storeSave(save); after?.(); showScreen('main'); }, x, 526, 220, 60, { size: 24 });
      opt('Som', 'sound', 152, () => sfx.setOn(save.sound));
      opt('Música', 'music', 402, () => sfx.setMusic(save.music));
      opt('FPS', 'fps', 652);
      p.text(`Estrelas: ${totalStars()} de ${LEVELS.length * 3}${save.scores[0] ? `   ·   Recorde: ${save.scores[0].name} ${save.scores[0].score}` : ''}`, 512, 622, { size: 25, color: UI.star });
      p.text(vr ? 'Aponte e aperte o gatilho para escolher' : 'No Quest: abra esta página no navegador do óculos e aperte "Entrar em VR"', 512, 670, { size: 21, color: UI.dim });
    } else if (name === 'levels') {
      p.title('Escolher fase', 56, 48);
      WORLDS.forEach((W, w) => {
        const y = 100 + w * 190;
        p.text(W.name, 512, y + 6, { size: 26, bold: true, color: ['#8ae05a', '#ffb05a', '#5ff2e0'][w] });
        for (let k = 0; k < LEVELS_PER_WORLD; k++) {
          const i = w * LEVELS_PER_WORLD + k, L = LEVELS[i], d = save.done[i];
          p.tile(112 + k * 205, y + 26, 190, 140, { num: i + 1, name: L.boss ? `Chefe: ${L.name}` : L.name, stars: d?.stars || 0, done: !!d, locked: !unlocked(i), master: !!L.boss, action: () => startLevel(i, 'level') });
        }
      });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 652, 300, 56, { size: 28 });
    } else if (name === 'scores') {
      p.title('Recordes do fliperama', 60, 50);
      if (!save.scores.length) p.text('Ninguém ainda. Jogue o Fliperama: as 12 fases seguidas!', 512, 300, { size: 28, color: UI.dim });
      save.scores.forEach((e, i) => {
        const y = 130 + i * 56, hl = mode === 'arcade' && arcade.over && i === arcade.rank;
        p.text(`${i + 1}.`, 250, y, { size: 34, bold: true, color: hl ? UI.edge : UI.dim, align: 'right' });
        p.text(e.name, 300, y, { size: 38, bold: true, color: hl ? UI.edge : UI.text, align: 'left' });
        p.text(pad6(e.score), 620, y, { size: 38, bold: true, color: hl ? UI.edge : UI.star, align: 'right' });
        p.text(e.level >= 12 ? 'zerou!' : `fase ${e.level}`, 660, y, { size: 26, color: UI.dim, align: 'left' });
      });
      p.button('Fliperama', () => startArcade(), 262, 588, 245, 80, { size: 30 });
      p.button('Voltar', () => showScreen('main'), 517, 588, 245, 80, { size: 30 });
    } else if (name === 'help') {
      p.title('Como jogar', 56);
      const rows = vr ? [
        'Aponte o controle para a casa vizinha da capivara e aperte o gatilho: ela pula.',
        'O manche também pula (empurre para a direção). O anel mostra para onde vai.',
        'Segure o grip e gire a mão para girar a maquete e olhar por outro lado.',
        'Na estrada, fuja dos carros. No rio, só pise em tora, tartaruga e no corpo do jacaré.',
      ] : [
        'Setas ou WASD: pular. Ou clique na casa ao lado da capivara.',
        'Botão direito arrastando (ou Q/E): girar a maquete.',
        'Na estrada, fuja dos carros. No rio, só pise em tora, tartaruga e no corpo do jacaré.',
        'Leve a capivara até as 5 tocas na margem de cima. Esc: pausa.',
      ];
      rows.forEach((t, i) => p.text(t, 50, 112 + i * 46, { size: 23, align: 'left' }));
      const sp = [
        ['Tartaruga que afunda: saia de cima!', '#8ae05a'], ['Jacaré: a cabeça morde', '#5aa04a'],
        ['Garça na toca: não entre', '#f4f4f4'], ['Fruta na toca: +200', '#ffa020'],
        ['Cobra no canteiro do meio', '#c8b040'], ['Tora saindo da maquete leva você', '#d8b080'],
      ];
      sp.forEach(([t, c], i) => p.text(t, 70 + (i % 2) * 460, 316 + Math.floor(i / 2) * 50, { size: 23, align: 'left', color: c }));
      p.text('Cada travessia tem um relógio. 3 estrelas sem perder vida, 2 perdendo uma.', 512, 490, { size: 21, color: UI.dim });
      p.text('Chefes na 4ª fase de cada mundo.', 512, 530, { size: 22, color: UI.dim });
      p.button('Voltar', () => showScreen(app === 'paused' ? 'pause' : 'main'), 362, 600, 300, 76);
    } else if (name === 'pause') {
      p.title('Pausa', 64);
      p.text(`Fase ${level + 1}: ${LEVELS[level].name}${mode === 'arcade' ? '  ·  fliperama' : ''}`, 512, 122, { size: 28, color: UI.dim });
      p.button('Continuar', () => togglePause(), 262, 160, 500, 84);
      p.button(mode === 'arcade' ? 'Recomeçar o fliperama' : 'Recomeçar a fase', () => (mode === 'arcade' ? startArcade() : startLevel(level)), 262, 258, 500, 80, { size: 30 });
      p.button('Recentralizar', () => { recenter(); togglePause(); }, 262, 352, 245, 80, { size: 28, locked: !vr });
      p.button('Como jogar', () => showScreen('help'), 517, 352, 245, 80, { size: 28 });
      p.button(`Som: ${save.sound ? 'sim' : 'não'}`, () => { save.sound = !save.sound; storeSave(save); sfx.setOn(save.sound); showScreen('pause'); }, 262, 446, 245, 72, { size: 26 });
      p.button(`Música: ${save.music ? 'sim' : 'não'}`, () => { save.music = !save.music; storeSave(save); sfx.setMusic(save.music); showScreen('pause'); }, 517, 446, 245, 72, { size: 26 });
      p.button('Menu principal', () => goMenu(), 262, 560, 500, 80);
    } else if (name === 'done') {
      const r = lastResult, d = save.done[level];
      if (r.won) {
        p.title(newRecord ? 'Todas em casa! Recorde!' : 'Todas em casa!', 66, 56);
        p.stars(r.stars, 512, 140, 74);
        p.text(`Tocas ${r.homes}  ·  vidas perdidas ${r.livesLost}  ·  tempo ${r.time.toFixed(0)} s`, 512, 212, { size: 28 });
        p.text(`Pontos ${r.score}  (bônus ${r.bonus})`, 512, 256, { size: 34, bold: true, color: UI.edge });
        p.text('3 estrelas sem perder vida · 2 perdendo uma', 512, 298, { size: 21, color: UI.dim });
        if (d) p.text(`Melhor: ${d.stars} estrela${d.stars === 1 ? '' : 's'} · ${d.score} pontos`, 512, 332, { size: 22, color: UI.dim });
      } else {
        p.title(mode === 'arcade' ? 'Fim de jogo' : 'Acabaram as vidas', 70, 58);
        p.text(`Faltaram ${game.left} tocas`, 512, 160, { size: 32, color: UI.red });
        p.text('Dica: gire a maquete para ver o que vem atrás dos caminhões.', 512, 214, { size: 25 });
      }
      if (mode === 'arcade') {
        p.text(`Fliperama: ${pad6(arcade.score)} pontos  ·  vidas ${arcade.lives}`, 512, 384, { size: 30, bold: true, color: UI.star });
        if (r.won && level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'arcade'), 262, 420, 500, 92, { size: 38 });
        else p.button('Recordes', () => showScreen('scores'), 262, 420, 500, 92, { size: 38 });
        p.button('Menu principal', () => goMenu(), 262, 540, 500, 78);
      } else {
        if (level < LEVELS.length - 1) p.button('Próxima fase', () => startLevel(level + 1, 'level'), 262, 372, 500, 90, { size: 36, locked: !unlocked(level + 1) });
        else if (r.won) p.text('Você levou todas as capivaras para casa!', 512, 416, { size: 34, bold: true, color: UI.edge });
        p.button(r.won ? 'Repetir' : 'Tentar de novo', () => startLevel(level, 'level'), 262, 478, 245, 80);
        p.button('Fases', () => showScreen('levels'), 517, 478, 245, 80);
        p.button('Menu principal', () => goMenu(), 262, 576, 500, 78);
      }
    } else if (name === 'initials') {
      p.title('Novo recorde!', 70, 60);
      p.text(`${pad6(arcade.score)} pontos  ·  ${arcade.rank + 1}º lugar`, 512, 140, { size: 34, bold: true, color: UI.star });
      p.text('Escolha suas 3 letras', 512, 190, { size: 26, color: UI.dim });
      for (let k = 0; k < 3; k++) {
        const x = 292 + k * 160;
        p.button('▲', () => { arcade.letters[k] = (arcade.letters[k] + 1) % LETTERS.length; showScreen('initials'); }, x, 220, 120, 70, { size: 36 });
        p.text(LETTERS[arcade.letters[k]], x + 60, 345, { size: 96, bold: true, color: UI.edge });
        p.button('▼', () => { arcade.letters[k] = (arcade.letters[k] + LETTERS.length - 1) % LETTERS.length; showScreen('initials'); }, x, 400, 120, 70, { size: 36 });
      }
      p.button('Gravar', () => {
        const nm = arcade.letters.map(i => LETTERS[i]).join('');
        save.name = nm;
        addScore(save, nm, arcade.score, arcade.reached);
        storeSave(save);
        app = 'done';
        updateHint();
        showScreen('scores');
      }, 262, 520, 500, 90, { size: 40 });
      p.text(vr ? 'Aponte e aperte o gatilho' : 'Teclado: digite as letras (Enter grava)', 512, 650, { size: 22, color: UI.dim });
    }
  });
}

function placePanel() {
  if (renderer.xr.isPresenting) {
    if (panel.mesh.parent !== scene) scene.add(panel.mesh);
    panel.mesh.scale.setScalar(1);
    const e = new THREE.Euler().setFromQuaternion(xrHeadQuat(), 'YXZ');
    const head = xrHeadPos();
    panel.mesh.position.set(head.x - Math.sin(e.y) * 1.1, head.y - 0.05, head.z - Math.cos(e.y) * 1.1);
    panel.mesh.rotation.set(0, e.y, 0);
    return;
  }
  if (panel.mesh.parent !== camera) camera.add(panel.mesh);
  const half = THREE.MathUtils.degToRad(camera.fov / 2);
  const visH = 2 * 0.8 * Math.tan(half), visW = visH * camera.aspect;
  panel.mesh.position.set(0, 0, -0.8);
  panel.mesh.rotation.set(0, 0, 0);
  panel.mesh.scale.setScalar(Math.min(1, visW * 0.94 / 0.9, visH * 0.92 / 0.633));
}

function finishLevel() {
  const r = game.result;
  lastResult = r;
  const prev = save.done[level];
  newRecord = false;
  if (r.won) {
    newRecord = !!prev && r.score > prev.score;
    save.done[level] = { stars: Math.max(r.stars, prev?.stars || 0), score: Math.max(r.score, prev?.score || 0), time: Math.min(r.time, prev?.time ?? 1e9) };
    storeSave(save);
  }
  if (mode === 'arcade') {
    arcade.score += r.score;
    arcade.counted = true;
    arcade.lives = r.lives + (r.won && LEVELS[level].boss ? 1 : 0);
    arcade.reached = r.won ? level + 2 : level + 1;
    if (!r.won || level === LEVELS.length - 1) {
      arcade.over = true;
      arcade.rank = rankOf(save, arcade.score);
      if (arcade.rank >= 0) {
        arcade.letters = [...(save.name || 'AAA')].map(ch => Math.max(0, LETTERS.indexOf(ch)));
        app = 'initials';
        showScreen('initials');
        updateHint();
        return;
      }
    }
  }
  app = 'done';
  showScreen('done');
  for (let k = 0; k < r.stars; k++) setTimeout(() => sfx.star(k), 300 + k * 220);
  updateHint();
}

// ---------- Controles do VR ----------
const ctrls = [];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  rig.add(ctrl);
  const laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffe14a }));
  laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, laser, source: null, side: null, prevButtons: [], hoverIndex: -1, squeeze: false, stickArmed: true, rot: null, aim: null };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => { entry.source = e.data; entry.side = e.data.handedness; });
  ctrl.addEventListener('disconnected', () => { entry.source = null; entry.side = null; entry.squeeze = false; entry.rot = null; });
  ctrl.addEventListener('selectstart', () => onSelect(entry));
  ctrl.addEventListener('squeezestart', () => { entry.squeeze = true; entry.rot = { yaw: ctrlYaw(entry), board: board.group.rotation.y }; });
  ctrl.addEventListener('squeezeend', () => { entry.squeeze = false; entry.rot = null; });
}
const entryFor = (side) => ctrls.find(e => e.side === side && e.source);
function pulse(side, v, ms) { try { entryFor(side)?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(clamp(v, 0, 1), ms); } catch { /* sem vibração */ } }
const both = (v, ms) => { pulse('left', v, ms); pulse('right', v, ms); };
function ctrlYaw(e) { e.ctrl.getWorldQuaternion(_q); return new THREE.Euler().setFromQuaternion(_q, 'YXZ').y; }
function onSelect(entry) {
  sfx.unlock();
  if (panel.visible) { if (entry.hoverIndex >= 0) { const a = panel.actionAt(entry.hoverIndex); if (a) { sfx.click(); a(); } } return; }
  if (app === 'playing' && entry.aim) pendingHop = entry.aim;
}
// direção do pulo a partir de um ponto apontado na maquete (em casas)
function dirToward(cx, cy) {
  const dx = cx - game.x, dy = cy - game.y;
  if (Math.abs(dx) < 0.45 && Math.abs(dy) < 0.45) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? 'up' : 'down';
  return dx > 0 ? 'right' : 'left';
}
const boardPlane = new THREE.Plane();
function rayToCell(origin, dir) {
  board.group.updateMatrixWorld(true);
  const n = new THREE.Vector3(0, 1, 0).transformDirection(board.group.matrixWorld);
  boardPlane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3().setFromMatrixPosition(board.group.matrixWorld));
  raycaster.set(origin, dir);
  const hit = raycaster.ray.intersectPlane(boardPlane, new THREE.Vector3());
  if (!hit) return null;
  const local = board.group.worldToLocal(hit);
  const cx = local.x / CELL + (COLS - 1) / 2, cy = -local.z / CELL + (ROWS - 1) / 2;
  if (cx < -2 || cx > COLS + 1 || cy < -2 || cy > ROWS + 1) return null;
  return [cx, cy];
}
function pollButtons() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (!gp || e.source.hand) continue;
    const b = gp.buttons.map(x => x.pressed);
    if (b[5] && !e.prevButtons[5] && (app === 'playing' || app === 'paused')) togglePause();
    e.prevButtons = b;
    // manche: um pulo por empurrão ("para a frente" = para longe de quem olha a maquete agora)
    const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
    const m = Math.hypot(ax, ay);
    if (m < 0.3) e.stickArmed = true;
    else if (m > 0.75 && e.stickArmed && app === 'playing') {
      e.stickArmed = false;
      const ang = Math.atan2(ax, -ay) - (xrYaw() - board.group.rotation.y);
      const s = Math.sin(ang), c = Math.cos(ang);
      pendingHop = Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'up' : 'down') : (s > 0 ? 'right' : 'left');
    }
  }
}
function xrYaw() { return new THREE.Euler().setFromQuaternion(xrHeadQuat(), 'YXZ').y; }
// mira (anel na casa para onde vai pular) e giro da maquete com o grip
let aimCell = null;
function updateAim() {
  aimCell = null;
  const vr = renderer.xr.isPresenting;
  if (vr) for (const e of ctrls) if (e.rot && e.source) board.group.rotation.y = e.rot.board + (ctrlYaw(e) - e.rot.yaw);
  if (app !== 'playing' || demo || dev.autoplay || !game.alive) return;
  if (vr) {
    for (const e of ctrls) {
      e.aim = null;
      if (!e.source || e.rot || panel.visible) continue;
      e.ctrl.getWorldPosition(_v2);
      e.ctrl.getWorldQuaternion(_q);
      const c = rayToCell(_v2.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(_q));
      if (!c) continue;
      e.laser.visible = true;
      e.laser.scale.z = _v2.distanceTo(board.group.localToWorld(new THREE.Vector3(...cellPos(c[0], c[1]))));
      const d = dirToward(c[0], c[1]);
      e.aim = d;
      if (d) aimCell = target(d);
    }
  } else if (mouse.has) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const c = rayToCell(raycaster.ray.origin.clone(), raycaster.ray.direction.clone());
    mouse.aim = c ? dirToward(c[0], c[1]) : null;
    if (mouse.aim && !mouse.rotating) aimCell = target(mouse.aim);
  }
}
function target(d) {
  const D = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[d];
  let x = game.x + D[0];
  const y = game.y + D[1];
  if (!RIVER.includes(y)) x = Math.round(x);
  if (y === TOP) { const h = HOMES.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a); if (Math.abs(h - x) < 0.55) x = h; }
  return [x, y, '#ffffff'];
}

// ---------- VR: sessão e recentralizar ----------
let recenterIn = 0;
function xrHeadPos() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldPosition(new THREE.Vector3()) : camera.getWorldPosition(new THREE.Vector3()); }
function xrHeadQuat() { return renderer.xr.isPresenting ? renderer.xr.getCamera().getWorldQuaternion(new THREE.Quaternion()) : camera.getWorldQuaternion(new THREE.Quaternion()); }
function recenter() {
  if (!renderer.xr.isPresenting) return;
  // cabeça em x = 0, z = 0 olhando para a maquete; a altura fica
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  rig.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  rig.position.set(-head.x, 0, -head.z);
  if (panel.visible) placePanel();
}
renderer.xr.addEventListener('sessionstart', () => {
  recenterIn = 6;
  camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  if (app === 'menu') goMenu();
  if (panel.visible) setTimeout(placePanel, 150);
  updateHint();
});
renderer.xr.addEventListener('sessionend', () => {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (app === 'menu') goMenu();
  if (panel.visible) placePanel();
  onResize();
  updateHint();
});

// ---------- Mouse e teclado (PC) ----------
const mouse = { ndc: new THREE.Vector2(0, -0.3), has: false, aim: null, rotating: false, lastX: 0 };
const canvas = renderer.domElement;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.has = true;
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    const a = panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv));
    if (a) { sfx.click(); a(); }
    return;
  }
  if (e.button === 2) { mouse.rotating = true; mouse.lastX = e.clientX; return; }
  if (e.button === 0 && app === 'playing') { updateAim(); if (mouse.aim) pendingHop = mouse.aim; }
});
window.addEventListener('pointerup', (e) => { if (e.button === 2) mouse.rotating = false; });
canvas.addEventListener('pointermove', (e) => {
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.has = true;
  if (mouse.rotating) { board.group.rotation.y += (e.clientX - mouse.lastX) * 0.008; mouse.lastX = e.clientX; }
});
const keyRot = { q: false, e: false };
window.addEventListener('blur', () => { mouse.rotating = false; keyRot.q = keyRot.e = false; });
const KEYDIR = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const k = e.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (app === 'initials') {
    if (/^[a-z0-9]$/.test(k)) { arcade.letters[arcade.slot] = LETTERS.indexOf(k.toUpperCase()); arcade.slot = (arcade.slot + 1) % 3; showScreen('initials'); }
    else if (k === 'enter') panel.buttons.at(-1)?.action?.();
    return;
  }
  if (k === 'q') keyRot.q = true;
  if (k === 'e') keyRot.e = true;
  if (e.repeat) return;
  if (k === 'escape' || k === 'p') { if (app === 'playing' || app === 'paused') togglePause(); return; }
  if (k === 'f') { save.fps = !save.fps; storeSave(save); return; }
  if (KEYDIR[k] && app === 'playing') {
    // as setas seguem a maquete girada: "para cima" é para longe de quem olha
    const order = ['up', 'left', 'down', 'right'];
    const turns = Math.round(board.group.rotation.y / (Math.PI / 2));
    pendingHop = order[(((order.indexOf(KEYDIR[k]) - turns) % 4) + 4) % 4];
  }
});
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === 'q') keyRot.q = false; if (k === 'e') keyRot.e = false; });
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (panel.visible) placePanel();
}
window.addEventListener('resize', onResize);
function updatePcCamera(dt) {
  if (renderer.xr.isPresenting) return;
  if (keyRot.q) board.group.rotation.y += dt * 1.5;
  if (keyRot.e) board.group.rotation.y -= dt * 1.5;
  camera.position.copy(PC_CAM);
  camera.lookAt(0, TABLE.y, TABLE.z - 0.04);
}
function buildInput() {
  if (dev.autoplay || demo) return robot.step(game);
  const h = pendingHop; pendingHop = null;
  return { hop: h };
}

// ---------- Raios do menu ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = false;
    if (!vr || !e.source || !panel.visible) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(_q);
    rayDir.set(0, 0, -1).applyQuaternion(_q);
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.visible = true;
    e.laser.scale.z = hit ? hit.distance : 1.2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    canvas.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else if (!vr) canvas.style.cursor = app === 'playing' ? 'none' : 'default';
  if (panel.visible) panel.setHover(hover);
}

// ---------- HUD ----------
const hintEl = document.getElementById('hint');
const hudEl = document.getElementById('hud');
const msgEl = document.getElementById('msg');
const fpsEl = document.getElementById('fps');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.innerHTML = app === 'playing'
    ? '<span>Setas/WASD ou clique ao lado: pular · botão direito arrastando ou Q/E: girar a maquete · Esc: pausa</span>'
    : app === 'initials' ? '<span>Digite as 3 letras e aperte Enter</span>' : '<span>Clique nas opções do painel</span>';
}
function updateBoard() {
  if (!game || (app === 'menu' && !demo)) { world.setBoard([{ text: 'CAPIVARA ATRAVESSA', x: 512, align: 'center', size: 62, color: '#ffe14a' }]); return; }
  if (app === 'menu') {
    const best = save.scores[0];
    world.setBoard([
      { text: 'CAPIVARA', x: 30, size: 62, color: '#ffe14a' },
      { text: best ? `RECORDE ${best.name} ${pad6(best.score)}` : 'INSIRA FICHA', x: 994, align: 'right', size: 44, color: '#ff6ab8' },
    ]);
    return;
  }
  const score = mode === 'arcade' ? arcade.score + (arcade.counted ? 0 : game.score) : game.score;
  const tl = Math.max(0, Math.ceil(game.lifeT));
  world.setBoard([
    { text: game.boss ? BOSS_NAME[game.boss].toUpperCase() : `FASE ${level + 1}`, x: 22, size: 44, color: game.boss ? '#ff6ab8' : '#5ff2e0', y: 40 },
    { text: `TEMPO ${String(tl).padStart(2, '0')}`, x: 22, size: 40, color: tl <= 8 ? '#ff5a4a' : '#8ae05a', y: 92 },
    { text: pad6(score), x: 600, align: 'center', size: 70, color: '#ffe14a' },
    { text: '♥'.repeat(Math.max(0, game.lives)), x: 1000, align: 'right', size: 56, color: '#ff5a6a' },
  ]);
}
function updateHud(dt) {
  const vr = renderer.xr.isPresenting;
  const playing = (app === 'playing' || app === 'done' || app === 'paused') && !!game && !demo;
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  updateBoard();
  if (!vr) {
    msgLabel.mesh.visible = false;
    hudEl.style.display = playing ? 'block' : 'none';
    if (playing) {
      const L = LEVELS[level];
      const html = `<b>${level + 1}. ${L.name}</b><br><em>${WORLDS[L.world].name}${mode === 'arcade' ? ' · fliperama' : ''}</em>`
        + `<div>Tempo da travessia: ${Math.max(0, Math.ceil(game.lifeT))} s</div>`
        + `<div>Tocas: ${'●'.repeat(5 - game.left)}${'○'.repeat(game.left)} · vidas ${'♥'.repeat(Math.max(0, game.lives))}</div>`;
      if (hudEl.dataset.last !== html) { hudEl.innerHTML = html; hudEl.dataset.last = html; }
    }
    const mtxt = msg && playing ? msg.text : '';
    if (msgEl.dataset.last !== mtxt) { msgEl.textContent = mtxt; msgEl.style.color = msg?.color || '#fff'; msgEl.dataset.last = mtxt; }
    msgEl.style.display = mtxt ? 'block' : 'none';
    return;
  }
  hudEl.style.display = msgEl.style.display = 'none';
  msgLabel.mesh.visible = playing && !!msg;
  if (!playing) return;
  const hp = xrHeadPos(), hq = xrHeadQuat();
  const fwd = _v.set(0, 0, -1).applyQuaternion(hq);
  const up = _v2.set(0, 1, 0).applyQuaternion(hq);
  const k = Math.min(1, dt * 2.5);
  const tgt = hp.clone().addScaledVector(fwd, 1.3).addScaledVector(up, 0.3);
  msgLabel.mesh.position.lerp(tgt, msgLabel.mesh.visible ? k : 1);
  msgLabel.mesh.lookAt(hp);
  if (msg) msgLabel.set([{ text: msg.text, size: 0.62, color: msg.color, bold: false }]);
}

// ---------- Eventos do jogo -> som, vibração, avisos, efeitos ----------
const toWorld = (x, y, h = 0.03) => board.group.localToWorld(new THREE.Vector3(...cellPos(x, y, h))).toArray();
function handleEvents(evs) {
  const quiet = demo;
  for (const ev of evs) {
    switch (ev.type) {
      case 'hop': if (!quiet) { sfx.hop(toWorld(ev.x, ev.y)); both(0.15, 15); } break;
      case 'death': {
        const p = toWorld(ev.x, ev.y);
        burst(p, ev.reason === 'water' || ev.reason === 'carried' ? '#9ad8ff' : '#ff7a5a', 30);
        if (!quiet) {
          const r = ev.reason;
          if (r === 'water' || r === 'carried') sfx.splash(p); else if (r === 'jacare') sfx.chomp(p); else if (r === 'snake' || r === 'sucuri') sfx.hiss(p);
          else if (r === 'heron' || r === 'bush') sfx.bird(p); else if (r === 'time') sfx.timeOut(); else sfx.squash(p);
          sfx.death(); both(0.8, 250);
          showMsg(`${DEATH_MSG[r] || 'Opa!'}${ev.lives > 0 ? (ev.lives === 1 ? ' Última vida!' : ` Restam ${ev.lives}.`) : ''}`, 2.4, '#ff6a5a');
        }
        break;
      }
      case 'home': { const p = toWorld(ev.x, ev.y, 0.05); burst(p, '#ffe14a', 30); if (!quiet) { sfx.home(p); if (ev.fruit) { sfx.fruit(p); showMsg('Pegou a fruta! +200', 1.6, '#ffa020'); } else showMsg(`Em casa! +${ev.bonus}`, 1.4, '#8ae05a'); both(0.4, 60); } break; }
      case 'won': if (!quiet) { sfx.won(); doneTimer = 2.2; showMsg('Todas em casa!', 2.2, '#ffe14a'); } break;
      case 'lost': if (!quiet) { sfx.lost(); both(1, 400); doneTimer = 2.5; } break;
    }
  }
}
// partículas simples (pedacinhos que pulam)
const PCAP = 400;
const pPos = new Float32Array(PCAP * 3), pVel = new Float32Array(PCAP * 3), pLife = new Float32Array(PCAP), pCol = new Float32Array(PCAP * 3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, depthWrite: false }));
pts.frustumCulled = false;
scene.add(pts);
let pNext = 0;
function burst(p, color, n) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % PCAP;
    pPos.set(p, i * 3);
    pVel.set([(Math.random() - 0.5) * 0.6, Math.random() * 0.7, (Math.random() - 0.5) * 0.6], i * 3);
    pCol.set([c.r, c.g, c.b], i * 3);
    pLife[i] = 0.5 + Math.random() * 0.4;
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PCAP; i++) {
    if (pLife[i] <= 0) { pPos[i * 3 + 1] = -10; continue; }
    pLife[i] -= dt;
    pVel[i * 3 + 1] -= 2 * dt;
    for (let j = 0; j < 3; j++) pPos[i * 3 + j] += pVel[i * 3 + j] * dt;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

// ---------- Botão de VR ----------
const vrBtn = document.getElementById('vr');
async function setupVR() {
  const okXR = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!okXR) { vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS'; vrBtn.disabled = true; return; }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) { vrBtn.textContent = 'Erro ao entrar em VR'; console.error(err); }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now(), time = 0;
let fpsFrames = 0, fpsTime = 0;
const _lf = new THREE.Vector3(), _lu = new THREE.Vector3();
let lastWarn = false, lastStorm = false, flash = 0, lastSeg = -1;

function tick(dt) {
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  pollButtons();
  rig.updateMatrixWorld(true);
  updatePcCamera(dt);
  camera.updateMatrixWorld(true);
  updateMenuRays();
  updateAim();

  const running = app === 'playing' || app === 'done' || app === 'menu' || app === 'initials';
  if (running) {
    acc += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    for (let i = 0; i < n; i++) { game.step(buildInput()); handleEvents(game.events); }
    acc -= n * DT;
    if (demo && game.over) newGame(Math.floor(Math.random() * LEVELS.length), { seed: Math.floor(Math.random() * 1e6) });
  } else acc = 0;
  if (app === 'playing' && doneTimer > 0) { doneTimer -= dt; if (doneTimer <= 0) finishLevel(); }

  // avisos do trem, da tempestade e da sucuri
  const live = app === 'playing' && !demo;
  if (game.boss === 'train') {
    const tr = game.trainAt(game.t);
    if (live && (tr.warn || tr.front != null)) { sfx.bell(toWorld(-1, 3)); if (tr.front != null) sfx.train(toWorld(clamp(tr.front, 0, 12), 3)); }
    if (live && tr.warn && !lastWarn) showMsg('Trem vindo! Saia do trilho', 1.4, '#ff6a5a');
    lastWarn = tr.warn;
  }
  if (game.boss === 'storm') {
    const w = game.stormWarn(game.t);
    if (w && !lastStorm) { flash = 0.35; if (live) { sfx.thunder(); showMsg('Relâmpago! A correnteza vai virar', 1.2, '#c8d8ff'); } }
    lastStorm = w;
  }
  flash = Math.max(0, flash - dt);
  world.flash(flash > 0 ? (Math.floor(flash * 20) % 2 ? 1 : 0.3) : 0);
  if (game.boss === 'sucuri') {
    const seg = Math.floor(game.t / 4);
    if (seg !== lastSeg && live) { const s = game.sucuriAt(game.t); sfx.hiss(toWorld(clamp(s.head, 0, 12), s.row)); }
    lastSeg = seg;
  }

  board.update(game, time, live ? aimCell : null);
  if (app !== 'paused') updateParticles(dt);
  world.update(app === 'paused' ? 0 : dt, time);
  updateHud(dt);

  if (sfx.ctx) {
    const hq = xrHeadQuat();
    sfx.setListener(xrHeadPos(), _lf.set(0, 0, -1).applyQuaternion(hq), _lu.set(0, 1, 0).applyQuaternion(hq));
  }
  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  tick(dt);
  renderer.render(scene, camera);
}

// ---------- Depuração (console do navegador) ----------
// dev.loadLevel(5) · dev.autoplay = true · dev.advance(20) · dev.state() · dev.snapshot() · dev.arcade() · dev.hop('up') · dev.resetSave()
const dev = {
  _auto: false,
  get autoplay() { return this._auto; },
  set autoplay(v) { this._auto = !!v; robot.reset(); updateHint(); },
  loadLevel(n) { startLevel(clamp(n, 1, LEVELS.length) - 1, 'level'); return this.state(); },
  arcade() { startArcade(); return this.state(); },
  hop(d) { pendingHop = d; },
  advance(sec, step = 1 / 72) {
    const frames = Math.round(sec / step);
    for (let i = 0; i < frames; i++) tick(step);
    lastT = performance.now();
    renderer.render(scene, camera);
    return this.state();
  },
  state() {
    return {
      tela: app, modo: mode, fase: level + 1, nome: LEVELS[level].name, mundo: WORLDS[LEVELS[level].world].name,
      tempo: +game.t.toFixed(1), vidas: game.lives, pontos: game.score, fliperama: mode === 'arcade' ? arcade.score : null,
      capivara: { x: +game.x.toFixed(2), y: game.y, viva: game.alive, relogio: +game.lifeT.toFixed(1) }, tocas: game.homes.slice(),
      resultado: game.result, salvo: save.done[level] || null,
    };
  },
  snapshot(w = 960) {
    renderer.render(scene, camera);
    const src = renderer.domElement, c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * src.height / src.width);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  },
  resetSave() { save.done = {}; save.scores = []; storeSave(save); },
};
window.dev = dev;
window.capivara = { dev, get game() { return game; }, save, sfx, robot, board, startLevel, startArcade, goMenu, camera, scene, renderer };

goMenu();
renderer.setAnimationLoop(frame);
