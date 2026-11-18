// 수달섬 — 교환(작업지시서 3 D · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 가까운 수달을 누름 → 「교환 신청」 → 상대가 수락 → 양쪽이 물건 · 조개를 올림 → 둘 다 확인하면 서버가 한 번에 바꿈.
// 확인한 뒤 상대가 올린 것을 바꾸면 확인이 풀림 · 멀어지거나 맞으면 취소 · 거절당하면 같은 사람에게 30초 못 검 — 모두 서버가 정함.
// 화면은 고른 것을 보내고 서버가 보낸 상태(state)를 그릴 뿐.
let TRADE = null;
let tradeSel = -1, tradeQty = 1, tradeMoney = 0, askFrom = null, offerTo = null;

// 받은 신청 · 거는 신청 띠(화면 위 가운데 · body 에 고정)
const askEl = document.createElement('div'); askEl.id = 'tradeAsk'; askEl.className = 'trade-bar'; askEl.hidden = true;
askEl.innerHTML = '<span></span><button type="button" class="gbtn" data-ans="1">수락</button><button type="button" class="bbtn" data-ans="0">거절</button>';
document.body.appendChild(askEl);
const offerEl = document.createElement('div'); offerEl.id = 'tradeOffer'; offerEl.className = 'trade-bar'; offerEl.hidden = true;
offerEl.innerHTML = '<span></span><button type="button" class="gbtn" data-go="1">교환 신청</button><button type="button" class="bbtn" data-go="0">닫기</button>';
document.body.appendChild(offerEl);
askEl.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !askFrom) return;
  netSend({ t: 'trade', op: 'answer', id: askFrom.id, yes: b.dataset.ans === '1' }); askFrom = null; askEl.hidden = true;
});
offerEl.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.go === '1' && offerTo) { netSend({ t: 'trade', op: 'ask', id: offerTo.id }); toast(`${offerTo.name} 님에게 교환을 신청했어요`); }
  offerTo = null; offerEl.hidden = true;
});

// 가까운 수달 누르기(짧게 누름 · 거의 안 움직임) — 손가락은 터치, 마우스는 포인터
let tapAt = null;
cv.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; tapAt = { x: t.clientX, y: t.clientY, t: performance.now() }; }, { passive: true });
cv.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; if (tapAt && Math.hypot(t.clientX - tapAt.x, t.clientY - tapAt.y) < 12 && performance.now() - tapAt.t < 400) tapOtter(t.clientX, t.clientY); tapAt = null; }, { passive: true });
cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') tapAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
// 손가락으로 누르면 pointerup 이 touchend 보다 먼저 오므로, 마우스일 때만 여기서 처리 · 지움(손가락 기록을 지우면 안 됨)
cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') return; if (tapAt && Math.hypot(e.clientX - tapAt.x, e.clientY - tapAt.y) < 6) tapOtter(e.clientX, e.clientY); tapAt = null; });
const TAPV = new THREE.Vector3();
// 누른 자리에서 48px 안 · 4칸 안의 수달 중 가장 가까운 것
function tapOtter(x, y) {
  // 총을 들었으면 누르기 = 쏘기(싸우다 교환 띠가 뜨지 않게 — 리뷰 2026-11-18)
  if (!srvOn() || me.dead || TRADE || !winEl.hidden || GUNS.includes(S.tool)) return null;
  let best = null, bd = 48;
  for (const o of net.others.values()) {
    if (o.alive === false || !o.obj.visible || Math.hypot(o.x - me.x, o.z - me.z) > 4) continue;
    TAPV.set(o.x, groundY(o.x, o.z) + 0.6, o.z).project(camera);
    const d = Math.hypot((TAPV.x + 1) / 2 * innerWidth - x, (1 - TAPV.y) / 2 * innerHeight - y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return null;
  offerTo = { id: best.id, name: best.name };
  offerEl.querySelector('span').textContent = `${best.name} 님과 교환할까요?`; offerEl.hidden = false;
  const me0 = offerTo; setTimeout(() => { if (offerTo === me0) { offerTo = null; offerEl.hidden = true; } }, 6000);
  return best;
}

// 서버 말: asked · no · open · state · done · closed
function onNetTrade(m) {
  if (m.op === 'asked') {
    askFrom = { id: m.from, name: m.name }; askEl.querySelector('span').textContent = `${m.name} 님이 교환을 신청했어요`; askEl.hidden = false;
    const a0 = askFrom; setTimeout(() => { if (askFrom === a0) { askFrom = null; askEl.hidden = true; } }, (m.secs || 20) * 1000);
  } else if (m.op === 'no') toast(`${m.name} 님이 교환을 거절했어요`);
  else if (m.op === 'open') {
    TRADE = { with: m.with, name: m.name, mine: { items: [], money: 0 }, theirs: { items: [], money: 0 }, okMine: false, okTheirs: false };
    tradeSel = -1; tradeMoney = 0; offerEl.hidden = true; askEl.hidden = true; if (!chatBox.hidden) chatClose(); openWin('trade');
  } else if (m.op === 'state' && TRADE) {
    Object.assign(TRADE, { mine: m.mine, theirs: m.theirs, okMine: !!m.okMine, okTheirs: !!m.okTheirs });
    if (view === 'trade') render();
  } else if (m.op === 'done' || m.op === 'closed') {
    const was = TRADE; TRADE = null;
    if (view === 'trade') closeWin();
    if (was || m.op === 'done') toast(m.op === 'done' ? '교환했어요!' : m.why || '교환이 취소됐어요', m.op === 'done' ? '조개' : undefined);
  }
}
// 창을 닫거나 다른 창을 열면 교환 취소(life.js openWin · closeWin 이 부름)
function tradeClosed() { if (TRADE) { netSend({ t: 'trade', op: 'cancel' }); TRADE = null; } }
const sendOffer = (items, money) => netSend({ t: 'trade', op: 'offer', items: items.map((x) => [x.i, x.n]), money });

// 이름 등 남이 정한 글을 창(HTML)에 넣을 때
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tSlot = (x, kind, i) => `<button type="button" class="slot" data-box="${kind}" data-i="${i}">${x ? `<i class="ic" style="background-image:${ic(x.id)}"></i>${ITEMS[x.id] && ITEMS[x.id].tool ? '' : `<b>${x.n}</b>`}${durHtml(x)}` : ''}</button>`;
function tradeHtml() {
  const T = TRADE; if (!T) return '<div class="empty">교환이 끝났어요</div>';
  const side = (o, kind) => `<div class="grid trade-grid">${Array.from({ length: 8 }, (_, i) => tSlot(o.items[i], kind, i)).join('')}</div><div class="trade-money">${price(o.money || 0)}</div>`;
  const okTag = '<em class="trade-ok">확인</em>';
  let h = `<div class="two"><div><h4>내가 올린 것${T.okMine ? ' · ' + okTag : ''}<small>누르면 내림</small></h4>${side(T.mine, 'tmine')}</div><div><h4>${escHtml(T.name)} 님${T.okTheirs ? ' · ' + okTag : ''}</h4>${side(T.theirs, 'ttheirs')}</div></div>`;
  h += `<h4 class="trade-bag-h">가방 (눌러서 고르기)</h4><div class="grid">${S.bag.map((s, i) => tSlot(s, 'tbag', i).replace('class="slot"', `class="slot${tradeSel === i ? ' sel' : ''}"`)).join('')}</div>`;
  const s = S.bag[tradeSel];
  if (s) {
    tradeQty = Math.max(1, Math.min(s.n, tradeQty));
    h += `<div class="row mat-row"><i class="ic" style="background-image:${ic(s.id)}"></i><span class="nm">올리기<small>${s.id}</small></span><div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-tq="-1" ${tradeQty <= 1 ? 'disabled' : ''}>−</button><b>${tradeQty}</b><button type="button" class="bbtn" data-tq="1" ${tradeQty >= s.n ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" id="tradeAdd">올리기</button></div></div>`;
  }
  tradeMoney = Math.max(0, Math.min(S.money, tradeMoney));
  h += `<div class="row mat-row"><i class="ic" style="background-image:${ic('조개')}"></i><span class="nm">조개 올리기<small>가진 조개 ${S.money.toLocaleString()}</small></span><div class="mat-line"><span class="qty"><button type="button" class="bbtn" data-tm="-1" ${tradeMoney <= 0 ? 'disabled' : ''}>−</button><b>${tradeMoney.toLocaleString()}</b><button type="button" class="bbtn" data-tm="1" ${tradeMoney >= S.money ? 'disabled' : ''}>+</button></span><button type="button" class="bbtn" id="tradeMoneyBtn">올리기</button></div></div>`;
  h += `<div class="foot trade-foot"><button type="button" class="gbtn" id="tradeOk" ${T.okMine ? 'disabled' : ''}>${T.okMine ? '상대 확인 기다리는 중' : '확인'}</button><button type="button" class="bbtn" id="tradeCancel">취소</button></div>`;
  return h;
}
// 교환 창 단추(life.js 가 먼저 부름) — 처리했으면 true
function tradeClick(b) {
  const T = TRADE; if (!T) return false;
  const mine = T.mine.items.map((x) => ({ i: x.i, n: x.n }));
  if (b.dataset.box === 'tbag') { tradeSel = +b.dataset.i; const s = S.bag[tradeSel]; tradeQty = s ? s.n : 1; render(); return true; }
  if (b.dataset.box === 'tmine') { const x = T.mine.items[+b.dataset.i]; if (x) sendOffer(mine.filter((q) => q.i !== x.i), T.mine.money || 0); return true; }
  if (b.dataset.box === 'ttheirs') return true;
  if (b.dataset.tq) { const s = S.bag[tradeSel]; tradeQty = Math.max(1, Math.min(s ? s.n : 1, tradeQty + +b.dataset.tq * (tradeQty >= 10 ? 5 : 1))); render(); return true; }
  if (b.id === 'tradeAdd') { const s = S.bag[tradeSel]; if (!s) return true; const rest = mine.filter((q) => q.i !== tradeSel); if (rest.length >= 8) { toast('8칸까지 올릴 수 있어요'); return true; } sendOffer([...rest, { i: tradeSel, n: Math.min(s.n, tradeQty) }], T.mine.money || 0); tradeSel = -1; return true; }
  if (b.dataset.tm) { const st = tradeMoney >= 1000 ? 500 : tradeMoney >= 100 ? 50 : 10; tradeMoney = Math.max(0, Math.min(S.money, tradeMoney + +b.dataset.tm * st)); render(); return true; }
  if (b.id === 'tradeMoneyBtn') { sendOffer(mine, tradeMoney); return true; }
  if (b.id === 'tradeOk') { netSend({ t: 'trade', op: 'ok' }); return true; }
  if (b.id === 'tradeCancel') { tradeClosed(); closeWin(); return true; }
  return false;
}
