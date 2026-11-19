// 수달섬 — 여럿이 함께(섬 방 연결) (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 여럿이 함께 (2026-11-17) — 홈페이지에서 로그인했으면 섬 방(워커 SudalterIsland)에 붙는다 ─────────
// ?net= 은 이 PC 시험(localhost)에서만 — 실서버에서 받아 주면 꾸민 링크로 로그인 열쇠가 남의 서버로 갈 수 있음(2026-11-17 점검 때 막음)
const NET_URL = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('net')) || 'wss://byeongmu.byeongmu-munpa.workers.dev/suseom';
const net = { ws: null, on: false, server: false, id: 0, name: '', others: new Map(), houses: new Map(), tries: 0, sendT: 0, last: '', ac: 0 };
let keepPos = false; // 새 판으로 다시 열려 있던 자리를 지킬 때 true
// 말 판(서버 config.proto 와 같게) — 서버가 새 판이면 옛 화면으로 사고팔기 · 도구가 어긋나므로 바로 새로 연다(작업지시서 3 A1).
// 시험(localhost)에서만 ?proto= 로 일부러 다르게 해 볼 수 있음
const PROTO = (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && +new URLSearchParams(location.search).get('proto')) || 10;
function reloadForServer() {
  // 30초 안에 또 새로 열었으면(화면 파일이 아직 안 올라옴) 다시 열지 않고 30초 뒤에 한 번 더
  let last = 0;
  try { last = +sessionStorage.getItem('suseom-proto-reload') || 0; } catch { /* 저장소 막힘 */ }
  if (Date.now() - last < 30000) { netStatus('새 판을 받는 중…'); setTimeout(reloadForServer, 30000 - (Date.now() - last)); return; }
  try {
    sessionStorage.setItem('suseom-proto-reload', String(Date.now()));
    sessionStorage.setItem('suseom-pos', JSON.stringify({ x: me.x, z: me.z, f: me.face, t: Date.now(), v: MAP_V }));
  } catch { /* 저장소 막힘 */ }
  net.protoReload = true;
  const q = new URLSearchParams(location.search); q.set('v', String(Date.now())); location.replace(location.pathname + '?' + q);
}
const srvOn = () => net.on && net.server; // 수달섬 서버(가방 · 채집 · 싸움을 서버가 정함)에 붙어 있음
const KEYED = new Map();
for (const [list, p] of [[TREES, 'T'], [ROCKS, 'R'], [FLOWERS, 'F'], [BUSHES, 'B'], [BERRIES, 'E'], [FISH_SPOTS, 'P']]) list.forEach((r, i) => { r.key = p + i; KEYED.set(r.key, r); });
const netSend = (o) => { if (net.on && net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify(o)); };
const netRes = (r) => { if (r.key) netSend({ t: 'res', k: r.key }); }; // 다시 자라는 시간은 워커(REGEN · 접속 인원)가 정해 돌려줌
// 살림(가방 · 조개 · 보관함 · 집 단계) 서버 저장 — 2026-11-17. 들어올 때 서버 것을 쓰고(다른 기기에서도 같게),
// 끊겨 있는 동안 바뀐 게 있으면(netPending) 그때는 이 기기 것을 올린다
let netPending = false;
onSaved = () => { if (net.server) return; if (net.on) netSend({ t: 'save', inv: { money: S.money, bag: S.bag, chest: S.chest, tier: S.tier, tool: S.tool } }); else netPending = true; };
function adoptInv(inv) {
  S.mag = inv.mag || {}; S.money = inv.money; S.tier = Math.max(0, Math.min(3, inv.tier | 0)); S.tool = inv.tool || null;
  S.extra = inv.extra | 0; S.bag = fit(inv.bag.slice(), BAG_N); S.chest = inv.chest.slice(); // 보관함 칸은 서버가 정함(늘리기 포함)
  if (Number.isFinite(inv.hp)) setMyHp(inv.hp);
  if (!mySet || mySet.tier !== S.tier) buildHouse(false); // 단계가 바뀐 때만 다시 지음
  changed();
}
function netStatus(text, on) { const el = $('net'); el.querySelector('span').textContent = text; el.classList.toggle('on', !!on); }
const countNow = () => netStatus(`함께 ${net.others.size + 1}명`, true);
// full: 다시 자라는 전체 시간(나무 단계 계산) · gone: 삽으로 파냄(작업지시서 3 E · grow.js)
function applyRes(k, left, full, gone) {
  const r = KEYED.get(k); if (!r) return;
  if (gone) { wobbles.delete(r); hideRec(r); growApply(r, 0, true); return; }
  if (!(left > 0)) return;
  if (r.gone) r.gone = false;
  r.down = clock + left; if (r.wood != null) r.wood = 3; if (r.stone != null) r.stone = 3; wobbles.delete(r); hideRec(r); growApply(r, full);
}
const hashName = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const lookOf = (name) => lookFromName(name); // 문파원마다 모자 3종 × 8색(새 수달 · 2026-11-18)
function addOther(p) {
  removeOther(net.others.get(p.id));
  const obj = makeOtter(lookOf(p.name)); applyOutfit(obj, p.w); obj.position.set(p.x, groundY(p.x, p.z), p.z); obj.rotation.y = p.f; scene.add(obj);
  const tools = {}; for (const t of TOOLS) { tools[t] = heldModel(srcs[t], t); obj.userData.hold.add(tools[t]); tools[t].visible = p.tl === t; }
  const label = document.createElement('div'); label.className = 'tag'; label.textContent = p.name; document.body.appendChild(label);
  net.others.set(p.id, { ...p, tx: p.x, tz: p.z, tf: p.f, s: 0, r: 0, phase: 0, actT: 0, sw: 0, ac: 0, obj, tools, label });
}
function removeOther(o) { if (!o) return; scene.remove(o.obj); o.label.remove(); net.others.delete(o.id); }
function setHouse(name, x, z, tier) { // 남의 집(B단계: 텐트를 친 자리 x · z)
  if (name === net.name || !Number.isFinite(x) || !Number.isFinite(z)) return;
  const old = net.houses.get(name);
  if (old) { if (old.tier === tier && old.x === x && old.z === z) return; removeHouseSet(old); }
  net.houses.set(name, { x, z, tier, ...placeHouseSet({ x, z }, Math.max(0, Math.min(3, tier | 0))) });
  nudgeFree(); // 내 자리 위에 남의 집이 생기면 옆으로 비킴
}
function onNet(m) {
  if (m.t === 'welcome') {
    // 서버 말 판이 이 화면과 다르면(서버만 먼저 새 판) 바로 새로 열기
    if (m.proto && m.proto !== PROTO) { net.protoMismatch = m.proto; try { net.ws.close(); } catch { /* */ } reloadForServer(); return; }
    me.obj.userData.setLook(lookOf(m.name)); // 내 모자 · 가방도 이름으로
    // 운영자면 「운영자」 단추(작업지시서 4 B6 — 서버가 회원 기록으로 정한 값 · 만들기도 서버가 다시 확인)
    if (typeof opShow === 'function') opShow(!!m.op);
    // 만드는 법(작업지시서 4 C) — 서버 config.craft 그대로
    if (m.craft && typeof onNetCraft === 'function') onNetCraft({ t: 'craftdef', ...m.craft });
    // 입은 옷(작업지시서 3 F) — 서버 옷장 · 입은 것
    adoptClothes(m.inv);
    if (fishing.st) endFish();
    net.on = true; net.tries = 0; net.id = m.id; net.name = m.name;
    for (const o of [...net.others.values()]) removeOther(o);
    for (const p of m.players) addOther(p);
    for (const h of [...net.houses.values()]) removeHouseSet(h); net.houses.clear(); // 다시 붙을 때 옛 집이 남지 않게
    for (const h of m.houses) { setHouse(h.name, h.x, h.z, h.tier); applyHouseState(h.name, h); }
    clearTraps(); for (const t of m.traps || []) addTrap(t); // 함정(8단계)
    // 바닥 물건(작업지시서 3 B)
    clearGround(); for (const g of m.ground || []) setGround(g);
    // 수달끼리 겹치지 않기 숫자(서버 config.body · 작업지시서 3 C)
    if (m.body) BODY = { ...BODY, ...m.body };
    // 다시 붙으면 번호가 바뀌므로 말풍선을 지우고, 하던 교환은 서버가 이미 취소함
    clearChat();
    if (TRADE) { TRADE = null; if (view === 'trade') closeWin(); }
    if (m.myHouse) HSTATE.set(m.name, { hp: m.myHouse.hp, max: m.myHouse.max, broken: m.myHouse.broken });
    // 자연(작업지시서 3 E): 심은 나무 · 파낸 나무 · 그림자를 먼저, 그다음 자라는 중인 것들
    growWelcome(m);
    for (const [k, left] of Object.entries(m.res || {})) applyRes(k, left, (m.full || {})[k]);
    net.server = !!m.server; if (net.server) { me.x = m.x; me.z = m.z; me.speed = 0; fightWelcome(m); } // 자리는 서버가 정함(마지막 자리 10분 안 · 아니면 집 앞)
    if (m.inv && (net.server || !netPending)) adoptInv(m.inv); else { dirty = true; flush(); } // 서버에 없거나(처음) 끊긴 동안 바뀌었으면 이 기기 것을 올림
    netPending = false;
    if (net.server) { for (const [b, s] of Object.entries(m.buffs || {})) BUFF[b] = clock + s; MARKET = m.market || null; DECAY_H = m.decayH || 0; S.homeAt = m.homeAt || null; S.home = m.home ? { x: m.home.x, z: m.home.z } : null; buildHouse(false); if (!S.home) setTimeout(() => { if (net.on && !S.home) toast('텐트 자판기에서 텐트를 사서 원하는 곳에 치면 내 집이 돼요', '텐트'); }, 2500); } // 집은 텐트를 친 자리(B단계)
    countNow(); toast(`${m.name} 님, 수달섬에 오신 걸 환영해요!`);
  } else if (m.t === 'join') { addOther(m); { const o = net.others.get(m.id); if (o && net.server) { o.hp = m.hp; o.alive = m.alive; updateTagHp(o); if (m.alive === false) layDown(o.obj, true); } } countNow(); toast(`${m.name} 님이 들어왔어요`); }
  else if (m.t === 'leave') { const fo = fishOf.get(m.id); if (fo) { dropBob(fo.bob); fishOf.delete(m.id); } const o = net.others.get(m.id); if (o) { toast(`${o.name} 님이 나갔어요`); removeOther(o); } countNow(); }
  else if (m.t === 'mv') {
    const o = net.others.get(m.id); if (!o) return;
    Object.assign(o, { tx: m.x, tz: m.z, tf: m.f, s: m.s, r: m.r });
    if (Number.isFinite(m.hp) && m.hp !== o.hp && o.alive !== false) { o.hp = m.hp; if (typeof updateTagHp === 'function') updateTagHp(o); } // 먼 곳에서 맞은 체력도 맞춤(리뷰 4번)
    if (m.ac !== o.ac) {
      o.ac = m.ac; o.actT = o.actDur = ACT_T; o.sw = m.an === 'punchl' || m.an === 'punchr' ? m.an : m.sw; o.fit = null;
      const tr = m.an === 'shake' && KEYED.get(m.tk);
      if (tr && TRUNK[tr.kind] && !tr.down) { o.sw = 'shake'; o.actT = o.actDur = SHAKE_T; o.fit = shakeFit(tr, m.x, m.z); wobble(tr, SHAKE_AMP); } // 같은 나무를 같은 박자로 흔듦
    }
    if (o.tl !== m.tl) { o.tl = m.tl; for (const t of TOOLS) o.tools[t].visible = m.tl === t; }
  } else if (m.t === 'res') {
    applyRes(m.k, m.left, m.full, m.gone);
    // 나무는 그루터기가 남고 새싹부터 다시 자람(작업지시서 3 E) · 파냈으면 알림만
    if (m.gone && m.by === net.id) toast('그루터기를 파냈어요 — 빈 땅이 됐어요', '삽');
    const RES_MSG = { T: '나무가 쓰러졌어요 — 그루터기에서 새싹이 다시 자라요', N: '나무가 쓰러졌어요 — 그루터기에서 새싹이 다시 자라요', R: '바위를 다 캤어요 — N초 뒤 다시 생겨요' };
    if (m.gone) return;
    if (m.by === net.id && RES_MSG[m.k[0]]) toast(RES_MSG[m.k[0]].replace('N', Math.round(m.left))); // 내가 없앤 것 — 워커가 정한 시간으로 알림
  }
  else if (m.t === 'house') { setHouse(m.name, m.x, m.z, m.tier); if (m.hp != null) applyHouseState(m.name, m); }
  else if (m.t === 'homegone') { const h = net.houses.get(m.name); if (h) { removeHouseSet(h); net.houses.delete(m.name); } } // 이사 가서 빈 자리
  else if (m.t === 'home') { // 내 텐트를 쳤거나(x · z) 접었음(x 없음)
    S.home = m.x == null ? null : { x: m.x, z: m.z }; S.homeAt = m.at || S.homeAt; if (m.decayH) DECAY_H = m.decayH; buildHouse(false); if (S.home) { applyHouseState(net.name, m); toast('텐트를 쳤어요! 여기가 내 집이에요', '텐트'); } else if (view === 'house') closeWin();
  }
  else if (m.t === 'err') netStatus('혼자 놀기 · ' + m.msg);
  else if (m.t === 'look') onNetLook(m);
  else if (m.t === 'inv') { adoptInv(m.inv); adoptClothes(m.inv); aim.reloading = 0; refreshGunHud(); } // 장전이 끝나면 inv 가 옴
  else if (m.t === 'gd' || m.t === 'gdel') onNetGround(m);
  // 채팅 · 교환(작업지시서 3 D) — chat.js · trade.js
  else if (m.t === 'say') onNetSay(m);
  // 자연(작업지시서 3 E) — grow.js
  else if (m.t === 'plant' || m.t === 'shd' || m.t === 'sit' || m.t === 'digging') onNetGrow(m);
  // 제작대 일감 · 올가미덫(작업지시서 4 C · craft.js)
  else if ((m.t === 'craft' || m.t === 'stun') && typeof onNetCraft === 'function') onNetCraft(m);
  else if (m.t === 'trade') onNetTrade(m);
  else if (m.t === 'market') { MARKET = m.f; if (view === 'shop' && !winEl.hidden) render(); } // 물고기 시세(D단계)
  else if (m.t === 'buff') (BUFF[m.b] = clock + m.secs), toast(`${{ fast: '빠르게', tough: '덜 다침', warm: '모닥불 회복 2배', quick: '채집 빨리' }[m.b] || m.b} ${m.secs}초`, '열매');
  else onNetFight(m); // got · msg · hp · died · respawn · sack · sackgone · fix (fight.js)
}
function connect() {
  let token = ''; try { token = localStorage.getItem('bmc-token') || ''; } catch { /* 저장소 막힘 */ }
  if (!token) { netStatus('혼자 놀기 · 홈페이지에서 로그인하면 함께'); return; }
  netStatus('섬에 붙는 중…');
  let ws; try { ws = new WebSocket(NET_URL); } catch { netStatus('혼자 놀기 · 섬에 못 붙음'); return; }
  net.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hi', token, x: me.x, z: me.z, f: me.face, tl: S.tool, tier: S.tier, keep: keepPos }));
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'mvs') { for (const x of m.l || []) onNet(x); for (const x of m.s || []) onNet(x); return; } onNet(m); }; // mvs: 서버가 0.1초마다 묶어 보낸 움직임 · 총알(9단계)
  ws.onclose = (e) => {
    if (net.ws !== ws) return;
    net.on = false; for (const o of [...net.others.values()]) removeOther(o);
    if (net.server) { net.server = false; me.dead = false; layDown(me.obj, false); hpBox.hidden = true; for (const id of [...sacks.keys()]) removeSack(id); closeWin(); loadLocal(); clearTraps(); clearGround(); } // 끊기면 누운 채 멈추지 않게(리뷰 9번) · 열린 창을 닫고 혼자 놀기 가방으로(3단계 리뷰 3 · 4번)
    if (e.code === 4001) return netStatus('혼자 놀기 · 홈페이지에서 다시 로그인해 주세요');
    if (e.code === 4002) return netStatus('다른 창에서 들어와서 이 창은 혼자 놀기');
    // 서버 판이 달라 새로 여는 중이면 다시 붙지 않음
    if (net.protoMismatch) return;
    // 끊겼다면 서버가 새 판일 수 있으니 화면 판도 바로 확인(1분 기다리지 않음)
    if (typeof checkGame === 'function') checkGame();
    netStatus('다시 붙는 중…'); setTimeout(connect, Math.min(30000, 2000 * 2 ** Math.min(4, net.tries++)));
  };
}
const TAGV = new THREE.Vector3(), TAG_Y = 1.32; // 이름표 높이(머리 위 · 모자 없음)
const myTag = document.createElement('div'); myTag.className = 'tag me'; myTag.id = 'myTag'; document.body.appendChild(myTag);
function myTagTick() { // 내 머리 위 이름표(로그인하면 이름 · 혼자 놀기면 「나」)
  const t = net.name || '나'; if (myTag.textContent !== t) myTag.textContent = t;
  TAGV.set(me.x, groundY(me.x, me.z) + TAG_Y, me.z).project(camera); const vis = TAGV.z < 1 && Math.abs(TAGV.x) < 1.1 && Math.abs(TAGV.y) < 1.1; myTag.style.display = vis ? '' : 'none';
  if (vis) myTag.style.transform = `translate(${((TAGV.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - TAGV.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
}
function netTick(dt) {
  fightTick(); gunTick(dt); lookTick(dt); fishTick(dt); houseTick(dt); myTagTick();
  if (net.on && (net.sendT -= dt) <= 0) { // 움직일 때만 1초에 6번
    const st = `${me.x.toFixed(2)},${me.z.toFixed(2)},${me.face.toFixed(2)},${S.tool},${net.ac}`;
    if (st !== net.last) { net.sendT = 1 / 6; net.last = st; netSend({ t: 'mv', x: +me.x.toFixed(2), z: +me.z.toFixed(2), f: +me.face.toFixed(2), s: +me.speed.toFixed(2), r: me.run ? 1 : 0, ac: net.ac, sw: me.actSwing ? 1 : 0, an: typeof me.actSwing === 'string' ? me.actSwing : me.actSwing ? 'swing' : 'pick', tk: me.actTree, tl: S.tool }); } // an: 동작 이름 · tk: 흔든 나무
  }
  const k = Math.min(1, dt * 8);
  for (const o of net.others.values()) {
    o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k;
    let d = o.tf - o.f; d = Math.atan2(Math.sin(d), Math.cos(d)); o.f += d * k;
    if (Math.hypot(o.tx - o.x, o.tz - o.z) < 0.03) o.s *= 1 - Math.min(1, dt * 6); // 멈추면 걸음도 멈춤
    o.phase += dt * o.s * (o.r ? 2.2 : 2.9); o.actT -= dt;
    const y = groundY(o.x, o.z); o.obj.position.set(o.x, y + (o.alive === false ? 0.22 : 0), o.z); o.obj.rotation.y = o.f;
    const farO = Math.hypot(o.x - me.x, o.z - me.z) > 38; o.obj.visible = !farO; // 먼 수달은 안 그림(50명 대비 · 9단계 · 서버 45칸 안쪽 동그라미) — 이름표 · 움직임 계산도 건너뜀(미니맵 점은 그대로)
    if (farO) { o.label.style.display = 'none'; continue; }
    animOtter(o.obj, o.phase, Math.min(1, o.s / WALK), !!o.r, clock + o.id, o.actT > 0 ? 1 - o.actT / (o.actDur || ACT_T) : -1, typeof o.sw === 'string' ? o.sw : !!o.sw, o.fit);
    gunPose(o.obj, o.tl); // 총을 들었으면 겨누는 팔
    fishPose(o.obj, fishOf.has(o.id)); // 낚시 중이면 낚싯대를 앞으로
    TAGV.set(o.x, y + TAG_Y, o.z).project(camera);
    const vis = TAGV.z < 1 && Math.abs(TAGV.x) < 1.1 && Math.abs(TAGV.y) < 1.1;
    o.label.style.display = vis ? '' : 'none';
    if (vis) o.label.style.transform = `translate(${((TAGV.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - TAGV.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
// 손에 든 도구 쥐는 법(작업지시서 3 A3) — s: 길이(칸) · grip: 손잡이 끝에서 쥐는 자리(길이 비율) · rx: 손 기준 기울기
// (π = 팔 따라 바로 아래 · π/2 = 앞). 도끼 · 곡괭이는 손잡이 끝을 쥐고 머리(날)가 앞 아래로 — 휘두르면 팔과 함께 위에서 아래로.
// 낚싯대는 앞 위로. 예전(길이 0.5 · 앞으로 눕힘)은 게임 카메라에서 안 보여 1.5배 넘게 키움
const HOLD = { 도끼: { s: 0.82, grip: 0.18, rx: Math.PI - 0.95 }, 곡괭이: { s: 0.82, grip: 0.18, rx: Math.PI - 0.95 }, 낚싯대: { s: 0.95, grip: 0.12, rx: 0.85 } };
function heldModel(src, tool) {
  // 등급 도구(작업지시서 4 C)는 낡은 것의 모형 · 쥐는 법을 쓰고 craft.js 가 색 · 크기를 바꿈
  const base = kindOfC(tool), H = HOLD[tool] || HOLD[base] || { s: 0.5, grip: 0.2, rx: Math.PI / 2 };
  src = src || srcs[base];
  const o = src.clone(true), b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), k = H.s / Math.max(sz.x, sz.y, sz.z);
  const inner = new THREE.Group(); inner.add(o); o.position.set(-(b.min.x + sz.x / 2), -b.min.y - sz.y * H.grip, -(b.min.z + sz.z / 2)); inner.scale.setScalar(k);
  const g = new THREE.Group(); g.add(inner); g.rotation.x = H.rx; g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  if (typeof gradeLook === 'function') gradeLook(g, tool);
  return g;
}
