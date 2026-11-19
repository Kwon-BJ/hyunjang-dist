// 수달섬 — 집 내구도 · 습격 · 수리 · 습격 기록(밤샘 7단계). 깎기 · 부서짐 · 쏟아짐 · 수리는 서버가 정한다.
// 남의 집 앞에서 쓰기 → 집 치기(도끼면 더 세게). 내구도가 깎이면 집 위에 막대가 잠깐 보임. 부서진 집은 낮게 무너진 모양.
const HSTATE = new Map(); // 이름 → { hp, max, broken } (내 집은 net.name)
const REPAIR = { 나무: 20, 돌: 10 }; // 서버 config.repair 와 같게(창에 보여 주기용)
const hsOf = (name) => HSTATE.get(name) || { hp: 1, max: 1, broken: 0 };
function setOf(name) { return name === net.name ? mySet : (net.houses.get(name) || null); }
function showBroken(name) {
  const st = hsOf(name), set = setOf(name); if (!set || !set.obj) return;
  const o = set.obj, u = o.userData; if (u.sy == null) u.sy = o.scale.y;
  o.scale.y = st.broken ? u.sy * 0.32 : u.sy; o.rotation.z = st.broken ? 0.1 : 0; // 무너진 집: 낮게 · 기울게
}
function applyHouseState(name, s) {
  if (!s) return; HSTATE.set(name, { hp: s.hp, max: s.max, broken: s.broken ? 1 : 0 }); showBroken(name);
}
// ── 내구도 막대(남 · 내 집 위, 깎인 뒤 6초) ──
const htags = new Map();
function hpTag(name) {
  let t = htags.get(name); if (!t) { const el = document.createElement('div'); el.className = 'tag htag'; el.innerHTML = '<span></span><i><b></b></i>'; document.body.appendChild(el); t = { el, until: 0 }; htags.set(name, t); }
  const st = hsOf(name); t.until = clock + 6; t.el.querySelector('span').textContent = (name === net.name ? '내 집' : name + '의 집') + (st.broken ? ' · 부서짐' : '');
  t.el.querySelector('b').style.width = Math.max(0, st.hp / st.max * 100) + '%';
}
const HV = new THREE.Vector3();
let hsT = 0;
function houseTick(dt) {
  if ((hsT -= dt || 0) <= 0) { hsT = 0.5; for (const n of HSTATE.keys()) showBroken(n); }
  for (const [name, t] of htags) {
    const set = setOf(name); if (!set || !set.box || clock > t.until) { t.el.style.display = 'none'; continue; }
    const b = set.box, x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2; HV.set(x, height(x, z) + 3.2, z).project(camera);
    const vis = HV.z < 1 && Math.abs(HV.x) < 1.1 && Math.abs(HV.y) < 1.1; t.el.style.display = vis ? '' : 'none';
    if (vis) t.el.style.transform = `translate(${((HV.x + 1) / 2 * innerWidth).toFixed(0)}px, ${((1 - HV.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
// ── 대상: 남의 집 벽 앞 ──
function raidTargets(see) {
  if (!srvOn() || inSafeC(me.x, me.z)) return; // 안전 구역에선 못 침
  for (const [name, h] of net.houses) {
    if (!h.box || hsOf(name).broken) continue;
    const b = h.box, cx = Math.max(b.x0, Math.min(b.x1, me.x)), cz = Math.max(b.z0, Math.min(b.z1, me.z));
    if (Math.hypot(me.x - cx, me.z - cz) < 1.3) see('raid', { name }, cx, cz, 2.0, -0.2); // 꽃 · 풀보다 뒤(집 옆에서 채집할 수 있게)
  }
}
function raidAction(t) {
  me.actT = me.actDur = 0.45; net.ac++; actCool = S.tool === '도끼' ? 0.7 : 0.6; me.actSwing = meleeSwing(); netSend({ t: 'hhit', name: t.rec.name }); // ac: 남 화면에 동작 · 쿨타임은 서버와 같게(리뷰 3 · 5번)
}
// ── 서버 말 ──
function onNetHouse(m) {
  if (m.t === 'hhp') {
    const st = { ...hsOf(m.name), hp: m.hp, max: m.max }; if (m.broken != null) st.broken = m.broken; HSTATE.set(m.name, st); showBroken(m.name); hpTag(m.name);
    if (m.broken && m.name === net.name) toast('내 집이 부서졌어요! 집 앞에서 고칠 수 있어요');
    else if (m.broken) toast(`${m.name}의 집이 부서졌어요`);
    if (view === 'house' && !winEl.hidden) render();
  } else if (m.t === 'raids') { raids.push(...m.list); if (!m.live) { openWin('raids'); } else toast(raidText(m.list[m.list.length - 1]), '집'); }
}
const raids = [];
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`; };
const itemsText = (it) => (it || []).map((x) => (Array.isArray(x) ? `${x[0]} ${x[1]}` : `${x.id} ${x.n}`)).join(', '); // 가져감 [[이름, 수]] · 쏟아짐 [{id, n}]
function raidText(e) {
  const who = e.by || '누군가';
  if (e.act === 'broke') return `${who} 님이 집을 부숨 — 보관함이 쏟아짐${e.items && e.items.length ? ` (${itemsText(e.items)})` : ''}`;
  if (e.act === 'trap') return `${who} 님이 ${itemsText(e.items).replace(/ 1$/, '')}을 부숨`;
  if (e.act === 'decay') return '텐트가 낡아 사라짐 — 보관함 물건은 그대로(새 텐트를 치면 다시 씀)';
  if (e.act === 'took') return `${who} 님이 보관함 물건을 가져감 (${itemsText(e.items)})`;
  return `${who} 님이 집을 침`;
}
function raidsHtml() {
  if (!raids.length) return '<div class="empty">습격 기록이 없어요</div>';
  return `<div class="raids">${raids.slice(-20).reverse().map((e) => `<div class="row raid"><span class="nm">${raidText(e).replace(/</g, '&lt;')}</span><small>${ago(e.t)}</small></div>`).join('')}</div>`;
}
// 집 창 위쪽: 내구도 · 수리
function houseHpHtml() {
  if (!srvOn()) return '';
  const st = HSTATE.get(net.name); if (!st) return '';
  const k = (1 - st.hp / st.max) * (S.tier + 1), need = Object.entries(REPAIR).map(([id, n]) => [id, Math.max(1, Math.ceil(n * k))]), ok = need.every(([id, n]) => count(id) >= n);
  const bar = `<div class="hdur${st.broken ? ' broken' : ''}"><b>${st.broken ? '부서짐!' : '내구도'} ${Math.round(st.hp).toLocaleString()} / ${st.max.toLocaleString()}</b><i><em style="width:${(st.hp / st.max * 100).toFixed(1)}%"></em></i></div>`;
  const log = raids.length ? '<div class="foot"><button type="button" class="bbtn" id="raidsBtn">습격 기록</button></div>' : '';
  if (st.hp >= st.max) return bar + log;
  return bar + `<div class="mats">${need.map(([id, n]) => `<div class="mat${count(id) >= n ? '' : ' lack'}"><i class="ic" style="background-image:${ic(id)}"></i><b>${id} ${Math.min(count(id), n)}/${n}</b></div>`).join('')}</div>
    <div class="foot"><button type="button" class="gbtn" id="repairBtn" ${ok ? '' : 'disabled'}>고치기</button></div>${log}`;
}
