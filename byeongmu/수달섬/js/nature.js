// 수달섬 — 나무 · 덤불 · 바위 · 꽃 · 풀 · 다리 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 모양 만들기 도구 ─────────
const toFlat = (g) => { if (g.index) g = g.toNonIndexed(); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
// 높이에 따라 c0 → c1 로 물들임(아래 어둡게 · 위 밝게 — 그림 같은 느낌)
function grad(g, c0, c1, y0, y1, jitter = 0) {
  g = toFlat(g); const p = g.attributes.position, a = new Float32Array(p.count * 3), A = new THREE.Color(c0), B = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(A).lerp(B, sstep(y0, y1, p.getY(i))); if (jitter) c.multiplyScalar(1 - jitter + 2 * jitter * hash(p.getX(i) * 7.1, p.getZ(i) * 3.3 + p.getY(i))); a.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const at = (g, x, y, z, sx = 1, sy = sx, sz = sx) => { g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
// ── 펠트 인형 모양(2026-11-19 부장님 · 기획/디자인/배경소품-시안.png): 둥글고 통통한 덩어리 몇 개 · 각진 면 · 뾰족한 끝 없음 ──
// 꼭짓점을 나눠 쓰는(index) 매끈한 공 · 돌림 모양이라 면이 안 보이고, 예전(잘게 나눈 공 7개 · 꼭짓점 따로)보다 꼭짓점이 훨씬 적어 휴대폰이 가벼움.
// 섬 자리(rnd)는 건드리지 않음 — 모양 안의 흔들림은 hash 만 씀(서버 world.json 과 같은 자리)
function gradI(g, c0, c1, y0, y1, jitter = 0) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, a = new Float32Array(p.count * 3), A = new THREE.Color(c0), B = new THREE.Color(c1), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(A).lerp(B, sstep(y0, y1, p.getY(i))); if (jitter) c.multiplyScalar(1 - jitter + 2 * jitter * hash(p.getX(i) * 1.3, p.getZ(i) * 1.1 + p.getY(i))); a.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
// SEGK: 마디 배율 — 먼 칸에 쓸 단순한 모양을 만들 때만 잠깐 줄임(같은 모양 · 같은 색, 공 마디만 적게)
let SEGK = 1;
const segOf = (n, min) => Math.max(min, Math.round(n * SEGK));
const feltBall = (r, x, y, z, sx = 1, sy = sx, sz = sx, w = 12, h = 9) => at(new THREE.SphereGeometry(r, segOf(w, 5), segOf(h, 3)), x, y, z, sx, sy, sz);
// 돌림 모양: [반지름, 높이] 점들을 세로축으로 돌림(꼭대기 · 바닥 가운데는 0.001 로 닫음)
const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), segOf(seg, 5));
// 통통한 줄기: 밑은 뿌리처럼 살짝 퍼지고 위는 둥글게 닫힘(잎 덩어리 속) — 높이 h · 밑 r0 · 위 r1 은 예전과 같게(otter.js TRUNK · 흔들기 손 자리)
const trunkP = (h, r0, r1) => gradI(lathe([[0, -0.06], [r0 * 1.32, -0.06], [r0 * 1.3, 0.05], [r0 * 1.08, 0.16 * h], [r0, 0.3 * h], [(r0 + r1) / 2, 0.65 * h], [r1, 0.95 * h], [r1 * 0.75, h * 1.04], [0, h * 1.08]], 10), BARK0, BARK1, 0, h);
// 둥근 잎 덩어리: 가운데 큰 공 하나 + 둘레 아래쪽 n 개(시안의 활엽수처럼 위 하나 · 양옆 둘)
function softCanopy(cy, R, n, dark, light, s) {
  const out = [feltBall(R * 0.86, 0, cy + R * 0.18, 0, 1, 0.92, 1)];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + hash(s, i) * 0.6, rr = R * 0.6, k = 0.56 + 0.1 * hash(i, s * 2); out.push(feltBall(R * k, Math.cos(a) * rr, cy - R * 0.2 + (hash(i * 3, s) - 0.5) * R * 0.15, Math.sin(a) * rr, 1, 0.9, 1)); }
  return out.map((g) => underShade(gradI(g, dark, light, cy - R * 0.95, cy + R * 1.05, 0.035), 0.35));
}
// 아랫면 그늘: 법선이 아래를 향하는 곳(층 · 잎 공의 밑)을 어둡게 — 수달 등불이 밑에서 비춰 침엽수 아랫단 가장자리가 밝은 띠로 보이던 것(2026-11-19 부장님) · 인형의 밑 그늘 느낌
function underShade(g, k = 0.45) {
  const n = g.attributes.normal, c = g.attributes.color;
  for (let i = 0; i < n.count; i++) { const f = 1 - k * sstep(0.1, -0.6, n.getY(i)); c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f); }
  return g;
}
// 침엽수 한 층: 끝이 둥근 고깔(반지름 r · 높이 h · 밑 높이 y) — 아래 가장자리도 둥글게 말림
// 2026-11-19 3차: 뾰족해 보여서 낮고 넓게 · 꼭대기는 넓은 둥근 끝(반지름의 약 1/3)
const pineTier = (r, h, y, dark, light) => underShade(gradI(at(lathe([[0, 0], [0.75, 0], [0.96, 0.06], [1, 0.17], [0.93, 0.33], [0.78, 0.5], [0.6, 0.66], [0.44, 0.8], [0.3, 0.9], [0.15, 0.97], [0, 1]], 12), 0, y, 0, r, h, r), dark, light, y, y + h, 0.03), 0.55);
// 바람 · 가림(수달과 카메라 사이면 비침)
function windy(mat, { sway = 0.05, from = 1.0, occlude = false, noFlip = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    if (noFlip) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0')); // 풀잎 뒷면도 앞면처럼 밝게
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
      #endif
      float k = max(0.0, position.y - ${from.toFixed(2)});
      transformed.x += (sin(uTime * 1.7 + ip.x * 0.31 + ip.y * 0.23) + 0.4 * sin(uTime * 3.3 + ip.x)) * ${sway.toFixed(3)} * k * k;
      transformed.z += sin(uTime * 1.3 + ip.y * 0.41) * ${(sway * 0.6).toFixed(3)} * k * k;`).replace('#include <project_vertex>', `#include <project_vertex>
      vec4 wq = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wq = instanceMatrix * wq;
      #endif
      vWPos = (modelMatrix * wq).xyz;`);
    if (occlude) sh.fragmentShader = 'uniform vec3 uCam, uPlayer;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      vec3 pa = uCam, pb = uPlayer + vec3(0.0, 0.6, 0.0), ab = pb - pa;
      float tt = clamp(dot(vWPos - pa, ab) / dot(ab, ab), 0.0, 1.0);
      float occD = length(vWPos - (pa + ab * tt));
      // 작업지시서 4 A2: 가운데(수달 크기 0.95)는 나무를 완전히 비움 → 수달 몸에 점무늬가 안 남음 · 바깥 고리(0.95~1.5)는 4×4 순서 점으로 점점 진해져 큰 둥근 테두리가 안 보임
      vec2 bq = floor(gl_FragCoord.xy), bh = floor(bq * 0.5);
      float bay = fract(dot(mod(bh, 2.0), vec2(0.5, mod(bh.y, 2.0) * 0.75))) * 0.25 + fract(dot(mod(bq, 2.0), vec2(0.5, mod(bq.y, 2.0) * 0.75)));
      if (tt < 0.94 && bay >= smoothstep(0.95, 1.5, occD)) discard;`);
    else sh.fragmentShader = 'uniform vec3 uPlayer;\nvarying vec3 vWPos;\n' + sh.fragmentShader;
    // 수달 등불(머리 위 1.8 · light.js myLamp)이 잎 · 덤불을 비추는 세기만 0.3 배 — 등불이 수달 둘레 나무 층 윗면을 밝게 비춰, 앞 나무 비침 구멍 너머로 밝은 초록 띠가 보이던 것
    // (2026-11-19 · 등불을 끄면 띠가 사라지고, 거리로 어둡게 해도 띠 자리 픽셀이 그대로임을 확인 — 띠는 등불에서 5~7칸 뒤 나무). 땅 · 수달은 등불 그대로
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getPointLightInfo( pointLight, geometryPosition, directLight );', `getPointLightInfo( pointLight, geometryPosition, directLight );
      if ( distance( pointLight.position, ( viewMatrix * vec4( uPlayer + vec3( 0.0, 1.8, 0.0 ), 1.0 ) ).xyz ) < 0.6 ) directLight.color *= 0.12;`));
  };
  // 셰이더 이름을 재질 설정마다 따로(2026-11-19): 예전엔 바람 재질 4개(나무 · 덤불 · 꽃 · 풀)의 이름이 같아(함수 글이 같음) three 가 먼저 만든 셰이더를 돌려씀 →
  // 칸 나눠 그리기로 그리는 차례가 바뀌자 나무가 덤불 셰이더(가림 비침 없음)를 받아 수달 앞 나무가 비치지 않았음. 흔들림 세기도 서로 섞일 수 있었음
  const key = `windy|${sway}|${from}|${occlude ? 1 : 0}|${noFlip ? 1 : 0}`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

// ───────── 나무 · 덤불 · 바위 · 꽃 · 풀 (같은 모양은 한 번에 그림) ─────────
const BARK0 = 0x5e3b22, BARK1 = 0x9a6a40;
// 덤불 공: 가운데 위 하나 + 둘레 셋(앞 왼쪽 · 앞 오른쪽 · 뒤) — [x, y, z, 반지름] · 열매 덤불의 열매도 이 공 겉면에 붙임
const BUSH_BLOBS = [[0, 0.5, 0, 0.54], ...[0.6, 2.7, 4.7].map((a) => [Math.cos(a) * 0.3, 0.32, Math.sin(a) * 0.3, 0.38])];
// 나무 · 덤불(2026-11-19 펠트 인형 모양) — 줄기 높이 · 굵기는 예전 그대로(흔들기 · 막힘), 잎은 큰 공 몇 개
const buildKinds = () => ({
  round: mergeGeometries([trunkP(1.6, 0.27, 0.17), ...softCanopy(2.4, 1.25, 3, 0x2f7a33, 0x9ad65a, 1)]),
  round2: mergeGeometries([trunkP(1.9, 0.3, 0.18), ...softCanopy(2.8, 1.45, 4, 0x2a6e30, 0x8fcf55, 2)]),
  fruit: mergeGeometries([trunkP(1.4, 0.26, 0.16), ...softCanopy(2.15, 1.2, 3, 0x3a8a37, 0xa6dc62, 3),
    ...[[0.8, 2.05, 0.75], [-0.85, 2.15, 0.6], [0.15, 1.75, 1.05], [-0.25, 2.75, 0.9], [0.95, 2.5, -0.3], [-0.7, 1.8, -0.8], [0.35, 3.0, 0.45]].map(([x, y, z]) => gradI(feltBall(0.16, x, y, z, 1, 1, 1, 8, 6), 0xb52a1c, 0xff6a4a, y - 0.16, y + 0.16))]),
  // 침엽수: 끝이 둥근 고깔 세 층(시안처럼 층마다 아래 가장자리가 말림)
  pine: mergeGeometries([trunkP(1.0, 0.22, 0.14), pineTier(1.35, 1.0, 0.95, 0x1f5a35, 0x4f9a55), pineTier(1.05, 0.9, 1.6, 0x22603a, 0x5aa65c), pineTier(0.76, 0.82, 2.2, 0x266840, 0x66b264), gradI(feltBall(0.26, 0, 2.98, 0), 0x2c7246, 0x72ba6c, 2.75, 3.24)]),
  // 덤불: 통통한 공 셋 + 뒤 하나 · 작은 꽃 공
  bush: mergeGeometries([...BUSH_BLOBS.map(([x, y, z, r]) => gradI(feltBall(r, x, y, z), 0x2f7a33, 0x8fcf55, 0, 1.0, 0.03)),
    ...[[0.32, 0.72, 0.3], [-0.3, 0.6, 0.38], [0.05, 0.98, 0.1], [0.5, 0.5, -0.12]].map(([x, y, z]) => gradI(feltBall(0.07, x, y, z, 1, 1, 1, 8, 6), 0xffffff, 0xffffff, 0, 1))]),
});
// 가까운 모양 · 먼 칸 모양(마디 약 절반 — 삼각형 약 1/4)
const TREE_KINDS = buildKinds();
SEGK = 0.45;
const TREE_LO = buildKinds();
SEGK = 1;
// 바위(2026-11-19 펠트): 꼭짓점을 나눠 쓰는 매끈한 공을 아주 완만하게만 울퉁불퉁 — 면 · 모서리가 안 보이는 통통한 조약돌 · lo 는 먼 칸 모양
const rockGeo = (w, h) => { const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.93 + 0.12 * noise(x * 0.9 + 5, z * 0.9 + y * 0.8); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return gradI(g, 0x7e8078, 0xbcb9ab, -0.6, 0.7); };
// 윗면 이끼: 높이에 따라 부드럽게 물듦
const mossy = (g) => { const p = g.attributes.position, c = g.attributes.color, m = new THREE.Color(0x7aa848), t = new THREE.Color(); for (let i = 0; i < p.count; i++) { const k = sstep(0.5, 0.8, p.getY(i)) * 0.6; if (k > 0) { t.setRGB(c.getX(i), c.getY(i), c.getZ(i)).lerp(m, k); c.setXYZ(i, t.r, t.g, t.b); } } return g; };
const ROCK = mossy(rockGeo(22, 16)), ROCK_LO = mossy(rockGeo(9, 6));
const BLADE = (() => { // 풀잎 하나: 아래 진한 초록 → 끝 연두
  const w = 0.05, h = 0.3, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-w, 0, 0, w, 0, 0, -w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, 0, -w * 0.35, h * 0.75, 0, w * 0.35, h * 0.75, 0, 0, h, 0.02]), 3));
  g.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(21).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const A = new THREE.Color(0x74ac46), B = new THREE.Color(0xa9d466), col = []; for (const y of [0, 0, 0.4, 0.4, 0.75, 0.75, 1]) { const c = A.clone().lerp(B, y); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3)); return g;
})();
const FLOWER = mergeGeometries([
  ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return grad(at(new THREE.SphereGeometry(0.06, 6, 4), Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07, 1, 0.35, 1), 0xffffff, 0xffffff, 0, 1); }),
  grad(at(new THREE.SphereGeometry(0.04, 6, 4), 0, 0.17, 0), 0xffd23a, 0xffd23a, 0, 1),
  grad(at(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 3), 0, 0.08, 0), 0x4f8f2e, 0x4f8f2e, 0, 1),
]);
// 길가 자갈: 납작한 둥근 공(각진 12면체 대신 · 꼭짓점도 더 적음)
const PEBBLE = gradI(feltBall(0.12, 0, 0, 0, 1, 0.62, 1, 7, 4), 0x9a9486, 0xd2cbb8, -0.08, 0.08);
const treeMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true }), { sway: 0.022, from: 1.2, occlude: true }); // 매끈한 면(찰흙 · C단계)
const bushMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true }), { sway: 0.05, from: 0.2, occlude: false });
const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const grassMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { sway: 1.6, from: 0, noFlip: true });
const flowerMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true }), { sway: 1.2, from: 0 });
// 자갈도 면이 안 보이게 매끈하게(2026-11-19 펠트 · 예전 flatShading 끔)
const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
// ── 칸 나눠 그리기(2026-11-19 부장님 · 휴대폰 성능) ──
// 예전엔 종류마다 섬 전체가 한 묶음이라 한 그루만 보여도 전부(나무 435 · 꽃 1800 …) 그렸음 → CELL 칸 네모마다 따로 묶어 화면 밖 칸은 three 가 거름.
// lo: 먼 칸에 그릴 단순한 모양(공 마디를 줄인 것) · null 이면 먼 칸은 안 그림(꽃 · 자갈처럼 작은 것) · 없으면 거리와 상관없이 같은 모양.
// 채집 · 흔들기 코드는 r.im.setMatrixAt / getMatrixAt / instanceMatrix.needsUpdate 만 쓰므로, 먼 모양이 있는 칸은 둘 다 고치는 작은 손잡이를 r.im 으로 줌
const CELL = 24, LOD_CELLS = [];
function chunkInstances(big, recs, { lo, far = 30 } = {}) {
  const cells = new Map(), c = new THREE.Color(), hasColor = !!big.instanceColor;
  for (const r of recs) { const k = Math.floor(r.x / CELL) + ',' + Math.floor(r.z / CELL); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(r); }
  for (const list of cells.values()) {
    const cols = hasColor ? list.map((r) => { big.getColorAt(r.i, c); return c.clone(); }) : null;
    const mk = (geo) => {
      const im = new THREE.InstancedMesh(geo, big.material, list.length); im.castShadow = big.castShadow; im.receiveShadow = big.receiveShadow;
      list.forEach((r, i) => { im.setMatrixAt(i, r.m); if (cols) im.setColorAt(i, cols[i]); });
      im.computeBoundingSphere(); scene.add(im); return im;
    };
    const near = mk(big.geometry), farIm = lo ? mk(lo) : null;
    let h = near;
    if (lo !== undefined) {
      const cx = list.reduce((s, r) => s + r.x, 0) / list.length, cz = list.reduce((s, r) => s + r.z, 0) / list.length;
      h = { near, far: farIm, cx, cz, R: far,
        setMatrixAt(i, m) { near.setMatrixAt(i, m); if (farIm) farIm.setMatrixAt(i, m); },
        getMatrixAt(i, m) { return near.getMatrixAt(i, m); },
        instanceMatrix: { set needsUpdate(v) { near.instanceMatrix.needsUpdate = v; if (farIm) farIm.instanceMatrix.needsUpdate = v; } } };
      LOD_CELLS.push(h);
    }
    list.forEach((r, i) => { r.im = h; r.i = i; });
  }
}
// 가까운 칸만 제 모양 · 먼 칸은 단순한 모양(없으면 숨김). 저사양은 가까운 거리를 짧게. loop.js 가 카메라를 옮긴 뒤 부름
let lodAt = -1;
function lodTick(at) {
  if (++lodAt % 6) return;
  const k = quality.level === 0 ? 0.6 : quality.level === 1 ? 0.85 : 1;
  for (const h of LOD_CELLS) { const on = Math.hypot(h.cx - at.x, h.cz - at.z) < h.R * k + CELL * 0.5; h.near.visible = on; if (h.far) h.far.visible = !on; }
}
function scatter(geo, mat, n, place, { shadow = true, area = ISLE_R * 2 + 4, tryMul = 40, chunk = true, lo, far } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let k = 0;
  const recs = []; // 채집용: 자리 · 원래 모양 · 막힘
  for (let tries = 0; k < n && tries < n * tryMul; tries++) {
    const x = (rnd() - 0.5) * area, z = (rnd() - 0.5) * area;
    const r = place(x, z, k); if (!r) continue;
    const px = r.x ?? x, pz = r.z ?? z;
    e.set(r.rx || 0, rnd() * Math.PI * 2, r.rz || 0); q.setFromEuler(e);
    m.compose(v.set(px, height(px, pz) + (r.y || 0), pz), q, s.set(r.sx ?? r.s, r.sy ?? r.s, r.sz ?? r.s));
    im.setMatrixAt(k, m); if (r.color) im.setColorAt(k, r.color);
    recs.push({ im, i: k, x: px, z: pz, s: r.s, m: m.clone(), circle: r.circle || null });
    k++;
  }
  im.count = k; im.castShadow = shadow; im.receiveShadow = true; im.userData.recs = recs;
  // 칸으로 나누면 큰 묶음은 장면에 넣지 않음(recs 의 im · i 가 칸 묶음을 가리킴)
  if (chunk) chunkInstances(im, recs, { lo, far }); else scene.add(im);
  return im;
}
const tint = (base, vary) => new THREE.Color(base).offsetHSL((rnd() - 0.5) * vary, (rnd() - 0.5) * vary, (rnd() - 0.5) * vary);
const treeSpots = [];
const spotOk = (x, z, gap) => treeSpots.every((t) => Math.hypot(t.x - x, t.z - z) > gap);
const TREES = [], BUSHES = [], ROCKS = [], FLOWERS = []; // 채집 대상
for (const [kind, n] of [['round', 150], ['round2', 110], ['pine', 130], ['fruit', 45]]) {
  const im = scatter(TREE_KINDS[kind], treeMat, n, (x, z) => {
    if (!clearSpot(x, z, 3.2) || !spotOk(x, z, 3.4)) return null;
    if (kind === 'pine' && Math.hypot(x, z) < 70 && !(x > 30 && z < -60)) return null; // 소나무는 바깥쪽 · 북동쪽 소나무 숲
    const fz = noise(x * 0.028 + 3, z * 0.028); if (fz < 0.42 && rnd() < 0.85) return null; // 숲이 덩어리로 뭉치게(빈 들판을 넓게 — 텐트 자리)
    const s = 0.85 + rnd() * 0.4, circle = { x, z, r: 0.32 * s }; treeSpots.push({ x, z }); circles.push(circle);
    return { s, color: tint(0xffffff, 0.08), circle };
  }, { lo: TREE_LO[kind], far: 32 });
  for (const r of im.userData.recs) TREES.push(Object.assign(r, { kind, wood: 3, next: 0, down: 0 }));
}
const BUSH_TINT = [0xffffff, 0xffc6dc, 0xfff1a8, 0xe3d0ff];
BUSHES.push(...scatter(TREE_KINDS.bush, bushMat, 230, (x, z) => {
  if (!clearSpot(x, z, 2.2) || !spotOk(x, z, 1.8)) return null;
  const circle = { x, z, r: 0.45 }; treeSpots.push({ x, z }); circles.push(circle);
  return { s: 0.8 + rnd() * 0.5, color: new THREE.Color(BUSH_TINT[Math.floor(rnd() * 4)]), circle };
}, { lo: TREE_LO.bush, far: 26 }).userData.recs.map((r) => Object.assign(r, { next: 0 })));
// ── 열매 덤불(밤샘 5단계): 덤불 셋 중 하나쯤에 빨간 열매 송이 — 따면 사라졌다가 다시 열림(BERRIES · 서버 키 E) ──
const BERRIES = [];
{
  const parts = [];
  // 통통한 덤불 겉면에 동그란 열매(2026-11-19 펠트 — 공을 더 둥글게 · 겉으로 조금 나옴)
  for (let j = 0; j < 7; j++) { const [bx, by, bz, br] = BUSH_BLOBS[j % 4], a = hash(j, 7.7) * Math.PI * 2, d = new THREE.Vector3(bx * 2 + Math.cos(a) * 0.5, by - 0.05 + hash(j, 3.1) * 0.6, bz * 2 + Math.sin(a) * 0.5).normalize(); const g = new THREE.SphereGeometry(0.1, 8, 6); g.translate(bx + d.x * br * 0.97, by + d.y * br * 0.97, bz + d.z * br * 0.97); const c = new THREE.Color(j % 2 ? 0xd2232f : 0xe84a3c), col = []; for (let v = 0; v < g.attributes.position.count; v++) col.push(c.r, c.g, c.b); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); parts.push(g); }
  const BERRY = mergeGeometries(parts), mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const pick = BUSHES.filter((b, i) => hash(i * 1.7 + 3, 11.3) < 0.36);
  const im = new THREE.InstancedMesh(BERRY, mat, Math.max(1, pick.length)), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  pick.forEach((b, i) => { b.m.decompose(v, q, s); m.compose(v, q, s); im.setMatrixAt(i, m); BERRIES.push({ im, i, x: b.x, z: b.z, s: b.s, m: m.clone(), circle: null, bush: b, down: 0 }); });
  // 칸으로 나눠 그림(멀어도 열매는 그대로 보임 — 딸 수 있는 덤불 표시)
  im.count = pick.length; im.castShadow = true; im.receiveShadow = false; chunkInstances(im, BERRIES);
}
// 바위 종류(작업지시서 4 C): 항구에서 먼 바위 일부가 철 바위(60칸 밖) · 금 바위(95칸 밖 · 가장 드묾) — 자리로 정해져(hash) 서버 world.json 과 같음 · 섬 자리(rnd)는 안 건드림
const rockKind = (x, z) => { const d = Math.hypot(x - HARBOR.x, z - HARBOR.z); return d > 125 && hash(x * 0.53 + 9, z * 1.9) < 0.07 ? '금' : d > 50 && hash(x * 1.31, z * 0.77) < 0.42 ? '철' : null; };
const ROCK_TINT = { null: new THREE.Color(0xffffff), 철: new THREE.Color(0xe8b49a), 금: new THREE.Color(0xffe27a) };
// 바위 24개 (2026-11-17 부장님 — 집터 56개로 늘린 뒤 clearSpot(집터 6칸 금지)에 걸려 7개뿐이었음)
// 바위는 따로: 집 · 보관함 자리만 피하고(집터 가운데 5칸 · 보관함 2.2칸) 모래 가장자리까지 허용
const rockSpots = [];
const rockOk = (x, z) => {
  const d = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
  if (d > R - 7 || height(x, z) < -0.05 || pathDist(x, z) < 2.2) return false;
  if (Math.abs(x - riverX(z)) < RW + 2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) return false;
  if (Math.hypot(x - HARBOR.x, z - HARBOR.z) < 14) return false;
  if (KEEP.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) return false;
  if (CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < 5 || Math.hypot(x - p.x - 3.6, z - p.z - 3.4) < 2.2)) return false;
  return spotOk(x, z, 2.4) && rockSpots.every((q) => Math.hypot(q.x - x, q.z - z) > 3);
};
const ROCKY = { x: -45, z: 88, r: 26 }; // 남서쪽 바위 지대(눈에 띄는 곳)
ROCKS.push(...scatter(ROCK, rockMat, 95, (x, z) => {
  if (Math.hypot(x - ROCKY.x, z - ROCKY.z) > ROCKY.r && rnd() < 0.55) return null; // 반쯤은 바위 지대에
  if (!rockOk(x, z)) return null;
  const s = 0.45 + rnd() * 0.65, circle = { x, z, r: s * 0.95 }; circles.push(circle); rockSpots.push({ x, z }); return { s, sy: s * 0.62, sz: s * 0.85, y: 0.05, circle, color: ROCK_TINT[rockKind(x, z)] };
}, { tryMul: 400, lo: ROCK_LO, far: 30 }).userData.recs.map((r) => Object.assign(r, { stone: 3, down: 0, kind: rockKind(r.x, r.z) })));
const FLOWER_COLORS = [0xffffff, 0xff9fc4, 0xffe066, 0xc39af5, 0xff8a65, 0x9fd4ff];
// 꽃 무리 자리는 풀밭에서만 고르고, 시도마다 아무 무리나 고른다
// (예전: k번째 꽃은 k번째 무리에만 — 무리 하나가 물 · 길이면 거기서 멈춰 섬 전체에 꽃 8개뿐이었음 · 2026-11-17 고침)
const flowerSpots = [];
for (let i = 0; i < 6000 && flowerSpots.length < 120; i++) { const x = (rnd() - 0.5) * ISLE_R * 1.8, z = (rnd() - 0.5) * ISLE_R * 1.8; if (isGrass(x, z)) flowerSpots.push({ x, z, c: FLOWER_COLORS[Math.floor(rnd() * FLOWER_COLORS.length)] }); }
FLOWERS.push(...scatter(FLOWER, flowerMat, 1800, () => {
  const f = flowerSpots[Math.floor(rnd() * flowerSpots.length)], a = rnd() * 6.28, rr = Math.sqrt(rnd()) * 3.2, fx = f.x + Math.cos(a) * rr, fz = f.z + Math.sin(a) * rr;
  if (!isGrass(fx, fz)) return null;
  return { s: 0.9 + rnd() * 0.5, color: new THREE.Color(f.c), x: fx, z: fz };
}, { shadow: false, lo: null, far: 18 }).userData.recs.map((r) => Object.assign(r, { down: 0 })));
scatter(PEBBLE, plainMat, 1100, (x, z, k) => { // 길가 자갈
  const sgi = PATHS[k % PATHS.length], t = rnd(), side = rnd() < 0.5 ? -1 : 1, dx = sgi[2] - sgi[0], dz = sgi[3] - sgi[1], l = Math.hypot(dx, dz);
  const off = side * (1.35 + rnd() * 0.6), px = sgi[0] + dx * t - dz / l * off, pz = sgi[1] + dz * t + dx / l * off;
  if (height(px, pz) < -0.1 || pathDist(px, pz) < 1.25) return null; // 광장 · 다른 길 한가운데는 빼고 가장자리만
  return { s: 0.6 + rnd() * 0.9, sy: 0.5, x: px, z: pz, y: 0.02 };
}, { shadow: false, lo: null, far: 18 });
const GRASS_N = touchy ? 2500 : 5000; // C단계: 뾰족한 풀잎을 거의 없앰(땅은 단색에 옅은 무늬 · 작업지시서 2 C)
const grass = scatter(BLADE, grassMat, GRASS_N, (x, z) => {
  if (noise(x * 0.05 + 9, z * 0.05) < 0.62) return null; // 군데군데 덤불 밑에만 조금
  if (!isGrass(x, z)) return null;
  return { s: 0.7 + rnd() * 0.7, sx: 1, sz: 1, color: tint(0xffffff, 0.1) };
}, { shadow: false, chunk: false });

// ───────── 다리 · 부두 (나무 판) ─────────
{ // 부두: 항구 북쪽 바다로
  const wood = new THREE.MeshLambertMaterial({ color: 0xb07a45 }), dark = new THREE.MeshLambertMaterial({ color: 0x80552f });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); };
  const n = Math.round((DOCK.z1 - DOCK.z0) / 0.59); for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(DOCK.half * 2 + 0.3, 0.14, 0.52), i % 2 ? wood : dark, DOCK.x + (hash(i, 7) - 0.5) * 0.08, DOCK.y - 0.07, DOCK.z1 - 0.3 - i * 0.59);
  for (const s of [-1, 1]) for (let i = 0; i <= 5; i++) add(new THREE.CylinderGeometry(0.13, 0.15, 1.6, 10), dark, DOCK.x + s * (DOCK.half + 0.1), DOCK.y - 0.45, DOCK.z1 - 0.4 - i * (DOCK.z1 - DOCK.z0 - 0.8) / 5);
}
{
  const wood = new THREE.MeshLambertMaterial({ color: 0xb07a45 }), dark = new THREE.MeshLambertMaterial({ color: 0x80552f });
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; scene.add(o); };
  for (const B of BRIDGES) { // 개울 다리 3곳
    const n = Math.round(B.half * 2 / 0.59); for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(0.52, 0.14, 3.1), i % 2 ? wood : dark, B.x - B.half + 0.3 + i * 0.59, B.y - 0.07 + (hash(i, 1) - 0.5) * 0.03, B.z + (hash(i, 2) - 0.5) * 0.08);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(B.half * 2, 0.1, 0.12), wood, B.x, B.y + 0.75, B.z + s * 1.5);
      for (let i = 0; i <= 6; i++) add(new THREE.BoxGeometry(0.16, 1.4, 0.16), dark, B.x - B.half + 0.2 + i * (B.half * 2 - 0.4) / 6, B.y + 0.1, B.z + s * 1.5);
    }
  }
}
