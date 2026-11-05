import { THREE, createApp, Board, Particles, sfx, overlay, rand, loadBest, saveBest } from '../js/common.js';

overlay('Paredão',
  'Você está no gol. Os chutes ficam mais fortes e com mais curva a cada defesa. Tomou 5 gols, acabou.<br><br>' +
  '<b>Quest:</b> as luvas ficam nos controles, é só espalmar a bola.<br><b>PC:</b> mova o mouse para posicionar as luvas.');

const SKY = 0x87c4f0;
const app = createApp({
  background: SKY,
  fog: new THREE.Fog(SKY, 40, 110),
  desktopCamera: { pos: [0, 1.3, 1.5], look: [0, 1.0, -6] },
});
const { scene, camera } = app;

// ---------- Estádio ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a6a3a, 1.8));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
sun.position.set(8, 20, 6);
scene.add(sun);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const grassTex = canvasTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3f9a45' : '#48a84e'; g.fillRect(0, (i * h) / 8, w, h / 8); }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(1, 4);
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(50, 80), new THREE.MeshLambertMaterial({ map: grassTex }));
pitch.rotation.x = -Math.PI / 2;
pitch.position.z = -25;
scene.add(pitch);

const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function line(x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), lineMat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
  m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2);
  scene.add(m);
}
line(-22, 0, 22, 0);
line(-4.5, 0, -4.5, -4.5); line(4.5, 0, 4.5, -4.5); line(-4.5, -4.5, 4.5, -4.5);
line(-10, 0, -10, -12); line(10, 0, 10, -12); line(-10, -12, 10, -12);
const spot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), lineMat);
spot.rotation.x = -Math.PI / 2;
spot.position.set(0, 0.013, -9);
scene.add(spot);

// gol
const GOAL_W = 1.6, GOAL_H = 2.0, NET_D = 1.1;
const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
for (const x of [-GOAL_W, GOAL_W]) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, GOAL_H, 12), postMat);
  p.position.set(x, GOAL_H / 2, 0.06);
  scene.add(p);
}
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, GOAL_W * 2 + 0.11, 12), postMat);
bar.rotation.z = Math.PI / 2;
bar.position.set(0, GOAL_H, 0.06);
scene.add(bar);

const netPts = [];
const step = 0.2;
for (let x = -GOAL_W; x <= GOAL_W + 0.001; x += step) { netPts.push(x, 0, NET_D, x, GOAL_H, NET_D); netPts.push(x, GOAL_H, 0.06, x, GOAL_H, NET_D); }
for (let y = 0; y <= GOAL_H + 0.001; y += step) { netPts.push(-GOAL_W, y, NET_D, GOAL_W, y, NET_D); }
for (const x of [-GOAL_W, GOAL_W]) {
  for (let z = 0.06; z <= NET_D + 0.001; z += step) netPts.push(x, 0, z, x, GOAL_H, z);
  for (let y = 0; y <= GOAL_H + 0.001; y += step) netPts.push(x, y, 0.06, x, y, NET_D);
}
for (let z = 0.06; z <= NET_D + 0.001; z += step) netPts.push(-GOAL_W, GOAL_H, z, GOAL_W, GOAL_H, z);
const netGeo = new THREE.BufferGeometry();
netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
scene.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));

// arquibancada
const crowdTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, w, h);
  const cols = ['#e04a3a', '#f2c94c', '#ffffff', '#3a7be0', '#1e1e1e', '#e07a3a'];
  for (let i = 0; i < 1400; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(Math.random() * w, Math.random() * h, 3, 4); }
});
crowdTex.wrapS = THREE.RepeatWrapping;
function stand(w, x, z, rotY) {
  const g = new THREE.Group();
  for (let r = 0; r < 4; r++) {
    const t = crowdTex.clone();
    t.repeat.set(w / 12, 1);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 2), [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: t }), postMat]);
    m.position.set(0, 0.8 + r * 1.6, -r * 2);
    g.add(m);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}
stand(60, 0, -60, 0);
stand(70, -26, -25, Math.PI / 2);
stand(70, 26, -25, -Math.PI / 2);

const adColors = ['#ffcf2e', '#e5403a', '#2e7be5'];
for (let i = 0; i < 9; i++) {
  const t = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = adColors[i % 3]; g.fillRect(0, 0, w, h);
    g.fillStyle = i % 3 === 0 ? '#1a1a1a' : '#ffffff';
    g.font = '900 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(['PAREDÃO', 'VR ARCADE', 'QUEST'][i % 3], w / 2, h / 2 + 2);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.15), new THREE.MeshBasicMaterial({ map: t }));
  m.position.set(-20 + i * 5, 0.4, -40);
  scene.add(m);
}

// ---------- Batedor ----------
const shirt = new THREE.MeshLambertMaterial({ color: 0xd43a2f });
const skin = new THREE.MeshLambertMaterial({ color: 0xc58c62 });
const shorts = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
const kicker = new THREE.Group();
const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), shirt);
torso.position.y = 1.2;
const headK = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
headK.position.y = 1.72;
const hips = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.22), shorts);
hips.position.y = 0.85;
function leg(x) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.85, 0);
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.8, 8), skin);
  l.position.y = -0.42;
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  boot.position.set(0, -0.82, 0.05);
  pivot.add(l, boot);
  return pivot;
}
const legL = leg(-0.11), legR = leg(0.11);
kicker.add(torso, headK, hips, legL, legR);
scene.add(kicker);

// ---------- Bola ----------
const BALL_R = 0.11;
const ballTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1b1b';
  for (let i = 0; i < 14; i++) {
    const x = ((i % 7) + (i >= 7 ? 0.5 : 0)) * (w / 7), y = i < 7 ? h * 0.3 : h * 0.72;
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); }
    g.fill();
  }
});
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshLambertMaterial({ map: ballTex }));
scene.add(ball);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// ---------- Luvas ----------
const gloveMat = new THREE.MeshLambertMaterial({ color: 0x18c27a });
const palmMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
function makeGlove(thumbSide) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.04), gloveMat);
  back.position.set(0, 0.03, -0.04);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.125, 0.008), palmMat);
  palm.position.set(0, 0.03, -0.064);
  g.add(back, palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.08, 0.03), gloveMat);
    f.position.set(-0.04 + i * 0.027, 0.13, -0.045);
    g.add(f);
  }
  const th = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.03), gloveMat);
  th.position.set(0.07 * thumbSide, 0.02, -0.045);
  th.rotation.z = -0.5 * thumbSide;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), new THREE.MeshLambertMaterial({ color: 0x0b6b43 }));
  cuff.position.set(0, -0.06, -0.035);
  g.add(th, cuff);
  return g;
}
const GLOVE_C = new THREE.Vector3(0, 0.04, -0.06);
const GLOVE_R = 0.14;
const gloves = app.hands.map((h, i) => {
  const gl = makeGlove(i === 0 ? -1 : 1);
  h.mount.add(gl);
  return { c: new THREE.Vector3(), prev: new THREE.Vector3(), has: false };
});

// No PC: as duas luvas seguem o mouse num plano à frente do gol.
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.3);
const _hit = new THREE.Vector3(), _look = new THREE.Vector3();
app.desktopPose = (h, ray) => {
  if (!ray.ray.intersectPlane(plane, _hit)) return false;
  _hit.x += h.index === 0 ? 0.16 : -0.16;
  _hit.y = Math.max(_hit.y, 0.15);
  _look.set(_hit.x, _hit.y, _hit.z - 5);
  app.aim(h.mount, _hit, _look);
  return true;
};

// ---------- Placar ----------
const board = new Board(6, 2.3);
board.mesh.position.set(0, 4.3, -14);
scene.add(board.mesh);
const ACC = '#18c27a';

// ---------- Estado ----------
const BEST_KEY = 'paredao_best';
const MAX_GOALS = 5;
let state = 'menu';
let saves = 0, goals = 0, shots = 0, lockT = 0, best = loadBest(BEST_KEY);
let phase = 'idle', phaseT = 0, msg = '';
const ballPos = new THREE.Vector3(), ballVel = new THREE.Vector3(), ballAcc = new THREE.Vector3();
let saved = false, scored = false;
const kickFrom = new THREE.Vector3(), kickTo = new THREE.Vector3();
const parts = new Particles(scene, 300, 0.04);

function placeBall() {
  ballPos.set(rand(-4, 4), BALL_R, rand(-11, -8.5));
  ballVel.set(0, 0, 0);
  ballAcc.set(0, 0, 0);
  saved = false; scored = false;
  const away = new THREE.Vector3(ballPos.x, 0, ballPos.z).normalize();
  kickFrom.copy(ballPos).addScaledVector(away, 2.4).setY(0);
  kickTo.copy(ballPos).addScaledVector(away, 0.35).setY(0);
  kicker.position.copy(kickFrom);
  kicker.lookAt(0, 0, 0);
  phase = 'ready';
  phaseT = 0.9;
}

function kick() {
  shots++;
  const target = new THREE.Vector3(rand(-GOAL_W + 0.15, GOAL_W - 0.15), rand(0.25, GOAL_H - 0.15), 0);
  const speed = Math.min(10 + shots * 0.55, 22);
  const curve = rand(-1, 1) * Math.min(1 + shots * 0.3, 5);
  ballAcc.set(curve, -9.8, 0);
  const tFlight = target.distanceTo(ballPos) / speed;
  ballVel.copy(target).sub(ballPos).addScaledVector(ballAcc, -0.5 * tFlight * tFlight).divideScalar(tFlight);
  phase = 'flight';
  phaseT = 4;
  sfx.noise(0.08, 0.6, 300, 1);
  sfx.tone(90, 0.1, 'sine', 0.3, 50);
}

function start() {
  saves = 0; goals = 0; shots = 0; msg = '';
  state = 'play';
  placeBall();
  sfx.tone(880, 0.25, 'square', 0.08);
}
function gameOver() {
  state = 'over';
  lockT = 1.5;
  if (saves > best) { best = saves; saveBest(BEST_KEY, best); }
}

app.onPress = () => { if (state !== 'play' && lockT <= 0) start(); };

const _n = new THREE.Vector3(), _vg = new THREE.Vector3(), _vr = new THREE.Vector3(), _gc = new THREE.Vector3();
const _rotAxis = new THREE.Vector3();

function stepBall(h) {
  ballVel.addScaledVector(ballAcc, h);
  ballPos.addScaledVector(ballVel, h);
  if (ballPos.y < BALL_R) {
    ballPos.y = BALL_R;
    if (ballVel.y < 0) ballVel.y *= -0.55;
    ballVel.x *= 0.985; ballVel.z *= 0.985;
    ballAcc.x = 0;
  }
}

app.onFrame = (dt, t) => {
  lockT -= dt;
  // centros das luvas agora e no frame anterior
  app.hands.forEach((h, i) => {
    const g = gloves[i];
    g.prev.copy(g.has ? g.c : _gc.copy(GLOVE_C).applyMatrix4(h.mount.matrixWorld));
    g.c.copy(GLOVE_C).applyMatrix4(h.mount.matrixWorld);
    g.has = h.mount.visible;
  });

  if (state === 'play') {
    phaseT -= dt;
    if (phase === 'ready') {
      if (phaseT <= 0) { phase = 'runup'; phaseT = 0.9; }
    } else if (phase === 'runup') {
      const k = 1 - Math.max(phaseT, 0) / 0.9;
      kicker.position.lerpVectors(kickFrom, kickTo, k);
      const sw = Math.sin(k * Math.PI * 5) * 0.6;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      if (phaseT <= 0) { legR.rotation.x = -1.2; kick(); }
    } else if (phase === 'flight' || phase === 'after') {
      legR.rotation.x *= 0.9; legL.rotation.x *= 0.9;
      const n = Math.max(1, Math.ceil(dt / 0.003));
      const h = dt / n;
      for (let s = 0; s < n; s++) {
        const f = (s + 1) / n;
        stepBall(h);
        if (scored && ballPos.z > NET_D - BALL_R) {
          ballPos.z = NET_D - BALL_R;
          ballVel.multiplyScalar(0.15);
          ballVel.z = -Math.abs(ballVel.z);
        }
        if (scored) {
          ballPos.x = THREE.MathUtils.clamp(ballPos.x, -GOAL_W + BALL_R, GOAL_W - BALL_R);
          ballPos.y = Math.min(ballPos.y, GOAL_H - BALL_R);
        }
        if (phase !== 'flight' || saved) continue;
        for (let gi = 0; gi < gloves.length; gi++) {
          const g = gloves[gi];
          if (!g.has) continue;
          _gc.lerpVectors(g.prev, g.c, f);
          _n.subVectors(ballPos, _gc);
          const d = _n.length();
          if (d < GLOVE_R + BALL_R) {
            _n.divideScalar(d || 1);
            _vg.subVectors(g.c, g.prev).divideScalar(Math.max(dt, 1e-4));
            _vr.subVectors(ballVel, _vg);
            const vn = _vr.dot(_n);
            if (vn < 0) _vr.addScaledVector(_n, -1.5 * vn);
            ballVel.copy(_vr).add(_vg);
            if (ballVel.z > -1) ballVel.z = -Math.max(2, Math.abs(ballVel.z) * 0.5);
            ballAcc.x = 0;
            ballPos.copy(_gc).addScaledVector(_n, GLOVE_R + BALL_R + 0.005);
            saved = true;
            saves++;
            msg = ['DEFENDEU!', 'QUE DEFESA!', 'PAREDÃO!', 'ESPALMOU!'][(Math.random() * 4) | 0];
            parts.emit(ballPos, 0xffffff, 18, 3, 0.5);
            sfx.noise(0.12, 0.7, 250, 0.8);
            sfx.tone(520, 0.2, 'triangle', 0.12, 880);
            app.pulse(app.hands[gi], 1, 90);
            phase = 'after';
            phaseT = 1.6;
            break;
          }
        }
        // cruzou a linha do gol
        if (!saved && !scored && ballPos.z >= 0) {
          if (Math.abs(ballPos.x) < GOAL_W - BALL_R && ballPos.y < GOAL_H - BALL_R) {
            scored = true;
            goals++;
            msg = 'GOL...';
            app.hurtFlash(0.3);
            app.pulseAll(0.6, 250);
            sfx.noise(1.4, 0.35, 700, 0.3);
            sfx.tone(200, 0.5, 'sawtooth', 0.1, 80);
          } else {
            msg = 'PRA FORA!';
          }
          phase = 'after';
          phaseT = 1.6;
        }
      }
      if (phase === 'flight' && phaseT <= 0) { phase = 'after'; phaseT = 0.5; msg = ''; }
      if (phase === 'after' && phaseT <= 0) {
        if (goals >= MAX_GOALS) gameOver();
        else { msg = ''; placeBall(); }
      }
    }
  } else if (phase === 'flight' || phase === 'after') {
    stepBall(dt);
  }

  // rotação visual da bola
  const sp = ballVel.length();
  if (sp > 0.01) {
    _rotAxis.set(ballVel.z, 0, -ballVel.x).normalize();
    if (_rotAxis.lengthSq() > 0) ball.rotateOnWorldAxis(_rotAxis, (sp * dt) / BALL_R);
  }
  ball.position.copy(ballPos);
  shadow.position.set(ballPos.x, 0.015, ballPos.z);
  shadow.material.opacity = 0.3 * Math.max(0.2, 1 - ballPos.y / 3);
  parts.update(dt);

  const go = app.vr ? 'Puxe o gatilho' : 'Clique';
  if (state === 'menu') {
    board.show({ title: 'PAREDÃO', accent: ACC, lines: [`${go} para começar`, `Recorde: ${best} defesas`] });
  } else if (state === 'play') {
    board.show({ title: msg || `${saves} DEFESAS`, accent: ACC, lines: [`Gols sofridos ${goals}/${MAX_GOALS}`, `Chute nº ${shots + (phase === 'ready' || phase === 'runup' ? 1 : 0)}`] });
  } else {
    board.show({ title: 'FIM DE JOGO', accent: ACC, lines: [`${saves} defesas   Recorde: ${best}`, lockT > 0 ? '' : `${go} para jogar de novo`] });
  }
};

// bola parada na marca enquanto está no menu
ballPos.set(0, BALL_R, -9);
kicker.position.set(0, 0, -11.5);
kicker.lookAt(0, 0, 0);

// depuração (console): __dbg()
window.__dbg = () => ({ state, phase, saves, goals, shots, ball: ballPos.toArray().map((v) => +v.toFixed(2)), screen: (() => { const p = ballPos.clone().project(camera); return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight]; })() });
