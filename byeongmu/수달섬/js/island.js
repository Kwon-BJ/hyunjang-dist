// 수달섬 — 섬 모양 · 땅 · 물 · 막힘 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 섬 모양 (x 동쪽 · z 남쪽 · 높이 y) ─────────
const SEA_Y = -0.35;
const islandR = (a) => 62 + 3 * Math.sin(3 * a) + 2 * Math.sin(5 * a + 1);
const RW = 3; // 개울 반폭
const riverX = (z) => 24 + 4 * Math.sin(z * 0.06);
const BRIDGE = { x: 24, half: 5, w: 1.3, y: 0.3 };
const POND = { x: -28, z: 18, r: 6 };
const PLAZA = { x: 0, z: 0, r: 6 }; // 옛 광장(이제 갈림길)
const HARBOR = { x: 0, z: -54 }; // 항구 = 안전지대(섬 북쪽 가장자리 · 부장님 2026-11-18) — 부두 · 도구 상점 · 자판기
const DOCK = { x: 0, half: 1.2, z0: -69, z1: -58.5, y: 0.3 }; // 부두(바다로 나간 나무 길)
const PATHS = [[0, -54, 16, -44], [16, -44, 14, -20], [14, -20, 19, 0], [0, -54, 0, -6], [0, -54, -28, -38], [-28, -38, -19, -17], // 항구에서 나가는 길 3곳: 동(다리 쪽) · 남(옛 광장) · 서(야영지)
  [0, 0, 19, 0], [29, 0, 38, -10], [0, 0, -18, -15], [0, 0, 0, 44], [0, 0, -6, 30], [-6, 30, -20, 22]];
const FLAT = [{ x: 0, z: -54, r: 9 }, { x: 0, z: 0, r: 9 }, { x: -19, z: -17, r: 11 }, { x: 41, z: -10, r: 14 }, { x: 44, z: 14, r: 7 }, { x: 24, z: 0, r: 9 }]; // 언덕을 만들지 않는 곳
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (px, pz, [ax, az, bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const pathDist = (x, z) => Math.min(Math.hypot(x - PLAZA.x, z - PLAZA.z) - PLAZA.r + 1.6, Math.hypot(x - HARBOR.x, z - HARBOR.z) - 7 + 1.6, ...PATHS.map((s) => segDist(x, z, s)));
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function height(x, z) {
  const d = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
  const rv = Math.abs(x - riverX(z)), pd = Math.hypot(x - POND.x, z - POND.z);
  let h = -0.9 * sstep(R - 6, R + 3, d);
  let hill = sstep(R - 5, R - 15, d) * sstep(RW + 2, RW + 8, rv) * sstep(POND.r + 2, POND.r + 8, pd);
  for (const f of FLAT) hill *= sstep(f.r, f.r + 7, Math.hypot(x - f.x, z - f.z));
  const n = noise(x * 0.035 + 7, z * 0.035 + 3);
  h += hill * n * n * 2.6;
  h = Math.min(h, -0.8 * sstep(RW + 1.5, RW, rv));
  h = Math.min(h, -0.8 * sstep(POND.r + 1.5, POND.r, pd));
  return h;
}
// 빈터(2026-11-18 B단계: 정해진 집터를 없애고 텐트를 사서 아무 데나 침 — 옛 집터 자리는 「평평한 빈터」로 남겨 나무 · 바위 자리가 바뀌지 않게). 옛 설명: 집터 문파원마다 하나씩(서버가 번호를 정해 줌) — 섬 안쪽 · 물 · 길 · 마을 시설을 피해 8칸 간격, 광장에 가까운 순 64개(2026-11-17 9칸 40개였는데 실제론 33개뿐 · 문파원 50명이라 늘림). 집터는 평평하게
const KEEP = [{ x: 0, z: -54, r: 10 }, { x: 0, z: 0, r: 10 }, { x: -19, z: -17, r: 10 }, { x: 41, z: -10, r: 13 }, { x: 44, z: 14, r: 7 }, { x: 0, z: 50, r: 6 }, { x: -4.5, z: -5, r: 4 }];
const CLEARINGS = (() => {
  const out = [];
  const SP = 9; // 집터 간격(2026-11-18 부장님 — 집마다 함정 자리 8곳 이상: 8 → 9 · 가장자리 여유 11 → 8 로 56곳 유지)
  for (let gz = -54; gz <= 54; gz += SP) for (let gx = -54; gx <= 54; gx += SP) {
    const x = gx + (Math.abs(Math.round(gz / SP)) % 2 ? SP / 2 : 0), z = gz;
    if (Math.hypot(x, z) > islandR(Math.atan2(z, x)) - 8) continue;
    if (Math.abs(x - riverX(z)) < RW + 5.5 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 5.5 || pathDist(x, z) < 4.5) continue;
    if (KEEP.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 4)) continue;
    out.push({ x, z });
  }
  return out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 64);
})();
FLAT.push(...CLEARINGS.map((p) => ({ x: p.x, z: p.z, r: 5.5 })));
const onBridge = (x, z) => (Math.abs(x - BRIDGE.x) < BRIDGE.half && Math.abs(z) < BRIDGE.w) || (Math.abs(x - DOCK.x) < DOCK.half && z > DOCK.z0 && z < DOCK.z1); // 다리 · 부두 위는 걸어짐
const groundY = (x, z) => (onBridge(x, z) ? Math.max(BRIDGE.y, height(x, z)) : height(x, z));
let seed = 20261117;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const isGrass = (x, z) => {
  const d = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
  return d < R - 8.5 && Math.hypot(x - HARBOR.x, z - HARBOR.z) > 10 && height(x, z) > -0.05 && // 항구(안전지대) 안엔 꽃 · 풀 없음(부장님)
    pathDist(x, z) > 1.7 && Math.abs(x - riverX(z)) > RW + 1.9 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 1.9;
};

// ───────── 땅 ─────────
{
  const C = (h) => new THREE.Color(h);
  const G1 = C(0x86c04f), G2 = C(0xa8d264), G3 = C(0x6aa944), DIRT = C(0xdcbc8a), DIRT2 = C(0xc9a06c), SAND = C(0xf0e0b0), WET = C(0xc2b083), BANK = C(0xdccb9a);
  const geo = new THREE.PlaneGeometry(150, 150, 300, 300); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = height(x, z);
    pos.setY(i, h);
    const n = noise(x * 0.12, z * 0.12), n2 = noise(x * 0.5 + 40, z * 0.5);
    c.copy(G1).lerp(G2, sstep(0.35, 0.75, n)).lerp(G3, 0.35 * sstep(0.6, 0.9, n2));
    c.lerp(C(0xb7d86c), sstep(0.4, 1.6, h) * 0.35); // 언덕 위는 밝게
    const pd = pathDist(x, z);
    c.lerp(DIRT.clone().lerp(DIRT2, n2 * 0.6), sstep(1.9, 1.2, pd));
    const d = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
    c.lerp(SAND, sstep(R - 9.5, R - 7, d));
    const bank = Math.max(sstep(RW + 1.9, RW + 0.7, Math.abs(x - riverX(z))), sstep(POND.r + 1.9, POND.r + 0.7, Math.hypot(x - POND.x, z - POND.z)));
    c.lerp(BANK, bank * 0.85);
    c.lerp(WET, sstep(-0.15, -0.4, h));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const tc = document.createElement('canvas'); tc.width = tc.height = 128; const tx = tc.getContext('2d');
  tx.fillStyle = '#fff'; tx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const g = 215 + Math.floor(rnd() * 40); tx.fillStyle = `rgb(${g},${g},${g})`; tx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2); }
  const tex = new THREE.CanvasTexture(tc); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(90, 90); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }));
  ground.receiveShadow = true; scene.add(ground);
}

// ───────── 물 (얕은 곳 청록 · 깊은 곳 파랑 · 물가 거품 · 반짝임) ─────────
{
  const N = 256, data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -75 + (i + 0.5) * 150 / N, z = -75 + (j + 0.5) * 150 / N;
    data[(j * N + i) * 4] = Math.round(255 * Math.min(1, Math.max(0, (SEA_Y - height(x, z)) / 1.2)));
    data[(j * N + i) * 4 + 3] = 255;
  }
  const depthTex = new THREE.DataTexture(data, N, N); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShallow: { value: new THREE.Color(0x5fd6d0) }, uDeep: { value: new THREE.Color(0x2f8fc4) } }]),
    vertexShader: `
      varying vec2 vXZ;
      #include <fog_pars_vertex>
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uDepth; uniform vec3 uShallow, uDeep; varying vec2 vXZ;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = (vXZ + 75.0) / 150.0;
        float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.2 : texture2D(uDepth, uv).r * 1.2;
        vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 0.9, d));
        float w = sin(vXZ.x * 2.1 + uTime * 1.3) * sin(vXZ.y * 1.8 - uTime * 1.1) + 0.6 * sin((vXZ.x + vXZ.y) * 3.7 + uTime * 2.1);
        col += vec3(0.9, 0.95, 1.0) * smoothstep(1.25, 1.5, w) * 0.22;
        float f = smoothstep(0.075, 0.015, d + 0.02 * sin(uTime * 1.6 + vXZ.x * 1.3 + vXZ.y * 1.1));
        col = mix(col, vec3(1.0), f * 0.6);
        gl_FragColor = vec4(col, max(mix(0.5, 0.93, smoothstep(0.0, 0.6, d)), f * 0.7));
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = U.uTime; mat.uniforms.uDepth = { value: depthTex };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; scene.add(sea);
}

// ───────── 막힘 ─────────
const circles = [], boxes = [];
function free(x, z, r = 0.32) {
  if (!onBridge(x, z) && height(x, z) < -0.18) return false;
  for (const c of circles) if (!c.off && (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return false; // 쓰러진 나무 · 다 캔 바위는 off(예전엔 반지름 -100 → 제곱하면 섬 전체가 막혀 제자리걸음, 2026-11-17)
  for (const b of boxes) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
  return true;
}
const keepOut = KEEP;
const clearSpot = (x, z, gap) => {
  const d = Math.hypot(x, z), R = islandR(Math.atan2(z, x));
  if (d > R - 10 || height(x, z) < 0 || pathDist(x, z) < gap) return false;
  if (CLEARINGS.some((p) => Math.hypot(x - p.x, z - p.z) < 6)) return false; // 빈터엔 나무 · 바위 없음
  if (Math.abs(x - riverX(z)) < RW + 2.5 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5) return false;
  return !keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
};
