// 수달섬 — 제작대 · 도구 등급 · 만든 총 · 함정(작업지시서 4 C · 2026-11-19). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 물건 이름 · 등급 표는 서버 config.js(제작대와 등급)와 같게. 만드는 법(재료 · 시간)은 입장 인사로 받음(CRAFT.list).
// 계산 · 시간은 서버가 함 — 화면은 「1개 · 전부 만들기 · 그만」 요청과 진행 막대만.
// 그림(아이콘)은 3D 모형을 등급 색으로 찍은 것(img/i-<이름>.webp · 기획/디자인/아이콘굽기.cjs — 색을 바꾸면 다시 굽기).
const GRADE_TOOLS = {
  도끼: [['돌도끼', '돌', '돌도끼'], ['철도끼', '철', '철 도끼'], ['황금도끼', '황금', '황금 도끼']],
  곡괭이: [['돌곡괭이', '돌', '돌곡괭이'], ['철곡괭이', '철', '철 곡괭이'], ['황금곡괭이', '황금', '황금 곡괭이']],
  삽: [['돌삽', '돌', '돌삽'], ['철삽', '철', '철 삽'], ['황금삽', '황금', '황금 삽']],
  낚싯대: [['대나무낚싯대', '대나무', '대나무 낚싯대'], ['철낚싯대', '철', '철 낚싯대'], ['황금낚싯대', '황금', '황금 낚싯대']],
};
// 서버 config.dur 와 같게(낡은 것 × 등급 배율 2 · 4 · 8)
const GRADE_DUR = { 돌: 2, 대나무: 2, 철: 4, 황금: 8 };
const BASE_DUR = { 도끼: 250, 곡괭이: 250, 삽: 200, 낚싯대: 120 };
// 등급 색(손에 든 모양) · 크기
// 돌 짙은 회색 · 철 밝은 은색 · 황금 금색(2026-11-19 부장님 — 한눈에 구별)
const GRADE_COLOR = { 돌: 0x6f7378, 대나무: 0x9fc46a, 철: 0xeef3f8, 황금: 0xffcc33 };
const GRADE_SCALE = { 돌: 1.04, 대나무: 1.04, 철: 1.08, 황금: 1.12 };
const TOOL_GRADE = {};
for (const [base, list] of Object.entries(GRADE_TOOLS)) {
  for (const [id, g, nm] of list) {
    // 아이콘은 제 그림(img/i-<이름>.webp — 기획/디자인/아이콘굽기.cjs 가 3D 모형으로 구움)
    TOOL_KIND[id] = base; TOOL_GRADE[id] = g; ITEM_NAME[id] = nm;
    ITEMS[id] = { tool: true }; DUR[id] = BASE_DUR[base] * GRADE_DUR[g];
    if (base !== '삽' && !TOOLS.includes(id)) TOOLS.push(id);
  }
}
// 삽은 grow.js 가 TOOLS 에 넣으므로 등급 삽도 같이
for (const [id] of GRADE_TOOLS.삽) if (!TOOLS.includes(id)) TOOLS.push(id);
// 새 재료(철 · 금 바위)
Object.assign(ITEMS, { 철광석: { sell: 25 }, 금광석: { sell: 70 } });
SELLABLE.push('철광석', '금광석'); MATERIALS.push('철광석', '금광석');
// 만든 총(서버 config.guns 와 같은 연사 · 탄창 · 탄약) — 모형은 기본 총(GUN_MODEL) · 색은 GUN_COLOR
const GUN_MODEL = { 철권총: '권총', 황금권총: '권총', 철소총: '소총', 황금소총: '소총', 철산탄총: '산탄총', 황금산탄총: '산탄총', 기관총: '소총', 저격총: '소총' };
const GUN_COLOR = { 철권총: 0xeef3f8, 철소총: 0xeef3f8, 철산탄총: 0xeef3f8, 황금권총: 0xffcc33, 황금소총: 0xffcc33, 황금산탄총: 0xffcc33 };
Object.assign(GUN_INFO, {
  철권총: { rate: 3.4, mag: 15, ammo: '권총탄', snd: 1650, len: 0.66 }, 철소총: { rate: 9, mag: 36, ammo: '소총탄', snd: 2300, len: 1.12 }, 철산탄총: { rate: 1.4, mag: 7, ammo: '산탄', snd: 880, len: 1.08 },
  황금권총: { rate: 3.8, mag: 18, ammo: '권총탄', snd: 1600, len: 0.68 }, 황금소총: { rate: 10, mag: 42, ammo: '소총탄', snd: 2200, len: 1.15 }, 황금산탄총: { rate: 1.6, mag: 8, ammo: '산탄', snd: 860, len: 1.1 },
  기관총: { rate: 16, mag: 60, ammo: '소총탄', snd: 2600, len: 0.95 }, 저격총: { rate: 0.7, mag: 5, ammo: '소총탄', snd: 1200, len: 1.4 },
});
Object.assign(DUR, { 철권총: 900, 철소총: 2000, 철산탄총: 450, 황금권총: 1300, 황금소총: 2800, 황금산탄총: 650, 기관총: 2500, 저격총: 400 });
for (const g of Object.keys(GUN_MODEL)) { if (!GUNS.includes(g)) GUNS.push(g); ITEMS[g] = { tool: true }; }
Object.assign(ITEM_NAME, { 철권총: '철 권총', 철소총: '철 소총', 철산탄총: '철 산탄총', 황금권총: '황금 권총', 황금소총: '황금 소총', 황금산탄총: '황금 산탄총' });
// 함정 · 포탑 · 제작대(서버 config.traps 와 같은 이름) — 모형은 가시덫 · 포탑 · 작업대, 색은 TRAP_COLOR
const TRAP_COLOR = { 철가시덫: 0xeef3f8, 올가미덫: 0x9a7444, 연사포탑: 0xeef3f8, 산탄포탑: 0xf09a3a };
for (const id of ['철가시덫', '올가미덫', '폭발덫', '연사포탑', '산탄포탑', '제작대']) { if (!TRAP_ITEMS.includes(id)) TRAP_ITEMS.push(id); ITEMS[id] = { tool: true }; }
ITEMS.제작대.buy = 2500;
// 손에 든 것 · 놓은 것 색 바꾸기(등급 · 만든 총 · 함정) — 재질은 복사해서 바꿈(다른 것과 함께 쓰는 재질은 그대로)
function gradeLook(obj, id) {
  const g = TOOL_GRADE[id], c = g ? GRADE_COLOR[g] : GUN_COLOR[id] ?? TRAP_COLOR[id];
  if (c == null) return obj;
  const col = new THREE.Color(c);
  obj.traverse((m) => { if (!m.isMesh || !m.material) return; m.material = m.material.clone(); m.material.color.lerp(col, 0.8); if (g === '황금' || /황금/.test(id)) { m.material.emissive = new THREE.Color(0x4a3300); } });
  if (g) obj.scale.multiplyScalar(GRADE_SCALE[g]);
  return obj;
}

// 이름 색(2026-11-19 부장님 — 가방 · 제작대에서 등급을 글자 색으로도): 등급 도구 · 철/황금 총 · 철가시덫
const GRADE_CLASS = { 돌: 'g-stone', 대나무: 'g-bamboo', 철: 'g-iron', 황금: 'g-gold' };
const gradeNameOf = (id) => TOOL_GRADE[id] || (/^황금/.test(id) ? '황금' : /^철/.test(id) && (GUN_MODEL[id] || TRAP_COLOR[id]) ? '철' : null);
function nameHtml(id) { const g = gradeNameOf(id); return g ? `<b class="${GRADE_CLASS[g]}">${nameOf(id)}</b>` : nameOf(id); }

// ── 제작대 ──
// 항구 공용 제작대 자리(서버 config.bench 와 같게) · 놓은 제작대는 함정 칸(kind bench)
const BENCH_AT = { x: HARBOR.x + 2.4, z: HARBOR.z + 5 };
const CRAFT = { list: {}, bench: { r: 2.6, time: 10, max: 20 }, job: null, jobAt: 0 };
let craftBench = 'H';
// main.js 가 모형을 받은 뒤 부름: 항구 제작대(작업대 모형)
function craftBuild() { if (srcs['작업대']) placeModel(srcs['작업대'], BENCH_AT.x, BENCH_AT.z, 180, 1.0, 'c'); }
function craftTargets(see) {
  if (!srvOn()) return;
  see('craft', { key: 'H' }, BENCH_AT.x, BENCH_AT.z, 2.2, 0.4);
  for (const t of traps.values()) if (t.kind === 'bench') see('craft', { key: 'P' + t.id }, t.x, t.z, 2.2, t.owner === net.name ? 0.4 : 0.3);
}
function onNetCraft(m) {
  if (m.t === 'craftdef') { CRAFT.list = m.list || {}; Object.assign(CRAFT.bench, m.bench || {}); return; }
  if (m.t === 'stun') { toast(`올가미에 걸렸어요 — ${m.s}초 못 움직여요`, '가시덫'); return; }
  CRAFT.job = m.job; CRAFT.jobAt = performance.now();
  if (view === 'craft' && !winEl.hidden) render();
}
const craftHave = (id) => count(id);
function craftHtml() {
  const J = CRAFT.job, now = performance.now();
  let h = '';
  if (J) {
    const left = Math.max(0, J.ends - (now - CRAFT.jobAt) / 1000), done = J.total - J.left;
    h += `<div class="row mat-row craft-job"><i class="ic" style="background-image:${ic(J.id)}"></i><span class="nm">${nameHtml(J.id)} 만드는 중<small>${done}/${J.total} · 다음 ${Math.ceil(left)}초</small></span><div class="mat-line"><i class="dur craft-bar"><u style="width:${Math.round((1 - left / J.each) * 100)}%"></u></i><button type="button" class="bbtn" id="craftStop">그만</button></div></div>`;
  }
  const ids = Object.keys(CRAFT.list);
  if (!ids.length) return h + '<div class="empty">홈페이지에서 로그인하고 함께 놀 때 만들 수 있어요</div>';
  h += ids.map((id) => {
    const need = CRAFT.list[id], can = Math.min(...need.map(([k, n]) => Math.floor(craftHave(k) / n)));
    const off = J || can < 1 ? 'disabled' : '';
    return `<div class="row mat-row" data-prev="${id}"><i class="ic" style="background-image:${ic(id)}"></i><span class="nm">${nameHtml(id)}<small>${CRAFT.bench.time}초</small></span><div class="mat-line"><span class="need">${need.map(([k, n]) => `${nameHtml(k)} ${Math.min(craftHave(k), n)}/${n}`).join(' · ')}</span><button type="button" class="bbtn" data-craft="${id}" ${off}>1개</button><button type="button" class="bbtn" data-craftall="${id}" ${off}>전부${can > 1 ? ' ' + Math.min(can, CRAFT.bench.max) : ''}</button></div></div>`;
  }).join('');
  return h + `<div class="empty">만드는 동안 제작대 옆에 있어요 — 멀어지거나 맞으면 멈추고 남은 재료는 돌려받아요</div>`;
}
bodyEl.addEventListener('click', (e) => {
  if (view !== 'craft') return;
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.craft) netSend({ t: 'craft', id: b.dataset.craft, b: craftBench, all: false });
  else if (b.dataset.craftall) netSend({ t: 'craft', id: b.dataset.craftall, b: craftBench, all: true });
  else if (b.id === 'craftStop') netSend({ t: 'craft', cancel: true });
});
// 만드는 중에는 창의 남은 초 · 막대를 1초마다 다시 그림
setInterval(() => { if (CRAFT.job && view === 'craft' && !winEl.hidden) render(); }, 1000);
