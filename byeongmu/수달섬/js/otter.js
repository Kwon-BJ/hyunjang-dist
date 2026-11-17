// 수달섬 — 수달 모양 · 동작 · 나 · 맨손 흔들기 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 수달 (ChatGPT 수달 기본형을 보고 만듦: 갈색 털 · 크림 얼굴 · 파란 후드 · 베이지 바지) ─────────
const OTTER = { fur: 0x8a5a3b, cream: 0xead2aa, hood: 0x4d6aa6, pants: 0xcdb084, dark: 0x1d1714 };
function makeOtter(colors = OTTER) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const fur = M(colors.fur), cream = M(colors.cream), hood = M(colors.hood), pants = M(colors.pants), dark = new THREE.MeshStandardMaterial({ color: colors.dark, roughness: 0.3 }), white = M(0xffffff), blush = M(0xf2a08a);
  const mesh = (g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
  const S = (r) => new THREE.SphereGeometry(r, 18, 14), CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const leg = (s) => { const g = new THREE.Group(); g.position.set(s * 0.1, 0.33, 0); g.add(mesh(CAP(0.095, 0.12), pants, 0, -0.12, 0), mesh(S(0.095), fur, 0, -0.29, 0.04, 1, 0.55, 1.45)); body.add(g); return g; };
  const legL = leg(-1), legR = leg(1);
  body.add(mesh(S(0.2), pants, 0, 0.36, 0, 1.05, 0.72, 0.92));
  body.add(mesh(CAP(0.205, 0.2), hood, 0, 0.58, 0, 1.06, 1, 0.9));
  body.add(mesh(new THREE.TorusGeometry(0.15, 0.065, 8, 18), hood, 0, 0.76, 0, 1, 1, 1).rotateX(Math.PI / 2));
  body.add(mesh(S(0.15), hood, 0, 0.78, -0.13, 1.1, 0.9, 0.8));
  body.add(mesh(new THREE.BoxGeometry(0.012, 0.3, 0.02), M(0x3d5588), 0, 0.57, 0.19));
  for (const s of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), M(0x45609a), s * 0.1, 0.45, 0.18));
  const arm = (s) => { const g = new THREE.Group(); g.position.set(s * 0.23, 0.7, 0); g.rotation.z = s * 0.18; g.add(mesh(CAP(0.075, 0.16), hood, 0, -0.12, 0), mesh(S(0.072), fur, 0, -0.27, 0.01)); body.add(g); return g; };
  const armL = arm(-1), armR = arm(1);
  const hold = new THREE.Group(); hold.position.set(0, -0.29, 0.03); armR.add(hold); // 손에 든 도구 자리
  const head = new THREE.Group(); head.position.set(0, 0.97, 0); body.add(head);
  head.add(mesh(S(0.26), fur, 0, 0, 0, 1, 0.94, 0.95));
  head.add(mesh(S(0.2), cream, 0, -0.07, 0.1, 1.05, 0.78, 0.8));
  head.add(mesh(S(0.1), cream, 0, -0.07, 0.21, 1.35, 0.8, 0.85));
  head.add(mesh(S(0.045), dark, 0, -0.025, 0.295, 1.35, 0.9, 0.8));
  for (const s of [-1, 1]) {
    head.add(mesh(S(0.036), dark, s * 0.095, 0.04, 0.22));
    head.add(mesh(S(0.012), white, s * 0.095 + 0.012, 0.056, 0.252));
    head.add(mesh(S(0.072), fur, s * 0.2, 0.15, -0.03, 1, 1, 0.7));
    head.add(mesh(S(0.042), cream, s * 0.2, 0.15, 0.015, 1, 1, 0.5));
    head.add(mesh(S(0.05), cream, s * 0.1, 0.11, 0.17, 1.3, 0.5, 0.6));
    head.add(mesh(S(0.035), blush, s * 0.15, -0.06, 0.2, 1.2, 0.7, 0.5));
    const wg = new THREE.BufferGeometry().setFromPoints([0.08, 0, -0.06].flatMap((dy) => [new THREE.Vector3(s * 0.08, -0.06, 0.27), new THREE.Vector3(s * 0.3, -0.06 + dy * 0.8, 0.22)]));
    head.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xf4efe6 })));
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.3, -0.13); body.add(tail);
  let t = tail;
  for (const [r, l, rx] of [[0.085, 0.16, 0.8], [0.07, 0.15, 0.5], [0.05, 0.13, 0.25]]) { // + 가 뒤쪽 · 땅으로 휘어 눕게
    const seg = new THREE.Group(); seg.rotation.x = rx; t.add(seg);
    seg.add(mesh(CAP(r, l), fur, 0, -(l / 2 + r * 0.6), 0));
    const next = new THREE.Group(); next.position.y = -(l + r * 0.9); seg.add(next); t = next;
  }
  root.userData = { body, legL, legR, armL, armR, head, tail, hold };
  return root;
}
// act: 0~1 진행(없으면 -1) · swing: 도구 휘두르기 / 아니면 손으로 줍기(허리 숙임)
function animOtter(o, phase, amt, run, t, act = -1, swing = false, fit = null) {
  const p = o.userData, sw = Math.sin(phase);
  if (p.shook && !(act >= 0 && swing === 'shake')) { p.armL.rotation.set(0, 0, -0.18); p.armR.rotation.set(0, 0, 0.18); p.body.position.x = p.body.position.z = 0; p.shook = false; } // 흔들기 끝 → 팔 · 몸 제자리
  p.legL.rotation.x = sw * 0.75 * amt; p.legR.rotation.x = -sw * 0.75 * amt;
  p.armL.rotation.x = -sw * (run ? 0.9 : 0.55) * amt; p.armR.rotation.x = sw * (run ? 0.9 : 0.55) * amt;
  p.body.position.y = Math.abs(Math.cos(phase)) * (run ? 0.07 : 0.04) * amt + (1 - amt) * Math.sin(t * 2.2) * 0.008;
  p.body.rotation.x = (run ? 0.2 : 0.05) * amt;
  if (act >= 0 && swing === 'shake' && fit) shakePose(p, o.rotation.y, act, fit);
  else if (act >= 0) {
    if (swing) { p.armR.rotation.x = act < 0.4 ? -2.5 * (act / 0.4) : -2.5 + 2.0 * ((act - 0.4) / 0.6); p.body.rotation.x = act < 0.4 ? -0.08 : 0.15 * Math.sin(((act - 0.4) / 0.6) * Math.PI); }
    else { const k = Math.sin(act * Math.PI); p.body.rotation.x = 0.55 * k; p.armR.rotation.x = p.armL.rotation.x = -1.1 * k; }
  }
  p.head.rotation.x = -(run ? 0.12 : 0.03) * amt + (1 - amt) * Math.sin(t * 1.1) * 0.03;
  p.head.rotation.z = (1 - amt) * Math.sin(t * 0.7) * 0.05;
  p.tail.rotation.y = Math.sin(phase * 0.5 + t * (1 - amt) * 1.5) * (0.25 + 0.15 * amt);
}

// ───────── 나 ─────────
// ───────── 맨손 나무 흔들기 'shake' (2026-11-17) — 몸은 안 숙이고, 줄기에서 팔 길이만큼 서서 두 손을 줄기에 대고,
// 나무가 wobble(0.6초 · 같은 식)로 기우는 쪽으로 어깨 · 팔을 좌우로 민다. 손 자리는 줄기 표면에 맞춰 계산(IK)
const TRUNK = { round: [1.6, 0.27, 0.17], round2: [1.9, 0.3, 0.18], fruit: [1.4, 0.26, 0.16], pine: [1.0, 0.22, 0.14] }; // 줄기 높이 · 밑 반지름 · 위 반지름(TREE_KINDS 와 같게)
const SHAKE_T = 0.6, PAW_R = 0.072, ARM_L = 0.27, SH_X = 0.23, SH_Y = 0.7, GRIP_X = 0.12; // 손 반지름 · 어깨→손 가운데 · 어깨 자리 · 두 손 사이 반
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
