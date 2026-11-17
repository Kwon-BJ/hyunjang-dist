// 수달섬 — 모델(CC0) 놓기 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 모델 (CC0) ─────────
const PROPS = [
  // 이름, x, z, 돌림(도), 높이, 막힘
  ['텐트', -12, -21.5, -15, 1.7, 'c'], ['모닥불', -19, -15.5, 0, 0.75, 'c'], ['침낭', -21.5, -13.5, 70, 0.22, ''], // 내 집 자리(-20, -23)는 비워 둠
  ['가판대', -4.5, -5.2, 0, 2.6, 'c'], ['수레', -8.2, -3.6, 60, 1.5, 'c'],
  ['작업대', -13.5, -14.5, -90, 1.0, 'c'], ['모루', -12.8, -17.2, -60, 0.9, 'c'], ['통', -25.5, -18, 0, 0.95, 'c'], ['상자', -26, -19.6, 25, 0.7, 'c'], // 보관함은 집마다 옆에(placeHouseSet)
  ['표지판', 3, -3.5, -20, 1.7, 'c'],
  ['헛간', 41, -17, 0, 5.2, 'b'], ['닭장', 34, -6.5, 30, 2.0, 'c'], ['사일로', 48, -12, 0, 8, 'c'], ['풍차', 44, 14, -30, 10, 'c'],
  ['낚시대', -22.6, 14.5, 120, 1.1, 'c'], ['통', 33, -11, 0, 0.95, 'c'], ['상자', 36.5, -16.5, 10, 0.7, 'c'],
];
const FENCES = [[34, -21, 0], [40, -21, 0], [46, -21, 0], [50.5, -17.5, 90], [50.5, -7, 90]];
let srcs = {}; // 받은 모델(이름 → 장면) — main 이 채움
const loader = new GLTFLoader();
const cache = {};
const loadModel = (name) => (cache[name] ||= loader.loadAsync(`models/${encodeURIComponent(name)}.glb`).then((g) => g.scene));
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
