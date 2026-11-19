// 수달섬 — 모델(CC0) 놓기 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 모델 (CC0) ─────────
const PROPS = [
  // 이름, x, z, 돌림(도), 높이, 막힘
  ['텐트', CAMP.x + 7, CAMP.z - 4.5, -15, 1.7, 'c'], ['모닥불', CAMP.x, CAMP.z + 1.5, 0, 0.75, 'c'], ['침낭', CAMP.x - 2.5, CAMP.z + 3.5, 70, 0.22, ''], ['모닥불', 0, 0, 0, 0.75, 'c'], // 서쪽 야영지 · 가운데 광장 모닥불
  ['가판대', HARBOR.x, HARBOR.z - 3.4, 0, 2.6, 'c'], ['수레', HARBOR.x - 8.5, HARBOR.z + 4.5, 60, 1.5, 'c'], // B단계 · 부장님 알림: 상인 가판대 = 도구 상점(항구 울타리 안)
  ['작업대', CAMP.x + 5.5, CAMP.z + 2.5, -90, 1.0, 'c'], ['모루', CAMP.x + 6.2, CAMP.z - 0.2, -60, 0.9, 'c'], ['통', CAMP.x - 6.5, CAMP.z - 1, 0, 0.95, 'c'], ['상자', CAMP.x - 7, CAMP.z - 2.6, 25, 0.7, 'c'], // 보관함은 집마다 옆에(placeHouseSet)
  ['표지판', HARBOR.x + 2.4, HARBOR.z + 8.4, -20, 1.7, 'c'], // 항구 남쪽 문 밖
  ['통', HARBOR.x - 2.2, HARBOR.z - 4.6, 0, 0.95, 'c'], ['상자', HARBOR.x + 2.3, HARBOR.z - 4.7, 20, 0.7, 'c'], ['통', HARBOR.x - 5.2, HARBOR.z + 2.8, 0, 0.95, 'c'], ['모닥불', HARBOR.x, HARBOR.z + 4, 0, 0.75, 'c'], // 항구 장식(채집 안 됨)
  ['헛간', FARM.x, FARM.z - 7, 0, 5.2, 'b'], ['닭장', FARM.x - 7, FARM.z + 3.5, 30, 2.0, 'c'], ['사일로', FARM.x + 7, FARM.z - 2, 0, 8, 'c'], ['풍차', 98, -16, -30, 10, 'c'],
  ['낚시대', POND.x + 17, POND.z - 3, 120, 1.1, 'c'], ['통', FARM.x - 8, FARM.z - 1, 0, 0.95, 'c'], ['상자', FARM.x - 4.5, FARM.z - 6.5, 10, 0.7, 'c'],
];
const FENCES = [[FARM.x - 7, FARM.z - 11, 0], [FARM.x - 1, FARM.z - 11, 0], [FARM.x + 5, FARM.z - 11, 0], [FARM.x + 9.5, FARM.z - 7.5, 90], [FARM.x + 9.5, FARM.z + 3, 90]]; // 농장 울타리
let srcs = {}; // 받은 모델(이름 → 장면) — main 이 채움
const loader = new GLTFLoader();
const cache = {};
// 펠트 느낌(2026-11-19): 모델의 반사 재질(Standard)을 같은 색의 무광(Lambert)으로 바꿈 — render.js 의 펠트 결이 붙고 휴대폰에서 더 가벼움
function feltModel(root) {
  const done = new Map();
  root.traverse((m) => {
    if (!m.isMesh || !m.material || !m.material.isMeshStandardMaterial) return;
    const s = m.material;
    if (!done.has(s)) done.set(s, new THREE.MeshLambertMaterial({ color: s.color, map: s.map, vertexColors: s.vertexColors, emissive: s.emissive, emissiveMap: s.emissiveMap, emissiveIntensity: s.emissiveIntensity, transparent: s.transparent, opacity: s.opacity, side: s.side, alphaTest: s.alphaTest, name: s.name }));
    m.material = done.get(s);
  });
  return root;
}
const loadModel = (name) => (cache[name] ||= loader.loadAsync(`models/${encodeURIComponent(name)}.glb`).then((g) => feltModel(g.scene)));
function placeModel(src, x, z, rotDeg, h, block) {
  const o = src.clone(true), b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), s = h / sz.y;
  const inner = new THREE.Group(); inner.add(o); o.position.set(-(b.min.x + sz.x / 2), -b.min.y, -(b.min.z + sz.z / 2));
  const g = new THREE.Group(); g.add(inner); g.scale.setScalar(s); g.rotation.y = rotDeg * Math.PI / 180; g.position.set(x, Math.max(0, height(x, z)), z);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  scene.add(g);
  const a = rotDeg * Math.PI / 180, wx = Math.abs(Math.cos(a)) * sz.x * s + Math.abs(Math.sin(a)) * sz.z * s, wz = Math.abs(Math.sin(a)) * sz.x * s + Math.abs(Math.cos(a)) * sz.z * s;
  if (block === 'c') circles.push({ x, z, r: Math.min(wx, wz) * 0.45 });
  if (block === 'b') boxes.push({ x0: x - wx / 2, x1: x + wx / 2, z0: z - wz / 2, z1: z + wz / 2 });
  if (block === 'f') boxes.push({ x0: x - wx / 2, x1: x + wx / 2, z0: z - Math.max(wz, 0.3) / 2, z1: z + Math.max(wz, 0.3) / 2 });
  return g;
}

// ───────── 안전지대 울타리 · 가게 · 자판기 (2026-11-18 작업지시서 2 B) ─────────
// 서버 config.shops 와 같은 자리(시험이 world.json 으로 맞춤). tool = 상인 가판대 앞(도구 상점) · 나머지는 종류별 자판기
const SAFE_DEF = { x: HARBOR.x, z: HARBOR.z, r: 6.5 }; // 혼자 놀기 때 텐트 자리 판정용(함께일 땐 서버가 보낸 SAFE)
const STATIC = { circles: [], boxes: [] }; // 섬이 다 차린 뒤의 막힘(나무 · 바위 · 모델 · 울타리) — 텐트 자리 판정용(main 이 채움)
const SHOPS = {
  tool: { x: HARBOR.x, z: HARBOR.z - 1.6, name: '도구 상점', buy: ['도끼', '곡괭이', '낚싯대'], sell: true },
  // 작업지시서 4 B2: 총 자판기 · 탄알 자판기로 나눔(서버 config.shops gun · ammo 와 같은 자리)
  gun: { x: HARBOR.x - 4, z: HARBOR.z - 1, name: '총 자판기', buy: ['권총', '소총', '산탄총'], color: 0xe0584a, glow: 0xffb0a0 },
  ammo: { x: HARBOR.x - 4.4, z: HARBOR.z - 4, name: '탄알 자판기', buy: ['권총탄', '소총탄', '산탄'], color: 0xd98a3a, glow: 0xffd8a8 },
  tent: { x: HARBOR.x - 3.4, z: HARBOR.z + 2.2, name: '텐트 자판기', buy: ['텐트', '나무', '돌', '보관함', '제작대'], color: 0x4fae6a, glow: 0xb8ffc8 },
  trap: { x: HARBOR.x + 4, z: HARBOR.z - 1, name: '함정 자판기', buy: ['가시덫'], color: 0x8f6cc8, glow: 0xdccbff },
  food: { x: HARBOR.x + 3.4, z: HARBOR.z + 2.2, name: '먹거리 자판기', buy: ['모닥불', '열매', '생선구이'], color: 0xf2b244, glow: 0xfff0b8 }, // D단계에 채움
};
const SHOP_AT = SHOPS.tool; // 예전 이름(시험 · 지도)
const FENCE_R = 6.5, FENCE_GATES = [[Math.atan2(22, 25), 0.24], [Math.PI / 2, 0.24], [Math.atan2(22, -40), 0.24], [-Math.PI / 2, 0.22]]; // 항구 울타리 반지름 · 문(항구에서 본 각도 rad · 반폭 rad): 동쪽 길 · 남쪽 길 · 서쪽 길 · 북쪽 부두
const vendObjs = [];
// 이름 간판(작업지시서 4 B1): 둥근 나무판 + 크림 글자 그림판 · 빛을 안 받는 재질(밤에도 읽힘) · 자판기 앞을 봄
function shopSign(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 136; const g = c.getContext('2d');
  const r = 40; g.beginPath(); g.moveTo(r, 6); g.arcTo(506, 6, 506, 130, r); g.arcTo(506, 130, 6, 130, r); g.arcTo(6, 130, 6, 6, r); g.arcTo(6, 6, 506, 6, r); g.closePath();
  g.fillStyle = '#8a5a33'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#5e3b22'; g.stroke();
  g.fillStyle = '#fff3d6'; g.font = 'bold 66px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 72, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: true }));
  m.name = 'shopSign'; return m;
}
// 자판기: 찰흙 느낌 둥근 상자 + 빛나는 앞판 · 위 띠(밤에 빛남 — 조명은 C단계)
function makeVending(k) {
  const g = new THREE.Group(), clay = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 16), clay(k.color)); body.scale.set(1.25, 1, 0.85); body.position.y = 0.95; g.add(body);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.06), clay(0x000000, k.glow)); face.material.emissiveIntensity = 0.75; face.position.set(0, 1.05, 0.36); g.add(face);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.08), clay(0xffffff, k.glow)); top.position.set(0, 1.72, 0.3); g.add(top);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), clay(0x2c2720)); slot.position.set(0, 0.4, 0.37); g.add(slot);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  { const s = shopSign(k.name); s.position.set(0, 2.25, 0.2); g.add(s); }
  g.position.set(k.x, Math.max(0, height(k.x, k.z)), k.z); g.rotation.y = Math.atan2(-k.x, -k.z); // 광장 가운데를 봄
  g.userData.glow = k.glow; scene.add(g); circles.push({ x: k.x - Math.sin(g.rotation.y) * 0.05, z: k.z - Math.cos(g.rotation.y) * 0.05, r: 0.55 }); vendObjs.push(g);
  return g;
}
function buildTown() {
  for (const k of Object.values(SHOPS)) if (k.color) makeVending(k);
  // 도구 상점(상인 가판대) 간판 — 가판대 앞 위(카메라 쪽 +z 를 봄)
  { const s = shopSign(SHOPS.tool.name); s.position.set(HARBOR.x, Math.max(0, height(HARBOR.x, HARBOR.z - 2.9)) + 2.85, HARBOR.z - 2.75); s.scale.setScalar(1.25); scene.add(s); }
  // 울타리: 문 사이 호를 짧은 토막(울타리 모델 길이를 반으로)으로 두르고, 말뚝 자리에 작은 막힘 원
  const gates = FENCE_GATES.map(([a, w]) => [a - w, a + w]), inGate = (a) => gates.some(([lo, hi]) => { const d = Math.atan2(Math.sin(a - (lo + hi) / 2), Math.cos(a - (lo + hi) / 2)); return Math.abs(d) < (hi - lo) / 2; });
  const steps = 360; let run = [];
  const flush = () => { if (run.length < 2) { run = []; return; } const a0 = run[0], a1 = run[run.length - 1], L = (a1 - a0) * FENCE_R, n = Math.max(1, Math.round(L / 2.4));
    for (let i = 0; i < n; i++) { const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n, am = (b0 + b1) / 2, x = Math.cos(am) * FENCE_R, z = Math.sin(am) * FENCE_R, len = 2 * FENCE_R * Math.sin((b1 - b0) / 2);
      const o = placeModel(srcs['울타리'], HARBOR.x + x, HARBOR.z + z, 0, 1.0, ''); o.rotation.y = -am + Math.PI / 2; o.scale.x *= len / 5.02; }
    for (let t = 0; t <= 1.0001; t += 0.5 / ((a1 - a0) * FENCE_R)) { const a = a0 + (a1 - a0) * Math.min(1, t); circles.push({ x: HARBOR.x + Math.cos(a) * FENCE_R, z: HARBOR.z + Math.sin(a) * FENCE_R, r: 0.2, fence: 1 }); }
    run = []; };
  for (let i = 0; i <= steps; i++) { const a = -Math.PI + i / steps * Math.PI * 2; if (inGate(a) || i === steps) flush(); else run.push(a); }
}

// ───────── 경비 포탑(부장님 2026-11-18) — 항구에서 나가는 길마다 하나. 안 부서지고 탄약도 없음. 쏘는 판정은 서버(config.guards)
const GUARDS = [[4.43, 7.25], [-2.51, 8.12], [-8.34, 1.66]].map(([dx, dz], i) => ({ id: 'G' + i, x: HARBOR.x + dx, z: HARBOR.z + dz })); // 서버 config.guards.at 과 같은 자리(동 · 남 · 서 길 옆)
const guardObjs = new Map();
function buildGuards() { for (const g of GUARDS) guardObjs.set(g.id, { ...g, ...makeTrapObj({ kind: 'turret', x: g.x, z: g.z, owner: '' }) }); }
