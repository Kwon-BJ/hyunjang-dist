// 수달섬 — 바닥 물건(작업지시서 3 B · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 도끼 · 흔들기 · 곡괭이로 나온 것과 내려놓은 것은 바닥에 물건 그림(아이콘)으로 놓인다. 누구나 주울 수 있고(줍기 한 번에 둘레 모두),
// 같은 종류는 한 덩어리 · 5분 뒤 사라짐 — 정하는 것은 서버. 여기는 그리기 · 「줍기」 대상만.
const ground = new Map();
const GTEX = {};
// 물건 그림(요리처럼 아직 그림이 없는 것은 ICON_ALIAS 로 재료 그림)
function gtex(id) {
  if (!GTEX[id]) {
    GTEX[id] = new THREE.TextureLoader().load(`img/i-${(ICON_ALIAS[id] || id).replace(/ /g, '')}.webp`);
    GTEX[id].colorSpace = THREE.SRGBColorSpace;
  }
  return GTEX[id];
}
function setGround(g) {
  let o = ground.get(g.g);
  if (!o) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex(g.id), transparent: true, depthWrite: false }));
    s.renderOrder = 2; scene.add(s); o = { s }; ground.set(g.g, o);
  }
  Object.assign(o, g);
  // 많이 쌓인 덩어리는 조금 크게
  const k = 0.45 + Math.min(0.25, Math.log10(1 + g.n) * 0.15);
  o.s.scale.setScalar(k); o.s.position.set(g.x, Math.max(0, height(g.x, g.z)) + k * 0.5 + 0.02, g.z);
}
function delGround(id) {
  const o = ground.get(id); if (!o) return;
  scene.remove(o.s); o.s.material.dispose(); ground.delete(id);
}
function clearGround() { for (const id of [...ground.keys()]) delGround(id); }
// 대상: 둘레 2.3칸 안 바닥 물건이 있으면 「줍기 (덩어리 수)」
function groundTargets(see) {
  if (!srvOn()) return;
  let n = 0, near = null;
  for (const o of ground.values()) if (Math.hypot(o.x - me.x, o.z - me.z) < 2.3) { n++; near = o; }
  // 도끼 · 곡괭이를 들고 앞에 칠 나무 · 바위가 있으면 치기가 먼저(떨어진 것 때문에 계속 줍기만 잡히지 않게)
  // — 칠 것이 없으면(다 베어 그루터기만 남음 등) 줍기가 먼저(2026-11-18 함께 시험: 그루터기 「앉기」가 줍기를 가림)
  const fx = me.x + Math.sin(me.face) * 0.6, fz = me.z + Math.cos(me.face) * 0.6;
  const work = (toolIs('도끼') && [...TREES, ...PLANTED].some((r) => !(r.down > clock) && !r.gone && Math.hypot(r.x - fx, r.z - fz) < 1.35)) || (toolIs('곡괭이') && ROCKS.some((r) => !(r.down > clock) && Math.hypot(r.x - fx, r.z - fz) < 0.95 + r.circle.r));
  if (near) see('pickup', { n }, near.x, near.z, 2.8, work ? -1.5 : 0.6);
}
function pickupAction() {
  me.actT = me.actDur = ACT_T; me.actSwing = false; net.ac++;
  netSend({ t: 'pickup' });
}
function onNetGround(m) {
  if (m.t === 'gd') setGround(m.g);
  else if (m.t === 'gdel') for (const id of m.ids) delGround(id);
}
