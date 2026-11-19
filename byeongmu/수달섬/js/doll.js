// 수달섬 — 인형 느낌 총 · 함정 모형(2026-11-19 부장님). 각진 GLB 대신 둥근 덩어리(roundBox · 캡슐 · 구)로 코드에서 만듦.
// 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀(이름은 doll 로 시작).
// 총은 총구가 +x · 위가 +y(gun.js gunMeshFor 가 긴 쪽을 앞으로 돌림 — 옛 GLB 와 같은 방향).
// 기관총은 짧고 크고 둥근 탄창 · 저격총은 길고 조준경 · 폭발덫은 둥근 지뢰(가시덫과 다른 모양).
// main.js 가 모형을 받은 뒤 srcs 에 넣음 → 손에 든 총 · 포탑 · 놓은 함정 · 미리보기 · 아이콘이 모두 이 모양.
const DOLL_C = { body: 0x4b5058, dark: 0x383c43, wood: 0xa06d40, metal: 0x9aa3ad, red: 0xe0452f, yel: 0xf2c23a, plate: 0x7a5a3a };
const DOLL_M = {};
const dollMat = (k) => DOLL_M[k] || (DOLL_M[k] = new THREE.MeshLambertMaterial({ color: DOLL_C[k] }));
// 부품 하나: 모양 · 색 이름 · 자리 · 돌림(z 먼저 기울임)
function dollPart(g, geo, col, x, y, z, rz = 0, rx = 0) {
  const m = new THREE.Mesh(geo, dollMat(col)); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m;
}
// x 방향 캡슐(총열 · 조준경) — len 은 둥근 끝을 뺀 길이
const dollTube = (r, len) => { const c = new THREE.CapsuleGeometry(r, len, 4, 12); c.rotateZ(Math.PI / 2); return c; };
// 모서리 둥근 상자(otter.js roundBox) — 반지름은 가장 얇은 쪽 절반을 넘지 않게
const dollRB = (w, h, d, r) => roundBox(w, h, d, Math.min(r, w / 2, h / 2, d / 2) * 0.98, 4);
// 납작한 둥근 알(기관총 탄창 · 지뢰 몸통)
const dollPill = (r, sy, sz) => { const s = new THREE.SphereGeometry(r, 18, 12); s.scale(1, sy, sz); return s; };

const DOLL_GUNS = {
  권총: (g) => {
    dollPart(g, dollRB(0.62, 0.2, 0.15, 0.07), 'body', 0.04, 0.1, 0);
    dollPart(g, dollTube(0.045, 0.1), 'dark', 0.38, 0.12, 0);
    dollPart(g, dollRB(0.17, 0.36, 0.14, 0.07), 'wood', -0.16, -0.12, 0, -0.3);
    dollPart(g, new THREE.TorusGeometry(0.06, 0.02, 6, 12), 'dark', 0.03, -0.04, 0);
  },
  소총: (g) => {
    dollPart(g, dollRB(0.72, 0.18, 0.13, 0.07), 'body', 0, 0, 0);
    dollPart(g, dollRB(0.4, 0.21, 0.11, 0.08), 'wood', -0.5, -0.04, 0, 0.06);
    dollPart(g, dollTube(0.035, 0.42), 'dark', 0.6, 0.03, 0);
    dollPart(g, dollRB(0.11, 0.26, 0.09, 0.045), 'dark', 0.12, -0.17, 0, 0.2);
    dollPart(g, dollRB(0.1, 0.2, 0.1, 0.045), 'body', -0.2, -0.14, 0, -0.25);
    dollPart(g, dollRB(0.22, 0.1, 0.12, 0.045), 'wood', 0.32, -0.04, 0);
  },
  산탄총: (g) => {
    dollPart(g, dollRB(0.5, 0.2, 0.14, 0.08), 'body', -0.05, 0, 0);
    dollPart(g, dollRB(0.42, 0.22, 0.12, 0.09), 'wood', -0.48, -0.05, 0, 0.1);
    dollPart(g, dollTube(0.05, 0.62), 'dark', 0.55, 0.05, 0);
    dollPart(g, dollTube(0.04, 0.5), 'metal', 0.5, -0.05, 0);
    dollPart(g, dollRB(0.24, 0.13, 0.15, 0.06), 'wood', 0.45, -0.05, 0);
  },
  // 짧고 뭉툭: 굵은 총열 덮개 · 아래에 크고 둥근 탄창 · 위에 손잡이
  기관총: (g) => {
    dollPart(g, dollRB(0.5, 0.26, 0.19, 0.1), 'body', 0, 0, 0);
    dollPart(g, dollTube(0.085, 0.16), 'dark', 0.36, 0.04, 0);
    dollPart(g, dollTube(0.04, 0.1), 'metal', 0.55, 0.04, 0);
    dollPart(g, dollPill(0.18, 1, 0.6), 'metal', 0.04, -0.22, 0);
    dollPart(g, dollRB(0.3, 0.07, 0.08, 0.03), 'dark', 0, 0.15, 0);
    dollPart(g, dollRB(0.22, 0.2, 0.13, 0.08), 'wood', -0.33, -0.02, 0);
    dollPart(g, dollRB(0.1, 0.2, 0.1, 0.045), 'body', -0.15, -0.17, 0, -0.25);
  },
  // 길고 가는 총열 · 위에 조준경(양 끝 렌즈) · 앞에 받침다리
  저격총: (g) => {
    dollPart(g, dollRB(0.62, 0.16, 0.12, 0.06), 'body', 0, 0, 0);
    dollPart(g, dollRB(0.5, 0.2, 0.1, 0.08), 'wood', -0.52, -0.04, 0, 0.06);
    dollPart(g, dollTube(0.03, 0.85), 'dark', 0.74, 0.03, 0);
    dollPart(g, dollTube(0.055, 0.36), 'dark', 0.02, 0.18, 0);
    dollPart(g, new THREE.SphereGeometry(0.07, 12, 8), 'metal', 0.26, 0.18, 0);
    dollPart(g, new THREE.SphereGeometry(0.06, 12, 8), 'metal', -0.22, 0.18, 0);
    dollPart(g, dollRB(0.05, 0.09, 0.06, 0.02), 'dark', 0.1, 0.1, 0);
    dollPart(g, dollRB(0.05, 0.09, 0.06, 0.02), 'dark', -0.08, 0.1, 0);
    dollPart(g, dollRB(0.1, 0.14, 0.08, 0.04), 'dark', 0.1, -0.12, 0);
    dollPart(g, new THREE.CapsuleGeometry(0.018, 0.22, 3, 6), 'dark', 0.62, -0.12, 0.04, 0.4);
    dollPart(g, new THREE.CapsuleGeometry(0.018, 0.22, 3, 6), 'dark', 0.62, -0.12, -0.04, 0.4);
  },
};
// 가시덫: 둥근 고리 + 판 + 끝이 둥근 가시 10개(안쪽으로 기울임)
function dollSpikeTrap() {
  const g = new THREE.Group();
  const ring = new THREE.TorusGeometry(0.45, 0.07, 8, 24); ring.rotateX(Math.PI / 2);
  dollPart(g, ring, 'metal', 0, 0.07, 0);
  dollPart(g, dollPill(0.4, 0.12, 1), 'plate', 0, 0.04, 0);
  const spike = new THREE.LatheGeometry([[0.075, 0], [0.068, 0.08], [0.05, 0.15], [0.03, 0.2], [0.014, 0.224], [0, 0.232]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Group(); p.rotation.y = -i / 10 * Math.PI * 2; g.add(p);
    dollPart(p, spike, 'metal', 0.45, 0.08, 0, 0.3);
  }
  return g;
}
// 폭발덫: 납작하고 둥근 지뢰 · 노란 띠 · 빨간 단추 · 둥근 못 4개
function dollMine() {
  const g = new THREE.Group();
  dollPart(g, dollPill(0.42, 0.42, 1), 'dark', 0, 0.12, 0);
  const band = new THREE.TorusGeometry(0.405, 0.05, 6, 24); band.rotateX(Math.PI / 2);
  dollPart(g, band, 'yel', 0, 0.12, 0);
  dollPart(g, new THREE.SphereGeometry(0.11, 12, 8), 'red', 0, 0.28, 0);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; dollPart(g, new THREE.SphereGeometry(0.045, 8, 6), 'metal', Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25); }
  return g;
}
function dollModels() {
  const out = {};
  for (const [k, mk] of Object.entries(DOLL_GUNS)) { const g = new THREE.Group(); mk(g); out[k] = g; }
  out.가시덫 = dollSpikeTrap(); out.폭발덫 = dollMine();
  return out;
}
// 미리보기(preview.js): 제 모형이 없는 등급 물건은 바탕 모형에 등급 색을 입혀 보여 줌
function prevModelOf(id) {
  const base = GUN_MODEL[id] || (/가시덫|올가미덫/.test(id) ? '가시덫' : TOOL_KIND[id]);
  const src = base && srcs[base];
  return src ? gradeLook(src.clone(true), id) : null;
}
