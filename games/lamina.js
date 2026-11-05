import { THREE, createApp, Board, Particles, sfx, overlay, rand, distPointSegment, loadBest, saveBest } from '../js/common.js';

overlay('Lâmina da Lua',
  'Sombras mascaradas avançam pelo bambuzal. Corte com golpes rápidos; as de máscara dourada atiram facas: rebata com a lâmina.<br><br>' +
  '<b>Quest:</b> uma espada em cada mão, gatilho começa.<br><b>PC:</b> arraste o mouse rápido por cima dos inimigos.');

const NIGHT = 0x0a0c18;
const app = createApp({ background: NIGHT, fog: new THREE.FogExp2(NIGHT, 0.055) });
const { scene } = app;

// ---------- Cenário ----------
scene.add(new THREE.HemisphereLight(0x6070b0, 0x101018, 1.1));
const moonLight = new THREE.DirectionalLight(0x9fb4ff, 1.4);
moonLight.position.set(-5, 10, -10);
scene.add(moonLight);

const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4ecd0, fog: false }));
moon.position.set(-14, 20, -70);
scene.add(moon);
const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xa0405a, transparent: true, opacity: 0.18, fog: false }));
halo.position.set(-14, 20, -72);
scene.add(halo);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x1a1c24 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0x34343c, flatShading: true }));
plat.position.y = 0.05;
scene.add(plat);

const bambooMat = new THREE.MeshLambertMaterial({ color: 0x2f4a32 });
const bambooGeo = new THREE.CylinderGeometry(0.07, 0.09, 1, 6);
for (let i = 0; i < 160; i++) {
  const a = Math.random() * Math.PI * 2;
  const front = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.1;
  const d = front ? rand(15, 32) : rand(4, 28);
  const h = rand(6, 11);
  const b = new THREE.Mesh(bambooGeo, bambooMat);
  b.scale.set(rand(0.8, 1.3), h, rand(0.8, 1.3));
  b.position.set(Math.sin(a) * d, h / 2, -Math.cos(a) * d);
  b.rotation.z = rand(-0.06, 0.06);
  scene.add(b);
}

// lanternas de pedra
const stone = new THREE.MeshLambertMaterial({ color: 0x55555c, flatShading: true });
const glow = new THREE.MeshBasicMaterial({ color: 0xffb060 });
for (const [x, z] of [[-2.4, -1.5], [2.4, -1.5], [-3.5, -6], [3.5, -6], [-2.6, 2], [2.6, 2]]) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6), stone);
  base.position.y = 0.4;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), glow);
  box.position.y = 0.93;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.25, 4), stone);
  roof.position.y = 1.18;
  roof.rotation.y = Math.PI / 4;
  g.add(base, box, roof);
  g.position.set(x, 0, z);
  scene.add(g);
}
for (const x of [-2.4, 2.4]) {
  const pl = new THREE.PointLight(0xff9a40, 4, 9, 1.6);
  pl.position.set(x, 1, -1.5);
  scene.add(pl);
}

// vaga-lumes
const flyCount = 160;
const flyPos = new Float32Array(flyCount * 3);
const flyBase = [];
for (let i = 0; i < flyCount; i++) {
  const a = Math.random() * Math.PI * 2, d = rand(2, 18);
  flyBase.push([Math.sin(a) * d, rand(0.3, 4), -Math.cos(a) * d, Math.random() * 10]);
}
const flyGeo = new THREE.BufferGeometry();
flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: 0xffc070, size: 0.06, transparent: true, opacity: 0.85 }));
scene.add(flies);

// ---------- Espadas ----------
const BLADE_BASE = new THREE.Vector3(0, 0, -0.12);
const BLADE_TIP = new THREE.Vector3(0, 0, -1.0);
function makeSword(edgeColor) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0x241a14 }));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.02;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12), new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
  guard.rotation.x = Math.PI / 2;
  guard.position.z = -0.1;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.88), new THREE.MeshLambertMaterial({ color: 0xd8dde6, emissive: 0x1c2233 }));
  blade.position.z = -0.56;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.88), new THREE.MeshBasicMaterial({ color: edgeColor }));
  edge.position.set(0, -0.022, -0.56);
  g.add(handle, guard, blade, edge);
  return g;
}

class Trail {
  constructor(color, n = 12) {
    this.n = n;
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false,
    }));
    this.mesh.frustumCulled = false;
    this.color = new THREE.Color(color);
    this.started = false;
  }
  push(base, tip, strength) {
    const p = this.pos;
    if (!this.started) {
      for (let i = 0; i < this.n; i++) { base.toArray(p, i * 6); tip.toArray(p, i * 6 + 3); }
      this.started = true;
    }
    p.copyWithin(6, 0, (this.n - 1) * 6);
    base.toArray(p, 0);
    tip.toArray(p, 3);
    for (let i = 0; i < this.n; i++) {
      const f = (1 - i / (this.n - 1)) * strength;
      this.col[i * 6] = 0; this.col[i * 6 + 1] = 0; this.col[i * 6 + 2] = 0;
      this.col[i * 6 + 3] = this.color.r * f; this.col[i * 6 + 4] = this.color.g * f; this.col[i * 6 + 5] = this.color.b * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

const EDGE = [0x6fe0ff, 0xff5a7a];
const swords = app.hands.map((h, i) => {
  const s = makeSword(EDGE[i]);
  h.mount.add(s);
  const trail = new Trail(EDGE[i]);
  scene.add(trail.mesh);
  return { obj: s, trail, base: new THREE.Vector3(), tip: new THREE.Vector3(), prevTip: new THREE.Vector3(), speed: 0, has: false };
});

// No PC: a espada sai de baixo da tela e a ponta segue o mouse.
const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _off = new THREE.Vector3();
app.desktopPose = (h, ray, cam) => {
  if (h.index !== 0) return false;
  _off.set(0.05, -0.5, -0.3).applyQuaternion(cam.quaternion);
  _p.copy(cam.position).add(_off);
  _t.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 1.35);
  app.aim(h.mount, _p, _t);
  return true;
};

// ---------- Placar ----------
const board = new Board(2.8, 1.15);
board.mesh.position.set(0, 2.9, -5);
scene.add(board.mesh);
const ACC = '#e0334a';

// ---------- Estado ----------
const BEST_KEY = 'lamina_best';
let state = 'menu';
let score = 0, hp = 5, combo = 1, elapsed = 0, spawnT = 0, lockT = 0;
let best = loadBest(BEST_KEY);
const enemies = [];
const knives = [];
const slashes = [];
const parts = new Particles(scene, 700, 0.045);
parts.gravity = -3;

const robeMat = new THREE.MeshLambertMaterial({ color: 0x15151c, flatShading: true });
const headMat = new THREE.MeshLambertMaterial({ color: 0x0e0e12 });
const maskW = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });
const maskG = new THREE.MeshBasicMaterial({ color: 0xd9ab3c });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
const scarfMat = new THREE.MeshBasicMaterial({ color: 0xa3122a });

function spawn() {
  const thrower = elapsed > 8 && Math.random() < Math.min(0.4, 0.15 + elapsed / 200);
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 7), robeMat);
  robe.position.y = -0.22;
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), headMat);
  headM.position.y = 0.28;
  const mask = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), thrower ? maskG : maskW);
  mask.position.set(0, 0.28, 0.155);
  const e1 = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.018), eyeMat);
  e1.position.set(-0.045, 0.3, 0.157);
  e1.rotation.z = -0.25;
  const e2 = e1.clone();
  e2.position.x = 0.045;
  e2.rotation.z = 0.25;
  g.add(robe, headM, mask, e1, e2);
  if (thrower) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 14), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.13;
    g.add(scarf);
  }
  const arc = app.vr ? 55 : 35;
  const yaw = THREE.MathUtils.degToRad(rand(-arc, arc));
  const d = rand(13, 16);
  g.position.set(Math.sin(yaw) * d, rand(1.1, 1.6), -Math.cos(yaw) * d);
  g.userData = {
    thrower, r: 0.36,
    speed: Math.min(1.5 + elapsed * 0.03, 3.6),
    phase: Math.random() * 10,
    throwT: 0.8, throws: 0, hold: thrower ? rand(5.5, 7.5) : 0,
  };
  scene.add(g);
  enemies.push(g);
}

const knifeGeo = new THREE.OctahedronGeometry(0.05, 0);
knifeGeo.scale(0.6, 0.6, 3.2);
function throwKnife(from, target) {
  const m = new THREE.Mesh(knifeGeo, new THREE.MeshBasicMaterial({ color: 0xff3344 }));
  m.position.copy(from);
  const v = new THREE.Vector3().subVectors(target, from);
  v.x += rand(-0.15, 0.15); v.y += rand(-0.15, 0.1);
  v.normalize().multiplyScalar(Math.min(6 + elapsed * 0.04, 10));
  m.userData = { v, deflected: false, life: 6 };
  scene.add(m);
  knives.push(m);
  sfx.tone(700, 0.12, 'triangle', 0.06, 1400);
}

function removeFrom(arr, o) { scene.remove(o); arr.splice(arr.indexOf(o), 1); }

function addSlash(pos, dir) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.035), new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false,
  }));
  m.position.copy(pos);
  const d = dir.clone().normalize();
  if (d.lengthSq() < 0.5) d.set(1, 0, 0);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
  scene.add(m);
  slashes.push({ m, life: 0.22 });
}

const _c = new THREE.Vector3();
function killEnemy(e, dir) {
  _c.copy(e.position);
  parts.emit(_c, 0x0c0c10, 30, 3, 1.0, 1.6);
  parts.emit(_c, 0xff2a3a, 14, 4, 0.6);
  parts.emit(_c, e.userData.thrower ? 0xd9ab3c : 0xf2efe6, 8, 2.5, 0.8, 1.2);
  if (dir) addSlash(_c, dir);
  score += (e.userData.thrower ? 150 : 100) * combo;
  combo = Math.min(combo + 1, 10);
  sfx.noise(0.18, 0.4, 3200, 1.5);
  sfx.tone(260, 0.15, 'sine', 0.12, 90);
  removeFrom(enemies, e);
}

function start() {
  for (const e of enemies) scene.remove(e);
  for (const k of knives) scene.remove(k);
  enemies.length = 0; knives.length = 0;
  score = 0; hp = 5; combo = 1; elapsed = 0; spawnT = 1.0;
  state = 'play';
  sfx.noise(0.3, 0.3, 4000, 2);
}
function gameOver() {
  state = 'over';
  lockT = 1.2;
  if (score > best) { best = score; saveBest(BEST_KEY, best); }
  sfx.tone(220, 0.8, 'sine', 0.2, 55);
}
function hurt() {
  hp--;
  combo = 1;
  app.hurtFlash();
  app.pulseAll(1, 180);
  sfx.tone(110, 0.35, 'sawtooth', 0.2, 50);
  if (hp <= 0) gameOver();
}

app.onPress = () => { if (state !== 'play' && lockT <= 0) start(); };

const head = new THREE.Vector3(), _to = new THREE.Vector3(), _side = new THREE.Vector3(), _vel = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const SLICE_SPEED = 1.8;

app.onFrame = (dt, t) => {
  lockT -= dt;
  app.headPos(head);

  // espadas: pontos da lâmina, velocidade da ponta e rastro
  app.hands.forEach((h, i) => {
    const s = swords[i];
    s.base.copy(BLADE_BASE).applyMatrix4(h.mount.matrixWorld);
    s.tip.copy(BLADE_TIP).applyMatrix4(h.mount.matrixWorld);
    s.speed = s.has && dt > 0 ? s.prevTip.distanceTo(s.tip) / dt : 0;
    s.has = h.mount.visible;
    s.trail.mesh.visible = h.mount.visible;
    if (h.mount.visible) s.trail.push(s.base, s.tip, THREE.MathUtils.clamp((s.speed - 1) / 4, 0, 0.9));
    s.prevTip.copy(s.tip);
  });

  // vaga-lumes
  for (let i = 0; i < flyCount; i++) {
    const b = flyBase[i];
    flyPos[i * 3] = b[0] + Math.sin(t * 0.5 + b[3]) * 0.4;
    flyPos[i * 3 + 1] = b[1] + Math.sin(t * 0.8 + b[3] * 2) * 0.25;
    flyPos[i * 3 + 2] = b[2] + Math.cos(t * 0.4 + b[3]) * 0.4;
  }
  flyGeo.attributes.position.needsUpdate = true;

  if (state === 'play') {
    elapsed += dt;
    spawnT -= dt;
    if (spawnT <= 0) { spawn(); spawnT = Math.max(0.6, 2.2 - elapsed * 0.025); }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], u = e.userData;
      _to.subVectors(head, e.position);
      const dist = _to.length();
      _to.divideScalar(dist);
      _side.crossVectors(_to, UP).normalize();
      const holding = u.thrower && u.throws < 3 && dist < u.hold;
      if (!holding) {
        e.position.addScaledVector(_to, u.speed * dt);
        e.position.addScaledVector(_side, Math.sin(t * 1.7 + u.phase) * 0.8 * dt);
      } else {
        e.position.addScaledVector(_side, Math.sin(t * 1.2 + u.phase) * 1.2 * dt);
        u.throwT -= dt;
        if (u.throwT <= 0) {
          u.throwT = Math.max(1.3, 2.4 - elapsed * 0.01);
          u.throws++;
          throwKnife(_c.copy(e.position).add(_side.set(0, 0.1, 0)), head);
        }
      }
      e.position.y += Math.sin(t * 2 + u.phase) * 0.15 * dt;
      e.lookAt(head.x, e.position.y, head.z);

      // corte
      let cut = false;
      for (const s of swords) {
        if (!s.has || s.speed < SLICE_SPEED) continue;
        if (distPointSegment(e.position, s.base, s.tip) < u.r) {
          _vel.subVectors(s.tip, s.prevTip);
          killEnemy(e, _vel.lengthSq() > 1e-6 ? _vel : _side);
          app.hands.forEach((h, k) => { if (swords[k] === s) app.pulse(h, 0.9, 60); });
          cut = true;
          break;
        }
      }
      if (cut) continue;
      if (dist < 0.6) {
        parts.emit(e.position, 0x0c0c10, 20, 2, 0.8, 1.5);
        removeFrom(enemies, e);
        hurt();
        if (state !== 'play') break;
      }
    }
  }

  // facas
  for (let i = knives.length - 1; i >= 0; i--) {
    const k = knives[i], u = k.userData;
    k.position.addScaledVector(u.v, dt);
    _c.copy(k.position).add(u.v);
    k.lookAt(_c);
    u.life -= dt;
    if (!u.deflected && state === 'play') {
      let blocked = false;
      for (let si = 0; si < swords.length; si++) {
        const s = swords[si];
        if (!s.has) continue;
        if (distPointSegment(k.position, s.base, s.tip) < 0.1) {
          blocked = true;
          u.deflected = true;
          k.material.color.set(0x6fe0ff);
          const target = enemies.length ? enemies.reduce((a, b) => (a.position.distanceToSquared(k.position) < b.position.distanceToSquared(k.position) ? a : b)) : null;
          if (target) u.v.subVectors(target.position, k.position).normalize().multiplyScalar(14);
          else u.v.multiplyScalar(-1.3).add(new THREE.Vector3(rand(-2, 2), rand(1, 3), 0));
          score += 50 * combo;
          parts.emit(k.position, 0xfff3c0, 12, 3, 0.35, 0.7);
          sfx.tone(1900, 0.18, 'triangle', 0.18);
          sfx.tone(2650, 0.12, 'triangle', 0.08);
          app.pulse(app.hands[si], 1, 50);
          break;
        }
      }
      if (!blocked && k.position.distanceTo(head) < 0.28) {
        removeFrom(knives, k);
        hurt();
        continue;
      }
    } else if (u.deflected) {
      for (const e of enemies) {
        if (e.position.distanceTo(k.position) < e.userData.r + 0.05) {
          killEnemy(e, u.v);
          score += 100;
          u.life = 0;
          break;
        }
      }
    }
    if (u.life <= 0 || k.position.y < 0 || k.position.length() > 40) removeFrom(knives, k);
  }

  for (let i = slashes.length - 1; i >= 0; i--) {
    const s = slashes[i];
    s.life -= dt;
    s.m.material.opacity = Math.max(0, s.life / 0.22);
    s.m.scale.x = 1 + (0.22 - s.life) * 3;
    if (s.life <= 0) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); slashes.splice(i, 1); }
  }
  parts.update(dt);

  const go = app.vr ? 'Puxe o gatilho' : 'Clique';
  if (state === 'menu') {
    board.show({ title: 'LÂMINA DA LUA', accent: ACC, lines: [`${go} para começar`, `Recorde: ${best}`] });
  } else if (state === 'play') {
    board.show({ title: `${score}`, accent: ACC, lines: [`Vida ${'●'.repeat(hp)}${'○'.repeat(Math.max(0, 5 - hp))}`, `Combo x${combo}`] });
  } else {
    board.show({ title: 'DERROTA', accent: ACC, lines: [`Pontos: ${score}   Recorde: ${best}`, lockT > 0 ? '' : `${go} para tentar de novo`] });
  }
};

// depuração (console): __dbg()
window.__dbg = () => ({ state, score, hp, combo, knives: knives.length, enemies: enemies.map((e) => { const p = e.position.clone().project(app.camera); return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight, e.position.distanceTo(app.camera.position)]; }) });
