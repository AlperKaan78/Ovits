// ============================================================
// src/oyun3d.js  —  SAHİBİ: Kişi 1  (ES modülü; oyun.html yükler, baslat.bat ile açılır)
// 3D oyun: src/*.js oyun mantığı olduğu gibi çalışır (G, modüller, sözleşme aynı). Bu dosya
// döngüyü, fare/klavye girdisini, nesneleri yükseltili zemine oturtmayı, sarmaşığı, meteor
// efektlerini, seçim halkalarını, inşa önizlemesini ve küçük haritayı yapar.
//   Zemin, ışık, kamera:  src/world3d.js (Kişi 1)
//   Modeller:             assets/art3d.js createModel (Kişi 3; binalar kodla, canlılar Blender .glb ile yenilenecek)
//   Arayüz:               assets/ui3d.js (Kişi 3; window.UI)
// Kamera: WASD / oklar / ekran kenarı kaydırır, tekerlek yakınlaştırır, Q döndürür (Shift+Q ters), orta tuş sürükler.
// Sayfa adresine #test eklenirse kendi kendini sınar ve sonucu konsola yazar.
// ============================================================
import { THREE, createWorld } from './world3d.js';
import { createModel, batchStatic } from '../assets/art3d.js';

const $ = (id) => document.getElementById(id);
const failed = new Set();
function fail(name, err) {
  console.error('[' + name + ']', err);
  if (failed.has(name)) return;
  failed.add(name);
  const box = $('error');
  box.hidden = false;
  box.textContent = (box.textContent ? box.textContent + '\n' : '') + name + ': ' + (err && err.message ? err.message : err);
}

// ---------- Oyun durumu ----------
const G = (Game.G = Game.newState());
for (const m of Game.modules) { try { if (m.init) m.init(G); } catch (e) { fail(m.name, e); } }
const world = createWorld($('world'), { map: G.map });
window.World3D = world;
{
  const mk = Game.merkez(G);
  if (mk) world.focus(mk.x + mk.size / 2 + 5, mk.y + mk.size / 2);
}
Game.msg(G, `Mor Sarmaşık başladı. İlk meteor dalgası ${Math.round(G.flags.nextWaveIn || 60)} saniye sonra.`, '#f2c14e');

// core.js'in 2D kamera yardımcılarının 3D karşılıkları (city.js '.' tuşu gibi yerler kullanır)
const keys = new Set();
Game.centerOn = (state, x, y) => world.focus(x, y);
Game.viewSize = () => ({ w: window.innerWidth, h: window.innerHeight });
Game.keyDown = (k) => keys.has(k);

const W = G.map.w, H = G.map.h;
const scene = world.scene;
const tileToWorld = (x, y, lift) => new THREE.Vector3(x - W / 2, world.heightAt(x, y) + (lift || 0), y - H / 2);

// ---------- Nesneler ----------
const ALIAS = { kule: 'cekimKulesi', ocak: 'tasOcagi', lab: 'laboratuvar', tasiyici: 'koloni', savasci: 'koloni', toplayici: 'koloni', muhafiz: 'koloni' };
const records = new Map();
function scaleFor(kind, e) {
  if (['isci', 'asker', 'bilimci', 'akinci'].includes(kind)) return 0.4;
  if (['merkez', 'ev', 'laboratuvar', 'karakol'].includes(kind)) return (e.size || 1) * 0.3;
  return 0.6;
}
function dropRecord(r) {
  scene.remove(r.model);
  r.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
// Bina tabanı köşelerin en yükseğine oturur, yamaçta gömülmez
function groundUnder(e) {
  if (!e.size) return world.heightAt(e.x, e.y);
  const s = e.size;
  return Math.max(world.heightAt(e.x + s / 2, e.y + s / 2), world.heightAt(e.x, e.y), world.heightAt(e.x + s, e.y),
    world.heightAt(e.x, e.y + s), world.heightAt(e.x + s, e.y + s)) - 0.05;
}

function syncEntities(dt) {
  const seen = new Set();
  const members = [];
  G.colonies.forEach((c) => c.members.forEach((m) => members.push(m)));
  const lists = [[G.buildings, null], [G.units, null], [G.enemies, 'akinci'], [G.crystals, 'kristal'], [members, null]];
  for (const [list, def] of lists) for (const e of list) {
    if (e.dead || e.hp <= 0 || e.state === 'chipped' || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    if (def === 'kristal' && (e.carriedBy != null || (e.oz != null && e.oz <= 0))) continue;
    const src = e.kind || e.role || e.type, kind = ALIAS[src] || def || src;
    seen.add(e);
    let r = records.get(e);
    if (r && r.kind !== kind) { dropRecord(r); records.delete(e); r = null; }
    if (!r) {
      const model = batchStatic(createModel(kind));
      model.userData.entity = e;
      r = { model, kind, lastX: e.x, lastY: e.y };
      records.set(e, r);
      scene.add(model);
    }
    const off = e.size ? e.size / 2 : 0, m = r.model;
    m.position.set(e.x + off - W / 2, groundUnder(e), e.y + off - H / 2);
    m.scale.setScalar(scaleFor(kind, e));
    const dx = e.x - r.lastX, dy = e.y - r.lastY;
    if (Math.hypot(dx, dy) > 0.001 && !e.size) m.rotation.y = Math.atan2(dx, dy);
    else if (kind === 'kristal') m.rotation.y += dt * 1.2;
    r.lastX = e.x; r.lastY = e.y;
    m.rotation.z = e.state === 'fainted' ? Math.PI / 2 : 0;
    if (e.built === false) {
      const bt = (G.cfg.buildings[e.type] && G.cfg.buildings[e.type].buildTime) || 1;
      m.scale.y *= 0.15 + 0.85 * Math.min(1, (e.progress || 0) / bt);
    }
    if (e.carrying && !r.cargo) {
      r.cargo = batchStatic(createModel('kristal'));
      r.cargo.scale.setScalar(0.35); r.cargo.position.set(0, 1.2, -0.55);
      m.add(r.cargo);
    }
    if (r.cargo) r.cargo.visible = !!e.carrying;
  }
  for (const [e, r] of records) if (!seen.has(e)) { dropRecord(r); records.delete(e); }
}

// Tıklanan nesne: önce ekranda imlece en yakın birim (bina arkasında kalsa bile seçilebilsin, AoE gibi),
// yoksa modele çarpan ışın (bina cephesine tıklayınca arkasındaki zemin değil bina seçilsin)
function hitEntity(cx, cy) {
  let best = null, bd = 18;
  for (const [e, r] of records) {
    if (e.size || r.kind === 'kristal') continue;
    tmpV.copy(r.model.position); tmpV.y += 0.3; tmpV.project(world.camera);
    if (tmpV.z > 1 || tmpV.z < -1) continue;
    const d = Math.hypot(((tmpV.x + 1) * window.innerWidth) / 2 - cx, ((1 - tmpV.y) * window.innerHeight) / 2 - cy);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  const rc = world.rayFrom(cx, cy);
  const hits = rc.intersectObjects([...records.values()].map((r) => r.model), true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.entity) o = o.parent;
    if (o) return o.userData.entity;
  }
  return null;
}

// ---------- Sarmaşık (kare başına çoğaltılmış model) ----------
const vineTpl = batchStatic(createModel('sarmasik'));
const vineMeshes = [];
let vineT = 1;
function syncVines(dt) {
  vineT += dt;
  if (vineT < 0.3 || !G.map.vine) return;
  vineT = 0;
  const cap = W * H;
  if (!vineMeshes.length) {
    vineTpl.traverse((t) => {
      if (!t.isMesh) return;
      const inst = new THREE.InstancedMesh(t.geometry, t.material, cap);
      inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false; inst.count = 0;
      scene.add(inst); vineMeshes.push(inst);
    });
  }
  const d = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < cap; i++) {
    const v = G.map.vine[i];
    if (!v) continue;
    const x = (i % W) + 0.5, y = Math.floor(i / W) + 0.5;
    d.position.set(x - W / 2, world.heightAt(x, y), y - H / 2);
    d.scale.setScalar(v === 2 ? 0.62 : 0.45);
    d.rotation.set(0, i * 2.4, 0);
    d.updateMatrix();
    for (const m of vineMeshes) m.setMatrixAt(n, d.matrix);
    n++;
  }
  for (const m of vineMeshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
}

// ---------- Meteorlar: zemindeki ışıltı, altın halka, düşüş ve çarpma ----------
const MC = G.cfg.meteors;
const AURORA_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const AURORA_FS = `
uniform float uTime, uK, uQ, uRing, uAng; uniform vec3 uA, uB, uGold; varying vec2 vUv;
void main(){
  vec2 q = vUv * 2.0 - 1.0; float r = length(q);
  if (r > 1.0) discard;
  float cs = cos(uAng), sn = sin(uAng); vec2 p = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  float fall = 1.0 - smoothstep(0.45, 1.0, r), bands = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float y = (fi - 1.5) * 0.3 + sin(p.x * 3.2 + uTime * 1.4 + fi * 1.7) * 0.16 + sin(p.x * 7.0 - uTime * 2.1 + fi) * 0.04;
    bands += exp(-pow((p.y - y) * 10.0, 2.0));
  }
  vec3 aur = mix(uA, uB, 0.5 + 0.5 * sin(p.x * 2.3 + uTime * 0.7)) * bands * fall * uK;
  float ring = exp(-pow((r - uRing) * 22.0, 2.0)) * uQ;
  float core = (1.0 - smoothstep(0.0, max(uRing, 0.05), r)) * uQ;
  gl_FragColor = vec4(aur * (1.0 - uQ * 0.8) + uGold * (ring * 1.8 + core * 0.35), 1.0);
  #include <colorspace_fragment>
}`;
const fxMeteors = new Map(), impacts = [];
const rockGeo = new THREE.IcosahedronGeometry(1, 1);
const rockMat = new THREE.MeshBasicMaterial({ color: '#fff1cc' });
const trailGeo = new THREE.CylinderGeometry(0.03, 1, 1, 10, 1, true).translate(0, 0.5, 0);
const trailMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
const flashGeo = new THREE.SphereGeometry(1, 16, 12);
const waveGeo = new THREE.RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2);
const FALL = 0.8, FALL_DIR = new THREE.Vector3(-0.22, 1, 0.18).normalize(), FALL_LEN = 22;
const UP = new THREE.Vector3(0, 1, 0);

function makeAurora() {
  const R = MC.auroraRadius;
  const geo = new THREE.PlaneGeometry(2 * R, 2 * R, 24, 24).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uK: { value: 0 }, uQ: { value: 0 }, uRing: { value: 0.6 }, uAng: { value: 0 },
      uA: { value: new THREE.Color('#78dcaa') }, uB: { value: new THREE.Color('#aa6ef0') }, uGold: { value: new THREE.Color('#f2aa3c') },
    },
    vertexShader: AURORA_VS, fragmentShader: AURORA_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3; mesh.frustumCulled = false;
  scene.add(mesh);
  const rock = new THREE.Mesh(rockGeo, rockMat), trail = new THREE.Mesh(trailGeo, trailMat);
  trail.quaternion.setFromUnitVectors(UP, FALL_DIR);
  rock.visible = trail.visible = false;
  scene.add(rock, trail);
  return { mesh, rock, trail, cx: NaN, cy: NaN, t: 99 };
}
// Işıltı ağı zemini izler: köşe yükseklikleri kayan meteorla birlikte güncellenir
function conform(fx, cx, cy) {
  if (Math.abs(fx.cx - cx) < 0.01 && Math.abs(fx.cy - cy) < 0.01) return;
  fx.cx = cx; fx.cy = cy;
  const pos = fx.mesh.geometry.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setY(k, world.heightAt(pos.getX(k) + cx, pos.getZ(k) + cy) + 0.15);
  pos.needsUpdate = true;
  fx.mesh.position.set(cx - W / 2, 0, cy - H / 2);
}
function dropAurora(fx) {
  scene.remove(fx.mesh, fx.rock, fx.trail);
  fx.mesh.geometry.dispose(); fx.mesh.material.dispose();
}
function impact(x, y, type) {
  const d = MC.types[type] || MC.types.kaya, R = d.radius, p = tileToWorld(x, y, 0.1);
  const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: '#fff5dc', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const wave = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: '#ffbe6e', transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
  const light = new THREE.PointLight('#ffb35c', 40, R * 8, 2);
  const N = type === 'dev' ? 60 : 34, pts = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, s = (0.6 + Math.random() * 1.6) * R;
    pts.set([p.x, p.y, p.z], i * 3);
    vel.push(new THREE.Vector3(Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s));
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#d8c6a5', size: 0.22, transparent: true, depthWrite: false }));
  flash.position.copy(p); wave.position.copy(p).y += 0.08; light.position.copy(p).y += 1.5;
  scene.add(flash, wave, light, dust);
  impacts.push({ age: 0, R, flash, wave, light, dust, vel });
}
function syncMeteors(dt) {
  const seen = new Set();
  for (const me of G.meteors) {
    seen.add(me);
    let fx = fxMeteors.get(me);
    if (!fx) { fx = makeAurora(); fxMeteors.set(me, fx); }
    fx.t = me.t; fx.x = me.x; fx.y = me.y; fx.type = me.type;
    const p = window.Meteors && Meteors.displayPos ? Meteors.displayPos(G, me) : me;
    conform(fx, p.x, p.y);
    const u = fx.mesh.material.uniforms, q = Math.max(0, Math.min(1, 1 - me.t / MC.focusTime));
    const far = Math.max(0, Math.min(1, 1 - (me.t - MC.focusTime) / Math.max(0.1, MC.auroraTime - MC.focusTime)));
    u.uTime.value = G.time; u.uAng.value = me.ang || 0; u.uQ.value = q;
    u.uK.value = (0.35 + 0.65 * far) * (1 - q * 0.6);
    u.uRing.value = 0.6 + ((MC.types[me.type] || MC.types.kaya).radius / MC.auroraRadius - 0.6) * q;
    const falling = me.t <= FALL;
    fx.rock.visible = fx.trail.visible = falling;
    if (falling) {
      const target = tileToWorld(me.x, me.y), k = me.t / FALL, size = me.type === 'dev' ? 0.65 : 0.38;
      fx.rock.position.copy(target).addScaledVector(FALL_DIR, FALL_LEN * k);
      fx.rock.scale.setScalar(size);
      fx.trail.position.copy(fx.rock.position);
      fx.trail.scale.set(size * 0.9, 7, size * 0.9);
    }
  }
  for (const [me, fx] of fxMeteors) {
    if (seen.has(me)) continue;
    if (fx.t < 0.35) impact(fx.x, fx.y, fx.type); // meteors.js düşen meteoru listeden çıkardı: çarpma anı
    dropAurora(fx); fxMeteors.delete(me);
  }
  for (let i = impacts.length - 1; i >= 0; i--) {
    const f = impacts[i];
    f.age += dt;
    f.flash.scale.setScalar(f.R * (0.3 + f.age * 4)); f.flash.material.opacity = Math.max(0, 1 - f.age / 0.3);
    f.wave.scale.setScalar(f.R * (0.3 + f.age * 2.2)); f.wave.material.opacity = Math.max(0, 0.9 * (1 - f.age / 0.9));
    f.light.intensity = 40 * Math.max(0, 1 - f.age / 0.45);
    const pos = f.dust.geometry.attributes.position;
    for (let k = 0; k < f.vel.length; k++) {
      const v = f.vel[k];
      v.y -= 7 * dt;
      pos.setXYZ(k, pos.getX(k) + v.x * dt, Math.max(f.flash.position.y - 0.1, pos.getY(k) + v.y * dt), pos.getZ(k) + v.z * dt);
    }
    pos.needsUpdate = true;
    f.dust.material.opacity = Math.max(0, 1 - f.age / 1.6);
    if (f.age > 1.6) {
      scene.remove(f.flash, f.wave, f.light, f.dust);
      f.flash.material.dispose(); f.wave.material.dispose(); f.dust.geometry.dispose(); f.dust.material.dispose();
      impacts.splice(i, 1);
    }
  }
}

// ---------- Seçim halkaları, inşa önizlemesi ----------
const ringGeo = new THREE.TorusGeometry(1, 0.035, 6, 48).rotateX(Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ color: '#5fd4e0', transparent: true, opacity: 0.95, depthWrite: false });
const rings = [];
function syncRings() {
  const list = (G.ui.selection || []).slice();
  const s = G.ui.selected, se = s && s.member ? s.member : s;
  if (se && !list.includes(se)) list.push(se);
  let i = 0;
  for (const e of list) {
    const r = records.get(e);
    if (!r) continue;
    let ring = rings[i];
    if (!ring) { ring = new THREE.Mesh(ringGeo, ringMat); ring.renderOrder = 5; scene.add(ring); rings.push(ring); }
    ring.visible = true;
    ring.position.copy(r.model.position); ring.position.y += 0.06;
    ring.scale.setScalar(e.size ? e.size * 0.75 : 0.45);
    i++;
  }
  for (; i < rings.length; i++) rings[i].visible = false;
}
const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshBasicMaterial({ color: '#4caf50', transparent: true, opacity: 0.45, depthWrite: false }));
const flatRing = (color) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
  m.renderOrder = 6; m.visible = false; scene.add(m); return m;
};
const forbidRing = flatRing('#e74c3c'), rangeRing = flatRing('#f4ecdc');
ghost.visible = false; ghost.renderOrder = 4; scene.add(ghost);
function syncGhost() {
  const type = G.ui.buildMode, d = type && G.cfg.buildings[type];
  ghost.visible = forbidRing.visible = rangeRing.visible = false;
  if (!d || !window.City || !City.placeAt) return;
  const p = City.placeAt(G, type), s = d.size, ok = City.canPlace(G, type, p.x, p.y).ok;
  const h = groundUnder({ x: p.x, y: p.y, size: s });
  ghost.visible = true;
  ghost.position.set(p.x + s / 2 - W / 2, h + 0.15, p.y + s / 2 - H / 2);
  ghost.scale.set(s, 1, s);
  ghost.material.color.set(ok ? '#4caf50' : '#e74c3c');
  const r = d.landRadius || d.range || d.guardRadius;
  if (r) { rangeRing.visible = true; rangeRing.position.copy(ghost.position); rangeRing.position.y = h + 0.1; rangeRing.scale.setScalar(r); }
  const mk = d.minDistFromMerkez && Game.merkez(G);
  if (mk) {
    const c = Game.center(mk);
    forbidRing.visible = true; forbidRing.scale.setScalar(d.minDistFromMerkez);
    forbidRing.position.copy(tileToWorld(c.x, c.y, 0.1));
  }
}

// ---------- Girdi ----------
const el = world.renderer.domElement;
// assets/ui3d.js'in kapladığı alanlar: üst çubuk, alt bina çubuğu, seçim paneli
function uiLayout() {
  const w = window.innerWidth, h = window.innerHeight;
  const n = Object.keys(G.cfg.buildings).filter((k) => k !== 'merkez').length;
  const cols = Math.max(1, Math.min(6, Math.floor((w - 24) / 155))), rows = Math.max(1, Math.ceil(n / cols));
  return { top: 80, bottom: h - rows * 57 - 26, side: Math.min(290, w * 0.36) };
}
function overUI(sx, sy) {
  const L = uiLayout();
  if (sy < L.top || sy >= L.bottom) return true;
  return !!G.ui.selected && sx >= window.innerWidth - L.side - 12 && sy >= 92;
}
function updateMouse(cx, cy) {
  const mm = G.ui.mouse;
  mm.sx = cx; mm.sy = cy;
  const p = world.pick(cx, cy);
  if (p) { mm.wx = p.wx; mm.wy = p.wy; mm.tx = p.tx; mm.ty = p.ty; }
}
function syncSelection() {
  const s = G.ui.selected;
  if (!s || !s.kind || s.owner !== 'player') { if (!s || !s.kind) G.ui.selection = []; return; }
  if (!G.ui.selection.includes(s)) G.ui.selection = [s];
}
// Tıklamayı modüllere sırayla sor (önce arayüz, en son dünya); kimse kullanmazsa seçimi bırak. core.js ile aynı kural.
function dispatchClick(info) {
  let used = false;
  for (let i = Game.modules.length - 1; i >= 0 && !used; i--) {
    const m = Game.modules[i];
    try { if (m.onClick && m.onClick(G, info)) used = true; } catch (e) { fail(m.name, e); }
  }
  if (!used && info.button === 0) { G.ui.selected = null; G.ui.selection = []; }
  syncSelection();
}
function click(cx, cy, button, shift) {
  updateMouse(cx, cy);
  const mm = G.ui.mouse;
  const info = { sx: cx, sy: cy, wx: mm.wx, wy: mm.wy, tx: mm.tx, ty: mm.ty, button, shift };
  if (!G.ui.buildMode && !overUI(cx, cy)) {
    const e = hitEntity(cx, cy);
    if (e) {
      const off = e.size ? e.size / 2 : 0;
      info.wx = e.x + off; info.wy = e.y + off; info.tx = Math.floor(info.wx); info.ty = Math.floor(info.wy);
    }
  }
  dispatchClick(info);
}
function boxSelect(d) {
  const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
  let list = G.units.filter((u) => {
    if (u.owner !== 'player' || u.hp <= 0 || u.kind === 'yumurta') return false;
    const s = world.toScreen(u.x, u.y, 0.3);
    return s.visible && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
  });
  if (list.some((u) => u.kind !== 'yavru')) list = list.filter((u) => u.kind !== 'yavru');
  G.ui.selection = d.shift ? Array.from(new Set(G.ui.selection.concat(list))) : list;
  G.ui.selected = G.ui.selection[0] || null;
}

let press = null;
el.addEventListener('contextmenu', (e) => e.preventDefault());
el.addEventListener('mousedown', (e) => {
  updateMouse(e.clientX, e.clientY);
  if (e.button === 2) { click(e.clientX, e.clientY, 2, e.shiftKey); return; }
  if (e.button !== 0) return; // orta tuş: kamera (world3d.js)
  const blocked = overUI(e.clientX, e.clientY) || !!G.ui.buildMode || !!G.over;
  press = { shift: e.shiftKey };
  if (!blocked) G.ui.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, active: false, shift: e.shiftKey };
});
window.addEventListener('mousemove', (e) => {
  updateMouse(e.clientX, e.clientY);
  if (window.UI && UI.onMouseMove) UI.onMouseMove(G, { sx: e.clientX, sy: e.clientY });
  const d = G.ui.drag;
  if (d) {
    d.x1 = e.clientX; d.y1 = e.clientY;
    if (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) > 8) { d.active = true; world.edgeScroll = false; }
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !press) return;
  const d = G.ui.drag, p = press;
  G.ui.drag = null; press = null; world.edgeScroll = true;
  if (d && d.active) boxSelect(d);
  else click(e.clientX, e.clientY, 0, p.shift);
});
window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  keys.add(e.key.toLowerCase());
  if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  if (e.key === ' ') G.paused = !G.paused;
  else if (['1', '2', '3'].includes(e.key) && !e.ctrlKey) G.speed = Number(e.key);
  else if (e.key === 'Escape') { G.ui.buildMode = null; G.ui.tool = null; G.ui.selected = null; G.ui.selection = []; }
  for (const m of Game.modules) { try { if (m.onKey) m.onKey(G, e.key, e); } catch (err) { fail(m.name, err); } }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ---------- Ekran katmanı: can çubukları, kutu seçimi, arayüz ----------
const hud = $('hud'), hctx = hud.getContext('2d');
const tmpV = new THREE.Vector3();
function drawHud() {
  const w = window.innerWidth, h = window.innerHeight;
  if (hud.width !== w || hud.height !== h) { hud.width = w; hud.height = h; }
  hctx.clearRect(0, 0, w, h);
  const sel = G.ui.selected && G.ui.selected.member ? G.ui.selected.member : G.ui.selected;
  for (const [e, r] of records) {
    if (!(e.maxHp > 0) || (e.hp >= e.maxHp && e !== sel && !G.ui.selection.includes(e))) continue;
    tmpV.copy(r.model.position); tmpV.y += e.size ? e.size * 1.1 : 0.9; tmpV.project(world.camera);
    if (tmpV.z > 1 || tmpV.z < -1) continue;
    const x = ((tmpV.x + 1) * w) / 2, y = ((1 - tmpV.y) * h) / 2, bw = e.size ? 44 : 30;
    hctx.fillStyle = '#251f28'; hctx.fillRect(x - bw / 2, y, bw, 4);
    hctx.fillStyle = e.owner === 'player' || e.size ? '#9be7a1' : '#e74c3c';
    hctx.fillRect(x - bw / 2, y, bw * Math.max(0, Math.min(1, e.hp / e.maxHp)), 4);
  }
  const d = G.ui.drag;
  if (d && d.active) {
    hctx.fillStyle = 'rgba(95,212,224,0.12)'; hctx.strokeStyle = '#5fd4e0'; hctx.lineWidth = 1;
    hctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); hctx.strokeRect(d.x0 + 0.5, d.y0 + 0.5, d.x1 - d.x0, d.y1 - d.y0);
  }
  if (window.UI && UI.drawUI) { try { UI.drawUI(hctx, G); } catch (e) { fail('ui', e); } }
}

// ---------- Küçük harita ----------
const mini = $('mini'), mctx = mini.getContext('2d');
const MS = mini.width / W;
let miniBase = null, miniT = 1;
function buildMiniBase() {
  miniBase = document.createElement('canvas');
  miniBase.width = mini.width; miniBase.height = mini.height;
  const c = miniBase.getContext('2d'), base = { rock: [140, 135, 127], plain: [185, 173, 151], forest: [62, 47, 69] };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = base[world.terrainType(x, y)], k = 0.85 + Math.max(-0.15, Math.min(0.2, world.heightAt(x + 0.5, y + 0.5) * 0.08));
    c.fillStyle = `rgb(${b[0] * k | 0},${b[1] * k | 0},${b[2] * k | 0})`;
    c.fillRect(x * MS, y * MS, MS + 0.5, MS + 0.5);
  }
}
function drawMini() {
  const L = uiLayout();
  mini.style.top = Math.max(L.top + 8, L.bottom - mini.height - 14) + 'px';
  if (!miniBase) buildMiniBase();
  mctx.drawImage(miniBase, 0, 0);
  const dot = (x, y, s, color) => { mctx.fillStyle = color; mctx.fillRect(x * MS - s / 2, y * MS - s / 2, s, s); };
  if (G.map.vine) {
    mctx.fillStyle = 'rgba(123,63,160,0.85)';
    for (let i = 0; i < G.map.vine.length; i++) if (G.map.vine[i]) mctx.fillRect((i % W) * MS, Math.floor(i / W) * MS, MS, MS);
  }
  G.meteors.forEach((me) => { mctx.strokeStyle = '#f2aa3c'; mctx.beginPath(); mctx.arc(me.x * MS, me.y * MS, 4, 0, Math.PI * 2); mctx.stroke(); });
  G.crystals.forEach((c) => dot(c.x, c.y, 3, '#f2c14e'));
  G.buildings.forEach((b) => { if (b.hp > 0) { mctx.fillStyle = '#c9773a'; mctx.fillRect(b.x * MS, b.y * MS, b.size * MS, b.size * MS); } });
  G.colonies.forEach((col) => col.members.forEach((m) => { if (m.hp > 0 && m.state !== 'chipped') dot(m.x, m.y, 3, m.state === 'attack' ? '#e74c3c' : '#6f9a3a'); }));
  G.units.forEach((u) => { if (u.owner === 'player' && u.hp > 0) dot(u.x, u.y, 3, G.ui.selection.includes(u) ? '#ffffff' : '#f1e6cf'); });
  G.enemies.forEach((e) => { if (e.hp > 0) dot(e.x, e.y, 4, '#e74c3c'); });
  // Kameranın gördüğü alan
  const w = window.innerWidth, h = window.innerHeight;
  const corners = [[0, L.top], [w, L.top], [w, L.bottom], [0, L.bottom]].map(([x, y]) => world.groundAt(x, y));
  if (corners.every(Boolean)) {
    mctx.strokeStyle = '#5fd4e0'; mctx.lineWidth = 1.2; mctx.beginPath();
    corners.forEach((p, i) => (i ? mctx.lineTo(p.wx * MS, p.wy * MS) : mctx.moveTo(p.wx * MS, p.wy * MS)));
    mctx.closePath(); mctx.stroke();
  }
}
mini.addEventListener('contextmenu', (e) => e.preventDefault());
mini.addEventListener('mousedown', (e) => {
  const r = mini.getBoundingClientRect(), wx = (e.clientX - r.left) / MS, wy = (e.clientY - r.top) / MS;
  if (e.button === 0) world.focus(wx, wy);
  else if (e.button === 2) dispatchClick({ sx: -1, sy: -1, wx, wy, tx: Math.floor(wx), ty: Math.floor(wy), button: 2, shift: e.shiftKey });
  e.preventDefault(); e.stopPropagation();
});

// ---------- Döngü ----------
let last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  tick(dt);
  requestAnimationFrame(frame);
}
function tick(dt) {
  frames++;
  if (!G.paused && !G.over) {
    const sdt = dt * G.speed;
    G.time += sdt;
    for (const m of Game.modules) { try { if (m.update) m.update(G, sdt); } catch (e) { fail(m.name, e); } }
    G.buildings = G.buildings.filter((b) => b.hp > 0 || b.type === 'merkez');
    G.units = G.units.filter((u) => u.hp > 0);
    G.enemies = G.enemies.filter((e) => e.hp > 0);
    G.ui.selection = G.ui.selection.filter((u) => u.hp > 0 && G.units.includes(u));
    const mk = G.buildings.find((b) => b.type === 'merkez');
    if (!mk || mk.hp <= 0) G.over = 'lose';
    else if (G.res.oz >= G.cfg.win.oz) G.over = 'win';
  }
  world.setNight(G.flags.night || 0);
  world.update(dt);
  try { syncEntities(dt); syncVines(dt); syncMeteors(dt); syncRings(); syncGhost(); } catch (e) { fail('3D çizim', e); }
  world.render();
  drawHud();
  miniT += dt;
  if (miniT > 0.25) { miniT = 0; drawMini(); }
}
requestAnimationFrame(frame);

window.oyun3d = { G, world, records, fail, failed, auroras: () => fxMeteors.size, impacts: () => impacts.length };

// ---------- Kendi kendini sınama (oyun.html#test) ----------
if (location.hash === '#test') setTimeout(async () => {
  // Başlıksız tarayıcı ekran karesi üretmeyebilir: zaman kare kare elle ilerletilir
  const sleep = async (ms) => { for (let i = 0; i < Math.ceil(ms / 33); i++) tick(1 / 30); await new Promise((r) => setTimeout(r, 0)); };
  const results = [], ok = (name, cond) => results.push((cond ? 'GECTI ' : 'KALDI ') + name);
  const fire = (type, x, y, button = 0, target = el) => target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true }));
  const tap = async (x, y, button = 0) => { fire('mousemove', x, y); fire('mousedown', x, y, button); await sleep(30); fire('mouseup', x, y, button); await sleep(60); };
  const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  try {
    key('e');
    ok('E tuşu Ev kurma moduna geçer', G.ui.buildMode === 'ev');
    let spot = null;
    for (let y = 22; y < 30 && !spot; y++) for (let x = 3; x < 10 && !spot; x++) if (City.canPlace(G, 'ev', x, y).ok) spot = { x, y };
    const before = G.buildings.length;
    world.focus(spot.x, spot.y); await sleep(400);
    const s2 = world.toScreen(spot.x + 0.5, spot.y + 0.5);
    await tap(s2.x, s2.y);
    ok(`yükseltili zeminde tıklanan kareye Ev kurulur (${spot.x},${spot.y})`, G.buildings.length === before + 1 && G.ui.buildMode === null);
    key('Escape');
    const worker = G.units.find((u) => u.kind === 'isci');
    const ws = world.toScreen(worker.x, worker.y, 0.2);
    await tap(ws.x, ws.y);
    ok('işçiye tıklayınca seçilir', G.ui.selection[0] && G.ui.selection[0].kind === 'isci');
    const mv = world.toScreen(worker.x + 2, worker.y + 2);
    fire('mousedown', mv.x, mv.y, 2); await sleep(50);
    ok('sağ tık yürüme emri verir', !!(G.ui.selection[0] && G.ui.selection[0].order && G.ui.selection[0].order.type === 'move'));
    key('Escape');
    const pts = G.units.filter((u) => u.owner === 'player').map((u) => world.toScreen(u.x, u.y, 0.2));
    const bx0 = Math.min(...pts.map((p) => p.x)) - 25, by0 = Math.min(...pts.map((p) => p.y)) - 25;
    const bx1 = Math.max(...pts.map((p) => p.x)) + 25, by1 = Math.max(...pts.map((p) => p.y)) + 25;
    fire('mousemove', bx0, by0); fire('mousedown', bx0, by0); fire('mousemove', (bx0 + bx1) / 2, (by0 + by1) / 2, 0, window);
    fire('mousemove', bx1, by1, 0, window); fire('mouseup', bx1, by1, 0, window); await sleep(50);
    ok(`kutu seçimi birden çok birim seçer (${G.ui.selection.length})`, G.ui.selection.length >= 2);
    key('Escape');
    const test = { x: 24, y: 20, type: 'kaya', t: 6, t0: 15, sx: 20, sy: 16, ang: 0.5 };
    G.meteors.push(test);
    const f0 = frames;
    await sleep(500);
    ok(`meteor ışıltısı zeminde belirir (kare ${frames - f0}, meteor ${G.meteors.length}, ışıltı ${fxMeteors.size}, duraklatılmış ${G.paused})`, fxMeteors.size >= 1);
    test.t = 0.3;
    await sleep(1200);
    ok(`meteor düşünce çarpma efekti oluşur (çarpma ${impacts.length}, kristal ${G.crystals.length})`, impacts.length >= 1);
    const px = mctx.getImageData(10, 10, 1, 1).data;
    ok('küçük harita çiziliyor', px[3] > 0);
    const yaw0 = world.camera.position.clone();
    key('q'); await sleep(600);
    ok('Q kamerayı döndürür', world.camera.position.distanceTo(yaw0) > 1);
    ok('hiç modül hatası yok', failed.size === 0);
  } catch (e) { results.push('KALDI test çalışırken hata: ' + e.message); }
  results.forEach((r) => console.log('TEST ' + r));
  console.log('TEST SONUC ' + results.filter((r) => r.startsWith('GECTI')).length + '/' + results.length);
}, 1200);
