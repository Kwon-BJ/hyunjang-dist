// 수달섬 — 자연(작업지시서 3 E · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 나무: 다 베면 그루터기 → 새싹 → 어린 나무 → 다 자란 나무(단계는 서버가 보낸 남은 시간 · 전체 시간 비율로). 그루터기에 앉기 · 삽으로 파내기.
// 삽 + 씨앗: 앞의 빈 땅에 심기(서버가 자리를 정함). 풀 덤불 · 꽃 · 열매는 뜯으면 작게 보였다가 점점 커짐(다 자라야 다시 채집).
// 낚시: 서버가 띄운 물고기 그림자(작 · 중 · 대)를 물 위에 그림 · 그림자가 있는 자리에서만 입질.
let GROW = { stumpF: 0.55, youngF: 0.3 };
const ZERO_G = new THREE.Matrix4().makeScale(0, 0, 0), GM = new THREE.Matrix4(), GS = new THREE.Matrix4();
const growing = new Set();
const PLANTED = [];

// 삽(손에 드는 모양 · 그림 파일이 없어 나무 자루 + 쇠 날을 직접 만듦) · 아이콘은 그림이 없어 곡괭이 그림을 빌림(결과 보고 「그림 필요」)
function shovelModel() {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x9b6a3c }), iron = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.3, 8), wood); stick.position.y = 0.65; g.add(stick);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), wood); grip.position.y = 1.3; g.add(grip);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.04), iron); blade.position.y = -0.18; g.add(blade);
  return g;
}
Object.assign(ITEMS, { 삽: { buy: 350, tool: true }, 씨앗: { sell: 4 } });
Object.assign(ICON_ALIAS, { 삽: '곡괭이', 씨앗: '열매' });
Object.assign(DUR, { 삽: 200 });
Object.assign(HOLD, { 삽: { s: 0.9, grip: 0.1, rx: Math.PI - 0.7 } });
TOOLS.push('삽'); SELLABLE.push('씨앗'); SHOPS.tool.buy.push('삽');

// 그루터기: 나무 종류와 상관없이 짧은 통나무(나무마다 한 칸 · 처음엔 안 보임)
const STUMP_N = TREES.length + 220;
// 펠트 그루터기(2026-11-19): 밑이 살짝 퍼지고 모서리가 둥근 통 · 윗면은 밝은 나이테 색(높이 0.36 — 앉기 높이 그대로)
const STUMP_GEO = (() => {
  // 빈 칸도 늘 그려지는 묶음(나무 수만큼)이라 점을 적게 — 10 둘레 · 6 마디
  const g = lathe([[0.36, 0], [0.33, 0.14], [0.3, 0.29], [0.27, 0.35], [0.2, 0.362], [0, 0.365]], 10);
  const top = new THREE.Color(0xe6c48f), side0 = new THREE.Color(BARK0), side1 = new THREE.Color(0x8a5a33), c = new THREE.Color(), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), r = Math.hypot(p.getX(i), p.getZ(i)); c.copy(side0).lerp(side1, sstep(0, 0.3, y)); if (y > 0.35 && r < 0.27) c.copy(top); col.push(c.r, c.g, c.b); }
  g.deleteAttribute('uv'); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
})();
const stumpIM = new THREE.InstancedMesh(STUMP_GEO, new THREE.MeshLambertMaterial({ vertexColors: true }), STUMP_N);
// 처음엔 그루터기 없음(쓰는 칸만 count)
const stumpOf = new Map(), stumpRec = [];
stumpIM.count = 0;
// 처음엔 모든 칸이 크기 0 이라 경계 구가 원점에 잡혀 통째로 안 그려짐 → 시야 거르기를 끔(심은 나무도 같게)
stumpIM.castShadow = true; stumpIM.receiveShadow = true; stumpIM.frustumCulled = false; scene.add(stumpIM);
let stumpNext = 0;
TREES.forEach((r) => { r.stumpI = stumpNext++; });
// 심은 나무: 종류마다 따로 그리는 칸(서버 grow.plantMax 200 까지)
const PLANT_IM = {};
// 그리는 수(count)는 심은 만큼만 — 크기 0 인 빈 칸도 그리면 나무 모양이 무거워 화면이 느려짐(2026-11-18 함께 시험이 느려져 찾음)
for (const kind of Object.keys(TREE_KINDS)) if (kind !== 'bush') { const im = new THREE.InstancedMesh(TREE_KINDS[kind], treeMat, 200); for (let i = 0; i < 200; i++) im.setMatrixAt(i, ZERO_G); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); PLANT_IM[kind] = { im, n: 0 }; }

function stageOfC(r) {
  if (r.gone) return 'gone';
  if (!(r.down > clock)) return 'tree';
  const f = (r.down - clock) / (r.full || 120);
  return f > GROW.stumpF ? 'stump' : f > GROW.youngF ? 'sapling' : 'young';
}
// ── 새싹(2026-11-19 펠트): 「작게 줄인 나무」 대신 둥근 줄기 + 통통한 떡잎 둘 · 그루터기 옆 땅에서 돋음 ──
// 새싹 단계인 것만 칸을 받음(빈 칸을 그리지 않게 쓰는 칸만 count) — 휴대폰 부담 작게
const SPROUT_GEO = (() => {
  const stem = lathe([[0, 0], [0.035, 0], [0.03, 0.12], [0.026, 0.24], [0.018, 0.28], [0, 0.29]], 6);
  const leaf = (s) => { const g = new THREE.SphereGeometry(0.1, 10, 7); g.scale(1, 0.32, 0.62); g.rotateZ(s * 0.45); g.translate(s * 0.1, 0.3, 0); return g; };
  const parts = [stem, leaf(-1), leaf(1)].map((g, i) => { g.deleteAttribute('uv'); const p = g.attributes.position, A = new THREE.Color(i ? 0x5f9a3e : 0x6e9b45), B = new THREE.Color(i ? 0xa6cf6a : 0x86b456), c = new THREE.Color(), col = []; for (let v = 0; v < p.count; v++) { c.copy(A).lerp(B, sstep(0.05, 0.34, p.getY(v))); col.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; });
  return mergeGeometries(parts);
})();
const SPROUT_N = 220, sproutIM = new THREE.InstancedMesh(SPROUT_GEO, windy(new THREE.MeshLambertMaterial({ vertexColors: true }), { sway: 1.0, from: 0.1 }), SPROUT_N);
sproutIM.count = 0; sproutIM.castShadow = true; sproutIM.receiveShadow = true; sproutIM.frustumCulled = false; scene.add(sproutIM);
const sproutOf = new Map(), sproutRec = [], SPROUT_V = new THREE.Vector3();
// k: 0 이면 없앰 · 아니면 그 크기로(새싹 단계 진행에 따라 0.7 → 1.3)
function setSprout(r, k) {
  let i = sproutOf.get(r);
  if (!k) {
    if (i == null) return;
    const last = sproutRec.length - 1, lr = sproutRec[last];
    if (i !== last) { sproutIM.getMatrixAt(last, GM); sproutIM.setMatrixAt(i, GM); sproutRec[i] = lr; sproutOf.set(lr, i); }
    sproutRec.pop(); sproutOf.delete(r); sproutIM.count = sproutRec.length; sproutIM.instanceMatrix.needsUpdate = true; return;
  }
  if (i == null) { if (sproutRec.length >= SPROUT_N) return; i = sproutRec.length; sproutRec.push(r); sproutOf.set(r, i); sproutIM.count = sproutRec.length; }
  // 1.8: 게임 카메라(멀리)에서도 떡잎이 보이게
  const s = (r.s || 1) * k * 1.8, a = (hashName(String(r.key || r.i)) % 628) / 100;
  GM.makeRotationY(a).scale(SPROUT_V.set(s, s, s)); GM.setPosition(r.x + 0.42 * (r.s || 1), groundY(r.x, r.z) - 0.01, r.z + 0.32 * (r.s || 1)); sproutIM.setMatrixAt(i, GM);
  sproutIM.instanceMatrix.needsUpdate = true;
}
const sproutScale = (r) => { const i = sproutOf.get(r); if (i == null) return 0; sproutIM.getMatrixAt(i, GM); return new THREE.Vector3().setFromMatrixScale(GM).y / 1.8; };
// 그루터기를 숨기면(다 자람 · 파냄 · 들어올 때) 새싹도 같이 없앰
function setStump(r, on) {
  if (!on) setSprout(r, 0);
  if (r.stumpI == null) return;
  // 2026-11-19 휴대폰 성능: 그루터기가 있는 나무만 칸을 받음(예전엔 나무 수만큼 빈 칸 655개를 늘 그림) · 지우면 끝 칸을 그 자리로 옮김
  let i = stumpOf.get(r);
  if (!on) {
    if (i == null) return;
    const last = stumpRec.length - 1, lr = stumpRec[last];
    if (i !== last) { stumpIM.getMatrixAt(last, GM); stumpIM.setMatrixAt(i, GM); stumpRec[i] = lr; stumpOf.set(lr, i); }
    stumpRec.pop(); stumpOf.delete(r); stumpIM.count = stumpRec.length; stumpIM.instanceMatrix.needsUpdate = true; return;
  }
  if (i == null) { i = stumpRec.length; stumpRec.push(r); stumpOf.set(r, i); stumpIM.count = stumpRec.length; }
  GM.makeScale(r.s || 1, 1, r.s || 1); GM.setPosition(r.x, groundY(r.x, r.z) - 0.02, r.z); stumpIM.setMatrixAt(i, GM);
  stumpIM.instanceMatrix.needsUpdate = true;
}
const stumpShown = (r) => stumpOf.has(r);
// 나무 한 그루를 지금 단계대로(나무 · 그루터기)
function treeShow(r) {
  const st = stageOfC(r);
  if (st === 'tree') return;
  if (st === 'gone') { r.im.setMatrixAt(r.i, ZERO_G); r.im.instanceMatrix.needsUpdate = true; setStump(r, false); growing.delete(r); return; }
  const f = (r.down - clock) / (r.full || 120);
  let k = 0;
  // 새싹 단계: 나무는 숨기고 그루터기 옆에 새싹(0.7 → 1.3) · 어린 나무: 0.4 → 0.8(다 자라면 1 — 그때는 life.js 가 원래 모양으로 되돌림)
  const sp = st === 'sapling' ? 0.7 + 0.6 * (1 - (f - GROW.youngF) / (GROW.stumpF - GROW.youngF)) : 0;
  if (st === 'young') k = 0.4 + 0.4 * (1 - f / GROW.youngF);
  if (k > 0) { GM.copy(r.m).multiply(GS.makeScale(k, k, k)); r.im.setMatrixAt(r.i, GM); } else r.im.setMatrixAt(r.i, ZERO_G);
  r.im.instanceMatrix.needsUpdate = true;
  setStump(r, st === 'stump' || st === 'sapling');
  setSprout(r, sp);
}
// 풀 덤불 · 꽃 · 열매: 다 자랄 때까지 작게(0.3 → 0.9)
function smallShow(r) {
  if (!(r.down > clock)) return;
  const f = Math.max(0, Math.min(1, (r.down - clock) / (r.full || 80))), k = 0.3 + 0.6 * (1 - f);
  GM.copy(r.m).multiply(GS.makeScale(k, k, k)); r.im.setMatrixAt(r.i, GM); r.im.instanceMatrix.needsUpdate = true;
}
// 서버 res 말을 받은 뒤(net.js applyRes 가 부름): 전체 시간 · 파냄을 적고 단계대로 그림
function growApply(r, full, gone) {
  if (gone) { r.gone = true; r.down = 0; }
  if (full > 0) r.full = full;
  if (r.key && (r.key[0] === 'T' || r.key[0] === 'N')) { growing.add(r); treeShow(r); }
  else if (r.key && 'BFE'.includes(r.key[0])) { if (!r.full) r.full = REGEN_LOCAL[r.key[0]] || 70; growing.add(r); smallShow(r); }
}
function addPlant(p) {
  if (KEYED.has(p.k)) return KEYED.get(p.k);
  const P = PLANT_IM[p.kind] || PLANT_IM.round; if (P.n >= 200) return null;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, height(p.x, p.z), p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hashName(p.k) % 628 / 100, 0)), new THREE.Vector3(1, 1, 1));
  const r = { im: P.im, i: P.n++, x: p.x, z: p.z, s: 1, m, circle: null, kind: p.kind, wood: 3, next: 0, down: 0, key: p.k, planted: true, stumpI: stumpNext < STUMP_N ? stumpNext++ : null };
  PLANTED.push(r); KEYED.set(p.k, r); P.im.setMatrixAt(r.i, m); P.im.count = P.n; P.im.instanceMatrix.needsUpdate = true;
  return r;
}
// 들어올 때(welcome): 단계 숫자 · 파낸 나무 · 심은 나무 · 그림자
function growWelcome(m) {
  if (m.grow) GROW = { ...GROW, ...m.grow };
  for (const r of [...TREES, ...PLANTED]) if (r.gone) { r.gone = false; showRec(r); setStump(r, false); }
  for (const k of m.gone || []) { const r = KEYED.get(k); if (r) growApply(r, 0, true); }
  // 심은 나무를 먼저 만들어 두면 뒤의 res 처리(net.js)가 단계대로 그림
  for (const [k, p] of Object.entries(m.plants || {})) { const r = addPlant({ k, ...p }); if (r && !(m.res || {})[k]) r.im.setMatrixAt(r.i, r.m); }
  setShadows(m.shadows || []);
}
// 서버 말: 심음 · 그림자 · 앉기
function onNetGrow(m) {
  if (m.t === 'plant') { const r = addPlant(m); if (r) { r.down = clock + m.left; growApply(r, m.full); } if (m.by === net.id) toast('씨앗을 심었어요 — 새싹부터 자라요', '씨앗'); }
  else if (m.t === 'shd') setShadows(m.l || []);
  // 그루터기 파기(2026-11-19): 서버가 정한 시간 동안 삽질 · 0 이면 그만둠(멀어짐 등)
  else if (m.t === 'digging') { if (m.s > 0) { me.actT = me.actDur = m.s; me.actSwing = true; toast(`파는 중… ${m.s}초`, '삽'); } else toast('파기를 그만뒀어요'); }
  // 앉기: 그루터기 위로 옮겨 앉음(움직이면 일어남 — 서버도 같게)
  else if (m.t === 'sit') {
    // 모닥불 옆에 앉기(작업지시서 4 B3): 그 자리에서 땅에 앉음
    if (m.fire && m.k) { me.sitK = m.k; me.sitFire = true; me.sitX = me.x; me.sitZ = me.z; me.speed = 0; toast('모닥불 옆에 앉았어요 — 에너지가 더 빨리 차요', '모닥불'); return; }
    const r = m.k && KEYED.get(m.k); me.sitK = r ? m.k : null; me.sitFire = false;
    if (r) { me.x = me.sitX = r.x; me.z = me.sitZ = r.z; me.speed = 0; toast('그루터기에 앉았어요 — 에너지가 조금 빨리 차요'); }
  }
}

// ── 대상 · 동작(life.js findTarget · doAction 이 부름) ──
function growTargets(see, fx, fz) {
  if (!srvOn()) return;
  // 그루터기는 둘레에 떨어진 것(줍기)보다 뒤 — 먼저 줍고 앉거나 파냄
  for (const r of [...TREES, ...PLANTED]) if (r.down > clock && stageOfC(r) === 'stump') see('stump', r, r.x, r.z, 1.4, -0.8);
  for (const r of PLANTED) if (!(r.down > clock) && !r.gone) see('tree', r, r.x, r.z, 1.35);
  // 삽을 들고 씨앗이 있으면 앞 땅에 심기(다른 대상이 있으면 그것이 먼저)
  if (toolIs('삽') && count('씨앗') > 0 && free(fx, fz, 0.5)) see('plant', { x: fx, z: fz }, fx, fz, 9, -3);
}
function growLabel(t) {
  if (t.type === 'stump') return toolIs('삽') ? '그루터기 파내기' : '앉기';
  if (t.type === 'plant') return '씨앗 심기';
  return null;
}
function growAction(t) {
  me.actT = me.actDur = ACT_T; net.ac++;
  if (t.type === 'stump') { me.actSwing = toolIs('삽'); netSend(toolIs('삽') ? { t: 'dig', k: t.rec.key } : { t: 'sit', k: t.rec.key }); return true; }
  if (t.type === 'plant') { me.actSwing = false; netSend({ t: 'plant', x: +t.rec.x.toFixed(2), z: +t.rec.z.toFixed(2) }); return true; }
  return false;
}

// ── 물고기 그림자 ──
const shadowsC = new Map();
const SH_G = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), SH_SIZE = { s: 0.32, m: 0.5, l: 0.75 };
function setShadows(list) {
  const seen = new Set();
  for (const [id, s, x, z, size] of list) {
    seen.add(id);
    let q = shadowsC.get(id);
    if (!q) {
      const mesh = new THREE.Mesh(SH_G, new THREE.MeshBasicMaterial({ color: 0x0c1a26, transparent: true, opacity: 0, depthWrite: false }));
      mesh.renderOrder = 1; scene.add(mesh); q = { mesh, x, z, a: 0 }; shadowsC.set(id, q);
    }
    Object.assign(q, { s, tx: x, tz: z, size });
    const k = SH_SIZE[size] || 0.4; q.mesh.scale.set(k * 1.7, 1, k);
  }
  for (const [id, q] of shadowsC) if (!seen.has(id)) { scene.remove(q.mesh); q.mesh.material.dispose(); shadowsC.delete(id); }
}

// ── 매 프레임(loop.js) ──
let growT = 0;
function growTick(dt) {
  // 자라는 것들: 0.25초마다 크기 · 단계
  if ((growT -= dt) <= 0) {
    growT = 0.25;
    for (const r of growing) {
      if (r.gone) continue;
      if (!(r.down > clock)) { growing.delete(r); setStump(r, false); continue; }
      if (r.key[0] === 'T' || r.key[0] === 'N') treeShow(r); else smallShow(r);
    }
    // 다 자란 심은 나무(life.js 는 처음부터 있던 나무만 되돌림)
    for (const r of PLANTED) if (r.down && clock > r.down && !r.gone) { r.down = 0; showRec(r); setStump(r, false); }
  }
  // 그루터기에 앉아 있음: 조금 낮게 · 다리를 앞으로 — 움직이면 일어남(서버도 같게)
  if (me.sitK) {
    if (Math.hypot(me.x - me.sitX, me.z - me.sitZ) > 0.4 || me.dead) me.sitK = null;
    // 그루터기 위(+0.3) · 모닥불 옆은 땅에 털썩(-0.12)
    else { const u = me.obj.userData; me.obj.position.y += me.sitFire ? -0.12 : 0.3; u.legL.rotation.x = u.legR.rotation.x = -1.35; }
  }
  // 그림자: 서버 자리로 부드럽게 · 처음엔 서서히 나타남 · 물결 따라 살짝 흔들림
  for (const q of shadowsC.values()) {
    const k = Math.min(1, dt * 2.5), dx = q.tx - q.x, dz = q.tz - q.z;
    q.x += dx * k; q.z += dz * k;
    if (Math.hypot(dx, dz) > 0.02) q.a = Math.atan2(dx, dz);
    q.mesh.position.set(q.x, SEA_Y + 0.31 + Math.sin(clock * 1.3 + q.x) * 0.01, q.z); q.mesh.rotation.y = q.a + Math.PI / 2;
    q.mesh.material.opacity = Math.min(0.42, q.mesh.material.opacity + dt * 0.3);
  }
}
