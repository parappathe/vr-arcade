// Base compartilhada: renderer WebXR, mãos (controles do Quest ou mouse), som, placar, partículas.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
export { THREE };

// ---------- Som (sintetizado, sem arquivos) ----------
let audioCtx = null;
function actx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
document.addEventListener('pointerdown', () => actx(), { once: false });

export const sfx = {
  tone(freq, dur = 0.12, type = 'square', vol = 0.15, slideTo = null) {
    const c = actx(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  },
  noise(dur = 0.15, vol = 0.2, freq = 1500, q = 0.8) {
    const c = actx(), t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
  },
};

// ---------- Texto de instruções na tela (só aparece fora do VR) ----------
export function overlay(title, html) {
  const d = document.createElement('div');
  d.className = 'hud';
  d.innerHTML = `<a href="../index.html">&larr; jogos</a><h1>${title}</h1><p>${html}</p>`;
  document.body.appendChild(d);
}

// ---------- App ----------
export function createApp(opts = {}) {
  const {
    background = 0x000000,
    fog = null,
    desktopCamera = { pos: [0, 1.6, 0], look: [0, 1.6, -5] },
  } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 300);
  const resetDesktopCamera = () => {
    camera.position.fromArray(desktopCamera.pos);
    camera.lookAt(new THREE.Vector3().fromArray(desktopCamera.look));
  };
  resetDesktopCamera();
  scene.add(camera);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const app = {
    THREE, renderer, scene, camera,
    hands: [],
    onPress: null,
    onRelease: null,
    onFrame: null,
    desktopPose: null,
    mouse: new THREE.Vector2(),
    ray: new THREE.Raycaster(),
    time: 0,
    get vr() { return renderer.xr.isPresenting; },
  };

  // Mãos: no VR seguem os controles; no PC seguem o mouse (desktopPose).
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    scene.add(controller);
    const mount = new THREE.Group();
    scene.add(mount);
    const hand = {
      index: i, controller, mount, source: null,
      handedness: i === 0 ? 'right' : 'left',
      pressed: false,
      vel: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
      hasPrev: false,
    };
    controller.addEventListener('connected', (e) => {
      hand.source = e.data;
      if (e.data && e.data.handedness) hand.handedness = e.data.handedness;
    });
    controller.addEventListener('disconnected', () => { hand.source = null; });
    controller.addEventListener('selectstart', () => { hand.pressed = true; app.onPress && app.onPress(hand); });
    controller.addEventListener('selectend', () => { hand.pressed = false; app.onRelease && app.onRelease(hand); });
    app.hands.push(hand);
  }

  // Mouse / toque / espaço
  const el = renderer.domElement;
  const setMouse = (e) => app.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  el.addEventListener('pointermove', setMouse);
  el.addEventListener('pointerdown', (e) => {
    if (app.vr) return;
    setMouse(e);
    const h = app.hands[0];
    h.pressed = true;
    app.onPress && app.onPress(h);
  });
  el.addEventListener('pointerup', () => {
    if (app.vr) return;
    const h = app.hands[0];
    h.pressed = false;
    app.onRelease && app.onRelease(h);
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || app.vr) return;
    actx();
    app.onPress && app.onPress(app.hands[0]);
  });

  renderer.xr.addEventListener('sessionstart', () => { app.hands.forEach((h) => (h.hasPrev = false)); document.body.classList.add('in-vr'); });
  renderer.xr.addEventListener('sessionend', () => {
    app.hands.forEach((h) => (h.hasPrev = false));
    document.body.classList.remove('in-vr');
    resetDesktopCamera();
  });

  // Vibração do controle
  app.pulse = (hand, intensity = 0.5, ms = 50) => {
    const a = hand && hand.source && hand.source.gamepad && hand.source.gamepad.hapticActuators && hand.source.gamepad.hapticActuators[0];
    if (a && a.pulse) a.pulse(intensity, ms);
  };
  app.pulseAll = (intensity, ms) => app.hands.forEach((h) => app.pulse(h, intensity, ms));

  // Aponta um objeto: -Z olha para o alvo
  const _m = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);
  app.aim = (obj, pos, target) => {
    obj.position.copy(pos);
    _m.lookAt(pos, target, UP);
    obj.quaternion.setFromRotationMatrix(_m);
  };

  const _p = new THREE.Vector3(), _t = new THREE.Vector3();
  function defaultDesktopPose(h, ray) {
    if (h.index !== 0) return false;
    _p.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 0.55);
    _p.x += 0.16; _p.y -= 0.16;
    _t.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 40);
    app.aim(h.mount, _p, _t);
    return true;
  }

  app.headPos = (out) => camera.getWorldPosition(out);

  // Clarão vermelho quando o jogador toma dano
  const hurt = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, fog: false })
  );
  hurt.renderOrder = 999;
  camera.add(hurt);
  let hurtAmt = 0;
  app.hurtFlash = (amt = 0.45) => { hurtAmt = amt; };

  const clock = new THREE.Clock();
  const _s = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    app.time += dt;
    const vr = app.vr;
    if (!vr) app.ray.setFromCamera(app.mouse, camera);
    for (const h of app.hands) {
      if (vr) {
        if (h.source) {
          h.controller.updateMatrixWorld(true);
          h.controller.matrixWorld.decompose(h.mount.position, h.mount.quaternion, _s);
          h.mount.visible = true;
        } else h.mount.visible = false;
      } else {
        const ok = app.desktopPose ? app.desktopPose(h, app.ray, camera) : defaultDesktopPose(h, app.ray);
        h.mount.visible = ok !== false;
      }
      h.mount.updateMatrixWorld(true);
      if (h.hasPrev && dt > 0) h.vel.subVectors(h.mount.position, h.prevPos).divideScalar(dt);
      else h.vel.set(0, 0, 0);
      h.prevPos.copy(h.mount.position);
      h.hasPrev = true;
    }
    hurtAmt = Math.max(0, hurtAmt - dt * 1.2);
    hurt.material.opacity = hurtAmt;
    hurt.visible = hurtAmt > 0.001;
    app.onFrame && app.onFrame(dt, app.time);
    renderer.render(scene, camera);
  });

  return app;
}

// ---------- Placar 3D (canvas como textura) ----------
export class Board {
  constructor(w = 2, h = 1, res = 768) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = res;
    this.canvas.height = Math.round((res * h) / w);
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, fog: false, depthWrite: false })
    );
    this.last = '';
  }
  // opts: { title, lines:[], accent, bg, fg, font }
  show(opts) {
    const key = JSON.stringify(opts);
    if (key === this.last) return;
    this.last = key;
    const { title = '', lines = [], accent = '#ff7a2f', bg = 'rgba(15,15,20,0.78)', fg = '#ffffff', font = 'system-ui, sans-serif' } = opts;
    const g = this.g, W = this.canvas.width, H = this.canvas.height;
    g.clearRect(0, 0, W, H);
    const r = H * 0.08;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, r);
    g.fill();
    g.fillStyle = accent;
    g.fillRect(4 + r, 4, W - 8 - 2 * r, H * 0.035);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const titleSize = H * 0.2;
    g.fillStyle = accent;
    g.font = `800 ${titleSize}px ${font}`;
    g.fillText(title, W / 2, H * 0.22);
    g.fillStyle = fg;
    const n = Math.max(lines.length, 1);
    const lineSize = Math.min(H * 0.13, (H * 0.62) / n * 0.8);
    g.font = `600 ${lineSize}px ${font}`;
    lines.forEach((ln, i) => g.fillText(ln, W / 2, H * 0.42 + i * lineSize * 1.25));
    this.tex.needsUpdate = true;
  }
}

// ---------- Partículas (um único InstancedMesh) ----------
export class Particles {
  constructor(scene, max = 500, size = 0.05) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.p = [];
    this.next = 0;
    this.gravity = -6;
    this.dummy = new THREE.Object3D();
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) {
      this.p.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, scale: 1 });
      this.mesh.setColorAt(i, white);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.color = new THREE.Color();
    scene.add(this.mesh);
  }
  emit(pos, color, n = 20, speed = 3, life = 0.8, scale = 1) {
    this.color.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const q = this.p[i];
      q.pos.copy(pos);
      q.vel.randomDirection().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      q.life = q.max = life * (0.6 + Math.random() * 0.6);
      q.scale = scale * (0.6 + Math.random() * 0.8);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (q.life <= 0) continue;
      q.life -= dt;
      q.vel.y += this.gravity * dt;
      q.pos.addScaledVector(q.vel, dt);
      const s = q.life > 0 ? (q.life / q.max) * q.scale : 0.0001;
      d.position.copy(q.pos);
      d.rotation.set(i, q.life * 6, i * 0.5);
      d.scale.setScalar(Math.max(s, 0.0001));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Utilidades ----------
const _ab = new THREE.Vector3(), _ap = new THREE.Vector3(), _c = new THREE.Vector3();
export function distPointSegment(p, a, b) {
  _ab.subVectors(b, a);
  const t = THREE.MathUtils.clamp(_ap.subVectors(p, a).dot(_ab) / Math.max(_ab.lengthSq(), 1e-9), 0, 1);
  _c.copy(a).addScaledVector(_ab, t);
  return p.distanceTo(_c);
}

export const rand = (a, b) => a + Math.random() * (b - a);

export function loadBest(key) { return Number(localStorage.getItem(key) || 0); }
export function saveBest(key, v) { localStorage.setItem(key, String(v)); }
