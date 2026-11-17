// 수달섬 — 모양 다듬기(밤샘 4단계): 나무 · 바위 · 집 밑 둥근 가짜 그림자 · 걸을 때 먼지 · 수달 조각 합치기
// 롱빈터 느낌(위에서 내려다봄 · 따뜻한 햇빛 · 푸른 그늘)을 목표로. 모델은 바꾸지 않음.

// ── 둥근 가짜 그림자(바닥에 깔린 흐린 원) — 해 그림자가 꺼진 낮은 품질에서도 물체가 땅에 붙어 보이게 ──
const BLOB_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, color: 0x1e3a5a, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: true });
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const blobs = (() => {
  const list = [...TREES.map((r) => [r, 3.4]), ...ROCKS.map((r) => [r, 2.6])];
  const im = new THREE.InstancedMesh(BLOB_GEO, BLOB_MAT, list.length), m = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  list.forEach(([r, k], i) => {
    r.m.decompose(p, q, s);
    const d = r.type === 'rock' || ROCKS.includes(r) ? (r.circle ? r.circle.r : 0.6) * k : Math.max(s.x, s.z) * k;
    m.makeScale(d, 1, d).setPosition(r.x, height(r.x, r.z) + 0.04, r.z); im.setMatrixAt(i, m);
    r.blob = { im, i, m: m.clone() };
  });
  im.renderOrder = -1; im.frustumCulled = false; scene.add(im); return im;
})();
function blobOn(r, on) { if (!r.blob) return; r.blob.im.setMatrixAt(r.blob.i, on ? r.blob.m : ZERO_M); r.blob.im.instanceMatrix.needsUpdate = true; }
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
// 집 밑 그림자(집 상자 크기)
function houseBlob(box) {
  const w = (box.x1 - box.x0) * 1.35, d = (box.z1 - box.z0) * 1.35, x = (box.x0 + box.x1) / 2, z = (box.z0 + box.z1) / 2;
  const o = new THREE.Mesh(BLOB_GEO, BLOB_MAT); o.scale.set(w, 1, d); o.position.set(x, height(x, z) + 0.05, z); o.renderOrder = -1; scene.add(o); return o;
}

// ── 걸을 때 먼지(작은 흙 알갱이 — 정해진 24개를 돌려 씀 · 새로 만들지 않음) ──
const DUST_G = new THREE.SphereGeometry(0.07, 6, 4), dust = [];
for (let i = 0; i < 24; i++) { const o = new THREE.Mesh(DUST_G, new THREE.MeshBasicMaterial({ color: 0xd9c49a, transparent: true, opacity: 0, depthWrite: false })); o.visible = false; scene.add(o); dust.push({ o, t: 0 }); }
let dustI = 0;
function puffDust(x, z, k) {
  let d = null; for (let i = 0; i < dust.length && !d; i++) { const c = dust[(dustI + i) % dust.length]; if (c.t <= 0) d = c; } // 빈 칸이 없으면 안 만듦(깜빡임 막음 · 리뷰 3번)
  if (!d) return; dustI++; d.t = d.t0 = 0.55; d.vx = (Math.random() - 0.5) * 0.5; d.vz = (Math.random() - 0.5) * 0.5; d.k = k;
  d.o.position.set(x + (Math.random() - 0.5) * 0.2, groundY(x, z) + 0.05, z + (Math.random() - 0.5) * 0.2); d.o.visible = true; // 다리 위에서도 보이게(리뷰 2번)
}
const dustAt = new WeakMap();
function stepDust(obj, x, z, speed, dt) {
  if (speed < 2.2 || quality.level < 1) return; // 걷기 이상 · 낮은 품질에선 끔
  let t = (dustAt.get(obj) || 0) - dt; if (t <= 0) { t = speed > 6 ? 0.09 : 0.2; puffDust(x, z, speed > 6 ? 1.3 : 0.8); } dustAt.set(obj, t);
}
function lookTick(dt) {
  fallTick(dt);
  for (const d of dust) {
    if (d.t <= 0) continue; d.t -= dt; const a = Math.max(0, d.t / d.t0);
    if (d.t <= 0) { d.o.visible = false; continue; }
    d.o.position.x += d.vx * dt; d.o.position.z += d.vz * dt; d.o.position.y += 0.35 * dt;
    d.o.scale.setScalar(d.k * (1 + (1 - a) * 1.8)); d.o.material.opacity = 0.45 * a;
  }
  stepDust(me.obj, me.x, me.z, me.dead ? 0 : Math.abs(me.speed || 0), dt);
  for (const o of net.others.values()) if (Math.abs(o.x - me.x) < 25 && Math.abs(o.z - me.z) < 25) stepDust(o.obj, o.x, o.z, o.s || 0, dt); // 가까운 사람만
  BLOB_MAT.opacity = sun.castShadow ? 0.2 : 0.34; // 해 그림자가 켜지면 둥근 그림자는 옅게(두 겹 어두움 막음)
}

// ── 수달 조각 합치기: 한 뼈대(몸 · 팔 · 다리 · 머리) 안에서 같은 색 조각을 하나로 → 50명일 때 그리기 수를 줄임. 모양 · 움직임은 그대로 ──
function mergeOtterParts(root) {
  const u = root.userData;
  for (const g of [u.body, u.legL, u.legR, u.armL, u.armR, u.head]) {
    const by = new Map();
    for (const c of [...g.children]) {
      if (!(c.isMesh || c.isLineSegments) || c.isInstancedMesh) continue;
      const key = (c.isLineSegments ? 'L' : 'M') + c.material.color.getHex() + '|' + (c.material.roughness ?? '');
      if (!by.has(key)) by.set(key, []); by.get(key).push(c);
    }
    for (const list of by.values()) {
      if (list.length < 2) continue;
      const geos = list.map((c) => { c.updateMatrix(); const gg = c.geometry.clone(); gg.applyMatrix4(c.matrix); return gg; });
      const merged = mergeGeometries(geos); if (!merged) continue;
      for (const gg of geos) gg.dispose();
      const one = list[0].isLineSegments ? new THREE.LineSegments(merged, list[0].material) : new THREE.Mesh(merged, list[0].material);
      one.castShadow = list[0].castShadow; // 수염 선은 그림자 없음(4단계 리뷰 1번)
      for (const c of list) g.remove(c);
      g.add(one);
    }
  }
  return root;
}

// ── 흔들면 떨어지는 열매 · 나뭇가지(밤샘 5단계) — 정해진 12개를 돌려 씀 ──
const FALL_G = { 열매: new THREE.SphereGeometry(0.09, 7, 5), 나뭇가지: new THREE.CylinderGeometry(0.025, 0.035, 0.42, 5).rotateZ(Math.PI / 2) };
const FALL_M = { 열매: new THREE.MeshLambertMaterial({ color: 0xd2232f }), 나뭇가지: new THREE.MeshLambertMaterial({ color: 0x8a5a32 }) };
const falls = []; for (let i = 0; i < 12; i++) { const o = new THREE.Mesh(FALL_G.열매, FALL_M.열매); o.visible = false; o.castShadow = true; scene.add(o); falls.push({ o, t: 0 }); }
let fallI = 0;
function dropFromTree(key, id, n) {
  const r = typeof KEYED !== 'undefined' ? KEYED.get(key) : null; if (!r || !FALL_G[id]) return;
  for (let k = 0; k < Math.min(n, 3); k++) {
    const f = falls[fallI++ % falls.length], a = Math.random() * Math.PI * 2, rr = 0.6 + Math.random() * 0.7;
    f.o.geometry = FALL_G[id]; f.o.material = FALL_M[id]; f.o.visible = true; f.t = 0; f.delay = k * 0.12;
    f.x0 = r.x + Math.cos(a) * rr; f.z0 = r.z + Math.sin(a) * rr; f.y0 = groundY(r.x, r.z) + 2.6 * (r.s || 1); f.g = groundY(f.x0, f.z0) + 0.08; f.spin = (Math.random() - 0.5) * 8;
    f.o.position.set(f.x0, f.y0, f.z0);
  }
}
const shaking = () => me.actSwing === 'shake' && me.actT > -0.6 && !!me.actTree; // 흔드는 중(서버 답이 조금 늦어도)
function fallTick(dt) {
  for (const f of falls) {
    if (!f.o.visible) continue; if ((f.delay -= dt) > 0) continue; f.t += dt;
    const y = f.y0 - 4.9 * f.t * f.t; f.o.position.y = Math.max(f.g, y); f.o.rotation.z += f.spin * dt;
    if (f.t > 1.4) f.o.visible = false;
  }
}
