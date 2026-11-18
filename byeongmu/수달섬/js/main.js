// 수달섬 — 시작 · 시험용 손잡이 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 시작 (모델을 받은 뒤 섬을 채우고 돌리기 시작) ─────────
(async () => {
srcs = Object.fromEntries(await Promise.all([...new Set([...PROPS.map((p) => p[0]), '울타리', '보관함', '오두막', '나무집', '큰집', '도끼', '곡괭이', '자루', '권총', '소총', '산탄총', '낚싯대', '금붕어', '비단잉어', '도미', '넙치', '가시덫'])].map(async (n) => [n, await loadModel(n)])));
for (const [n, x, z, r, h, b] of PROPS) placeModel(srcs[n], x, z, r, h, b);
for (const [x, z, r] of FENCES) placeModel(srcs['울타리'], x, z, r, 1.0, 'f');

buildMapBase();
buildHouse(true);
try { // 새 판으로 새로 열린 거면 있던 자리로
  const p = JSON.parse(sessionStorage.getItem('suseom-pos') || 'null'); sessionStorage.removeItem('suseom-pos');
  if (p && Date.now() - p.t < 120000 && Number.isFinite(p.x)) { me.x = p.x; me.z = p.z; me.face = p.f; nudgeFree(); keepPos = true; } // 서버에도 이 자리로(hi.keep)
} catch { /* */ }
for (const t of TOOLS) { held[t] = heldModel(srcs[t]); me.obj.userData.hold.add(held[t]); }
connect();
npc = makeOtter({ hat: 'cap', color: 0x8cc463 }); // 가게 주인: 연두 야구모자
npc.position.set(-4.5, height(-4.5, -5.9), -5.9); scene.add(npc);
changed(); dirty = false;
document.getElementById('load').remove();
requestAnimationFrame((t) => { last = t; frame(t); });

})().catch((e) => { console.error(e); const l = document.getElementById('load'); if (l) l.textContent = '수달섬을 못 열었어요: ' + e.message + ' — 이 화면을 찍어 보내 주세요'; });

// 시험용: sim(누를 키, 초) — 화면 속도와 상관없이 1/60초씩 움직여 본다
const sim = (codes, secs) => { codes.forEach((k) => keys.add(k)); for (let i = 0; i < Math.round(secs * 60); i++) step(1 / 60); codes.forEach((k) => keys.delete(k)); };
window.__수달섬 = { me, free, height, circles, boxes, onBridge, BRIDGE, riverX, camera, renderer, quality, sim, joy, grass,
  S, TREES, ROCKS, BUSHES, FLOWERS, BERRIES, KEYED, FISH_SPOTS, fishing, fishAction, fishOf, setZoom, get zoomLv() { return zoomLv; }, get zoomK() { return zoomK; }, zoomWant, ZOOM_K, HSTATE, raids, traps, PLACE_AT, get view() { return view; }, get mySet() { return mySet; }, HOUSES, SHOP_AT, PLOTS, net, checkGame, save: () => { dirty = true; flush(); }, GAME_BUILD, doAction, findTarget, openWin, closeWin, count, flush,
  get sacks() { return sacks; }, aim, fireOnce, GUNS, get lastShot() { return lastShot; }, get SAFE() { return SAFE; }, get srv() { return srvOn(); }, testHold, shakeFit, wobbleAngle, TRUNK, SHAKE_T, PAW_R, get newGame() { return newGame; }, get idleT() { return idleT; }, keys, get HOUSE_AT() { return HOUSE_AT; }, get CHEST_AT() { return CHEST_AT; }, get houseBox() { return houseBox; }, get clock() { return clock; } };

// 섬 자료(서버 판정용) — 기획/수달섬-세계뽑기.cjs 가 이것을 워커/src/suseom/world.json 으로 저장한다.
// 화면과 서버가 같은 섬을 보는지는 sum(나무 · 바위 · 꽃 자리 요약)으로 맞춘다.
function worldSum(W) { let h = 7; const add = (v) => { h = (h * 31 + Math.round(v * 100)) >>> 0; }; for (const l of [W.trees, W.rocks, W.flowers, W.bushes, W.berries || [], W.fishSpots || []]) for (const r of l) { add(r.x); add(r.z); } return h.toString(36); }
window.__수달섬.worldData = () => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const own = new Set([mySet && mySet.circle, mySet && mySet.box].filter(Boolean));
  const natural = new Set([...TREES, ...ROCKS, ...BUSHES].map((r) => r.circle).filter(Boolean));
  const tierBox = HOUSES.map((H) => { const b = new THREE.Box3().setFromObject(srcs[H.model]), sz = b.getSize(new THREE.Vector3()), s = H.h / sz.y; return [r2(sz.x * s / 2), r2(sz.z * s / 2)]; });
  const W = {
    trees: TREES.map((r) => ({ k: r.key, x: r2(r.x), z: r2(r.z), r: r2(r.circle.r), kind: r.kind })),
    rocks: ROCKS.map((r) => ({ k: r.key, x: r2(r.x), z: r2(r.z), r: r2(r.circle.r) })),
    flowers: FLOWERS.map((r) => ({ k: r.key, x: r2(r.x), z: r2(r.z) })),
    bushes: BUSHES.map((r, i) => ({ k: 'B' + i, x: r2(r.x), z: r2(r.z) })),
    berries: BERRIES.map((r, i) => ({ k: 'E' + i, x: r2(r.x), z: r2(r.z) })),
    fishSpots: FISH_SPOTS.map((r, i) => ({ k: 'P' + i, x: r.x, z: r.z, wx: r.wx, wz: r.wz })),
    plots: PLOTS.map((p) => ({ x: r2(p.x), z: r2(p.z) })),
    circles: circles.filter((c) => !natural.has(c) && !own.has(c)).map((c) => ({ x: r2(c.x), z: r2(c.z), r: r2(c.r) })), // 모델(텐트 · 모닥불 · 가판대 …)
    boxes: boxes.filter((b) => !own.has(b)).map((b) => ({ x0: r2(b.x0), z0: r2(b.z0), x1: r2(b.x1), z1: r2(b.z1) })), // 헛간 · 울타리
    water: (() => { const w = { river: [24, 4, 0.06], rw: RW, pond: { x: POND.x, z: POND.z, r: POND.r }, isle: [62, 3, 2] }; for (const z of [-30, 7, 41]) if (Math.abs(riverX(z) - (w.river[0] + w.river[1] * Math.sin(z * w.river[2]))) > 1e-9) throw new Error('개울 식이 바뀜 — world 물 자료 고쳐야 함'); if (Math.abs(islandR(1) - (62 + 3 * Math.sin(3) + 2 * Math.sin(6))) > 1e-9) throw new Error('섬 둘레 식이 바뀜'); return w; })(), // 함정 자리 물 판정(요청 4)
    houseHalf: tierBox, chestOff: [3.6, 3.4], shop: { x: SHOP_AT.x, z: SHOP_AT.z }, plaza: { x: PLAZA.x, z: PLAZA.z, r: PLAZA.r },
  };
  W.sum = worldSum(W); return W;
};
window.__수달섬.worldSum = () => worldSum({ trees: TREES, rocks: ROCKS, flowers: FLOWERS, bushes: BUSHES, berries: BERRIES, fishSpots: FISH_SPOTS });
