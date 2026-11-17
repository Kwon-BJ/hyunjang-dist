// 수달섬 — 살림(가방 · 조개 · 채집 · 상점 · 집 · 보관함 · 저장) (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 살림: 가방 · 조개 · 채집 · 상점 · 집 · 보관함 · 저장 (2026-11-17 · 창은 ChatGPT 시안대로) ─────────
const $ = (id) => document.getElementById(id);
const ITEMS = { 열매: { sell: 15 }, 나뭇가지: { sell: 5 }, 꽃: { sell: 10 }, 풀: { sell: 3 }, 나무: { sell: 12 }, 돌: { sell: 14 }, 도끼: { buy: 300, tool: true }, 곡괭이: { buy: 400, tool: true } };
const SELLABLE = ['열매', '나뭇가지', '꽃', '풀', '나무', '돌'], TOOLS = ['도끼', '곡괭이'];
const REGEN_LOCAL = { T: 120, R: 100, F: 80 }; // 혼자 놀기(서버 없음)일 때만 쓰는 다시 자라는 시간 — 함께일 땐 워커 REGEN 이 정함
const MATERIALS = ['나무', '돌']; // 건축 재료(집 올리기에 드는 것) — 일괄 판매에서 빼고 수량을 골라 판다
const sellQty = {};
const ic = (id) => `url(img/i-${id.replace(/ /g, '')}.webp)`;
const BAG_N = 16, STACK = 30, ACT_T = 0.45;
const HOUSES = [
  { name: '텐트', model: '텐트', h: 1.9, chest: 8 },
  { name: '오두막', model: '오두막', h: 3.4, chest: 16, cost: { 나무: 30, 돌: 10, 조개: 500 } },
  { name: '나무집', model: '나무집', h: 4.6, chest: 24, cost: { 나무: 60, 돌: 40, 조개: 2000 } },
  { name: '큰 집', model: '큰집', h: 5.6, chest: 32, cost: { 나무: 120, 돌: 100, 조개: 6000 } },
];
const SHOP_AT = { x: -4.5, z: -3.4 };
let HOUSE_AT = PLOTS[0], CHEST_AT = { x: 0, z: 0 }; // 내 집터(서버가 정해 준 번호) · 보관함은 집 앞 오른쪽
const SAVE_KEY = 'suseom-v1';
const S = { money: 100, bag: [], chest: [], tier: 0, tool: null, plot: 0 };
try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && Array.isArray(d.bag)) Object.assign(S, d); } catch { /* 저장 못 읽으면 새로 시작 */ }
const fit = (a, n) => { a.length = Math.min(a.length, n); while (a.length < n) a.push(null); return a; };
S.tier = Math.max(0, Math.min(HOUSES.length - 1, S.tier | 0)); fit(S.bag, BAG_N); fit(S.chest, HOUSES[S.tier].chest);
S.plot = Math.max(0, Math.min(PLOTS.length - 1, S.plot | 0));
let dirty = false;
let onSaved = null; // 여럿이 함께일 때 서버에도 저장(아래 「여럿이 함께」에서 채움)
// 혼자 놀기 저장으로 되돌림 — 서버에서 끊겼을 때(서버 가방이 이 기기 저장에 섞이지 않게 · 리뷰 3단계 4번)
function loadLocal() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && Array.isArray(d.bag)) Object.assign(S, { money: Math.max(0, +d.money || 0), bag: d.bag, chest: d.chest || [], tier: d.tier | 0, tool: d.tool || null }); else Object.assign(S, { money: 100, bag: [], chest: [], tier: 0, tool: null }); } catch { /* */ }
  S.tier = Math.max(0, Math.min(HOUSES.length - 1, S.tier | 0)); fit(S.bag, BAG_N); fit(S.chest, HOUSES[S.tier].chest); S.mag = {};
  buildHouse(false); changed(); dirty = false;
}
const flush = () => { if (!dirty) return; dirty = false; if (typeof srvOn === 'function' && srvOn()) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money: S.money, bag: S.bag, chest: S.chest, tier: S.tier, tool: S.tool, plot: S.plot })); } catch { /* 저장 공간 없음 */ } if (onSaved) onSaved(); };
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
function gain(id, n = 1) { const left = put(S.bag, id, n), got = n - left; if (got) toast(`+${got} ${id}`, id); if (left) toast('가방이 가득 찼어요', '가방'); changed(); return got; }
function refreshHud() { $('moneyN').textContent = S.money.toLocaleString(); $('toolIc').style.backgroundImage = S.tool ? ic(S.tool) : ic('손'); }

// 손에 든 도구 (모델은 시작할 때 붙임)
const held = {};
function setHeld() { for (const t of TOOLS) if (held[t]) held[t].visible = S.tool === t; }
function cycleTool() {
  const opts = [null, ...[...TOOLS, ...GUNS].filter((t) => count(t))]; // 총도 손에 들 수 있음
  if (opts.length === 1) { toast('도구가 없어요 — 상점에서 살 수 있어요', '손'); return; }
  const nextTool = opts[(opts.indexOf(S.tool) + 1) % opts.length];
  if (srvOn()) { netSend({ t: 'equip', tool: nextTool }); toast(nextTool ? `${nextTool}를 들었어요` : '맨손이에요', nextTool || '손'); return; }
  S.tool = nextTool; toast(S.tool ? `${S.tool}를 들었어요` : '맨손이에요', S.tool || '손'); changed();
}

// 채집 대상 숨기기 · 되살리기 · 흔들기
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hideRec(r) { r.im.setMatrixAt(r.i, ZERO); r.im.instanceMatrix.needsUpdate = true; if (r.circle) r.circle.off = true; }
function showRec(r) { r.im.setMatrixAt(r.i, r.m); r.im.instanceMatrix.needsUpdate = true; if (r.circle) r.circle.off = false; }
const wobbles = new Map(), WM = new THREE.Matrix4(), WR = new THREE.Matrix4();
const wobAmp = new Map(), wobble = (r, amp = WOB_AMP) => { wobbles.set(r, 0.6); wobAmp.set(r, amp); };

// 앞에 있는 것 찾기
let target = null, tgtT = 0;
function findTarget() {
  const fx = me.x + Math.sin(me.face) * 0.6, fz = me.z + Math.cos(me.face) * 0.6;
  let best = null, bd = 1e9;
  const see = (type, rec, x, z, reach, bonus = 0) => { const d = Math.hypot(x - fx, z - fz); if (d < reach && d - bonus < bd) { bd = d - bonus; best = { type, rec, x, z }; } }; // bonus: 가까운 꽃보다 먼저 잡을 것(싸움 상대 · 자루)
  if (houseBox) { const b = houseBox, cx = Math.max(b.x0, Math.min(b.x1, me.x)), cz = Math.max(b.z0, Math.min(b.z1, me.z)); if (Math.hypot(me.x - cx, me.z - cz) < 1.3) { bd = 0.5; best = { type: 'house', x: cx, z: cz }; } }
  see('shop', null, SHOP_AT.x, SHOP_AT.z, 2.0);
  see('chest', null, CHEST_AT.x, CHEST_AT.z, 1.7);
  for (const r of FLOWERS) if (!r.down) see('flower', r, r.x, r.z, 0.9);
  for (const r of BUSHES) see('bush', r, r.x, r.z, 1.3);
  for (const r of TREES) if (!r.down) see('tree', r, r.x, r.z, 1.35);
  for (const r of ROCKS) if (!r.down) see('rock', r, r.x, r.z, 0.95 + r.circle.r);
  fightTargets(see); // 다른 수달(때리기) · 자루(줍기) — fight.js
  return best;
}
const labelOf = (t) => !t ? '줍기/쓰기' : { shop: '가게 열기', chest: '보관함', house: '집 올리기', flower: '꽃 꺾기', bush: '풀 뜯기', otter: S.tool === '도끼' ? '도끼로 치기' : '때리기', sack: '자루 줍기' }[t.type]
  || (t.type === 'tree' ? (S.tool === '도끼' ? '나무 베기' : '나무 흔들기') : S.tool === '곡괭이' ? '돌 캐기' : '곡괭이 필요');

let actCool = 0;
function doAction() {
  if (!winEl.hidden || actCool > 0 || me.dead) return;
  const t = target = findTarget();
  if (!t) { toast('가까이에 할 수 있는 것이 없어요'); return; }
  actCool = 0.4; me.face = Math.atan2(t.x - me.x, t.z - me.z);
  const r = t.rec;
  if (t.type === 'shop') return openWin('shop');
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
    if (t.type === 'tree') wobble(r, S.tool === '도끼' ? WOB_AMP : SHAKE_AMP); else if (t.type === 'bush') wobble(r);
    netSend({ t: 'act', k: r.key }); return;
  }
  if (t.type === 'flower') { r.down = clock + REGEN_LOCAL.F; hideRec(r); netRes(r); gain('꽃'); }
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
    for (const r of [...TREES, ...ROCKS, ...FLOWERS]) if (r.down && clock > r.down && Math.hypot(r.x - me.x, r.z - me.z) > 3 && ![...net.others.values()].some((o) => Math.hypot(r.x - o.x, r.z - o.z) < 3)) { r.down = 0; showRec(r); } // 누가 서 있으면 다시 자라지 않음
  }
  if ((tgtT -= dt) <= 0) {
    tgtT = 0.12; target = winEl.hidden ? findTarget() : null;
    const L = labelOf(target); if ($('actTxt').textContent !== L) $('actTxt').textContent = L; $('actBtn').classList.toggle('off', !target);
  }
  if (npc) animOtter(npc, 0, 0, false, clock + 3);
}

// 창
let view = null, sel = -1, tab = 'sell', trashArm = 0;
function openWin(v) { view = v; sel = -1; trashArm = 0; winEl.hidden = false; document.body.classList.add('winopen'); toastsEl.textContent = ''; $('winMsg').textContent = ''; hideHint(); render(); }
function closeWin() { winEl.hidden = true; view = null; document.body.classList.remove('winopen'); }
$('winX').onclick = closeWin;
winEl.addEventListener('pointerdown', (e) => { if (e.target === winEl) closeWin(); });
const slotsHtml = (box, kind) => box.map((s, i) => `<button type="button" class="slot${kind === 'bag' && sel === i ? ' sel' : ''}${s && s.id === S.tool ? ' hold' : ''}" data-box="${kind}" data-i="${i}">${s ? `<i class="ic" style="background-image:${ic(s.id)}"></i>${ITEMS[s.id].tool ? '' : `<b>${s.n}</b>`}` : ''}</button>`).join('');
const price = (n) => `<span class="pr"><i class="ic"></i>${n.toLocaleString()}</span>`;
function render() {
  frameEl.classList.toggle('wide', view === 'chest');
  const H = HOUSES[S.tier];
  const [title, tic] = { bag: ['가방', '가방'], shop: ['수달 상점', '조개'], house: ['집 올리기', H.model], chest: ['보관함', H.model] }[view];
  $('winTitle').textContent = title; $('winIc').style.backgroundImage = ic(tic);
  let h = '';
  if (view === 'bag') {
    const s = S.bag[sel];
    h = `<div class="grid">${slotsHtml(S.bag, 'bag')}</div><div class="foot"><button type="button" class="bbtn" id="trash" ${s ? '' : 'disabled'}><i class="ic" style="background-image:${ic('쓰레기통')}"></i>${trashArm ? '한 번 더 누르면 버려요' : '버리기'}</button></div>`;
  } else if (view === 'shop') {
    h = `<div class="tabs"><button type="button" class="tab${tab === 'sell' ? ' on' : ''}" data-tab="sell">팔기</button><button type="button" class="tab${tab === 'buy' ? ' on' : ''}" data-tab="buy">사기</button></div>`;
    if (tab === 'sell') {
      const list = SELLABLE.filter((id) => count(id));
      // 건축 재료(나무 · 돌)는 수량을 골라 따로 판다 · 나머지는 줄마다 전부 팔기 + 탭 바로 아래 「재료 빼고 모두 팔기」 (2026-11-17 문파원 불만 · 가로 휴대폰에서 안 내려도 보이게 위로)
      const bulk = SELLABLE.filter((id) => !MATERIALS.includes(id)).reduce((n, id) => n + count(id) * ITEMS[id].sell, 0);
      if (list.length) h += `<div class="foot bulk"><button type="button" class="bbtn" id="sellAll" ${bulk ? '' : 'disabled'}>재료 빼고 모두 팔기 +${bulk.toLocaleString()}</button></div>`;
      h += list.length ? list.map((id) => {
        if (!MATERIALS.includes(id)) return `<div class="row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}<small>×${count(id)}</small></span>${price(ITEMS[id].sell)}<button type="button" class="bbtn" data-sell="${id}">팔기</button></div>`;
        const q = Math.max(1, Math.min(count(id), sellQty[id] || 1)); sellQty[id] = q;
        return `<div class="row mat-row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}<small>×${count(id)}</small></span>${price(ITEMS[id].sell)}<div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-qty="${id}" data-d="-1" ${q <= 1 ? 'disabled' : ''}>−</button><b>${q}</b><button type="button" class="bbtn" data-qty="${id}" data-d="1" ${q >= count(id) ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" data-sellq="${id}">${q}개 팔기</button></div></div>`; // 둘째 줄에 수량 · 팔기(좁은 휴대폰에서 넘치지 않게)
      }).join('') : '<div class="empty">팔 물건이 없어요. 섬에서 모아 오세요!</div>';
    } else {
      h += buyList().map((id) => { const ammo = !!PACK[id], have = !ammo && (count(id) > 0 || S.chest.some((s) => s && s.id === id)), cost = ITEMS[id].buy; return `<div class="row"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${id}${ammo ? `<small class="pk">${PACK[id]}발 묶음</small>` : ''}</span>${price(cost)}<button type="button" class="bbtn" data-buy="${id}" ${have || S.money < cost ? 'disabled' : ''}>${have ? '있음' : '사기'}</button></div>`; }).join('');
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
  } else if (view === 'chest') {
    h = `<div class="two"><div><h4>가방 (누르면 보관함으로)</h4><div class="grid">${slotsHtml(S.bag, 'bagc')}</div></div><div><h4>보관함 ${S.chest.length}칸 (누르면 가방으로)</h4><div class="grid chestgrid">${slotsHtml(S.chest, 'chest')}</div></div></div>`;
  }
  bodyEl.innerHTML = h;
}
bodyEl.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tab) { tab = b.dataset.tab; return render(); }
  if (srvOn()) { // 서버가 정함 — 요청만 보내고 inv 로 받음
    if (b.dataset.box === 'bag') { const i = +b.dataset.i, s = S.bag[i]; sel = i; trashArm = 0; if (s && ITEMS[s.id].tool) return netSend({ t: 'equip', tool: S.tool === s.id ? null : s.id }); return render(); }
    if (b.dataset.box === 'bagc' || b.dataset.box === 'chest') return netSend({ t: 'chest', from: b.dataset.box === 'chest' ? 'chest' : 'bag', i: +b.dataset.i });
    if (b.id === 'trash') { if (!trashArm) { trashArm = 1; render(); setTimeout(() => { if (trashArm && view === 'bag') { trashArm = 0; render(); } }, 2500); return; } trashArm = 0; return netSend({ t: 'trash', i: sel }); }
    if (b.dataset.sell) return netSend({ t: 'sell', id: b.dataset.sell, n: count(b.dataset.sell) });
    if (b.dataset.sellq) { const id = b.dataset.sellq, n = Math.min(count(id), sellQty[id] || 1); sellQty[id] = 1; return netSend({ t: 'sell', id, n }); }
    if (b.id === 'sellAll') return netSend({ t: 'sellall' });
    if (b.dataset.buy) return netSend({ t: 'buy', id: b.dataset.buy });
    if (b.id === 'upBtn') return netSend({ t: 'up' });
  }
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
  if (b.dataset.buy) { const id = b.dataset.buy, cost = ITEMS[id].buy; if (S.money < cost) return; if (put(S.bag, id, 1)) return toast('가방이 가득 찼어요', '가방'); S.money -= cost; S.tool = id; toast(`${id}를 샀어요! 손에 들었어요`, id); return changed(); }
  if (b.id === 'upBtn') {
    const N = HOUSES[S.tier + 1]; if (!N) return;
    for (const [k, v] of Object.entries(N.cost)) if ((k === '조개' ? S.money : count(k)) < v) return;
    for (const [k, v] of Object.entries(N.cost)) { if (k === '조개') S.money -= v; else take(k, v); }
    S.tier++; fit(S.chest, N.chest); buildHouse(); netSend({ t: 'tier', tier: S.tier }); toast(`${N.name}으로 올렸어요! 보관함 ${N.chest}칸`, N.model); return changed();
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
  return { obj, box, chest, circle };
}
function removeHouseSet(h) { scene.remove(h.obj); scene.remove(h.chest); boxes.splice(boxes.indexOf(h.box), 1); circles.splice(circles.indexOf(h.circle), 1); }
function buildHouse(goHome = false) {
  if (mySet) removeHouseSet(mySet);
  HOUSE_AT = PLOTS[S.plot]; CHEST_AT = { x: HOUSE_AT.x + 3.6, z: HOUSE_AT.z + 3.4 };
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
