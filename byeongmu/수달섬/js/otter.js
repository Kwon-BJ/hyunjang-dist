// 수달섬 — 수달 모양 · 동작 · 나 · 맨손 흔들기 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 수달 (2026-11-18 기획/수달-디자인시안.png 를 보고 다시 만듦 — 찰흙 인형 · 큰 머리 · 크림 얼굴 · 모자 3종 · 가방) ─────────
// 비율은 시안 정면(키 435px)에서 잼: 머리 너비 0.82 · 높이 0.67(키의 약 55%) · 몸통 너비 0.46 · 다리 0.27 · 팔 0.27. 색도 시안에서 잼.
// 2026-11-19 기획/수달-디자인시안-2.png 기준 펠트 인형으로: 얼굴은 그림 한 장(img/수달-얼굴.webp) · 볼 덩어리 · 펠트 결(render.js) · 옷 자판기에 멜빵바지 · 크로스백(clothes.js)
// 부품: 기본 11개(머리 · 볼 · 귀 · 몸통 · 팔 2 · 다리 2 · 꼬리 · 모자 · 가방) + 입은 옷(몸 1~2 · 등 1) — 한 번에 보이는 것은 15개 이하.
const FUR = 0x96705f, CREAM = 0xf6dfc4, INK = 0x2c2720; // 게임 빛(따뜻한 해 · 색 보정)을 거쳐 시안 색(털 #ad7759 · 얼굴 #eed2b3)에 가깝게
const LOOK_COLORS = [0x4d9f90, 0xf5735c, 0xf2b244, 0x8f7cc8, 0x5aaee0, 0xf08fb3, 0x8cc463, 0x4f6aa6]; // 시안 3색(청록 · 주황 · 노랑) + 보라 · 하늘 · 분홍 · 연두 · 남색
const HAT_KINDS = ['bucket', 'cap', 'beanie']; // 벙거지 · 야구모자 · 비니
const OTTER = { hat: null, color: LOOK_COLORS[0] }; // 2026-11-18 부장님 — 모자 없앰(기본 수달은 모자 없이 · 머리 위 이름표)
// 머리 붙는 높이(목) · 머리 반지름(가로 · 세로 · 앞뒤). 2026-11-19 시안 2 비율로 키움: 정면 머리 폭 = 키의 0.72배(시안 잼 309/430px · 예전 0.65배) · 옆으로 넓은 머리
// 모자는 예전 머리(HAT_BASE)에 맞춘 모양이라 setLook 에서 이 비율만큼 늘림
const H_Y = 0.53, H_R = [0.48, 0.385, 0.41], HAT_BASE = [0.41, 0.365, 0.37];
// 얼굴 그림(2026-11-19): 기획/디자인/수달-얼굴.png(정면 · 큰 눈 · 코 · 웃는 입 · 수염 · 볼의 밝은 면)을 머리 공에 감은 펼친 그림.
// 다시 그리려면 node 기획/디자인/그리기.cjs → node 기획/디자인/얼굴감기.cjs (휴대폰에서 계산하지 않게 미리 구움)
const FACE_TEX = (() => { const t = new THREE.TextureLoader().load('img/수달-얼굴.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
// 볼 덩어리(2026-11-19): 얼굴 그림의 밝은 볼 자리에 도톰한 공 2개. 꼭짓점마다 머리 공의 같은 방향 그림을 칠해(수염 · 밝은 면이 볼 위에 이어짐) 이음매가 안 보임
const CHEEK_DIR = [0.54, -0.33];
let CHEEK_GEO = null;
function cheekGeo() {
  // lz: 덩어리 안에서 앞쪽 정도(가운데 1 · 머리에 묻힌 가장자리 0 이하) — 가장자리 법선을 머리 쪽으로 녹여 테두리 선이 안 생기게
  const lz = [];
  const parts = [-1, 1].map((s) => {
    const n = new THREE.Vector3(s * CHEEK_DIR[0], CHEEK_DIR[1], Math.sqrt(1 - CHEEK_DIR[0] ** 2 - CHEEK_DIR[1] ** 2));
    const c = new THREE.Vector3(n.x * H_R[0], n.y * H_R[1], n.z * H_R[2]).multiplyScalar(0.93);
    const g = new THREE.SphereGeometry(1, 18, 12), gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) lz.push(gp.getZ(i));
    g.scale(0.17, 0.13, 0.07); g.lookAt(n); g.translate(c.x, c.y, c.z);
    return g;
  });
  const g = mergeGeometries(parts), p = g.attributes.position, uv = g.attributes.uv, nr = g.attributes.normal, hn = new THREE.Vector3(), on = new THREE.Vector3();
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / H_R[0], y = p.getY(i) / H_R[1], z = p.getZ(i) / H_R[2], l = Math.hypot(x, y, z);
    const th = Math.acos(Math.max(-1, Math.min(1, y / l))), ph = Math.atan2(z / l, -x / l);
    uv.setXY(i, ((ph / (Math.PI * 2)) + 1) % 1, 1 - th / Math.PI);
    hn.set(x / H_R[0], y / H_R[1], z / H_R[2]).normalize(); on.fromBufferAttribute(nr, i);
    on.lerp(hn, 1 - sm(0.1, 0.9, lz[i]) * 0.75).normalize(); nr.setXYZ(i, on.x, on.y, on.z);
  }
  return g;
}
// 찰흙 재질: 반사 없는 무광(Lambert) + 그늘이 너무 어둡지 않게 살짝 스스로 밝음
// 빛을 감싸게(half-Lambert 비슷): 그늘 쪽도 둥글게 밝아 찰흙 인형처럼 부드러움 — 수달 재질에만
const WRAP = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = pow( saturate( dot( geometryNormal, directLight.direction ) * 0.5 + 0.5 ), 1.4 );')).replace('#include <opaque_fragment>', 'outgoingLight += vec3(0.5, 0.36, 0.24) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4) * 0.22;\n#include <opaque_fragment>'); }; m.customProgramCacheKey = () => 'clayWrap2'; return m; };
// 가장자리 빛: 예전 푸른 달빛(0.75)이 머리 위를 보라 · 회색 안개처럼 띄워 → 작업지시서 4 A1: 따뜻한 갈색으로 밝기 합 약 1/5. 밤에 땅과 구별은 수달 둘레 등불(light.js)이 함
const clay = (color, map) => WRAP(new THREE.MeshLambertMaterial({ color: map ? 0xffffff : color, map: map || null, emissive: new THREE.Color(color).multiplyScalar(map ? 0 : 0.2) }));
// 얼굴 그림 자체를 조금 밝게(아래쪽 크림이 그늘에 묻히지 않게) · 맞으면 붉게 번쩍이도록 수달마다 따로 만들 수 있게 함수로(작업지시서 3 C · hit.js)
// 작업지시서 4 A6 2차: 크림 얼굴 아래가 그늘져 회색빛 → 얼굴 그림 스스로 밝기 0.2 → 0.28
const headMat = () => { const m = clay(FUR, FACE_TEX); m.emissiveMap = FACE_TEX; m.emissive = new THREE.Color(0.28, 0.28, 0.28); return m; };
const FUR_MAT = clay(FUR), HEAD_MAT = headMat();
// 둥근 상자(가방) — 상자 꼭짓점을 안쪽 상자에 붙인 뒤 반지름만큼 밀어 냄
function roundBox(w, h, dp, r, seg = 6) {
  const g = new THREE.BoxGeometry(w, h, dp, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), q = new THREE.Vector3(), iw = w / 2 - r, ih = h / 2 - r, id = dp / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); q.set(Math.max(-iw, Math.min(iw, v.x)), Math.max(-ih, Math.min(ih, v.y)), Math.max(-id, Math.min(id, v.z))); v.sub(q).normalize().multiplyScalar(r).add(q); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
// 모자 3종(시안) — 한 모양씩 합쳐 부품 1개
const HAT_GEO = {
  bucket: () => new THREE.LatheGeometry([[0, 0.39], [0.12, 0.385], [0.22, 0.365], [0.3, 0.33], [0.355, 0.27], [0.39, 0.18], [0.41, 0.08], [0.425, 0.02], [0.45, -0.02], [0.48, -0.065], [0.49, -0.1], [0.475, -0.115], [0.44, -0.085], [0.41, -0.035], [0.4, -0.01]].map(([r, y]) => new THREE.Vector2(r, y)), 48),
  cap: () => { const dome = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(0.43, 0.38, 0.41); const visor = new THREE.CylinderGeometry(0.41, 0.41, 0.075, 40, 1, false, -Math.PI * 0.42, Math.PI * 0.84); visor.scale(1, 1, 1.25); visor.translate(0, -0.005, 0.05); visor.rotateX(0.14); return mergeGeometries([dome.toNonIndexed(), visor.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })); },
  beanie: () => { const dome = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(0.415, 0.4, 0.395); dome.translate(0, 0.1, 0); const band = new THREE.TorusGeometry(0.375, 0.07, 16, 48).rotateX(Math.PI / 2); band.scale(1.0, 1.5, 0.98); band.translate(0, 0.06, 0); const wall = new THREE.CylinderGeometry(0.415, 0.415, 0.1, 40, 1, true); wall.translate(0, 0.08, 0); return mergeGeometries([dome.toNonIndexed(), band.toNonIndexed(), wall.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })); },
};
const HAT_CACHE = {}; const hatGeo = (k) => HAT_CACHE[k] || (HAT_CACHE[k] = HAT_GEO[k]());
const BAG_GEO = roundBox(0.4, 0.38, 0.17, 0.08);
function makeOtter(look = OTTER) {
  const mesh = (g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
  const S = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h), CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // 다리 2(굵고 짧게) · 몸통 · 팔 2(따로 돎 · 오른손 도구 자리) · 머리(얼굴 그림) · 귀 2(한 부품) · 굵은 꼬리
  const leg = (s) => { const g = new THREE.Group(); g.position.set(s * 0.115, 0.25, 0); g.add(mesh(CAP(0.1, 0.05), FUR_MAT, 0, -0.125, 0.01)); body.add(g); return g; };
  const legL = leg(-1), legR = leg(1);
  body.add(mesh(CAP(0.205, 0.12), FUR_MAT, 0, 0.385, 0, 1.1, 1, 0.98)); // 몸통(배가 살짝 둥글게)
  // 팔(작업지시서 4 A3): 끝이 가는 막대 대신 통통한 둥근 덩어리 · 어깨를 몸 쪽(SH_X)으로 붙임 — 손 가운데 자리(ARM_L)는 그대로라 도구 쥐는 자리 · 흔들기 손 계산이 같게 맞음
  const arm = (s) => { const g = new THREE.Group(); g.position.set(s * SH_X, SH_Y, 0); g.rotation.z = s * 0.18; g.add(mesh(S(PAW_R, 16, 12), FUR_MAT, 0, -0.115, 0, 1, 1.4, 1.05)); const paw = new THREE.Object3D(); paw.position.set(0, -ARM_L, 0); g.add(paw); body.add(g); return g; }; // paw: 손 가운데 자리(흔들기 맞춤 · 시험이 씀)
  const armL = arm(-1), armR = arm(1);
  const hold = new THREE.Group(); hold.position.set(0, -ARM_L, 0.03); armR.add(hold); // 손에 든 도구 자리
  const head = new THREE.Group(); head.position.set(0, H_Y, 0); body.add(head);
  const skull = mesh(S(1, 48, 32), HEAD_MAT, 0, H_R[1] - 0.02, 0, H_R[0], H_R[1], H_R[2]); head.add(skull);
  // 볼 덩어리(머리와 같은 재질 · 같은 얼굴 그림)
  const cheeks = mesh(CHEEK_GEO || (CHEEK_GEO = cheekGeo()), HEAD_MAT, 0, H_R[1] - 0.02, 0); head.add(cheeks);
  const ear = S(0.098, 18, 12), ears = mesh(mergeGeometries([ear.clone().translate(-H_R[0] * 0.73, 0, 0), ear.clone().translate(H_R[0] * 0.73, 0, 0)]), FUR_MAT, 0, H_R[1] + 0.25, -0.05, 1, 1, 0.6); head.add(ears);
  const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.17); body.add(tail);
  // 굵은 노 모양 꼬리(시안 2 — 뒤 아래로 길고 도톰하게) · 뒤로 눕게
  const tseg = new THREE.Group(); tseg.rotation.x = 1.3; tail.add(tseg); tseg.add(mesh(CAP(0.115, 0.17), FUR_MAT, 0, -0.18, 0, 1.15, 1, 0.8));
  const hat = new THREE.Mesh(hatGeo('bucket'), clay(LOOK_COLORS[0])); hat.material.side = THREE.DoubleSide; hat.castShadow = true; head.add(hat);
  const bag = mesh(BAG_GEO, clay(LOOK_COLORS[0]), 0, 0.37, -0.28); body.add(bag); // 등 가방 — 앞(총) · 오른손(도구)을 안 가림
  root.userData = { body, legL, legR, armL, armR, head, tail, hold, hat, bag, ears };
  root.userData.setLook = (l) => setLook(root, l);
  setLook(root, look);
  return root;
}
// 문파원마다 모자 종류 · 색(가방도 같은 색, 조금 진하게) — 모자는 위로 · 뒤로 젖혀 게임 카메라(약 40도 위)에서도 두 눈이 보이게(작업지시서 2 A)
function setLook(root, look = OTTER) {
  const u = root.userData, kind = HAT_KINDS.includes(look.hat) ? look.hat : null, c = look.color ?? LOOK_COLORS[0];
  u.hat.visible = !!kind; u.ears.visible = !kind; // 모자를 쓰면 귀는 모자 속(시안)
  // 모자: 예전 머리에서 머리 가운데 위로 잰 높이(벙거지 0.22 · 야구모자 0.15 · 비니 0.16)를 새 머리 비율로 늘림
  const hk = [0, 1, 2].map((i) => H_R[i] / HAT_BASE[i]);
  if (kind) { u.hat.geometry = hatGeo(kind); u.hat.scale.set(hk[0], hk[1], hk[2]); u.hat.position.set(0, H_R[1] - 0.02 + (kind === 'bucket' ? 0.22 : kind === 'cap' ? 0.15 : 0.16) * hk[1], (kind === 'cap' ? -0.02 : -0.04) * hk[2]); u.hat.rotation.set(kind === 'cap' ? -0.42 : kind === 'bucket' ? -0.34 : -0.26, 0, 0); u.hat.material.color.set(c); u.hat.material.emissive.set(c).multiplyScalar(0.14); }
  const bc = new THREE.Color(c).multiplyScalar(0.92); u.bag.material.color.copy(bc); u.bag.material.emissive.copy(bc).multiplyScalar(0.14);
  u.look = { hat: kind, color: c };
}
const lookFromName = (name) => { if (!name) return OTTER; const h = hashName(name); return { hat: null, color: LOOK_COLORS[Math.floor(h / 3) % LOOK_COLORS.length] }; }; // 모자 없음 — 가방 색만 문파원마다 다름
// act: 0~1 진행(없으면 -1) · swing: 도구 휘두르기 / 아니면 손으로 줍기(허리 숙임)
function animOtter(o, phase, amt, run, t, act = -1, swing = false, fit = null) {
  const p = o.userData, sw = Math.sin(phase);
  if (p.shook && !(act >= 0 && swing === 'shake')) { p.armL.rotation.set(0, 0, -0.18); p.armR.rotation.set(0, 0, 0.18); p.body.position.x = p.body.position.z = 0; p.shook = false; } // 흔들기 끝 → 팔 · 몸 제자리
  // 팔 옆 기울기 제자리(맨손 때리기가 바꿈)
  p.armL.rotation.z = -0.18; p.armR.rotation.z = 0.18; p.armL.rotation.y = p.armR.rotation.y = 0;
  p.legL.rotation.x = sw * 0.75 * amt; p.legR.rotation.x = -sw * 0.75 * amt;
  p.armL.rotation.x = -sw * (run ? 0.9 : 0.55) * amt; p.armR.rotation.x = sw * (run ? 0.9 : 0.55) * amt;
  p.body.position.y = Math.abs(Math.cos(phase)) * (run ? 0.07 : 0.04) * amt + (1 - amt) * Math.sin(t * 2.2) * 0.008;
  p.body.rotation.x = (run ? 0.2 : 0.05) * amt;
  p.body.rotation.y = 0;
  if (act >= 0 && (swing === 'punchl' || swing === 'punchr')) punchPose(p, act, swing === 'punchl' ? -1 : 1);
  else if (act >= 0 && swing === 'shake' && fit) shakePose(p, o.rotation.y, act, fit);
  else if (act >= 0) {
    if (swing) { p.armR.rotation.x = act < 0.4 ? -2.5 * (act / 0.4) : -2.5 + 2.0 * ((act - 0.4) / 0.6); p.body.rotation.x = act < 0.4 ? -0.08 : 0.15 * Math.sin(((act - 0.4) / 0.6) * Math.PI); }
    else { const k = Math.sin(act * Math.PI); p.body.rotation.x = 0.55 * k; p.armR.rotation.x = p.armL.rotation.x = -1.1 * k; }
  }
  p.head.rotation.x = -(run ? 0.12 : 0.03) * amt + (1 - amt) * Math.sin(t * 1.1) * 0.03;
  p.head.rotation.z = (1 - amt) * Math.sin(t * 0.7) * 0.05;
  p.tail.rotation.y = Math.sin(phase * 0.5 + t * (1 - amt) * 1.5) * (0.25 + 0.15 * amt);
  if (act >= 0 && swing === 'shake') p.head.rotation.x = -0.45 * Math.max(0, Math.min(1, act / 0.15, (1 - act) / 0.1)); // 큰 머리 — 줄기를 올려다봄
}

// 맨손 때리기: 권투처럼 한 팔을 앞으로 곧게 뻗고(빠르게 · 천천히 거둠) 다른 팔은 얼굴 앞을 막음 · 몸을 뻗는 쪽으로 살짝 비틂(작업지시서 3 C)
// side: -1 왼손 · 1 오른손
function punchPose(p, act, side) {
  const k = act < 0.3 ? Math.sin((act / 0.3) * Math.PI / 2) : 1 - (act - 0.3) / 0.7, hit = side < 0 ? p.armL : p.armR, guard = side < 0 ? p.armR : p.armL;
  hit.rotation.x = -1.55 * k; hit.rotation.z = side * 0.18 * (1 - k);
  guard.rotation.x = -1.0 * Math.min(1, k * 2 + 0.3); guard.rotation.z = -side * 0.35;
  p.body.rotation.y = -side * 0.28 * k; p.body.rotation.x = 0.12 * k;
}
// ───────── 나 ─────────
// ───────── 맨손 나무 흔들기 'shake' (2026-11-17) — 몸은 안 숙이고, 줄기에서 팔 길이만큼 서서 두 손을 줄기에 대고,
// 나무가 wobble(0.6초 · 같은 식)로 기우는 쪽으로 어깨 · 팔을 좌우로 민다. 손 자리는 줄기 표면에 맞춰 계산(IK)
const TRUNK = { round: [1.6, 0.27, 0.17], round2: [1.9, 0.3, 0.18], fruit: [1.4, 0.26, 0.16], pine: [1.0, 0.22, 0.14] }; // 줄기 높이 · 밑 반지름 · 위 반지름(TREE_KINDS 와 같게)
// 손 반지름 · 어깨→손 가운데 · 어깨 자리 · 두 손 사이 반(2026-11-18 새 수달 팔에 맞춤 · 11-19 작업지시서 4 A3 둥근 팔: 손 0.1 · 어깨 0.225)
const SHAKE_T = 0.6, PAW_R = 0.1, ARM_L = 0.135, SH_X = 0.225, SH_Y = 0.47, GRIP_X = 0.16;
const ARM_FWD = Math.sqrt(ARM_L ** 2 - (SH_X - GRIP_X) ** 2); // 팔을 수평으로 뻗었을 때 어깨→손의 앞쪽 거리
const WOB_AMP = 0.06, SHAKE_AMP = 0.21; // 흔들림 세기 — 기본(도끼 · 덤불) / 맨손 흔들기(최대 약 0.12rad 로 눈에 보이게 · 2026-11-17 부장님)
const wobbleAngle = (left, amp = SHAKE_AMP) => Math.sin(left * 30) * amp * left; // life() 의 wobble 과 같은 식
function shakeFit(r, x, z) { // 이 나무를 (x, z) 에서 잡을 때 필요한 값
  const [h, r0, r1] = TRUNK[r.kind], e = r.m.elements, s = r.s, hy = groundY(x, z) + SH_Y - e[13]; // 손 높이(나무 밑동 기준)
  const R = (r0 + (r1 - r0) * Math.min(1, Math.max(0, hy / s / h))) * s, xl = Math.hypot(e[0], e[2]);
  return { r, R, hy, ax: e[0] / xl, az: e[2] / xl, D: Math.hypot(r.x - x, r.z - z) }; // ax/az: 나무 자체 X 축(wobble 은 이 축 쪽으로 기움)
}
const shakeReach = (R) => ARM_FWD + Math.sqrt((R + PAW_R) ** 2 - GRIP_X ** 2); // 손이 줄기에 닿는 서는 거리
const V_DOWN = new THREE.Vector3(0, -1, 0), V1 = new THREE.Vector3(), Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), E0 = new THREE.Euler();
function shakeLean(f, act, fit) { // 손 높이에서 나무가 기운 만큼(수달 기준 옆 lx · 앞 lz)
  const th = wobbleAngle(SHAKE_T * (1 - act)), wx = -Math.sin(th) * fit.hy * fit.ax, wz = -Math.sin(th) * fit.hy * fit.az, c = Math.cos(f), sn = Math.sin(f);
  return { lx: wx * c - wz * sn, lz: wx * sn + wz * c };
}
function shakePose(p, f, act, fit) {
  const k = Math.max(0, Math.min(1, act / 0.15, (1 - act) / 0.1)); // 잡기(앞 15%) · 놓기(끝 10%)
  const { lx, lz } = shakeLean(f, act, fit);
  const Tz = fit.D - Math.sqrt((fit.R + PAW_R) ** 2 - GRIP_X ** 2) + lz; // 손 가운데가 줄기 표면에 닿는 앞쪽 거리
  p.shook = true; p.body.rotation.x = 0; // 숙이지 않음
  p.body.position.z = (Tz - ARM_FWD) * k; p.body.position.x = lx * k; // 서는 자리가 막힘 때문에 조금 멀면 몸째 다가섬 · 어깨를 기우는 쪽으로 민다
  for (const [arm, sg] of [[p.armL, -1], [p.armR, 1]]) {
    V1.set(sg * GRIP_X + lx - p.body.position.x - sg * SH_X, 0, Tz - p.body.position.z).normalize(); // 어깨 → 손(수평)
    Q0.setFromEuler(E0.set(0, 0, sg * 0.18)); Q1.setFromUnitVectors(V_DOWN, V1); arm.quaternion.copy(Q0).slerp(Q1, k);
  }
}
const me = { x: 2, z: 5, face: 0, speed: 0, phase: 0, run: false, actT: 0, actDur: 0.45, actSwing: false, fit: null, actTree: null, obj: makeOtter() };
scene.add(me.obj);
const WALK = 3.4, RUN = 6.4;
