// 수달섬 — 옷(작업지시서 3 F · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 기본 수달은 아무것도 안 걸침(가방도 없음). 항구 옷 자판기에서 모자 3종 · 옷 · 가방을 8색으로 사서 머리 · 몸 · 등에 입음(꾸미기만).
// 산 옷은 옷장(서버 inv.closet)에 — 죽어도 안 떨굼. 입은 것은 서버가 모두에게 알림(look).
// 새 그림 없이 있던 조각만: 창 · 줄 · 갈색 단추 · 탭. 색은 글자 앞 동그라미(글자 색 칸)로 보여 줌.
const CLOTH = {
  kinds: [['bucket', '벙거지', 'head'], ['cap', '야구모자', 'head'], ['beanie', '비니', 'head'], ['shirt', '반팔 티', 'body'], ['overall', '멜빵바지', 'body'], ['bag', '가방', 'back'], ['satchel', '크로스백', 'back']],
  // 값은 서버 config.js clothes.price 와 같게(멜빵바지 · 크로스백은 2026-11-19 · 부장님 확인 전 임시값)
  price: { bucket: 800, cap: 700, beanie: 600, shirt: 1000, overall: 1000, bag: 900, satchel: 900 },
  names: ['청록', '주황', '노랑', '보라', '하늘', '분홍', '연두', '남색'],
};
const SLOT_NM = { head: '머리', body: '몸', back: '등' };
SHOPS.cloth = { x: HARBOR.x + 5.3, z: HARBOR.z + 0.6, name: '옷 자판기', buy: [], color: 0xf08fb3, glow: 0xffd6e6 };
S.closet = []; S.wear = { head: null, body: null, back: null };
let clothTab = 'bucket';
const keyParts = (k) => { if (typeof k !== 'string') return null; const [kind, c] = k.split(':'); return { kind, c: +c }; };

// ── 옷 모양(2026-11-19 기획/수달-디자인시안-2.png) — 모양은 한 번만 만들어 모든 수달이 같이 씀 · 수달마다 재질(색)만 따로 ──
// 붙이는 자리는 몸통(otter.js: 캡슐 반지름 0.205 · 가운데 높이 0.385 · 가로 1.1배)에 맞춤. 팔 · 손(도구 자리)은 건드리지 않음
const noUv = (gs) => gs.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; });
const CLOTH_GEO = {};
// 반팔 티: 몸통 껍데기 + 어깨 소매 둥근 덩어리 2개(몸에 붙음 — 팔이 흔들려도 어깨를 덮음)
CLOTH_GEO.shirt = () => {
  const torso = new THREE.CapsuleGeometry(0.215, 0.12, 8, 20); torso.scale(1.13, 0.86, 1.04); torso.translate(0, 0.4, 0);
  const sl = (s) => { const g = new THREE.SphereGeometry(0.1, 16, 10); g.scale(1, 0.85, 1.05); g.translate(s * 0.245, 0.47, 0); return g; };
  return mergeGeometries(noUv([torso, sl(-1), sl(1)]));
};
// 멜빵바지: 엉덩이를 감싼 바지(돌림 모양) + 가슴판 + 어깨 끈 2(어깨를 넘어 등으로)
CLOTH_GEO.overall = () => {
  const prof = [[0, 0.12], [0.12, 0.125], [0.2, 0.14], [0.235, 0.18], [0.245, 0.25], [0.246, 0.32], [0.24, 0.4], [0.236, 0.435]].map(([r, y]) => new THREE.Vector2(r, y));
  const pants = new THREE.LatheGeometry(prof, 28); pants.scale(1.06, 1, 0.94);
  const bib = roundBox(0.25, 0.17, 0.045, 0.02); bib.rotateX(-0.1); bib.translate(0, 0.5, 0.195);
  const strap = (s) => { const g = new THREE.TorusGeometry(0.205, 0.017, 6, 18, Math.PI); g.rotateY(Math.PI / 2); g.scale(1, 0.42, 1.03); g.translate(s * 0.09, 0.5, 0); return g; };
  return mergeGeometries(noUv([pants, bib, strap(-1), strap(1)]));
};
// 멜빵 단추 2(크림 · 따로 한 부품)
CLOTH_GEO.button = () => { const b = (s) => { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12); g.rotateX(Math.PI / 2); g.translate(s * 0.09, 0.565, 0.222); return g; }; return mergeGeometries(noUv([b(-1), b(1)])); };
// 크로스백: 왼쪽 어깨에서 오른쪽 엉덩이로 비스듬한 끈 + 앞 옆구리 작은 가방(덮개 줄 포함 · 한 부품). 오른손(도구) · 등 가방 자리를 안 가림
CLOTH_GEO.satchel = () => {
  const strap = new THREE.TorusGeometry(1, 0.075, 6, 32); strap.rotateX(Math.PI / 2); strap.scale(0.258, 0.25, 0.24); strap.rotateZ(0.62); strap.translate(0, 0.42, 0);
  const bag = roundBox(0.19, 0.16, 0.08, 0.04); bag.rotateY(-0.5); bag.translate(-0.2, 0.27, 0.16);
  const flap = roundBox(0.19, 0.07, 0.085, 0.03); flap.rotateY(-0.5); flap.translate(-0.199, 0.325, 0.163);
  return mergeGeometries(noUv([strap, bag, flap]));
};
const clothGeo = (k) => CLOTH_GEO[k + '_'] || (CLOTH_GEO[k + '_'] = CLOTH_GEO[k]());
// 그 수달의 옷 부품(처음 입을 때 만듦) — 몸통(body)에 붙음
// userData 이름 = 옷 이름(shirt · overall · button · satchel — 시험이 u.shirt 를 봄)
function clothPart(u, k) {
  if (!u[k]) { const m = new THREE.Mesh(clothGeo(k), clay(k === 'button' ? 0xf3e3c8 : LOOK_COLORS[0])); m.castShadow = true; u.body.add(m); u[k] = m; }
  return u[k];
}
const clothTint = (m, hex) => { const c = new THREE.Color(hex); m.material.color.copy(c); m.material.emissive.copy(c).multiplyScalar(0.14); };
// 입은 것을 그 수달에 그림 · w = { head, body, back } (열쇠 또는 null)
function applyOutfit(obj, w) {
  const u = obj.userData, h = keyParts(w && w.head), b = keyParts(w && w.body), k = keyParts(w && w.back);
  setLook(obj, { hat: h ? h.kind : null, color: LOOK_COLORS[(h ? h.c : k ? k.c : 0) % LOOK_COLORS.length] });
  // 등 칸: 등 가방(bag) 또는 크로스백(satchel) — 산 사람만 · 색은 그 옷 색
  u.bag.visible = !!k && k.kind === 'bag';
  if (u.bag.visible) { const c = new THREE.Color(LOOK_COLORS[k.c % 8]).multiplyScalar(0.92); u.bag.material.color.copy(c); u.bag.material.emissive.copy(c).multiplyScalar(0.14); }
  if (k && k.kind === 'satchel') clothTint(clothPart(u, 'satchel'), LOOK_COLORS[k.c % 8]);
  if (u.satchel) u.satchel.visible = !!k && k.kind === 'satchel';
  // 몸 칸: 반팔 티(shirt) 또는 멜빵바지(overall + 단추) — 만든 적 있는 것만 숨김(안 입으면 부품을 만들지 않음)
  const bk = b ? b.kind : null;
  if (bk === 'shirt' || bk === 'overall') clothTint(clothPart(u, bk), LOOK_COLORS[b.c % 8]);
  if (bk === 'overall') clothPart(u, 'button');
  for (const nm of ['shirt', 'overall', 'button']) if (u[nm]) u[nm].visible = nm === 'button' ? bk === 'overall' : bk === nm;
  u.outfit = { ...(w || {}) };
}
// 서버 inv 에 옷장 · 입은 것이 오면(net.js adoptInv 뒤)
function adoptClothes(inv) {
  if (!inv || !Array.isArray(inv.closet)) return;
  S.closet = inv.closet.slice(); S.wear = { head: null, body: null, back: null, ...(inv.wear || {}) };
  applyOutfit(me.obj, S.wear);
  if (view === 'shop' && shopKind === 'cloth' && !winEl.hidden) render();
}
function onNetLook(m) {
  if (m.id === net.id) return;
  const o = net.others.get(m.id); if (o) { o.w = m.w; applyOutfit(o.obj, m.w); }
}

// ── 옷 자판기 창(life.js render · 단추가 부름) ──
function clothHtml() {
  const tabs = `<div class="tabs cloth-tabs">${CLOTH.kinds.map(([k, nm]) => `<button type="button" class="tab${clothTab === k ? ' on' : ''}" data-ctab="${k}">${nm}</button>`).join('')}</div>`;
  const [kind, kname, slot] = CLOTH.kinds.find(([k]) => k === clothTab);
  const rows = CLOTH.names.map((cn, c) => {
    const key = `${kind}:${c}`, have = S.closet.includes(key), on = S.wear[slot] === key, col = '#' + LOOK_COLORS[c].toString(16).padStart(6, '0');
    const btn = on ? `<button type="button" class="bbtn" data-cunwear="${slot}">벗기</button>` : have ? `<button type="button" class="bbtn" data-cwear="${key}">입기</button>` : `<button type="button" class="bbtn" data-cbuy="${key}" ${S.money < CLOTH.price[kind] ? 'disabled' : ''}>사기</button>`;
    // 두 줄: 색 · 이름 / 값(또는 가짐 · 입음) · 단추 — 좁은 휴대폰에서 넘치지 않게(다른 가게 줄과 같은 모양)
    return `<div class="row mat-row" data-cprev="${key}"><span class="cloth-dot" style="background:${col}"></span><span class="nm">${cn} ${kname}<small>${SLOT_NM[slot]}</small></span><div class="mat-line"><span class="need">${on ? '입고 있어요' : have ? '옷장에 있어요' : price(CLOTH.price[kind])}</span>${btn}</div></div>`;
  }).join('');
  return tabs + rows + `<div class="empty">꾸미기만 — 능력은 같아요 · 산 옷은 옷장에 남아 죽어도 안 떨어져요</div><div class="mine">내 조개 ${price(S.money)}</div>`;
}
function clothClick(b) {
  if (b.dataset.ctab) { clothTab = b.dataset.ctab; render(); return true; }
  if (b.dataset.cbuy) { const p = keyParts(b.dataset.cbuy); netSend({ t: 'cbuy', kind: p.kind, c: p.c }); return true; }
  if (b.dataset.cwear) { const p = keyParts(b.dataset.cwear), slot = (CLOTH.kinds.find(([k]) => k === p.kind) || [])[2]; netSend({ t: 'cwear', slot, key: b.dataset.cwear }); return true; }
  if (b.dataset.cunwear) { netSend({ t: 'cwear', slot: b.dataset.cunwear, key: null }); return true; }
  return false;
}
// 처음(혼자 놀기 포함): 아무것도 안 걸침
applyOutfit(me.obj, S.wear);
