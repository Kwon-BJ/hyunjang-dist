// 수달섬 — 섬 모양 · 땅 · 물 · 막힘 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 섬 모양 (x 동쪽 · z 남쪽 · 높이 y) ─────────
const SEA_Y = -0.35;
// 2026-11-18 C단계: 섬 넓이 4배 이상(반지름 62 → 128 · 부장님 알림). 숫자를 바꾸면 기획/수달섬-세계뽑기.cjs 로 world.json 을 다시 뽑는다
const ISLE_R = 128, MAP_V = 'C1'; // MAP_V: 지도 판(바뀌면 혼자 놀기 저장의 옛 집을 텐트로 · 리뷰)
const islandR = (a) => ISLE_R + 6 * Math.sin(3 * a) + 4 * Math.sin(5 * a + 1);
const RW = 3.5; // 개울 반폭
const riverX = (z) => 50 + 9 * Math.sin(z * 0.03);
const BRIDGES = [-70, 0, 70].map((z) => ({ x: +riverX(z).toFixed(2), z, half: 6.2, w: 1.4, y: 0.3 })); // 개울 다리 3곳(북 · 가운데 · 남)
const BRIDGE = BRIDGES[1]; // 예전 이름(가운데 다리)
const POND = { x: -60, z: 40, r: 15 }; // 호수(낚시)
const PLAZA = { x: 0, z: 0, r: 7 }; // 가운데 광장(모닥불 · 가로등 · 갈림길)
const HARBOR = { x: 0, z: -122 }; // 항구 = 안전지대(섬 북쪽 가장자리 · 부장님 2026-11-18) — 부두 · 도구 상점 · 자판기
const DOCK = { x: 0, half: 1.2, z0: -137, z1: -126.5, y: 0.3 }; // 부두(바다로 나간 나무 길)
const CAMP = { x: -75, z: -60 }, FARM = { x: 95, z: -40 }; // 서쪽 야영지 · 동쪽 농장
const PATHS = [[0, -122, 25, -100], [25, -100, 42, -70], [42, -70, 75, -62], [75, -62, 92, -44], // 항구 → 동(북쪽 다리 · 농장)
  [0, -122, 0, -7], // 항구 → 남(가운데 광장)
  [0, -122, -40, -100], [-40, -100, -73, -62], [-77, -57, -66, 22], // 항구 → 서(야영지 · 호수)
  [0, 0, 50, 0], [50, 0, 96, 10], [96, 10, 95, -26], [0, 0, -44, 26], [0, 0, 5, 60], [5, 60, 0, 112], [5, 60, 58, 70], [58, 70, 96, 76], [5, 60, -44, 86]];
const FLAT = [{ x: HARBOR.x, z: HARBOR.z, r: 12 }, { x: 0, z: 0, r: 10 }, { x: CAMP.x, z: CAMP.z, r: 12 }, { x: FARM.x, z: FARM.z, r: 17 }, { x: 98, z: -16, r: 8 }, ...BRIDGES.map((b) => ({ x: b.x, z: b.z, r: 10 }))]; // 언덕을 만들지 않는 곳
const CL_CELL = 14, clCells = new Map(); // 빈터를 칸으로 묶음(높이 계산 때 둘레 9칸만 봄 · 리뷰 4)
const clNear = (x, z) => { const i = Math.floor(x / CL_CELL), j = Math.floor(z / CL_CELL), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = clCells.get((i + a) + ',' + (j + b)); if (l) for (const q of l) out.push(q); } return out; };
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
  for (const f of clNear(x, z)) hill *= sstep(f.r, f.r + 7, Math.hypot(x - f.x, z - f.z));
  const n = noise(x * 0.022 + 7, z * 0.022 + 3), n2 = noise(x * 0.06 + 2, z * 0.06 + 5);
  h += hill * (n * n * 3.2 + n2 * 0.35); // 넓은 섬: 큰 언덕 + 잔물결
  h = Math.min(h, -0.8 * sstep(RW + 1.5, RW, rv));
  h = Math.min(h, -0.8 * sstep(POND.r + 1.5, POND.r, pd));
  return h;
}
// 빈터(2026-11-18 B단계: 정해진 집터를 없애고 텐트를 사서 아무 데나 침 — 옛 집터 자리는 「평평한 빈터」로 남겨 나무 · 바위 자리가 바뀌지 않게). 옛 설명: 집터 문파원마다 하나씩(서버가 번호를 정해 줌) — 섬 안쪽 · 물 · 길 · 마을 시설을 피해 8칸 간격, 광장에 가까운 순 64개(2026-11-17 9칸 40개였는데 실제론 33개뿐 · 문파원 50명이라 늘림). 집터는 평평하게
const KEEP = [{ x: HARBOR.x, z: HARBOR.z, r: 13 }, { x: 0, z: 0, r: 11 }, { x: CAMP.x, z: CAMP.z, r: 11 }, { x: FARM.x, z: FARM.z, r: 17 }, { x: 98, z: -16, r: 8 }, ...BRIDGES.flatMap((b) => [{ x: b.x - b.half - 1, z: b.z, r: 3 }, { x: b.x + b.half + 1, z: b.z, r: 3 }])]; // 나무 · 바위를 안 두는 곳
const CLEARINGS = (() => {
  const out = [];
  const SP = 14; // 빈터 간격(C단계: 넓은 섬 — 텐트 자리 80곳 이상이 나오게)
  for (let gz = -112; gz <= 112; gz += SP) for (let gx = -112; gx <= 112; gx += SP) {
    const x = gx + (Math.abs(Math.round(gz / SP)) % 2 ? SP / 2 : 0), z = gz;
    if (Math.hypot(x, z) > islandR(Math.atan2(z, x)) - 8) continue;
    if (Math.abs(x - riverX(z)) < RW + 5.5 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 5.5 || pathDist(x, z) < 4.5) continue;
    if (KEEP.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 4) || Math.hypot(x - HARBOR.x, z - HARBOR.z) < 33) continue; // 항구 둘레 25칸(+안전지대)은 집을 못 지으니 빈터도 안 만듦
    if (hash(gx * 0.37, gz * 0.53) < 0.25) continue; // 넷 중 하나는 숲으로 남김
    out.push({ x, z });
  }
  return out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, 140);
})();
for (const p of CLEARINGS) { const k = Math.floor(p.x / CL_CELL) + ',' + Math.floor(p.z / CL_CELL); if (!clCells.has(k)) clCells.set(k, []); clCells.get(k).push({ x: p.x, z: p.z, r: 5.5 }); } // 빈터는 평평하게(둘레 칸만 보는 표)
const onBridge = (x, z) => BRIDGES.some((b) => Math.abs(x - b.x) < b.half && Math.abs(z - b.z) < b.w) || (Math.abs(x - DOCK.x) < DOCK.half && z > DOCK.z0 && z < DOCK.z1); // 다리 · 부두 위는 걸어짐
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
  const G1 = C(0x86c04f), G2 = C(0xa8d264), G3 = C(0x6aa944), DIRT = C(0xa98c66), DIRT2 = C(0x977652), SAND = C(0xc4b68e), WET = C(0x9d8f6a), BANK = C(0xb3a57d); // 밤: 흙 · 모래를 낮춰 수달과 구별(C단계)
  const GS = ISLE_R * 2 + 30, GN = touchy ? 340 : 440; // 땅 크기 · 칸 수(넓은 섬 · 휴대폰은 조금 성기게)
  const geo = new THREE.PlaneGeometry(GS, GS, GN, GN); geo.rotateX(-Math.PI / 2);
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
  for (let i = 0; i < 700; i++) { const g = 228 + Math.floor(rnd() * 27); tx.fillStyle = `rgb(${g},${g},${g})`; tx.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2); }
  const tex = new THREE.CanvasTexture(tc); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(GS * 0.6, GS * 0.6); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // 땅을 10 × 10 조각으로(2026-11-19 휴대폰 성능): 한 장이면 화면 밖 땅(휴대폰 23만 · PC 39만 삼각형)까지 늘 그림.
  // 조각은 같은 꼭짓점 묶음을 함께 쓰고(메모리 그대로) 삼각형 번호만 나눔 · 조각마다 둘레 공을 따로 정해 화면 밖 조각은 three 가 거름
  const gmat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }), TN = 10, per = Math.ceil(GN / TN), W1 = GN + 1, box = new THREE.Box3(), pv = new THREE.Vector3();
  for (let ty = 0; ty < TN; ty++) for (let tx = 0; tx < TN; tx++) {
    const idx = [];
    box.makeEmpty();
    for (let iy = ty * per; iy < Math.min(GN, (ty + 1) * per); iy++) for (let ix = tx * per; ix < Math.min(GN, (tx + 1) * per); ix++) {
      const a = ix + W1 * iy, b = ix + W1 * (iy + 1), c2 = ix + 1 + W1 * (iy + 1), d = ix + 1 + W1 * iy;
      idx.push(a, b, d, b, c2, d);
      box.expandByPoint(pv.fromBufferAttribute(pos, a)); box.expandByPoint(pv.fromBufferAttribute(pos, c2));
    }
    if (!idx.length) continue;
    const tg = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv', 'color']) tg.setAttribute(k, geo.attributes[k]);
    tg.setIndex(idx); tg.boundingBox = box.clone(); tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); tg.boundingSphere.radius += 1;
    const tile = new THREE.Mesh(tg, gmat); tile.receiveShadow = true; scene.add(tile);
  }
}

// ───────── 물 (얕은 곳 청록 · 깊은 곳 파랑 · 물가 거품 · 반짝임) ─────────
{
  const N = touchy ? 256 : 512, WS = ISLE_R * 2 + 30, data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -WS / 2 + (i + 0.5) * WS / N, z = -WS / 2 + (j + 0.5) * WS / N;
    data[(j * N + i) * 4] = Math.round(255 * Math.min(1, Math.max(0, (SEA_Y - height(x, z)) / 1.2)));
    data[(j * N + i) * 4 + 3] = 255;
  }
  const depthTex = new THREE.DataTexture(data, N, N); depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter; depthTex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShallow: { value: new THREE.Color(0x3c8fa0) }, uDeep: { value: new THREE.Color(0x173f70) } }]),
    vertexShader: `
      varying vec2 vXZ;
      #include <fog_pars_vertex>
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uDepth; uniform vec3 uShallow, uDeep, uCam; varying vec2 vXZ;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = (vXZ + ${(ISLE_R + 15).toFixed(1)}) / ${(ISLE_R * 2 + 30).toFixed(1)};
        float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.2 : texture2D(uDepth, uv).r * 1.2;
        vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 0.9, d));
        float w = sin(vXZ.x * 2.1 + uTime * 1.3) * sin(vXZ.y * 1.8 - uTime * 1.1) + 0.6 * sin((vXZ.x + vXZ.y) * 3.7 + uTime * 2.1);
        col += vec3(0.9, 0.95, 1.0) * smoothstep(1.25, 1.5, w) * 0.22;
        float f = smoothstep(0.075, 0.015, d + 0.02 * sin(uTime * 1.6 + vXZ.x * 1.3 + vXZ.y * 1.1));
        col = mix(col, vec3(0.85, 0.92, 1.0), f * 0.45); // 물가 거품(밤이라 은은하게)
        vec2 toF = vXZ - uCam.xz; float far = length(toF); float mp = pow(max(0.0, dot(toF / max(far, 0.001), vec2(-0.42, -0.91))), 18.0); // 달 쪽(북북서)으로 비친 달빛 길
        col += vec3(0.7, 0.8, 1.0) * mp * (0.55 + 0.45 * sin(vXZ.x * 2.7 + uTime * 1.9) * sin(vXZ.y * 2.3 - uTime * 1.4)) * 0.6 * smoothstep(6.0, 26.0, far);
        gl_FragColor = vec4(col, max(mix(0.5, 0.93, smoothstep(0.0, 0.6, d)), f * 0.7));
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = U.uTime; mat.uniforms.uCam = U.uCam; mat.uniforms.uDepth = { value: depthTex };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat);
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
