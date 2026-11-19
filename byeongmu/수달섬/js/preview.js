// 수달섬 — 미리보기(작업지시서 4 B4 · 2026-11-19). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 옷 자판기: 수달 모형에 고른 옷을 입혀 보기(입어 보기) · 다른 자판기 · 제작대: 고른 물건의 모형. 끌면 돌아감 · 가만히 두면 천천히 돎.
// 휴대폰 부담: 작은 그림판 하나(180px)만 만들어 돌려 쓰고, 창이 열려 미리보기 칸이 화면에 있을 때만 그림. 모형이 없는 물건(재료 · 먹거리)은 아이콘을 크게.
const PREV = { r: null, scene: null, cam: null, obj: null, key: '', yaw: 0.6, drag: null, on: false, cv: null, sel: {} };
function prevInit() {
  if (PREV.r) return;
  const cv = document.createElement('canvas'); cv.className = 'prev-cv'; PREV.cv = cv;
  PREV.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  PREV.r.setPixelRatio(Math.min(devicePixelRatio, 2)); PREV.r.setSize(180, 180, false);
  PREV.r.outputColorSpace = THREE.SRGBColorSpace; PREV.r.toneMapping = THREE.ACESFilmicToneMapping;
  PREV.scene = new THREE.Scene();
  PREV.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a48, 1.1));
  const d = new THREE.DirectionalLight(0xffe2b8, 2.4); d.position.set(-2, 4, 3); PREV.scene.add(d);
  PREV.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  // 끌어 돌리기 — 아이폰 사파리는 포인터를 중간에 끊어 터치로(실수 기록)
  const start = (x) => { PREV.drag = { x, yaw: PREV.yaw }; }, move = (x) => { if (PREV.drag) PREV.yaw = PREV.drag.yaw + (x - PREV.drag.x) * 0.02; }, end = () => { PREV.drag = null; };
  cv.addEventListener('touchstart', (e) => { start(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchmove', (e) => { move(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', end);
  cv.addEventListener('mousedown', (e) => start(e.clientX));
  addEventListener('mousemove', (e) => move(e.clientX));
  addEventListener('mouseup', end);
}
// 무엇을 보일지: kind 'cloth'(key = 옷 열쇠 · 입은 옷 위에 그것만 바꿔 입힘) · 'item'(물건 이름)
function prevBuild(kind, key) {
  const k = kind + '|' + key + '|' + JSON.stringify(S.wear || {});
  if (PREV.key === k && PREV.obj) return PREV.obj;
  if (PREV.obj) PREV.scene.remove(PREV.obj);
  PREV.key = k; PREV.obj = null;
  let o = null;
  if (kind === 'cloth') {
    // 입어 보기 수달은 하나만 만들어 두고 옷만 다시 입힘(새로 만들면 모양 · 재질이 쌓임 — 리뷰)
    if (!PREV.otter) { PREV.otter = makeOtter(); const g = new THREE.Group(); g.add(PREV.otter); PREV.otterBox = g; }
    const w = { ...(S.wear || {}) };
    if (key) { const p = keyParts(key), slot = (CLOTH.kinds.find(([kk]) => kk === p.kind) || [])[2]; if (slot) w[slot] = key; }
    applyOutfit(PREV.otter, w);
    PREV.otter.position.set(0, -0.62, 0); PREV.otterBox.scale.setScalar(1.25);
    PREV.scene.add(PREV.otterBox); PREV.obj = PREV.otterBox; return PREV.obj;
  } else if (key && srcs[key]) {
    o = new THREE.Group(); const m = srcs[key].clone(true); o.add(m);
  } else if (key && typeof prevModelOf === 'function' && prevModelOf(key)) {
    o = new THREE.Group(); o.add(prevModelOf(key));
  }
  if (!o) return null;
  // 크기 · 가운데 맞춤
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), R = Math.max(s.x, s.y, s.z) || 1;
  const inner = new THREE.Group(); while (o.children.length) inner.add(o.children[0]); o.add(inner);
  inner.position.set(-c.x, -c.y, -c.z); o.scale.setScalar(1.6 / R);
  PREV.scene.add(o); PREV.obj = o; return o;
}
function prevTick() {
  // 창을 닫으면(숨김) 멈춤 — closeWin 은 render 를 안 불러 그림판이 문서에 남음(리뷰)
  if (!PREV.on || !PREV.cv.isConnected || winEl.hidden) { PREV.on = false; return; }
  if (!PREV.drag) PREV.yaw += 0.008;
  if (PREV.obj) PREV.obj.rotation.y = PREV.yaw;
  PREV.cam.position.set(0, 0.55, 3.4); PREV.cam.lookAt(0, 0, 0);
  PREV.r.render(PREV.scene, PREV.cam);
  requestAnimationFrame(prevTick);
}
// life.js render() 끝에서 부름: 자판기 · 상점(사기) · 제작대 창이면 맨 위에 미리보기 칸
function prevAfterRender() {
  const kindOfView = view === 'shop' && shopKind === 'cloth' ? 'cloth' : (view === 'shop' && (tab === 'buy' || !(SHOPS[shopKind] || {}).sell)) || view === 'craft' ? 'item' : null;
  if (!kindOfView) { PREV.on = false; return; }
  const sk = view === 'craft' ? 'craft' : shopKind;
  let key = PREV.sel[sk];
  if (kindOfView === 'item' && !key) { const first = bodyEl.querySelector('[data-prev]'); key = first && first.dataset.prev; }
  const box = document.createElement('div'); box.className = 'prev-box';
  bodyEl.prepend(box);
  prevInit();
  const o = prevBuild(kindOfView, key || null);
  if (o) { box.appendChild(PREV.cv); if (!PREV.on) { PREV.on = true; requestAnimationFrame(prevTick); } }
  else { PREV.on = false; if (key) box.innerHTML = `<i class="ic prev-ic" style="background-image:${ic(key)}"></i>`; else box.remove(); }
  // 고른 줄 표시
  for (const r of bodyEl.querySelectorAll('[data-prev],[data-cprev]')) r.classList.toggle('prev-on', (r.dataset.prev || r.dataset.cprev) === key);
}
// 줄을 누르면(단추 말고) 그것을 미리보기
bodyEl.addEventListener('click', (e) => {
  if (e.target.closest('button')) return;
  const r = e.target.closest('[data-prev],[data-cprev]'); if (!r) return;
  PREV.sel[view === 'craft' ? 'craft' : shopKind] = r.dataset.prev || r.dataset.cprev; render();
});
