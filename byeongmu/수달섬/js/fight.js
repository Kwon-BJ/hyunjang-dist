// 수달섬 — 싸움(체력 · 때리기 · 죽음 · 자루 · 안전 구역) · 밤샘 1단계
// 서버가 정한다: 피해 · 체력 · 죽음 · 자루 · 다시 태어나기. 화면은 요청(hit · pick)만 보내고 결과를 보여 준다.
// 혼자 연습(서버 없음)일 때는 아무것도 안 함.
let SAFE = null; // 안전 구역 {x, z, r} — welcome 으로 받음
const sacks = new Map(); // 자루 id → { id, x, z, n, money, obj }
me.hp = 100; me.dead = false;
const inSafeC = (x, z) => !!SAFE && Math.hypot(x - SAFE.x, z - SAFE.z) < SAFE.r;
let safeRing = null, wasSafe = null;

// 체력 막대(오른쪽 위 조개 아래) — 그림은 ChatGPT 조각(ui-체력틀 · ui-체력)
const hpBox = document.createElement('div'); hpBox.className = 'ui'; hpBox.id = 'hpBox'; hpBox.hidden = true;
hpBox.innerHTML = '<i class="fill"></i><b>100</b>'; document.body.appendChild(hpBox);
const hurtEl = document.createElement('div'); hurtEl.id = 'hurt'; document.body.appendChild(hurtEl);
function setMyHp(hp) {
  me.hp = Math.max(0, Math.min(100, hp)); hpBox.hidden = !srvOn();
  hpBox.querySelector('.fill').style.width = `calc((100% - 22px) * ${me.hp / 100})`; hpBox.querySelector('b').textContent = Math.round(me.hp);
  hpBox.classList.toggle('low', me.hp <= 30);
}
function flashHurt() { hurtEl.classList.remove('on'); void hurtEl.offsetWidth; hurtEl.classList.add('on'); }
function updateTagHp(o) {
  if (!o.hpBar) { o.hpBar = document.createElement('i'); o.label.appendChild(o.hpBar); }
  o.hpBar.style.width = Math.max(0, o.hp ?? 100) + '%'; o.hpBar.style.display = (o.hp ?? 100) < 100 ? '' : 'none';
}
function layDown(obj, down) { obj.rotation.z = down ? Math.PI / 2 : 0; obj.userData.down = down; } // 옆으로 눕힘(발이 축)

function makeSafeRing() { // 안전 구역 테두리: 땅 위 작은 동그라미 96개
  const n = 96, g = new THREE.CircleGeometry(0.16, 10); g.rotateX(-Math.PI / 2);
  safeRing = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.85 }), n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = SAFE.x + Math.cos(a) * SAFE.r, z = SAFE.z + Math.sin(a) * SAFE.r; m4.makeTranslation(x, Math.max(0, height(x, z)) + 0.04, z); safeRing.setMatrixAt(i, m4); }
  scene.add(safeRing);
}
function addSack(s) {
  const old = sacks.get(s.id); if (old) { Object.assign(old, s); return; }
  const obj = placeModel(srcs['자루'], s.x, s.z, (s.id * 47) % 360, 0.55, '');
  sacks.set(s.id, { ...s, obj });
}
function removeSack(id) { const s = sacks.get(id); if (s) { scene.remove(s.obj); sacks.delete(id); } }

function fightWelcome(m) {
  SAFE = m.safe || null; if (SAFE && !safeRing) makeSafeRing();
  for (const id of [...sacks.keys()]) removeSack(id);
  for (const s of m.sacks || []) addSack(s);
  for (const p of m.players || []) { const o = net.others.get(p.id); if (o) { o.hp = p.hp; o.alive = p.alive; updateTagHp(o); if (p.alive === false) layDown(o.obj, true); } }
  me.dead = false; layDown(me.obj, false);
}
// 앞에 있는 것 찾기(life.js findTarget 이 부름): 자루 · 다른 수달
function fightTargets(see) {
  if (!srvOn() || me.dead) return;
  for (const s of sacks.values()) see('sack', s, s.x, s.z, 1.7, 0.5); // 앞 0.6 + 1.7 ≈ 서버 줍기 거리 2.5 안
  if (inSafeC(me.x, me.z)) return; // 안전 구역에서는 때리기 대상 없음
  for (const o of net.others.values()) if (o.alive !== false && !inSafeC(o.x, o.z)) see('otter', o, o.x, o.z, 1.8, 1.5); // 싸움 상대가 꽃 · 나무보다 먼저
}
// 때리기 동작: 도끼는 내려찍기 · 맨손(다른 도구 포함)은 왼손 · 오른손 번갈아 뻗기(작업지시서 3 C) — 수달 · 집 · 함정 모두
let punchN = 0;
function meleeSwing() { if (S.tool === '도끼') return true; punchN++; return punchN % 2 ? 'punchl' : 'punchr'; }
function fightAction(t) {
  me.actT = me.actDur = ACT_T; net.ac++;
  if (t.type === 'otter') actCool = S.tool === '도끼' ? 0.7 : 0.6; // 서버 쿨타임과 같게(빨리 눌러 헛손질 안 나게 · 리뷰 11번)
  if (t.type === 'sack') { me.actSwing = false; netSend({ t: 'pick', id: t.rec.id }); return; }
  me.actSwing = meleeSwing();
  netSend({ t: 'hit', id: t.rec.id });
}
function onNetFight(m) {
  if (m.t === 'got') { for (const [id, n] of m.items || []) if ((id === '열매' || id === '나뭇가지') && shaking() && m.k === me.actTree) dropFromTree(me.actTree, id, n); for (const [id, n] of m.items || []) toast(`+${n.toLocaleString()} ${id}`, id); }
  else if (m.t === 'msg') toast(m.text, m.icon);
  else if (m.t === 'shield') toast(m.s > 0 ? `안전지대를 나왔어요 — ${m.s}초 동안 안 다쳐요(먼저 공격하면 풀려요)` : '보호가 풀렸어요', '손'); // 부장님 2026-11-18
  else if (m.t === 'hp') {
    if (m.id === net.id) { const lost = me.hp - m.hp; setMyHp(m.hp); if (lost > 0 && 'by' in m) flashHurt(); } // 배고픔 · 걷기로 줄 땐 안 깜빡임(D단계)
    else { const o = net.others.get(m.id); if (o) { o.hp = m.hp; updateTagHp(o); } }
    // 맞음 효과(붉게 · 밀림 · 소리 · 숫자 · 흔들림) — hit.js
    if ('by' in m) onHitFx(m);
  } else if (m.t === 'died') {
    const o = net.others.get(m.id);
    if (m.id === net.id) { me.dead = true; me.speed = 0; me.actT = 0; layDown(me.obj, true); setMyHp(0); closeWin(); toast(m.byName ? `${m.byName}${/(포탑|가시덫)$/.test(m.byName) ? '에' : ' 님에게'} 쓰러졌어요 — 3초 뒤 집에서 다시 일어나요` : '쓰러졌어요 — 3초 뒤 집에서 다시 일어나요'); }
    else if (o) { o.alive = false; o.hp = 0; updateTagHp(o); layDown(o.obj, true); toast(m.by === net.id ? `${o.name} 님을 쓰러뜨렸어요!` : `${o.name} 님이 쓰러졌어요`); }
  } else if (m.t === 'respawn') {
    // 다시 태어난 뒤 3초는 다른 수달과 겹쳐도 통과(hit.js)
    ghostAfterRespawn(m.id);
    if (m.id === net.id) { me.dead = false; me.x = m.x; me.z = m.z; me.speed = 0; nudgeFree(); layDown(me.obj, false); setMyHp(m.hp); toast('집에서 다시 일어났어요'); }
    else { const o = net.others.get(m.id); if (o) { Object.assign(o, { alive: true, hp: m.hp, x: m.x, z: m.z, tx: m.x, tz: m.z }); layDown(o.obj, false); updateTagHp(o); } }
  } else if (m.t === 'sack') addSack(m.s);
  else if (m.t === 'sackgone') removeSack(m.id);
  else if (m.t === 'shot' || m.t === 'mag' || m.t === 'reloading') onNetGun(m);
  else if (m.t === 'bite' || m.t === 'fishp' || m.t === 'fish') onNetFish(m);
  else if (m.t === 'hhp' || m.t === 'raids') onNetHouse(m);
  else if (m.t === 'notice') showNotice(m.text, m.secs);
  else if (m.t === 'trap' || m.t === 'trapgone' || m.t === 'spiked') onNetTrap(m);
  else if (m.t === 'fix') { me.x = m.x; me.z = m.z; me.speed = 0; } // 서버가 되돌린 자리
}
// 매 프레임(net.js netTick 이 부름): 안전 구역 드나들기 알림
function fightTick() {
  if (!srvOn() || !SAFE) return;
  const s = inSafeC(me.x, me.z);
  if (wasSafe !== null && s !== wasSafe) toast(s ? '안전 구역 — 여기서는 싸울 수 없어요' : '안전 구역을 나왔어요 — 조심하세요!');
  wasSafe = s;
}

// 서버 알림 띠(작업지시서 2 · 배포 1분 전 「1분 뒤 새 판으로 바뀝니다」) — 남은 초를 세어 보여 줌
const noticeEl = document.createElement('div'); noticeEl.id = 'notice'; noticeEl.hidden = true; document.body.appendChild(noticeEl);
let noticeT = null;
function showNotice(text, secs) {
  clearInterval(noticeT); let left = secs | 0; const paint = () => { noticeEl.textContent = left > 0 ? text + ' (' + left + '초)' : text; };
  paint(); noticeEl.hidden = false;
  noticeT = setInterval(() => { left--; if (left <= -8) { clearInterval(noticeT); noticeEl.hidden = true; } else paint(); }, 1000);
}
