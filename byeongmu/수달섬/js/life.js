// 수달섬 — 살림(가방 · 조개 · 채집 · 상점 · 집 · 보관함 · 저장) (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 살림: 가방 · 조개 · 채집 · 상점 · 집 · 보관함 · 저장 (2026-11-17 · 창은 ChatGPT 시안대로) ─────────
const $ = (id) => document.getElementById(id);
const ITEMS = { 열매: { sell: 15 }, 나뭇가지: { sell: 5 }, 꽃: { sell: 10 }, 풀: { sell: 3 }, 나무: { sell: 12, buy: 200 }, 돌: { sell: 14, buy: 220 }, 도끼: { buy: 300, tool: true }, 곡괭이: { buy: 400, tool: true }, 텐트: { buy: 5000, tool: true }, 보관함: { buy: 1500 }, 모닥불: { buy: 600, tool: true }, 생선구이: { buy: 150 }, 열매꼬치: {}, 열매잼: {}, 생선수프: {}, 꽃차: {}, 모둠구이: {} };
ITEMS.열매.buy = 120;
// 먹을 것 · 요리(서버 config.foods · recipes 와 같게 — 창에 보여 주기용)
const FOODS = { 열매: { e: 6 }, 생선구이: { e: 25 }, 열매꼬치: { e: 14 }, 열매잼: { e: 20, buff: '빠르게' }, 생선수프: { e: 45, buff: '덜 다침' }, 꽃차: { e: 15, buff: '모닥불 회복 2배' }, 모둠구이: { e: 40, buff: '채집 빨리' } };
const RECIPES = { 생선구이: [['생선', 1], ['나뭇가지', 1]], 열매꼬치: [['열매', 2], ['나뭇가지', 1]], 열매잼: [['열매', 3], ['꽃', 1]], 생선수프: [['생선', 2], ['풀', 1]], 꽃차: [['꽃', 2], ['풀', 1]], 모둠구이: [['생선', 1], ['열매', 2], ['꽃', 1]] };
const FISH_KINDS = ['금붕어', '비단잉어', '도미', '넙치'];
const haveOf = (k) => (k === '생선' ? FISH_KINDS.reduce((n, id) => n + count(id), 0) : count(k));
let MARKET = null; // 물고기 시세(서버가 보냄)
const BUFF = {}; // 버프 끝나는 시각(clock) — 서버 'buff' 말로 // 텐트 · 나무 · 돌 묶음 · 보관함 늘리기(B단계 · 서버 config 와 같게)
const SELLABLE = ['열매', '나뭇가지', '꽃', '풀', '나무', '돌'], TOOLS = ['도끼', '곡괭이', '낚싯대']; // 낚싯대(6단계)는 함께일 때만 팜
const REGEN_LOCAL = { T: 120, R: 100, F: 80, E: 90 }; // 혼자 놀기(서버 없음)일 때만 쓰는 다시 자라는 시간 — 함께일 땐 워커 REGEN 이 정함
const MATERIALS = ['나무', '돌']; // 건축 재료(집 올리기에 드는 것) — 일괄 판매에서 빼고 수량을 골라 판다
const sellQty = {};
const ICON_ALIAS = { 생선구이: '도미', 열매꼬치: '열매', 열매잼: '열매', 생선수프: '넙치', 꽃차: '꽃', 모둠구이: '비단잉어', 모닥불: '나무' }; // 그림이 아직 없는 것(요리 · 모닥불) — 재료 그림을 빌림
const ic = (id) => `url(img/i-${(ICON_ALIAS[id] || id).replace(/ /g, '')}.webp)`;
const BAG_N = 16, STACK = 30, ACT_T = 0.45;
const HOUSES = [
  { name: '텐트', model: '텐트', h: 1.9, chest: 8 },
  { name: '오두막', model: '오두막', h: 3.4, chest: 16, cost: { 나무: 30, 돌: 10, 조개: 500 } },
  { name: '나무집', model: '나무집', h: 4.6, chest: 24, cost: { 나무: 60, 돌: 40, 조개: 2000 } },
  { name: '큰 집', model: '큰집', h: 5.6, chest: 32, cost: { 나무: 120, 돌: 100, 조개: 6000 } },
];
// SHOP_AT(도구 상점 자리)은 props.js SHOPS.tool (B단계)
let HOUSE_AT = null, CHEST_AT = { x: 1e4, z: 1e4 }; // 내 집(텐트를 친 자리 · 없으면 null) · 보관함은 집 앞 오른쪽
const SAVE_KEY = 'suseom-v1';
const S = { money: 100, bag: [], chest: [], tier: 0, extra: 0, tool: null, home: null };
const SPAWN = { x: HARBOR.x, z: HARBOR.z + 1.8 }; // 집이 없을 때 시작하는 곳(항구 울타리 안 · 서버 config.spawn 과 같게)
const chestSize = () => HOUSES[S.tier].chest + Math.max(0, Math.min(2, S.extra | 0)) * 8; // 보관함 칸(늘리기 포함)
const okHome = (h) => (h && Number.isFinite(+h.x) && Number.isFinite(+h.z) ? { x: +h.x, z: +h.z } : null);
function fixSave() { // 예전 저장(집터 번호 plot)이면 집 대신 가방에 텐트(서버 초기화와 같게) · 집 자리 모양 검사
  if (S.mapV !== MAP_V) { if (S.home && S.plot == null) { S.home = null; if (put(S.bag, '텐트', 1)) { S.chest = Array.isArray(S.chest) ? S.chest : []; fit(S.chest, HOUSES[S.tier].chest); put(S.chest, '텐트', 1); } } S.mapV = MAP_V; } // 지도가 바뀌면 옛 집은 텐트로
  if (S.plot != null) { delete S.plot; S.home = null; if (!S.bag.some((s) => s && s.id === '텐트') && put(S.bag, '텐트', 1)) { S.chest = Array.isArray(S.chest) ? S.chest : []; fit(S.chest, HOUSES[S.tier].chest); put(S.chest, '텐트', 1); } }
  S.home = okHome(S.home); S.extra = Math.max(0, Math.min(2, S.extra | 0));
}
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && Array.isArray(d.bag)) Object.assign(S, d); } catch { /* 저장 못 읽으면 새로 시작 */ }
const fit = (a, n) => { a.length = Math.min(a.length, n); while (a.length < n) a.push(null); return a; };
S.tier = Math.max(0, Math.min(HOUSES.length - 1, S.tier | 0)); fit(S.bag, BAG_N); fixSave(); fit(S.chest, chestSize());
let dirty = false;
let onSaved = null; // 여럿이 함께일 때 서버에도 저장(아래 「여럿이 함께」에서 채움)
// 혼자 놀기 저장으로 되돌림 — 서버에서 끊겼을 때(서버 가방이 이 기기 저장에 섞이지 않게 · 리뷰 3단계 4번)
function loadLocal() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && Array.isArray(d.bag)) Object.assign(S, { money: Math.max(0, +d.money || 0), bag: d.bag, chest: d.chest || [], tier: d.tier | 0, extra: d.extra | 0, tool: d.tool || null, home: d.home || null, plot: d.plot, mapV: d.mapV }); else Object.assign(S, { money: 100, bag: [], chest: [], tier: 0, extra: 0, tool: null, home: null }); } catch { /* */ }
  S.tier = Math.max(0, Math.min(HOUSES.length - 1, S.tier | 0)); fit(S.bag, BAG_N); fixSave(); fit(S.chest, chestSize()); S.mag = {};
  buildHouse(false); changed(); dirty = false;
}
const flush = () => { if (!dirty) return; dirty = false; if (typeof srvOn === 'function' && srvOn()) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money: S.money, bag: S.bag, chest: S.chest, tier: S.tier, extra: S.extra, tool: S.tool, home: S.home, mapV: MAP_V })); } catch { /* 저장 공간 없음 */ } if (onSaved) onSaved(); };
setInterval(flush, 2000); addEventListener('pagehide', () => { dirty = true; flush(); });

const winEl = $('win'), bodyEl = $('winBody'), frameEl = $('frame'), toastsEl = $('toasts');
let msgTimer = 0;
function toast(text, id) {
  if (!winEl.hidden) { const m = $('winMsg'); m.textContent = text; clearTimeout(msgTimer); msgTimer = setTimeout(() => { m.textContent = ''; }, 2600); return; }
  const d = document.createElement('div'); d.innerHTML = (id ? `<i class="ic" style="background-image:${ic(id)}"></i>` : '') + '<span></span>'; d.lastChild.textContent = text;
  toastsEl.prepend(d); setTimeout(() => d.remove(), 2200); while (toastsEl.children.length > 4) toastsEl.lastChild.remove();
}
const count = (id, box = S.bag) => box.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
function put(box, id, n) { // 넣고 남은 수를 돌려줌
  const cap = ITEMS[id].tool ? 1 : STACK;
  for (const s of box) if (n && s && s.id === id && s.n < cap) { const k = Math.min(n, cap - s.n); s.n += k; n -= k; }
  for (let i = 0; n && i < box.length; i++) if (!box[i]) { const k = Math.min(n, cap); box[i] = { id, n: k }; n -= k; }
  return n;
}
function take(id, n, box = S.bag) {
  if (count(id, box) < n) return false;
  for (let i = box.length - 1; n && i >= 0; i--) { const s = box[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) box[i] = null; } }
  return true;
}
function changed() { dirty = true; if (S.tool && !count(S.tool)) S.tool = null; setHeld(); refreshHud(); if (!winEl.hidden) render(); }
function gain(id, n = 1) { if ((id === '열매' || id === '나뭇가지') && shaking()) dropFromTree(me.actTree, id, n); const left = put(S.bag, id, n), got = n - left; if (got) toast(`+${got} ${id}`, id); if (left) toast('가방이 가득 찼어요', '가방'); changed(); return got; }
function refreshHud() { $('moneyN').textContent = S.money.toLocaleString(); $('toolIc').style.backgroundImage = S.tool ? ic(S.tool) : ic('손'); }

// 손에 든 도구 (모델은 시작할 때 붙임)
const held = {};
function setHeld() { for (const t of TOOLS) if (held[t]) held[t].visible = S.tool === t; }
function cycleTool() {
  const opts = [null, ...[...TOOLS, ...GUNS, ...TRAP_ITEMS, '텐트'].filter((t) => count(t))]; // 총도 손에 들 수 있음
  if (opts.length === 1) { toast('도구가 없어요 — 상점에서 살 수 있어요', '손'); return; }
  const nextTool = opts[(opts.indexOf(S.tool) + 1) % opts.length];
  if (srvOn()) { netSend({ t: 'equip', tool: nextTool }); toast(nextTool ? `${nextTool}를 들었어요` : '맨손이에요', nextTool || '손'); return; }
  S.tool = nextTool; toast(S.tool ? `${S.tool}를 들었어요` : '맨손이에요', S.tool || '손'); changed();
}

// 채집 대상 숨기기 · 되살리기 · 흔들기
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hideRec(r) { r.im.setMatrixAt(r.i, ZERO); r.im.instanceMatrix.needsUpdate = true; if (r.circle) r.circle.off = true; blobOn(r, false); }
function showRec(r) { r.im.setMatrixAt(r.i, r.m); r.im.instanceMatrix.needsUpdate = true; if (r.circle) r.circle.off = false; blobOn(r, true); }
const wobbles = new Map(), WM = new THREE.Matrix4(), WR = new THREE.Matrix4();
const wobAmp = new Map(), wobble = (r, amp = WOB_AMP) => { wobbles.set(r, 0.6); wobAmp.set(r, amp); };

// 앞에 있는 것 찾기
let target = null, tgtT = 0;
function findTarget() {
  const fx = me.x + Math.sin(me.face) * 0.6, fz = me.z + Math.cos(me.face) * 0.6;
  let best = null, bd = 1e9;
  const see = (type, rec, x, z, reach, bonus = 0) => { const d = Math.hypot(x - fx, z - fz); if (d < reach && d - bonus < bd) { bd = d - bonus; best = { type, rec, x, z }; } }; // bonus: 가까운 꽃보다 먼저 잡을 것(싸움 상대 · 자루)
  if (houseBox) { const b = houseBox, cx = Math.max(b.x0, Math.min(b.x1, me.x)), cz = Math.max(b.z0, Math.min(b.z1, me.z)); if (Math.hypot(me.x - cx, me.z - cz) < 1.3) { bd = 0.5; best = { type: 'house', x: cx, z: cz }; } }
  for (const [k, v] of Object.entries(SHOPS)) see('shop', k, v.x, v.z, v.color ? 1.7 : 2.0); // 도구 상점 · 자판기(B단계)
  tentTargets(see); // 텐트를 들었으면 앞쪽에 치기(B단계)
  if (!(typeof HSTATE !== 'undefined' && (HSTATE.get(net.name) || {}).broken)) see('chest', null, CHEST_AT.x, CHEST_AT.z, 1.7); // 부서진 집 보관함은 고친 뒤에
  for (const r of FLOWERS) if (!r.down) see('flower', r, r.x, r.z, 0.9);
  if (S.tool === '낚싯대') for (const r of FISH_SPOTS) if (!r.down) see('fish', r, r.x, r.z, 1.6, 0.1); // 낚시 자리(6단계)
  for (const r of BUSHES) see('bush', r, r.x, r.z, 1.3);
  for (const r of BERRIES) if (!r.down) see('berry', r, r.x, r.z, 1.3, 0.05); // 열매가 달렸으면 풀보다 먼저
  for (const r of TREES) if (!r.down) see('tree', r, r.x, r.z, 1.35);
  for (const r of ROCKS) if (!r.down) see('rock', r, r.x, r.z, 0.95 + r.circle.r);
  fightTargets(see); // 다른 수달(때리기) · 자루(줍기) — fight.js
  raidTargets(see); // 남의 집 치기(7단계) — house.js
  trapTargets(see); // 함정 놓기 · 탄약 · 부수기(8단계) — trap.js
  cookTargets(see); // 모닥불 옆 요리(D단계)
  // 바닥 물건 줍기(작업지시서 3 B) — ground.js
  groundTargets(see);
  return best;
}
const labelOf = (t) => !t ? '줍기/쓰기' : (typeof trapLabel === 'function' && trapLabel(t)) || (t.type === 'pitch' ? (t.rec.why ? '여기는 못 쳐요' : '텐트 치기') : null) || (t.type === 'cook' ? '요리하기' : t.type === 'pickup' ? `줍기 (${t.rec.n})` : null) || { shop: t.rec && SHOPS[t.rec] && SHOPS[t.rec].color ? '자판기 열기' : '가게 열기', chest: '보관함', house: '집 올리기', flower: '꽃 꺾기', bush: '풀 뜯기', berry: '열매 따기', fish: '낚시하기', raid: S.tool === '도끼' ? '집 부수기' : '집 치기', otter: S.tool === '도끼' ? '도끼로 치기' : '때리기', sack: '자루 줍기' }[t.type]
  || (t.type === 'tree' ? (S.tool === '도끼' ? '나무 베기' : '나무 흔들기') : S.tool === '곡괭이' ? '돌 캐기' : '곡괭이 필요');

let actCool = 0;
function doAction() {
  if (!winEl.hidden || me.dead) return;
  if (fishAction()) return; // 낚시 중이면 연타 · 거두기(쿨타임 없음 — 연타 검사는 서버)
  if (actCool > 0) return;
  const t = target = findTarget();
  if (!t) { if (S.tool === '텐트' && !S.home && PITCH.why) return toast(PITCH.why, '텐트'); toast('가까이에 할 수 있는 것이 없어요'); return; }
  actCool = 0.4 * ((BUFF.quick || 0) > clock ? 0.7 : 1); me.face = Math.atan2(t.x - me.x, t.z - me.z); // 모둠구이 버프
  const r = t.rec;
  if (t.type === 'shop') { shopKind = t.rec; if (!SHOPS[shopKind].sell) tab = 'buy'; return openWin('shop'); }
  if (t.type === 'pitch') return pitchAction(t.rec);
  if (t.type === 'cook') return openWin('cook');
  if (t.type === 'pickup') return pickupAction();
  if (t.type === 'raid') return raidAction(t); // 7단계
  if ((t.type === 'place' || t.type === 'tload' || t.type === 'trap') && trapAction(t)) return; // 8단계
  if (t.type === 'house') return openWin('house');
  if (t.type === 'chest') return openWin('chest');
  if (t.type === 'otter' || t.type === 'sack') return fightAction(t);
  me.actT = me.actDur = ACT_T; me.actSwing = (t.type === 'tree' && S.tool === '도끼') || (t.type === 'rock' && S.tool === '곡괭이'); me.actTree = null; net.ac++;
  if (t.type === 'tree' && S.tool !== '도끼') { // 맨손 흔들기: 줄기에서 팔 길이만큼 서서 정면으로
    const R = shakeFit(r, me.x, me.z).R, D = Math.max(shakeReach(R), r.circle.r + 0.32 + 0.02); // 막힘(나무 + 수달)보다 가까이는 못 섬 → 그만큼은 몸째 다가섬(shakePose)
    const dx = me.x - r.x, dz = me.z - r.z, l = Math.hypot(dx, dz) || 1, nx = r.x + dx / l * D, nz = r.z + dz / l * D;
    if (free(nx, nz)) { me.x = nx; me.z = nz; }
    me.face = Math.atan2(r.x - me.x, r.z - me.z); me.speed = 0;
    me.actT = me.actDur = SHAKE_T; me.actSwing = 'shake'; me.actTree = r.key; me.fit = shakeFit(r, me.x, me.z);
  }
  if (srvOn()) { // 서버가 결과를 정함 — 동작 · 흔들림만 보이고 요청을 보냄(가방은 서버 inv 로 바뀜)
    if (t.type === 'rock' && S.tool !== '곡괭이') { toast('곡괭이가 있어야 캘 수 있어요', '곡괭이'); me.actT = 0; return; }
    if (t.type === 'tree') wobble(r, S.tool === '도끼' ? WOB_AMP : SHAKE_AMP); else if (t.type === 'bush') wobble(r); else if (t.type === 'berry') wobble(r.bush);
    netSend({ t: 'act', k: r.key }); return;
  }
  if (t.type === 'flower') { r.down = clock + REGEN_LOCAL.F; hideRec(r); netRes(r); gain('꽃'); }
  else if (t.type === 'berry') { wobble(r.bush); r.down = clock + REGEN_LOCAL.E; hideRec(r); netRes(r); gain('열매', 2); }
  else if (t.type === 'bush') { wobble(r); if (clock < r.next) toast('아직 풀이 덜 자랐어요', '풀'); else { r.next = clock + 60; gain('풀', 2); } }
  else if (t.type === 'tree') {
    wobble(r, S.tool === '도끼' ? WOB_AMP : SHAKE_AMP); // 맨손 흔들기는 크게
    if (S.tool === '도끼') { gain('나무'); if (--r.wood <= 0) { r.wood = 3; r.down = clock + REGEN_LOCAL.T; hideRec(r); wobbles.delete(r); netRes(r); if (!net.on) toast(`나무가 쓰러졌어요 — ${REGEN_LOCAL.T}초 뒤 다시 자라요`); } }
    else if (clock < r.next) toast('흔들어도 아무것도 안 떨어져요');
    else { r.next = clock + 45; if (r.kind === 'fruit') gain('열매', 1 + (rnd() < 0.5 ? 1 : 0)); gain('나뭇가지'); }
  } else if (t.type === 'rock') {
    if (S.tool !== '곡괭이') { toast('곡괭이가 있어야 캘 수 있어요', '곡괭이'); me.actT = 0; return; }
    gain('돌'); if (--r.stone <= 0) { r.stone = 3; r.down = clock + REGEN_LOCAL.R; hideRec(r); netRes(r); if (!net.on) toast(`바위를 다 캤어요 — ${REGEN_LOCAL.R}초 뒤 다시 생겨요`); }
  }
}
let regrowT = 0;
function life(dt) {
  actCool -= dt; me.actT -= dt;
  for (const [r, t] of wobbles) {
    const left = t - dt; if (left <= 0) { wobbles.delete(r); r.im.setMatrixAt(r.i, r.m); r.im.instanceMatrix.needsUpdate = true; continue; }
    wobbles.set(r, left); WM.copy(r.m).multiply(WR.makeRotationZ(wobbleAngle(left, wobAmp.get(r) ?? WOB_AMP))); r.im.setMatrixAt(r.i, WM); r.im.instanceMatrix.needsUpdate = true;
  }
  if ((regrowT -= dt) <= 0) {
    regrowT = 1;
    for (const r of [...TREES, ...ROCKS, ...FLOWERS, ...BERRIES]) if (r.down && clock > r.down && Math.hypot(r.x - me.x, r.z - me.z) > 3 && ![...net.others.values()].some((o) => Math.hypot(r.x - o.x, r.z - o.z) < 3)) { r.down = 0; showRec(r); } // 누가 서 있으면 다시 자라지 않음
  }
  if ((tgtT -= dt) <= 0) {
    tgtT = 0.12; target = winEl.hidden ? findTarget() : null;
    const L = fishLabel() || labelOf(target); if ($('actTxt').textContent !== L) $('actTxt').textContent = L; $('actBtn').classList.toggle('off', !target && !fishing.st);
  }
  if (npc) animOtter(npc, 0, 0, false, clock + 3);
  tentGhostTick();
}

// 창
let view = null, sel = -1, tab = 'sell', trashArm = 0, moveArm = 0, shopKind = 'tool';
function armMove() { moveArm = 1; render(); setTimeout(() => { if (moveArm && view === 'house') { moveArm = 0; render(); } }, 2500); } // shopKind: 연 가게 · 자판기(B단계)
// 교환 창에서 다른 창으로 바꾸거나 닫으면 교환 취소(trade.js)
function openWin(v) { if (view === 'trade' && v !== 'trade' && typeof tradeClosed === 'function') tradeClosed(); view = v; sel = -1; trashArm = 0; winEl.hidden = false; document.body.classList.add('winopen'); toastsEl.textContent = ''; $('winMsg').textContent = ''; hideHint(); render(); }
function closeWin() { if (view === 'trade' && typeof tradeClosed === 'function') tradeClosed(); winEl.hidden = true; view = null; document.body.classList.remove('winopen'); }
$('winX').onclick = closeWin;
winEl.addEventListener('pointerdown', (e) => { if (e.target === winEl) closeWin(); });
// 내구도 막대(작업지시서 3 B): 도구 · 총 칸 아래 · 0 이면 「고장」
const DUR = { 도끼: 250, 곡괭이: 250, 낚싯대: 120, 권총: 600, 소총: 1500, 산탄총: 300 };
const durHtml = (s) => (s && DUR[s.id] && Number.isFinite(s.d) ? (s.d <= 0 ? '<em class="broke">고장</em>' : `<i class="dur"><u style="width:${Math.round(s.d / DUR[s.id] * 100)}%"></u></i>`) : '');
const slotsHtml = (box, kind) => box.map((s, i) => `<button type="button" class="slot${kind === 'bag' && sel === i ? ' sel' : ''}${s && s.id === S.tool ? ' hold' : ''}" data-box="${kind}" data-i="${i}">${s ? `<i class="ic" style="background-image:${ic(s.id)}"></i>${ITEMS[s.id].tool ? '' : `<b>${s.n}</b>`}${durHtml(s)}` : ''}</button>`).join('');
const price = (n) => `<span class="pr"><i class="ic"></i>${n.toLocaleString()}</span>`;
function render() {
  frameEl.classList.toggle('wide', view === 'chest' || view === 'trade');
  const H = HOUSES[S.tier];
  const [title, tic] = { bag: ['가방', '가방'], shop: [(SHOPS[shopKind] || SHOPS.tool).name, '조개'], house: ['내 집', H.model], chest: ['보관함', H.model], raids: ['습격 기록', H.model], settings: ['설정', '손'], cook: ['요리', '도미'], trade: ['교환', '조개'] }[view];
  $('winTitle').textContent = title; $('winIc').style.backgroundImage = ic(tic);
  let h = '';
  if (view === 'bag') {
    const s = S.bag[sel];
    const food = s && FOODS[s.id];
    h = `<div class="grid">${slotsHtml(S.bag, 'bag')}</div><div class="${food || (s && FISH_KINDS.includes(s.id)) ? 'qsel' : 'foot'}">${food ? `<button type="button" class="gbtn" id="eatBtn">먹기 +${food.e}${food.buff ? ' · ' + food.buff : ''}</button>` : s && FISH_KINDS.includes(s.id) ? '<span class="pk">날생선은 모닥불에서 익혀요</span>' : ''}<button type="button" class="bbtn" id="trash" ${s ? '' : 'disabled'}><i class="ic" style="background-image:${ic('쓰레기통')}"></i>${trashArm ? '한 번 더 누르면 버려요' : '버리기'}</button></div>${srvOn() ? dropRows(s) : ''}`;
  } else if (view === 'shop') {
    if (!(SHOPS[shopKind] || SHOPS.tool).sell) tab = 'buy'; // 자판기는 사기만(팔기는 도구 상점 상인)
    h = (SHOPS[shopKind] || SHOPS.tool).sell ? `<div class="tabs"><button type="button" class="tab${tab === 'sell' ? ' on' : ''}" data-tab="sell">팔기</button><button type="button" class="tab${tab === 'buy' ? ' on' : ''}" data-tab="buy">사기</button></div>` : '';
    if (tab === 'sell') {
      const list = SELLABLE.filter((id) => count(id));
      // 건축 재료(나무 · 돌)는 수량을 골라 따로 판다 · 나머지는 줄마다 전부 팔기 + 탭 바로 아래 「재료 빼고 모두 팔기」 (2026-11-17 문파원 불만 · 가로 휴대폰에서 안 내려도 보이게 위로)
      const bulk = SELLABLE.filter((id) => !MATERIALS.includes(id)).reduce((n, id) => n + count(id) * sellOf(id), 0);
      if (list.length) h += `<div class="foot bulk"><button type="button" class="bbtn" id="sellAll" ${bulk ? '' : 'disabled'}>재료 빼고 모두 팔기 +${bulk.toLocaleString()}</button></div>`;
      h += list.length ? list.map((id) => {
        if (!MATERIALS.includes(id)) return `<div class="row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}<small>×${count(id)}${mkTag(id)}</small></span>${price(sellOf(id))}<button type="button" class="bbtn" data-sell="${id}">팔기</button></div>`;
        const q = Math.max(1, Math.min(count(id), sellQty[id] || 1)); sellQty[id] = q;
        return `<div class="row mat-row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}<small>×${count(id)}</small></span>${price(ITEMS[id].sell)}<div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-qty="${id}" data-d="-1" ${q <= 1 ? 'disabled' : ''}>−</button><b>${q}</b><button type="button" class="bbtn" data-qty="${id}" data-d="1" ${q >= count(id) ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" data-sellq="${id}">${q}개 팔기</button></div></div>`; // 둘째 줄에 수량 · 팔기(좁은 휴대폰에서 넘치지 않게)
      }).join('') : '<div class="empty">팔 물건이 없어요. 섬에서 모아 오세요!</div>';
    } else {
      h += fixRows();
      const list = buyList(); h += list.length ? list.map(buyRow).join('') : '<div class="empty">먹거리는 곧 들어와요</div>';
    }
    h += `<div class="mine">내 조개 ${price(S.money)}</div>`;
  } else if (view === 'house') {
    const N = HOUSES[S.tier + 1];
    if (!N) h = `<div class="up"><figure><i class="ic" style="background-image:${ic(H.model)}"></i><figcaption>지금 ${H.name}</figcaption></figure></div><div class="empty">가장 큰 집이에요! 보관함 ${H.chest}칸</div>`;
    else {
      const need = Object.entries(N.cost), have = (k) => (k === '조개' ? S.money : count(k)), okAll = need.every(([k, v]) => have(k) >= v);
      h = `<div class="up"><figure><i class="ic" style="background-image:${ic(H.model)}"></i><figcaption>지금 ${H.name}</figcaption></figure><span class="arrow">➜</span><figure><i class="ic" style="background-image:${ic(N.model)}"></i><figcaption>다음 ${N.name}</figcaption></figure></div>
        <div class="mats">${need.map(([k, v]) => `<div class="mat${have(k) >= v ? '' : ' lack'}"><i class="ic" style="background-image:${ic(k)}"></i><b>${k} ${Math.min(have(k), v).toLocaleString()}/${v.toLocaleString()}</b></div>`).join('')}</div>
        <div class="foot"><button type="button" class="gbtn" id="upBtn" ${okAll ? '' : 'disabled'}><i class="ic" style="background-image:${ic(N.model)}"></i>올리기</button></div>`;
    }
    if (S.tier === 0 && S.homeAt && DECAY_H) { const left = Math.max(0, S.homeAt + DECAY_H * 3600e3 - Date.now()) / 3600e3; h += `<div class="empty">텐트는 ${left >= 1 ? Math.floor(left) + '시간' : Math.ceil(left * 60) + '분'} 뒤 낡아 사라져요 — 오두막으로 올리면 그대로예요</div>`; }
    h = houseHpHtml() + h + `<div class="foot"><button type="button" class="bbtn" id="moveBtn">${moveArm ? '한 번 더 누르면 접어요' : '텐트로 접기 (이사)'}</button></div>`; // 내구도 · 고치기(7단계) · 이사(B단계)
  } else if (view === 'cook') {
    h = Object.entries(RECIPES).map(([id, need]) => { const okk = need.every(([k, n]) => haveOf(k) >= n), F = FOODS[id]; return `<div class="row mat-row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}<small>+${F.e}${F.buff ? ' · ' + F.buff : ''}</small></span><div class="mat-line"><span class="need">${need.map(([k, n]) => `${k} ${Math.min(haveOf(k), n)}/${n}`).join(' · ')}</span><button type="button" class="bbtn" data-cook="${id}" ${okk ? '' : 'disabled'}>만들기</button></div></div>`; }).join('') + '<div class="empty">생선 = 물고기 아무거나 · 모닥불 옆에 있으면 에너지가 차요</div>';
  } else if (view === 'settings') { const NM = { auto: '자동', low: '저사양', high: '고사양' };
    h = `<div class="empty">그래픽 품질 — 지금 ${NM[qMode]}${qMode === 'auto' ? ` (${['저사양', '보통', '고사양'][quality.level]})` : ''}</div><div class="qsel">${['auto', 'low', 'high'].map((m) => `<button type="button" class="${m === qMode ? 'gbtn' : 'bbtn'}" data-q="${m}">${NM[m]}</button>`).join('')}</div><div class="empty">저사양: 빠르게(효과 · 그림자 줄임) · 고사양: 부드러운 그림자 · 불빛 번짐 · 흐림 · 조명 많이</div>`;
  } else if (view === 'trade') { h = tradeHtml();
  } else if (view === 'raids') { h = raidsHtml();
  } else if (view === 'chest') {
    h = `<div class="two"><div><h4>가방 (누르면 보관함으로)</h4><div class="grid">${slotsHtml(S.bag, 'bagc')}</div></div><div><h4>보관함 ${S.chest.length}칸 (누르면 가방으로)</h4><div class="grid chestgrid">${slotsHtml(S.chest, 'chest')}</div></div></div>`;
  }
  bodyEl.innerHTML = h;
}
bodyEl.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tab) { tab = b.dataset.tab; return render(); }
  if (b.dataset.q) { setQualityMode(b.dataset.q); return render(); } // 설정 창(C단계)
  // 교환 창 단추(작업지시서 3 D · trade.js)
  if (view === 'trade' && tradeClick(b)) return;
  if (srvOn()) { // 서버가 정함 — 요청만 보내고 inv 로 받음
    if (b.dataset.box === 'bag') { const i = +b.dataset.i, s = S.bag[i]; sel = i; trashArm = 0; if (s && ITEMS[s.id].tool) return netSend({ t: 'equip', tool: S.tool === s.id ? null : s.id }); return render(); }
    if (b.dataset.box === 'bagc' || b.dataset.box === 'chest') return netSend({ t: 'chest', from: b.dataset.box === 'chest' ? 'chest' : 'bag', i: +b.dataset.i });
    if (b.id === 'trash') { if (!trashArm) { trashArm = 1; render(); setTimeout(() => { if (trashArm && view === 'bag') { trashArm = 0; render(); } }, 2500); return; } trashArm = 0; return netSend({ t: 'trash', i: sel }); }
    if (b.dataset.sell) return netSend({ t: 'sell', id: b.dataset.sell, n: count(b.dataset.sell) });
    if (b.dataset.sellq) { const id = b.dataset.sellq, n = Math.min(count(id), sellQty[id] || 1); sellQty[id] = 1; return netSend({ t: 'sell', id, n }); }
    if (b.id === 'sellAll') return netSend({ t: 'sellall' });
    if (b.dataset.buy) return netSend({ t: 'buy', id: b.dataset.buy });
    if (b.id === 'upBtn') return netSend({ t: 'up' });
    if (b.id === 'repairBtn') return netSend({ t: 'repair' });
    if (b.id === 'raidsBtn') return openWin('raids');
    if (b.id === 'moveBtn') { if (!moveArm) return armMove(); moveArm = 0; return netSend({ t: 'unpitch' }); }
    if (b.id === 'eatBtn') return netSend({ t: 'eat', i: sel });
    // 내려놓기 · 조개 주머니 · 수리(작업지시서 3 B)
    if (b.dataset.dq) { const s = S.bag[sel]; dropQty = Math.max(1, Math.min(s ? s.n : 1, dropQty + +b.dataset.dq * (dropQty >= 10 ? 5 : 1))); return render(); }
    if (b.id === 'dropBtn') { const s = S.bag[sel]; if (!s) return; const n = Math.min(s.n, dropQty); dropQty = 1; return netSend({ t: 'drop', i: sel, n }); }
    if (b.dataset.mq) { const st = moneyQty >= 1000 ? 500 : moneyQty >= 100 ? 50 : 10; moneyQty = Math.max(10, Math.min(Math.max(10, S.money), moneyQty + +b.dataset.mq * st)); return render(); }
    if (b.id === 'dropMoney') { const n = Math.min(S.money, moneyQty); if (n > 0) netSend({ t: 'drop', money: n }); return; }
    if (b.dataset.fix) return netSend({ t: 'fix', i: +b.dataset.fix });
    if (b.dataset.cook) return netSend({ t: 'cook', r: b.dataset.cook });
  }
  if (b.id === 'moveBtn') { if (!moveArm) return armMove(); moveArm = 0; return movePack(); } // 혼자 놀기 이사
  if (b.id === 'eatBtn' || b.dataset.cook) return toast('먹기 · 요리는 홈페이지에서 로그인해 함께일 때 돼요', '열매'); // 혼자 놀기엔 에너지가 없음
  if (b.dataset.box === 'bag') { const i = +b.dataset.i, s = S.bag[i]; sel = i; trashArm = 0; if (s && ITEMS[s.id].tool) { S.tool = S.tool === s.id ? null : s.id; toast(S.tool ? `${S.tool}를 들었어요` : '맨손이에요', S.tool || '손'); return changed(); } return render(); }
  if (b.dataset.box === 'bagc' || b.dataset.box === 'chest') { // 한 묶음 통째로 옮김
    const from = b.dataset.box === 'chest' ? S.chest : S.bag, to = from === S.chest ? S.bag : S.chest, i = +b.dataset.i, s = from[i]; if (!s) return;
    const left = put(to, s.id, s.n); if (left === s.n) toast(to === S.chest ? '보관함이 가득 찼어요' : '가방이 가득 찼어요'); if (left) s.n = left; else from[i] = null; return changed();
  }
  if (b.id === 'trash') { if (!trashArm) { trashArm = 1; render(); setTimeout(() => { if (trashArm && view === 'bag') { trashArm = 0; render(); } }, 2500); return; } const s = S.bag[sel]; S.bag[sel] = null; trashArm = 0; if (s) toast(`${s.id} 버렸어요`, '쓰레기통'); return changed(); }
  if (b.dataset.sell) { const id = b.dataset.sell, n = count(id), got = n * ITEMS[id].sell; take(id, n); S.money += got; toast(`${id} ${n}개 팔아 +${got.toLocaleString()} 조개`, '조개'); return changed(); }
  if (b.dataset.qty) { const id = b.dataset.qty, q = sellQty[id] || 1, d = +b.dataset.d, st = (d > 0 ? q : q - 1) < 10 ? 1 : (d > 0 ? q : q - 1) < 50 ? 5 : 10; sellQty[id] = Math.max(1, Math.min(count(id), q + d * st)); return render(); } // 10 아래 1씩 · 50 아래 5씩 · 그 위 10씩
  if (b.dataset.sellq) { const id = b.dataset.sellq, n = Math.min(count(id), sellQty[id] || 1), got = n * ITEMS[id].sell; if (!n) return; take(id, n); S.money += got; sellQty[id] = 1; toast(`${id} ${n}개 팔아 +${got.toLocaleString()} 조개`, '조개'); return changed(); }
  if (b.id === 'sellAll') { let got = 0, n = 0; for (const id of SELLABLE) if (!MATERIALS.includes(id)) { const c = count(id); if (c) { take(id, c); got += c * ITEMS[id].sell; n += c; } } if (!n) return; S.money += got; toast(`재료 빼고 ${n}개 팔아 +${got.toLocaleString()} 조개`, '조개'); return changed(); }
  if (b.dataset.buy) return buyLocal(b.dataset.buy);
  if (b.id === 'upBtn') {
    const N = HOUSES[S.tier + 1]; if (!N) return;
    for (const [k, v] of Object.entries(N.cost)) if ((k === '조개' ? S.money : count(k)) < v) return;
    for (const [k, v] of Object.entries(N.cost)) { if (k === '조개') S.money -= v; else take(k, v); }
    S.tier++; fit(S.chest, chestSize()); buildHouse(); netSend({ t: 'tier', tier: S.tier }); toast(`${N.name}으로 올렸어요! 보관함 ${N.chest}칸`, N.model); return changed();
  }
});
$('bagBtn').onclick = () => (winEl.hidden ? openWin('bag') : closeWin());
$('toolBtn').onclick = cycleTool;
$('actBtn').onclick = doAction;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape') closeWin();
  else if (e.code === 'KeyE' || e.code === 'Space') doAction();
  else if (e.code === 'KeyQ') cycleTool();
  else if (e.code === 'KeyB' || e.code === 'KeyI') (winEl.hidden ? openWin('bag') : closeWin());
});

// 내 집 · 상인
let mySet = null, houseBox = null, npc = null;
// 집 한 채 + 보관함(집 앞 오른쪽) — 내 집 · 다른 문파원 집 모두
function placeHouseSet(at, tier) {
  const H = HOUSES[tier], obj = placeModel(srcs[H.model], at.x, at.z, 0, H.h, 'b'), box = boxes[boxes.length - 1];
  const chest = placeModel(srcs['보관함'], at.x + 3.6, at.z + 3.4, -20, 0.75, 'c'), circle = circles[circles.length - 1];
  return { obj, box, chest, circle, blob: houseBlob(box), glow: typeof houseGlow === 'function' ? houseGlow(at, tier, box) : null }; // 창문 · 텐트 등불(C단계)
}
function removeHouseSet(h) { scene.remove(h.obj); scene.remove(h.chest); if (h.blob) scene.remove(h.blob); if (h.glow) removeGlow(h.glow); boxes.splice(boxes.indexOf(h.box), 1); circles.splice(circles.indexOf(h.circle), 1); }
function buildHouse(goHome = false) {
  if (mySet) { removeHouseSet(mySet); mySet = null; }
  if (!S.home) { HOUSE_AT = null; houseBox = null; CHEST_AT = { x: 1e4, z: 1e4 }; if (goHome) { me.x = SPAWN.x; me.z = SPAWN.z; me.face = 0; } nudgeFree(); return; } // 집 없음(텐트 치기 전) — 울타리 안에서 시작
  HOUSE_AT = S.home; CHEST_AT = { x: HOUSE_AT.x + 3.6, z: HOUSE_AT.z + 3.4 };
  mySet = placeHouseSet(HOUSE_AT, S.tier); mySet.tier = S.tier; houseBox = mySet.box;
  const b = houseBox;
  if (goHome || (me.x > b.x0 - 0.4 && me.x < b.x1 + 0.4 && me.z > b.z0 - 0.4 && me.z < b.z1 + 0.4)) { me.x = HOUSE_AT.x; me.z = b.z1 + 1.6; me.face = 0; } // 집 앞에서 시작 · 집이 커져 안에 갇히면 앞으로
  nudgeFree();
}
// 끼어 있으면 가까운 빈자리로(둥글게 넓혀 가며 찾음)
function nudgeFree() {
  if (free(me.x, me.z)) return;
  for (let r = 0.5; r < 12; r += 0.5) for (let a = 0; a < 16; a++) {
    const x = me.x + Math.sin(a / 16 * Math.PI * 2) * r, z = me.z + Math.cos(a / 16 * Math.PI * 2) * r;
    if (free(x, z)) { me.x = x; me.z = z; return; }
  }
}

// ───────── 가게 · 자판기 줄 · 혼자 놀기 사기 (B단계) ─────────
const MATPACK = { 나무: 10, 돌: 10, 열매: 5 }; // 자판기 수리 재료 묶음(서버 config.matPack 과 같게)
function buyRow(id) {
  const cost = ITEMS[id].buy, pk = PACK[id] ? `${PACK[id]}발 묶음` : MATPACK[id] ? `${MATPACK[id]}개 묶음` : '';
  if (id === '보관함') { const full = (S.extra | 0) >= 2, no = !S.home; return `<div class="row"><i class="ic" style="background-image:${ic(HOUSES[S.tier].model)}"></i><span class="nm">보관함 늘리기<small class="pk">+8칸 · ${S.extra | 0}/2</small></span>${price(cost)}<button type="button" class="bbtn" data-buy="보관함" ${full || no || S.money < cost ? 'disabled' : ''}>${full ? '다 늘림' : no ? '집 먼저' : '사기'}</button></div>`; }
  const one = !!ITEMS[id].tool, have = one && (count(id) > 0 || S.chest.some((s) => s && s.id === id)), home = id === '텐트' && !!S.home;
  return `<div class="row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}${pk ? `<small class="pk">${pk}</small>` : ''}</span>${price(cost)}<button type="button" class="bbtn" data-buy="${id}" ${have || home || S.money < cost ? 'disabled' : ''}>${home ? '집 있음' : have ? '있음' : '사기'}</button></div>`;
}
function buyLocal(id) {
  const cost = ITEMS[id].buy; if (S.money < cost) return;
  if (id === '보관함') { if (!S.home || (S.extra | 0) >= 2) return; S.money -= cost; S.extra = (S.extra | 0) + 1; fit(S.chest, chestSize()); toast(`보관함이 ${S.chest.length}칸이 되었어요`, HOUSES[S.tier].model); return changed(); }
  if (id === '텐트' && (S.home || count('텐트') || S.chest.some((s) => s && s.id === '텐트'))) return toast('집은 하나만 가질 수 있어요', '텐트');
  const n = MATPACK[id] || 1, trial = S.bag.map((s) => (s ? { ...s } : null)); if (put(trial, id, n)) return toast('가방이 가득 찼어요', '가방');
  S.bag = trial; S.money -= cost; if (ITEMS[id].tool) S.tool = id;
  toast(id === '텐트' ? '텐트를 샀어요! 손에 들고 친 곳이 내 집이에요' : n > 1 ? `${id} ${n}개를 샀어요` : `${id}를 샀어요! 손에 들었어요`, id); return changed();
}

// ───────── 텐트 치기 · 이사 (B단계) — 판정은 서버(world.js tentSpotWhy). 여기 tentWhy 는 미리보기 색 · 혼자 놀기용으로 같은 규칙 ─────────
const TENT = { foot: 4.2, gap: 12, safeGap: 25, fishGap: 4, ahead: 4.8, frontZ: 3.23 + 1.6 }; // frontZ: 큰 집 반 깊이(world.json houseHalf[3]) + 1.6 = 다시 태어나는 곳 // 서버 config.tent · safeBuffer(25) 와 같게 · ahead: 내 앞 몇 칸에 칠지
const inWaterC = (x, z) => Math.abs(x - riverX(z)) < RW + 0.4 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.4 || Math.hypot(x, z) > islandR(Math.atan2(z, x)) - 1.5; // 서버 inWater 와 같은 식
let NATURAL = null; // 나무 · 바위 · 덤불 막힘(서버는 나무 · 바위만 따로 봄 · 덤불은 안 봄)
function tentWhy(x, z) {
  const T = TENT, sf = (typeof SAFE !== 'undefined' && SAFE) || SAFE_DEF;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) >= ISLE_R + 12) return '여기는 칠 수 없어요';
  if (Math.hypot(x - sf.x, z - sf.z) < sf.r + T.safeGap) return `안전지대(항구) 둘레 ${T.safeGap}칸 안에는 칠 수 없어요`;
  const f = T.foot - 0.7; for (const [ox, oz] of [[0, 0], [f, 0], [-f, 0], [0, f], [0, -f], [f, f], [-f, f], [f, -f], [-f, -f]]) if (inWaterC(x + ox, z + oz)) return '물가에는 칠 수 없어요';
  for (const s of FISH_SPOTS) if (Math.hypot(x - s.x, z - s.z) < T.fishGap) return '낚시 자리에는 칠 수 없어요';
  for (const r of [...TREES, ...ROCKS]) if (Math.hypot(x - r.x, z - r.z) < r.circle.r + T.foot) return '나무 · 바위와 겹쳐요';
  NATURAL = NATURAL || new Set([...TREES, ...ROCKS, ...BUSHES].map((r) => r.circle).filter(Boolean));
  if (STATIC.circles.some((q) => !NATURAL.has(q) && Math.hypot(x - q.x, z - q.z) < q.r + T.foot) || STATIC.boxes.some((q) => x > q.x0 - T.foot && x < q.x1 + T.foot && z > q.z0 - T.foot && z < q.z1 + T.foot)) return '다른 것과 겹쳐요';
  for (const [qx, qz] of [[x, z + TENT.frontZ], [x + 3.6, z + 3.4]]) { // 큰 집 앞 · 보관함 자리(서버와 같게)
    if (inWaterC(qx, qz)) return '물가에는 칠 수 없어요';
    for (const r of [...TREES, ...ROCKS]) if (Math.hypot(qx - r.x, qz - r.z) < r.circle.r + 0.9) return '나무 · 바위와 겹쳐요';
    if (STATIC.circles.some((c) => !NATURAL.has(c) && Math.hypot(qx - c.x, qz - c.z) < c.r + 0.9)) return '다른 것과 겹쳐요';
  }
  for (const k of Object.values(SHOPS)) if (Math.hypot(x - k.x, z - k.z) < T.foot + 3) return '가게 둘레에는 칠 수 없어요';
  for (const h of net.houses.values()) if (Math.hypot(x - h.x, z - h.z) < T.gap) return `다른 집과 너무 가까워요 (${T.gap}칸 띄우기)`;
  return null;
}
const PITCH = { x: 0, z: 0, why: null };
function pitchSpot() { PITCH.x = me.x + Math.sin(me.face) * TENT.ahead; PITCH.z = me.z + Math.cos(me.face) * TENT.ahead; PITCH.why = tentWhy(PITCH.x, PITCH.z); return PITCH; }
function tentTargets(see) {
  if (S.tool !== '텐트' || S.home || me.dead) return;
  pitchSpot(); if (!PITCH.why) see('pitch', PITCH, me.x + Math.sin(me.face) * 0.6, me.z + Math.cos(me.face) * 0.6, 9, 9); // 칠 수 있으면 치기가 먼저 · 못 치는 곳이면 다른 일을 막지 않음(빨간 미리보기만)
}
function pitchAction(p) {
  if (p.why) return toast(p.why, '텐트');
  if (srvOn()) return netSend({ t: 'pitch', x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
  if (!take('텐트', 1)) return;
  S.home = { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }; if (!count('텐트')) S.tool = null; buildHouse(false); toast('텐트를 쳤어요! 여기가 내 집이에요', '텐트'); changed();
}
function movePack() { // 혼자 놀기 이사(함께일 땐 서버가 봄)
  if (!S.home) return;
  if (S.chest.some(Boolean)) return toast('보관함을 비워야 이사할 수 있어요', HOUSES[S.tier].model);
  if (put(S.bag, '텐트', 1)) return toast('가방이 가득 찼어요', '가방');
  S.home = null; S.tool = '텐트'; buildHouse(false); closeWin(); toast('텐트로 접었어요 — 새 자리에 다시 쳐요', '텐트'); changed();
}
// 미리보기: 반투명 텐트 + 집 땅(큰 집 크기) 둥근 테두리 — 칠 수 있으면 초록 · 없으면 빨강
let ghost = null;
function tentGhostTick() {
  const on = S.tool === '텐트' && !S.home && !me.dead && winEl.hidden && !!srcs['텐트'];
  if (!on) { if (ghost) ghost.g.visible = false; return; }
  if (!ghost) {
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.5, depthWrite: false });
    const ok = mat(0x5fe08a), no = mat(0xf0584a), g = new THREE.Group(), tent = placeModel(srcs['텐트'], 0, 0, 0, HOUSES[0].h, ''); scene.remove(tent); tent.position.set(0, 0, 0); g.add(tent);
    const ring = new THREE.Mesh(new THREE.RingGeometry(TENT.foot - 0.14, TENT.foot, 64), mat(0x5fe08a)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const meshes = []; tent.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; meshes.push(m); } });
    ghost = { g, ring, meshes, ok, no, okRing: ring.material, noRing: mat(0xf0584a), last: null }; scene.add(g);
  }
  const p = pitchSpot(), good = !p.why;
  ghost.g.visible = true; ghost.g.position.set(p.x, Math.max(0, height(p.x, p.z)), p.z);
  if (ghost.last !== good) { ghost.last = good; for (const m of ghost.meshes) m.material = good ? ghost.ok : ghost.no; ghost.ring.material = good ? ghost.okRing : ghost.noRing; }
}

// ───────── 내려놓기 · 조개 주머니 · 수리 (작업지시서 3 B) ─────────
let dropQty = 1, moneyQty = 100;
// 가방 창 아래: 고른 칸을 수량을 골라 내려놓기 · 조개를 금액을 골라 주머니로 내려놓기
function dropRows(s) {
  if (s) dropQty = Math.max(1, Math.min(s.n, dropQty));
  moneyQty = Math.max(10, Math.min(Math.max(10, S.money), moneyQty));
  const item = s ? `<div class="row mat-row"><i class="ic" style="background-image:${ic(s.id)}"></i><span class="nm">내려놓기<small>${s.id}</small></span><div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-dq="-1" ${dropQty <= 1 ? 'disabled' : ''}>−</button><b>${dropQty}</b><button type="button" class="bbtn" data-dq="1" ${dropQty >= s.n ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" id="dropBtn">내려놓기</button></div></div>` : '';
  const money = `<div class="row mat-row"><i class="ic" style="background-image:${ic('조개')}"></i><span class="nm">조개 주머니<small>가진 조개 ${S.money.toLocaleString()}</small></span><div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-mq="-1" ${moneyQty <= 10 ? 'disabled' : ''}>−</button><b>${moneyQty.toLocaleString()}</b><button type="button" class="bbtn" data-mq="1" ${moneyQty >= S.money ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" id="dropMoney" ${S.money < 1 ? 'disabled' : ''}>내려놓기</button></div></div>`;
  return item + money;
}
// 상점(도구) · 무기 자판기(총) 사기 쪽 위에: 닳은 도구 고치기 줄(값 = 새것 값 × 0.35 × 닳은 비율 · 서버 config.fixRate 와 같게)
function fixRows() {
  const forGun = shopKind === 'gun', forTool = shopKind === 'tool';
  if (!srvOn() || !(forGun || forTool)) return '';
  return S.bag.map((s, i) => [s, i]).filter(([s]) => s && DUR[s.id] && Number.isFinite(s.d) && s.d < DUR[s.id] && GUNS.includes(s.id) === forGun).map(([s, i]) => {
    const cost = Math.ceil(ITEMS[s.id].buy * 0.35 * (1 - s.d / DUR[s.id]));
    return `<div class="row"><i class="ic" style="background-image:${ic(s.id)}"></i><span class="nm">${s.id} 고치기<small class="pk">내구 ${s.d}/${DUR[s.id]}${s.d <= 0 ? ' · 고장' : ''}</small></span>${price(cost)}<button type="button" class="bbtn" data-fix="${i}" ${S.money < cost ? 'disabled' : ''}>고치기</button></div>`;
  }).join('');
}

// ───────── 요리 · 시세 · 부식 (D단계) ─────────
let DECAY_H = 0; // 텐트 부식 시간(서버가 보냄)
const sellOf = (id) => (MARKET && MARKET[id] ? Math.max(1, Math.round(ITEMS[id].sell * MARKET[id])) : ITEMS[id].sell);
const mkTag = (id) => { if (!MARKET || !MARKET[id]) return ''; const d = Math.round((MARKET[id] - 1) * 100); return d ? ` <b class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}%</b>` : ''; };
const FIRE_SPOTS = PROPS.filter((p) => p[0] === '모닥불').map((p) => ({ x: p[1], z: p[2] })); // 공용 모닥불(서버 config.fires 와 같은 자리)
function cookTargets(see) { // 모닥불(공용 · 내 것) 옆 → 「요리하기」
  if (!srvOn()) return;
  for (const f of FIRE_SPOTS) see('cook', f, f.x, f.z, 2.4, 0.3);
  for (const t of traps.values()) if (t.kind === 'fire') see('cook', t, t.x, t.z, 2.4, t.owner === net.name ? 0.3 : 0.2); // 남의 모닥불에서도 요리(서버와 같게)
}
