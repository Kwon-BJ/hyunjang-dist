// 수달섬 — 키보드 · 조이스틱 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 입력 ─────────
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
const joy = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
const JR = 60;
// 조이스틱 — 손가락은 터치 이벤트로 받는다(2026-11-17 아이폰에서 안 움직인다 함: 사파리가 포인터 끌기를 중간에 취소함) · 펜은 포인터 이벤트
const HAS_TOUCH = 'ontouchstart' in window;
function joyStart(id, x, y) {
  if (joy.id !== null || x > innerWidth * 0.55 || !document.getElementById('win').hidden) return false;
  joy.id = id; joy.x0 = x; joy.y0 = y; joy.dx = joy.dy = 0;
  joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; joyEl.style.display = 'block'; knob.style.transform = '';
  hideHint(); return true;
}
function joyMove(x, y) {
  let dx = x - joy.x0, dy = y - joy.y0; const l = Math.hypot(dx, dy); if (l > JR) { dx *= JR / l; dy *= JR / l; }
  joy.dx = dx / JR; joy.dy = dy / JR; knob.style.transform = `translate(${dx}px, ${dy}px)`;
}
function joyStop() { joy.id = null; joy.dx = joy.dy = 0; joyEl.style.display = 'none'; }
if (HAS_TOUCH) {
  cv.addEventListener('touchstart', (e) => { e.preventDefault(); for (const t of e.changedTouches) joyStart('t' + t.identifier, t.clientX, t.clientY); }, { passive: false });
  addEventListener('touchmove', (e) => { if (joy.id === null) return; for (const t of e.changedTouches) if ('t' + t.identifier === joy.id) { e.preventDefault(); joyMove(t.clientX, t.clientY); } }, { passive: false });
  const tEnd = (e) => { for (const t of e.changedTouches) if ('t' + t.identifier === joy.id) joyStop(); };
  addEventListener('touchend', tEnd); addEventListener('touchcancel', tEnd);
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // 아이폰 두 손가락 확대 막기
}
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || (HAS_TOUCH && e.pointerType === 'touch')) return;
  if (joyStart(e.pointerId, e.clientX, e.clientY)) cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e.clientX, e.clientY); });
const joyEnd = (e) => { if (e.pointerId === joy.id) joyStop(); };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
const hintEl = document.getElementById('hint');
hintEl.textContent = touchy ? '왼쪽을 눌러 움직이기 · 오른쪽 단추로 줍기/쓰기' : 'WASD 이동 · Shift 달리기 · E 줍기/쓰기 · Q 도구 · B 가방';
let hintTimer = setTimeout(hideHint, 9000);
function hideHint() { clearTimeout(hintTimer); hintEl.classList.add('off'); }
