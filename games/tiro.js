import { THREE, createApp, Board, Particles, sfx, overlay, rand, loadBest, saveBest } from '../js/common.js';

overlay('Ponto Zero',
  'Drones invadem o pátio industrial. Derrube todos antes que cheguem em você. Errar o tiro zera o combo.<br><br>' +
  '<b>Quest:</b> uma pistola em cada mão, gatilho atira.<br><b>PC:</b> mire com o mouse, clique (ou espaço) para atirar.');

const SKY = 0xc97b4a;
const app = createApp({ background: SKY, fog: new THREE.Fog(SKY, 18, 70) });
const { scene, camera } = app;

// ---------- Cenário ----------
scene.add(new THREE.HemisphereLight(0xffd7b0, 0x403530, 1.7));
const sun = new THREE.DirectionalLight(0xffe0c0, 1.8);
sun.position.set(-10, 15, -5);
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: 0x5a5652 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(240, 120, 0x77706a, 0x77706a);
grid.position.y = 0.01;
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);

const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.08, 32), new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
pad.position.y = 0.04;
scene.add(pad);
const stripe = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 40), new THREE.MeshBasicMaterial({ color: 0xffb800 }));
stripe.rotation.x = -Math.PI / 2;
stripe.position.y = 0.085;
scene.add(stripe);

const crateMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
const contColors = [0xd2602a, 0x2f6ea8, 0x9c2f2f, 0x4f7f4a];
const towerMat = new THREE.MeshLambertMaterial({ color: 0x4d5559 });
for (let i = 0; i < 46; i++) {
  const a = Math.random() * Math.PI * 2;
  const d = rand(7, 34);
  const x = Math.sin(a) * d, z = -Math.cos(a) * d;
  const kind = Math.random();
  let m;
  if (kind < 0.55) {
    const s = rand(0.8, 1.4);
    m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    m.position.set(x, s / 2, z);
  } else if (kind < 0.85) {
    m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 6), new THREE.MeshLambertMaterial({ color: contColors[i % 4] }));
    m.position.set(x, 1.3, z);
  } else {
    const h = rand(6, 14);
    m = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), towerMat);
    m.position.set(x * 1.3, h / 2, z * 1.3);
  }
  m.rotation.y = Math.random() * Math.PI;
  scene.add(m);
}

// ---------- Pistolas ----------
const dark = new THREE.MeshLambertMaterial({ color: 0x23252a });
const metal = new THREE.MeshLambertMaterial({ color: 0x6b7178 });
const accent = new THREE.MeshBasicMaterial({ color: 0xff7a2f });
function makeGun() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.2), dark);
  body.position.set(0, 0.0, -0.04);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.22), metal);
  slide.position.set(0, 0.045, -0.05);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), dark);
  grip.position.set(0, -0.07, 0.04);
  grip.rotation.x = -0.3;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.16), accent);
  strip.position.set(0, 0.025, -0.05);
  g.add(body, slide, grip, strip);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.045, -0.17);
  g.add(muzzle);
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.045, -0.17), new THREE.Vector3(0, 0.045, -30)]);
  const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35 }));
  g.add(laser);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  flash.position.copy(muzzle.position);
  flash.visible = false;
  g.add(flash);
  return { group: g, muzzle, laser, flash, flashT: 0, kick: 0 };
}
const guns = app.hands.map((h) => {
  const gun = makeGun();
  h.mount.add(gun.group);
  return gun;
});
document.body.classList.add('mira');

// ---------- Placar ----------
const board = new Board(3.2, 1.3);
board.mesh.position.set(0, 3.3, -6.5);
scene.add(board.mesh);

// ---------- Estado ----------
const BEST_KEY = 'pontozero_best';
let state = 'menu';
let score = 0, lives = 3, combo = 1, elapsed = 0, spawnT = 0, lockT = 0;
let best = loadBest(BEST_KEY);
const enemies = [];
const tracers = [];
const parts = new Particles(scene, 600, 0.06);

function start() {
  for (const e of enemies) scene.remove(e);
  enemies.length = 0;
  score = 0; lives = 3; combo = 1; elapsed = 0; spawnT = 1.0;
  state = 'play';
  sfx.tone(440, 0.1, 'square', 0.1, 880);
}
function gameOver() {
  state = 'over';
  lockT = 1.2;
  if (score > best) { best = score; saveBest(BEST_KEY, best); }
  sfx.tone(300, 0.6, 'sawtooth', 0.15, 60);
}

function spawn() {
  const tank = elapsed > 20 && Math.random() < Math.min(0.35, elapsed / 180);
  const r = tank ? 0.55 : 0.3;
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: tank ? 0x3d2626 : 0x2b2f36, flatShading: true, emissive: 0x000000 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 10, 8), new THREE.MeshBasicMaterial({ color: tank ? 0xffb000 : 0xff3020 }));
  eye.position.z = r * 0.85;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.35, r * 0.07, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff7a2f }));
  ring.rotation.x = Math.PI / 2;
  g.add(body, eye, ring);
  const arc = app.vr ? 65 : 38;
  const yaw = THREE.MathUtils.degToRad(rand(-arc, arc));
  const dist = rand(22, 28);
  g.position.set(Math.sin(yaw) * dist, rand(1.2, 3.6), -Math.cos(yaw) * dist);
  g.userData = {
    tank, r, mat, ring,
    hp: tank ? 4 : 1,
    speed: tank ? Math.min(1.3 + elapsed * 0.02, 3.5) : Math.min(2.2 + elapsed * 0.04, 6),
    phase: Math.random() * 10,
    flash: 0,
  };
  scene.add(g);
  enemies.push(g);
}

function removeEnemy(e) {
  scene.remove(e);
  enemies.splice(enemies.indexOf(e), 1);
}

function explode(e) {
  parts.emit(e.position, 0xff8a2a, e.userData.tank ? 50 : 28, 5, 0.8);
  parts.emit(e.position, 0x222222, e.userData.tank ? 30 : 16, 3, 1.0, 1.4);
  sfx.noise(0.4, 0.45, 380, 0.6);
}

function addTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 1 }));
  scene.add(line);
  tracers.push({ line, life: 0.07 });
}

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _v = new THREE.Vector3(), _m = new THREE.Vector3(), _end = new THREE.Vector3();
function fire(hand) {
  if (!hand.mount.visible) return;
  const gun = guns[hand.index];
  sfx.noise(0.12, 0.35, 900, 0.7);
  sfx.tone(170, 0.08, 'square', 0.06, 60);
  app.pulse(hand, 0.6, 40);
  gun.muzzle.getWorldPosition(_m);
  if (app.vr) {
    _o.copy(_m);
    _d.set(0, 0, -1).applyQuaternion(hand.mount.quaternion);
  } else {
    _o.copy(app.ray.ray.origin);
    _d.copy(app.ray.ray.direction);
  }
  let hit = null, bestT = Infinity;
  for (const e of enemies) {
    _v.subVectors(e.position, _o);
    const t = _v.dot(_d);
    if (t < 0) continue;
    const perp2 = _v.lengthSq() - t * t;
    const rr = e.userData.r * 1.25;
    if (perp2 < rr * rr && t < bestT) { bestT = t; hit = e; }
  }
  _end.copy(_o).addScaledVector(_d, hit ? bestT : 60);
  addTracer(_m, _end);
  gun.flash.visible = true;
  gun.flash.scale.setScalar(app.vr ? 1 : 0.35);
  gun.flashT = 0.05;
  gun.kick = 1;
  if (state !== 'play') return;
  if (hit) {
    const u = hit.userData;
    u.hp--;
    u.flash = 1;
    parts.emit(_end, 0xffe08a, 6, 2, 0.3, 0.6);
    sfx.tone(1100, 0.05, 'square', 0.08);
    if (u.hp <= 0) {
      score += (u.tank ? 300 : 100) * combo;
      combo = Math.min(combo + 1, 8);
      explode(hit);
      removeEnemy(hit);
    }
  } else {
    combo = 1;
  }
}

app.onPress = (hand) => {
  fire(hand);
  if (state !== 'play' && lockT <= 0) start();
};

const head = new THREE.Vector3(), _to = new THREE.Vector3(), _side = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

app.onFrame = (dt, t) => {
  lockT -= dt;
  app.headPos(head);

  // pistolas: laser só no VR, recuo e clarão
  for (const gun of guns) {
    gun.laser.visible = app.vr;
    gun.flashT -= dt;
    if (gun.flashT <= 0) gun.flash.visible = false;
    gun.kick = Math.max(0, gun.kick - dt * 10);
    gun.group.rotation.x = gun.kick * 0.25;
    gun.group.position.z = gun.kick * 0.03;
  }

  if (state === 'play') {
    elapsed += dt;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawn();
      spawnT = Math.max(0.45, 1.8 - elapsed * 0.02);
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], u = e.userData;
      _to.subVectors(head, e.position);
      const dist = _to.length();
      _to.divideScalar(dist);
      _side.crossVectors(_to, UP).normalize();
      e.position.addScaledVector(_to, u.speed * dt);
      if (!u.tank) e.position.addScaledVector(_side, Math.sin(t * 2.2 + u.phase) * 1.4 * dt);
      e.position.y += Math.sin(t * 3 + u.phase) * 0.3 * dt;
      e.lookAt(head);
      u.ring.rotation.z += dt * 4;
      u.flash = Math.max(0, u.flash - dt * 6);
      u.mat.emissive.setScalar(u.flash);
      if (dist < 1.0) {
        lives--;
        combo = 1;
        app.hurtFlash();
        app.pulseAll(1, 200);
        sfx.tone(120, 0.4, 'sawtooth', 0.2, 50);
        explode(e);
        removeEnemy(e);
        if (lives <= 0) { gameOver(); break; }
      }
    }
  } else {
    for (const e of enemies) { e.userData.ring.rotation.z += dt * 2; }
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.life -= dt;
    tr.line.material.opacity = Math.max(0, tr.life / 0.07);
    if (tr.life <= 0) {
      scene.remove(tr.line);
      tr.line.geometry.dispose();
      tr.line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  parts.update(dt);

  const go = app.vr ? 'Puxe o gatilho' : 'Clique';
  if (state === 'menu') {
    board.show({ title: 'PONTO ZERO', lines: [`${go} para começar`, `Recorde: ${best}`] });
  } else if (state === 'play') {
    board.show({
      title: `${score}`,
      lines: [`Vidas ${'♥'.repeat(lives)}${'♡'.repeat(Math.max(0, 3 - lives))}   Combo x${combo}`, `Onda ${1 + Math.floor(elapsed / 20)}`],
    });
  } else {
    board.show({ title: 'FIM DE JOGO', lines: [`Pontos: ${score}   Recorde: ${best}`, lockT > 0 ? '' : `${go} para jogar de novo`] });
  }
};

// depuração (console): __dbg()
window.__dbg = () => ({ state, score, lives, combo, enemies: enemies.map((e) => { const p = e.position.clone().project(camera); return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight]; }) });
