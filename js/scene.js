// Tudo que se vê na Capivara Atravessa: a maquete na mesa (calçada, estrada, canteiro, rio e as
// tocas), os veículos, toras, tartarugas, jacarés, a capivara, garça, fruta, cobra, trem, sucuri,
// os 3 cenários em volta e o letreiro do placar. Texturas desenhadas em canvas.
import * as THREE from '../vendor/three/three.module.js';
import { COLS, ROWS, HOMES, ROAD, RIVER, SAFE, TOP, TRAIN } from './sim.js';

export const CELL = 0.07;
export const TABLE = { y: 0.84, z: -0.62 };
export const THEMES = [
  { name: 'fazenda', bg: '#9ad4f0', sky: ['#5ab0e8', '#cdeaf6'], fog: '#cdeaf6', hemi: ['#ffffff', '#7a6a4a', 1.6], sun: ['#fff4dc', 1.5], water: '#3a9ad0', grass: '#6ac04a', bank: '#4a9a3a', glow: '#ffd25a', ground: '#7ab04a' },
  { name: 'mangue', bg: '#e8a070', sky: ['#5a6aa8', '#f0a878'], fog: '#e0a880', hemi: ['#ffe0c0', '#4a4a3a', 1.5], sun: ['#ffc890', 1.3], water: '#4a8a7a', grass: '#7aa04a', bank: '#5a7a3a', glow: '#ff9a5a', ground: '#6a6a4a' },
  { name: 'pantanal', bg: '#1a2448', sky: ['#0e1430', '#3a3a6a'], fog: '#2a3058', hemi: ['#b8c8ff', '#3a3a3a', 1.45], sun: ['#d0dcff', 1.0], water: '#2a5a8a', grass: '#4a8a4a', bank: '#3a6a3a', glow: '#5ff2e0', ground: '#2a3a2a' },
];

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (() => { let s = 777; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

function glowTexture() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
function skyTex(th) {
  return canvasTex(64, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.6, th.sky[1]); gr.addColorStop(1, th.fog);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (th.name === 'pantanal') for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; g.fillRect(rnd() * w, rnd() * h * 0.55, 1, 1); }
  });
}
// tabuleiro da maquete: uma textura para as 13 fileiras
function boardTex(th, rail) {
  const px = 32;
  return canvasTex(COLS * px, ROWS * px, (g, w, h) => {
    const rowY = (r) => h - (r + 1) * px;
    for (let r = 0; r < ROWS; r++) {
      const y = rowY(r);
      if (r === 0) { g.fillStyle = '#b8b0a0'; g.fillRect(0, y, w, px); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 1, px); } }
      else if (ROAD.includes(r)) {
        g.fillStyle = '#4a4a50'; g.fillRect(0, y, w, px);
        for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`; g.fillRect(rnd() * w, y + rnd() * px, 2, 2); }
        if (r === rail) {
          g.fillStyle = '#6a5040'; for (let x = 2; x < w; x += 10) g.fillRect(x, y + 4, 5, px - 8);
          g.fillStyle = '#c8c8d0'; g.fillRect(0, y + 9, w, 3); g.fillRect(0, y + px - 12, w, 3);
        } else if (r < 5) { g.fillStyle = '#f0f0e8'; for (let x = 6; x < w; x += 28) g.fillRect(x, y + px - 2, 14, 3); }
      } else if (r === SAFE) {
        g.fillStyle = th.grass; g.fillRect(0, y, w, px);
        for (let k = 0; k < 400; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,200,0.2)' : 'rgba(0,40,0,0.2)'; g.fillRect(rnd() * w, y + rnd() * px, 1, 3); }
      } else if (r === TOP) {
        g.fillStyle = th.bank; g.fillRect(0, y, w, px);
        for (let k = 0; k < 500; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(20,60,10,0.5)' : 'rgba(150,200,90,0.3)'; g.fillRect(rnd() * w, y + rnd() * px, 2, 2); }
        for (const hx of HOMES) {
          const cx = (hx + 0.5) * px;
          g.fillStyle = '#c8a070'; g.fillRect(cx - px * 0.48, y + 2, px * 0.96, px - 2);
          g.fillStyle = '#3a2410'; g.beginPath(); g.ellipse(cx, y + px * 0.55, px * 0.33, px * 0.3, 0, 0, Math.PI * 2); g.fill();
        }
      } else {
        g.fillStyle = th.water; g.fillRect(0, y, w, px);
      }
    }
    // margens do rio
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, rowY(11) - 1, w, 2); g.fillRect(0, rowY(6) - 1, w, 2);
  });
}
function waterTex(th) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = th.water; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.2})`; g.lineWidth = 1.5; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.stroke(); }
  }, [3, 1]);
}
function woodTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#8a5a30'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(${rnd() < 0.5 ? '50,25,5' : '200,150,90'},0.2)`; g.lineWidth = 1 + rnd() * 2; const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + rnd() * 6 - 3); g.stroke(); }
  }, [2, 2]);
}

// ---------- mundo ----------
export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#000', 10, 40);
  const hemi = new THREE.HemisphereLight('#fff', '#333', 1.5);
  const sun = new THREE.DirectionalLight('#fff', 1.3);
  sun.position.set(1.5, 5, 2);
  scene.add(hemi, sun);
  const glowTex = glowTexture();

  const themes = THEMES.map((th) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex(th), side: THREE.BackSide, fog: false, depthWrite: false })));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(45, 40), lam(th.ground));
    ground.rotation.x = -Math.PI / 2; g.add(ground);
    if (th.name === 'fazenda') {
      // cerca, celeiro e fardos de feno
      const wood = lam('#a87a4a');
      for (let k = 0; k < 24; k++) { const a = (-90 + k * 7.8) * Math.PI / 180; const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), wood); p.position.set(Math.sin(a) * 6, 0.5, -Math.cos(a) * 6); g.add(p); }
      const rail = new THREE.Mesh(new THREE.TorusGeometry(6, 0.03, 4, 60, Math.PI), wood); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI; rail.position.y = 0.75; g.add(rail);
      const barn = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), lam('#b83a2a')); b.position.y = 1.5; barn.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), lam('#5a3a2a')); roof.position.y = 3.8; roof.rotation.y = Math.PI / 4; barn.add(roof);
      barn.position.set(-9, 0, -14); barn.rotation.y = 0.4; g.add(barn);
      for (let k = 0; k < 5; k++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 14), lam('#e0c060')); h.rotation.z = Math.PI / 2; h.position.set(6 + k * 1.3, 0.5, -10 - k * 0.8); g.add(h); }
      for (let k = 0; k < 8; k++) { const a = (-70 + k * 20) * Math.PI / 180; const t = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), lam('#3a8a3a')); t.position.set(Math.sin(a) * 20, 2, -Math.cos(a) * 20); g.add(t); }
    } else if (th.name === 'mangue') {
      const water = new THREE.Mesh(new THREE.CircleGeometry(40, 40), lam('#4a8a7a', { transparent: true, opacity: 0.9 }));
      water.rotation.x = -Math.PI / 2; water.position.y = 0.02; water.scale.set(1, 0.6, 1); water.position.z = -18; g.add(water);
      const root = lam('#5a4030');
      for (let k = 0; k < 14; k++) {
        const a = (-80 + k * 12) * Math.PI / 180, r = 8 + (k % 3) * 3;
        const tree = new THREE.Group();
        for (let j = 0; j < 5; j++) { const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.6), root); rr.position.set(Math.cos(j * 1.3) * 0.4, 0.6, Math.sin(j * 1.3) * 0.4); rr.rotation.set(Math.sin(j) * 0.5, 0, Math.cos(j) * 0.5); tree.add(rr); }
        const top = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), lam('#2a6a3a')); top.position.y = 2.2; top.scale.y = 0.7; tree.add(top);
        tree.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); g.add(tree);
      }
      const sunDisk = new THREE.Mesh(new THREE.CircleGeometry(3, 32), basic('#ffd8a0')); sunDisk.position.set(12, 6, -40); sunDisk.lookAt(0, 1.6, 0); g.add(sunDisk);
    } else {
      // pantanal à noite: lua, carandás e vaga-lumes
      const moon = new THREE.Mesh(new THREE.CircleGeometry(2, 32), basic('#fff6d8')); moon.position.set(-10, 14, -38); moon.lookAt(0, 1.6, 0); g.add(moon);
      const mh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff2c0', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); mh.scale.setScalar(10); mh.position.copy(moon.position); g.add(mh);
      for (let k = 0; k < 10; k++) {
        const a = (-80 + k * 17) * Math.PI / 180, r = 9 + (k % 3) * 3;
        const tr = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4, 8), lam('#4a3a2a')); trunk.position.y = 2; tr.add(trunk);
        const fan = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 6), lam('#2a5a3a')); fan.position.y = 4.2; fan.scale.y = 0.5; tr.add(fan);
        tr.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); g.add(tr);
      }
      const ff = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), basic('#d8ff6a'), 60);
      const m = new THREE.Matrix4();
      const seeds = [];
      for (let k = 0; k < 60; k++) { seeds.push([(rnd() - 0.5) * 12, 0.4 + rnd() * 2.5, -2 - rnd() * 10, rnd() * 6]); m.setPosition(...seeds[k].slice(0, 3)); ff.setMatrixAt(k, m); }
      g.add(ff);
      g.userData.ff = { mesh: ff, seeds };
    }
    g.visible = false;
    scene.add(g);
    return g;
  });

  // mesa
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), new THREE.MeshLambertMaterial({ map: woodTex() }));
  top.position.y = TABLE.y - 0.06; table.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, TABLE.y - 0.08, 0.06), lam('#6a4020')); leg.position.set(sx * 0.54, (TABLE.y - 0.08) / 2, sz * 0.54); table.add(leg); }
  table.position.z = TABLE.z;
  scene.add(table);

  // letreiro do placar atrás da maquete
  const marquee = new THREE.Group();
  const MW = 1.5;
  marquee.add(new THREE.Mesh(new THREE.BoxGeometry(MW, 0.26, 0.06), lam('#1a1420')));
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024; boardCanvas.height = 128;
  const boardTexC = new THREE.CanvasTexture(boardCanvas); boardTexC.colorSpace = THREE.SRGBColorSpace;
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(MW - 0.08, 0.2), new THREE.MeshBasicMaterial({ map: boardTexC, toneMapped: false }));
  bm.position.z = 0.031; marquee.add(bm);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 30);
  for (let k = 0; k < 30; k++) {
    const m = new THREE.Matrix4();
    m.setPosition(k < 15 ? -MW / 2 + 0.05 + k * (MW - 0.1) / 14 : MW / 2 - 0.05 - (k - 15) * (MW - 0.1) / 14, k < 15 ? 0.12 : -0.12, 0.035);
    bulbs.setMatrixAt(k, m); bulbs.setColorAt(k, new THREE.Color('#ffd25a'));
  }
  marquee.add(bulbs);
  for (const x of [-MW / 2 + 0.04, MW / 2 - 0.04]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6), lam('#3a3a3a')); p.position.set(x, -0.42, -0.02); marquee.add(p); }
  marquee.position.set(0, TABLE.y + 0.7, TABLE.z - 0.62);
  marquee.rotation.x = 0.15;
  scene.add(marquee);

  let cur = -1;
  const base = { hemi: 1.5 };
  return {
    scene, themes, glowTex, marquee, hemi,
    setTheme(i) {
      if (i === cur) return;
      cur = i;
      const th = THEMES[i];
      themes.forEach((g, k) => { g.visible = k === i; });
      scene.background = new THREE.Color(th.bg);
      scene.fog.color.set(th.fog);
      hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = base.hemi = th.hemi[2];
      sun.color.set(th.sun[0]); sun.intensity = th.sun[1];
    },
    flash(f) { hemi.intensity = base.hemi + f * 3; },
    update(dt, time) {
      const g = themes[cur];
      const ff = g?.userData.ff;
      if (ff) {
        const m = new THREE.Matrix4();
        ff.seeds.forEach((s, k) => { m.setPosition(s[0] + Math.sin(time * 0.5 + s[3]) * 0.4, s[1] + Math.sin(time * 0.8 + s[3] * 2) * 0.2, s[2]); ff.mesh.setMatrixAt(k, m); });
        ff.mesh.instanceMatrix.needsUpdate = true;
      }
      const c = new THREE.Color();
      for (let k = 0; k < 30; k++) { c.set((Math.floor(time * 6) + k) % 3 === 0 ? THEMES[cur].glow : '#3a2a1a'); bulbs.setColorAt(k, c); }
      bulbs.instanceColor.needsUpdate = true;
    },
    setBoard(lines) {
      const key = JSON.stringify(lines);
      if (key === this._board) return;
      this._board = key;
      const g = boardCanvas.getContext('2d'), w = 1024, h = 128;
      g.fillStyle = '#0a0610'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let x = 4; x < w; x += 8) for (let y = 4; y < h; y += 8) g.fillRect(x, y, 3, 3);
      g.textBaseline = 'middle';
      for (const l of lines) {
        g.font = `bold ${l.size || 54}px monospace`; g.textAlign = l.align || 'left';
        g.fillStyle = l.color || '#ffd25a'; g.shadowColor = l.color || '#ffd25a'; g.shadowBlur = 12;
        g.fillText(l.text, l.x, l.y ?? h / 2);
      }
      g.shadowBlur = 0;
      boardTexC.needsUpdate = true;
    },
  };
}

// ---------- maquete (gira com a mão) ----------
// local: casa (x, y) fica em ((x - 6) * CELL, 0, -(y - 6) * CELL)
export const cellPos = (x, y, h = 0) => [(x - (COLS - 1) / 2) * CELL, h, -(y - (ROWS - 1) / 2) * CELL];

export class Board {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, TABLE.y, TABLE.z);
    scene.add(this.group);
    // planos que cortam o que passa da beira da maquete (os carros dão a volta por fora)
    this.clipL = new THREE.Plane(); this.clipR = new THREE.Plane();
    this.clip = [this.clipL, this.clipR];
    this.dyn = new THREE.Group();
    this.group.add(this.dyn);
    this.static = null;
    this.lanesView = [];
  }
  updateClip() {
    this.group.updateMatrixWorld(true);
    const half = (COLS / 2) * CELL;
    const m = this.group.matrixWorld;
    const nL = new THREE.Vector3(1, 0, 0).transformDirection(m), nR = new THREE.Vector3(-1, 0, 0).transformDirection(m);
    const pL = new THREE.Vector3(-half, 0, 0).applyMatrix4(m), pR = new THREE.Vector3(half, 0, 0).applyMatrix4(m);
    this.clipL.setFromNormalAndCoplanarPoint(nL, pL);
    this.clipR.setFromNormalAndCoplanarPoint(nR, pR);
  }
  mat(color, extra = {}) { return new THREE.MeshLambertMaterial({ color, clippingPlanes: this.clip, ...extra }); }

  build(game, th) {
    if (this.static) { this.group.remove(this.static); }
    while (this.dyn.children.length) this.dyn.remove(this.dyn.children[0]);
    const s = this.static = new THREE.Group();
    const W = COLS * CELL, H = ROWS * CELL;
    const rail = game.boss === 'train' ? TRAIN.row : -1;
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, H), [lam('#5a4030'), lam('#5a4030'), new THREE.MeshLambertMaterial({ map: boardTex(th, rail) }), lam('#5a4030'), lam('#5a4030'), lam('#5a4030')]);
    base.position.y = -0.015; s.add(base);
    // água animada por cima do rio (um pouco abaixo da margem)
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W, RIVER.length * CELL), new THREE.MeshLambertMaterial({ map: waterTex(th), transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.002, cellPos(0, 9)[2]);
    s.add(water);
    this.water = water;
    // moldura de madeira
    const frameM = lam('#7a4a24');
    for (const [w, d, x, z] of [[W + 0.04, 0.02, 0, H / 2 + 0.01], [W + 0.04, 0.02, 0, -H / 2 - 0.01], [0.02, H, W / 2 + 0.01, 0], [0.02, H, -W / 2 - 0.01, 0]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), frameM); f.position.set(x, 0.005, z); s.add(f);
    }
    // arbustos entre as tocas
    const bush = lam('#2a7a2a');
    for (let x = 0; x < COLS; x++) {
      if (HOMES.includes(x)) continue;
      const b = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.48, 8, 6), bush);
      const p = cellPos(x, TOP, CELL * 0.25); b.position.set(...p); b.scale.y = 0.8; s.add(b);
    }
    // sinal do trem
    if (rail >= 0) {
      this.signals = [-1, 1].map(sd => {
        const p = cellPos(sd < 0 ? -0.9 : COLS - 0.1, rail, 0);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1), lam('#3a3a3a')); post.position.set(p[0], 0.05, p[2] + 0.03); s.add(post);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), basic('#3a0a0a')); light.position.set(p[0], 0.1, p[2] + 0.03); s.add(light);
        return light;
      });
    } else this.signals = null;
    this.group.add(s);

    // objetos das faixas (um por objeto da fase)
    this.lanesView = [];
    for (let row = 0; row < ROWS; row++) {
      const lane = game.lanes[row];
      if (!lane || lane.t === 'rail') { this.lanesView[row] = null; continue; }
      this.lanesView[row] = lane.objs.map((_, k) => { const m = this.makeObj(lane.t, lane.len, lane.v, k, row); this.dyn.add(m); return m; });
    }
    // capivara, mira, garça, fruta, cobra, trem, sucuri
    this.capy = this.makeCapy(); this.dyn.add(this.capy);
    this.aim = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.3, CELL * 0.42, 20), basic('#ffffff', { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.aim.rotation.x = -Math.PI / 2; this.dyn.add(this.aim);
    this.heron = this.makeHeron(th.name === 'pantanal'); this.dyn.add(this.heron);
    this.fruit = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.22, 10, 8), lam('#ffa020', { emissive: '#4a2000' })); this.dyn.add(this.fruit);
    this.homeCapys = HOMES.map(h => { const c = this.makeCapy(); c.position.set(...cellPos(h, TOP, 0.0)); c.scale.setScalar(0.85); c.visible = false; this.dyn.add(c); return c; });
    this.snake = game.L.snake ? this.makeSnake(2, '#3a9a2a', 0.18) : null;
    if (this.snake) this.dyn.add(this.snake);
    this.train = game.boss === 'train' ? this.makeTrain() : null;
    if (this.train) this.dyn.add(this.train);
    this.sucuri = game.boss === 'sucuri' ? this.makeSnake(4, '#4a6a2a', 0.32) : null;
    if (this.sucuri) this.dyn.add(this.sucuri);
  }

  makeObj(kind, len, v, k, row) {
    const g = new THREE.Group();
    const dir = v >= 0 ? 1 : -1;
    const L = len * CELL;
    const colors = ['#e8443a', '#3a8ae8', '#f0c020', '#e86ab8', '#ffffff', '#5ad0c0'];
    const col = colors[(k + row * 2) % colors.length];
    if (kind === 'car') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, CELL * 0.32, CELL * 0.62), this.mat(col)); body.position.y = CELL * 0.26; g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, CELL * 0.26, CELL * 0.56), this.mat('#cfe8ff')); cab.position.set(-dir * L * 0.05, CELL * 0.52, 0); g.add(cab);
      this.wheels(g, L, 4);
      const lightM = this.mat('#fff8c0', { emissive: '#fff8c0' });
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.004, CELL * 0.08, CELL * 0.12), lightM); l.position.set(dir * L * 0.45, CELL * 0.28, s * CELL * 0.2); g.add(l); }
    } else if (kind === 'moto') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, CELL * 0.22, CELL * 0.18), this.mat(col)); body.position.y = CELL * 0.3; g.add(body);
      const rider = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.16, 8, 6), this.mat('#2a2a2a')); rider.position.set(-dir * L * 0.1, CELL * 0.62, 0); g.add(rider);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.17, CELL * 0.17, CELL * 0.08, 10), this.mat('#1a1a1a')); w.rotation.x = Math.PI / 2; w.position.set(s * L * 0.32, CELL * 0.17, 0); g.add(w); }
    } else if (kind === 'trator') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(L * 0.55, CELL * 0.4, CELL * 0.5), this.mat('#3a9a3a')); body.position.set(dir * L * 0.15, CELL * 0.32, 0); g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, CELL * 0.5, CELL * 0.5), this.mat('#f0c020')); cab.position.set(-dir * L * 0.15, CELL * 0.6, 0); g.add(cab);
      for (const s of [-1, 1]) {
        const big = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.3, CELL * 0.3, CELL * 0.12, 12), this.mat('#1a1a1a')); big.rotation.x = Math.PI / 2; big.position.set(-dir * L * 0.2, CELL * 0.3, s * CELL * 0.32); g.add(big);
        const sm = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.17, CELL * 0.17, CELL * 0.1, 10), this.mat('#1a1a1a')); sm.rotation.x = Math.PI / 2; sm.position.set(dir * L * 0.32, CELL * 0.17, s * CELL * 0.28); g.add(sm);
      }
    } else if (kind === 'truck') {
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(L * 0.72, CELL * 0.6, CELL * 0.66), this.mat(['#e0e0e0', '#c86a2a', '#5a7ac8'][k % 3])); cargo.position.set(-dir * L * 0.12, CELL * 0.45, 0); g.add(cargo);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, CELL * 0.48, CELL * 0.62), this.mat(col)); cab.position.set(dir * L * 0.36, CELL * 0.38, 0); g.add(cab);
      this.wheels(g, L, 6);
    } else if (kind === 'log') {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.36, CELL * 0.36, L * 0.96, 12), this.mat('#8a5a30')); log.rotation.z = Math.PI / 2; log.position.y = CELL * 0.12; g.add(log);
      for (const s of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.34, 12), this.mat('#d8b080')); end.position.set(s * L * 0.481, CELL * 0.12, 0); end.rotation.y = s * Math.PI / 2; g.add(end); }
    } else if (kind === 'turtle') {
      g.userData.shells = [];
      for (let j = 0; j < len; j++) {
        const t = new THREE.Group();
        const shell = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('#3a7a3a')); t.add(shell);
        const head = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.12, 8, 6), this.mat('#8ab05a')); head.position.set(dir * CELL * 0.42, CELL * 0.06, 0); t.add(head);
        t.position.set((j + 0.5) * CELL - L / 2, 0, 0);
        g.add(t); g.userData.shells.push(t);
      }
    } else if (kind === 'jacare') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(L * 0.66, CELL * 0.26, CELL * 0.55), this.mat('#3a6a2a')); body.position.set(-dir * L * 0.12, CELL * 0.08, 0); g.add(body);
      for (let j = 0; j < 5; j++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.07, CELL * 0.14, 4), this.mat('#2a5a1a')); sp.position.set(-dir * L * 0.4 + dir * j * L * 0.13, CELL * 0.26, 0); g.add(sp); }
      const head = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, CELL * 0.2, CELL * 0.42), this.mat('#4a7a2a')); head.position.set(dir * L * 0.34, CELL * 0.08, 0); g.add(head);
      for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.07, 8, 6), this.mat('#ffe85a', { emissive: '#4a3a00' })); eye.position.set(dir * L * 0.28, CELL * 0.2, s * CELL * 0.13); g.add(eye); }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.18, L * 0.22, 6), this.mat('#3a6a2a')); tail.rotation.z = dir * Math.PI / 2; tail.position.set(-dir * L * 0.5, CELL * 0.06, 0); g.add(tail);
    }
    g.userData.kind = kind; g.userData.len = len;
    return g;
  }
  wheels(g, L, n) {
    const m = this.mat('#1a1a1a');
    const per = n / 2;
    for (let j = 0; j < per; j++) for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.14, CELL * 0.14, CELL * 0.08, 10), m);
      w.rotation.x = Math.PI / 2; w.position.set(-L * 0.35 + j * (L * 0.7) / Math.max(1, per - 1), CELL * 0.14, s * CELL * 0.31); g.add(w);
    }
  }
  makeCapy() {
    const g = new THREE.Group();
    const fur = lam('#a0703a'), dark = lam('#5a3a1a');
    const body = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.34, 14, 10), fur); body.scale.set(0.9, 0.85, 1.25); body.position.y = CELL * 0.32; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.34, CELL * 0.32, CELL * 0.4), fur); head.position.set(0, CELL * 0.5, -CELL * 0.4); g.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.3, CELL * 0.2, CELL * 0.08), dark); nose.position.set(0, CELL * 0.44, -CELL * 0.6); g.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.07, 6, 5), dark); ear.position.set(s * CELL * 0.14, CELL * 0.7, -CELL * 0.3); g.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.04, 6, 5), lam('#111')); eye.position.set(s * CELL * 0.17, CELL * 0.56, -CELL * 0.5); g.add(eye);
      for (const f of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.06, CELL * 0.06, CELL * 0.2), dark); leg.position.set(s * CELL * 0.18, CELL * 0.1, f * CELL * 0.2); g.add(leg); }
    }
    return g;
  }
  makeHeron(tuiuiu) {
    const g = new THREE.Group();
    const white = lam('#f4f4f4');
    const body = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.3, 10, 8), white); body.scale.set(0.8, 0.9, 1.3); body.position.y = CELL * 0.75; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.05, CELL * 0.07, CELL * 0.6), tuiuiu ? lam('#1a1a1a') : white); neck.position.set(0, CELL * 1.15, -CELL * 0.2); neck.rotation.x = 0.4; g.add(neck);
    if (tuiuiu) { const collar = new THREE.Mesh(new THREE.TorusGeometry(CELL * 0.08, CELL * 0.03, 6, 10), lam('#e8302a')); collar.position.set(0, CELL * 0.95, -CELL * 0.12); collar.rotation.x = Math.PI / 2; g.add(collar); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.1, 8, 6), tuiuiu ? lam('#1a1a1a') : white); head.position.set(0, CELL * 1.45, -CELL * 0.32); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(CELL * 0.04, CELL * 0.4, 6), lam(tuiuiu ? '#2a2a2a' : '#ffb020')); beak.rotation.x = -Math.PI / 2 - 0.4; beak.position.set(0, CELL * 1.36, -CELL * 0.55); g.add(beak);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(CELL * 0.02, CELL * 0.02, CELL * 0.5), lam('#2a2a2a')); leg.position.set(s * CELL * 0.08, CELL * 0.25, 0); g.add(leg); }
    g.visible = false;
    return g;
  }
  makeSnake(len, color, thick) {
    const g = new THREE.Group();
    g.userData.segs = [];
    const n = len * 3;
    for (let j = 0; j < n; j++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(CELL * thick * (j === 0 ? 1.3 : 1 - j / n * 0.5), 10, 8), this.mat(j % 2 ? color : '#c8b040'));
      g.add(seg); g.userData.segs.push(seg);
    }
    const eyeM = this.mat('#ff3a2a', { emissive: '#ff3a2a' });
    const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(CELL * thick * 0.3, 6, 5), eyeM); g.userData.segs[0].add(e); e.position.set(0, CELL * thick * 0.6, s * CELL * thick * 0.6); return e; });
    void eyes;
    g.userData.len = len;
    return g;
  }
  makeTrain() {
    const g = new THREE.Group();
    const cars = Math.round(TRAIN.len / 3);
    for (let j = 0; j < cars; j++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(CELL * 2.8, CELL * 0.7, CELL * 0.7), this.mat(j === 0 ? '#c83a2a' : ['#3a5a8a', '#8a6a3a'][j % 2]));
      c.position.set(-j * CELL * 3 - CELL * 1.5, CELL * 0.4, 0); g.add(c);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.15, 8, 6), this.mat('#fff8c0', { emissive: '#fff8c0' })); lamp.position.set(0, CELL * 0.5, 0); g.add(lamp);
    g.visible = false;
    return g;
  }

  // posiciona tudo no tempo do jogo
  update(game, time, aimCell) {
    this.updateClip();
    const t = game.t;
    if (this.water) this.water.material.map.offset.x = (time * 0.05) % 1;
    for (let row = 0; row < ROWS; row++) {
      const views = this.lanesView[row];
      if (!views) continue;
      const objs = game.objectsAt(row, t);
      objs.forEach((o, k) => {
        const g = views[k];
        const c = cellPos(o.x - 0.5 + o.len / 2, row, 0);
        g.position.set(c[0], c[1], c[2]);
        // vira para o lado que anda (na Tempestade o rio muda de lado)
        g.scale.x = o.v >= 0 === game.lanes[row].v >= 0 ? 1 : -1;
        if (o.kind === 'turtle') {
          const y = o.sub === 2 ? -CELL * 0.5 : o.sub === 1 ? -CELL * 0.15 * (1 + Math.sin(time * 20)) : 0;
          for (const sh of g.userData.shells) sh.position.y = y;
        }
        if (o.kind === 'log') g.position.y = Math.sin(time * 2 + k) * 0.002;
      });
    }
    // capivara (pulo em arco)
    const capy = this.capy;
    capy.visible = game.alive && !(game.freeze > 0 && !game.homeFreeze);
    const f = game.hopT;
    const x = game.from[0] + (game.x - game.from[0]) * f, y = game.from[1] + (game.y - game.from[1]) * f;
    const p = cellPos(x, y, Math.sin(f * Math.PI) * CELL * 0.6);
    capy.position.set(...p);
    const dx = game.x - game.from[0], dy = game.y - game.from[1];
    if (Math.abs(dx) + Math.abs(dy) > 0.1) capy.rotation.y = Math.atan2(-dx, dy);
    if (game.freeze > 0 && game.homeFreeze) capy.visible = false;
    this.homeCapys.forEach((c, i) => { c.visible = game.homes[i]; c.rotation.y = Math.PI + Math.sin(time * 2 + i) * 0.3; });
    // mira
    this.aim.visible = !!aimCell && capy.visible;
    if (aimCell) { const a = cellPos(aimCell[0], aimCell[1], 0.006); this.aim.position.set(...a); this.aim.material.color.set(aimCell[2] || '#ffffff'); }
    // garça / tuiuiú e fruta
    const hi = game.heronAt(t);
    this.heron.visible = hi >= 0 && !game.homes[hi];
    if (this.heron.visible) { this.heron.position.set(...cellPos(HOMES[hi], TOP, 0)); this.heron.rotation.y = Math.PI + Math.sin(time) * 0.4; }
    const fi = game.fruitAt(t);
    this.fruit.visible = fi >= 0 && !game.homes[fi];
    if (this.fruit.visible) { const q = cellPos(HOMES[fi], TOP, CELL * 0.25 + Math.sin(time * 4) * 0.004); this.fruit.position.set(...q); }
    // cobra no canteiro
    if (this.snake) {
      const s = game.snakeAt(t);
      this.placeSnake(this.snake, s.x - 0.5 + (s.dir > 0 ? s.len : 0), SAFE, s.dir, time, 0.1);
    }
    if (this.sucuri) {
      const s = game.sucuriAt(t);
      this.placeSnake(this.sucuri, s.head - 0.5 + (s.dir > 0 ? 0.5 : 0.5), s.row, s.dir, time, 0.08);
    }
    if (this.train) {
      const tr = game.trainAt(t);
      this.train.visible = tr.front != null;
      if (tr.front != null) this.train.position.set(...cellPos(tr.front - 0.5, TRAIN.row, 0));
      const blink = (tr.warn || tr.front != null) && Math.floor(time * 6) % 2 === 0;
      for (const l of this.signals) l.material.color.set(blink ? '#ff2a1a' : '#3a0a0a');
    }
  }
  placeSnake(g, headX, row, dir, time, wig) {
    const segs = g.userData.segs, n = segs.length;
    const step = g.userData.len / n;
    segs.forEach((s, j) => {
      const x = headX - dir * j * step;
      const c = cellPos(x, row, CELL * 0.15);
      s.position.set(c[0], c[1], c[2] + Math.sin(time * 8 - j * 0.9) * CELL * wig * 3);
    });
    segs[0].rotation.y = dir > 0 ? 0 : Math.PI;
  }
}
