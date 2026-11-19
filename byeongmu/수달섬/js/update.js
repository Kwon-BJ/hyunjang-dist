// 수달섬 — 새 판 저절로 받기 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 새 판 저절로 받기 (2026-11-17 「새로고침 안 해도 자동 업데이트」) ─────────
// GAME_BUILD 는 올리기.mjs 가 게임 파일이 바뀐 때만 적는다. 1분마다 · 다른 앱에서 돌아올 때 build.txt 를 보고,
// 새 판이면 멈춰 있을 때(창 닫힘 · 안 움직임 · 조이스틱 안 누름) 1.5초 뒤 새로 연다 — 가방은 저장, 자리는 그대로
let newGame = '', idleT = 0;
async function checkGame() {
  if (GAME_BUILD === 'dev' || newGame) return;
  try {
    const b = (await (await fetch('build.txt?v=' + Date.now(), { cache: 'no-store' })).text()).trim().split(/\s+/)[0];
    if (/^\d{12}$/.test(b) && b !== GAME_BUILD && sessionStorage.getItem('suseom-reloaded') !== b) { newGame = b; toast('새 판이 나왔어요 — 잠깐 멈추면 새로 열어요'); }
  } catch { /* 못 보면 지금 판으로 */ }
}
function newGameTick(dt) {
  if (!newGame) return;
  const idle = winEl.hidden && joy.id === null && !keys.size && me.speed < 0.05 && me.actT <= 0;
  idleT = idle ? idleT + dt : 0;
  if (idleT < 1.5) return;
  const b = newGame; newGame = '';
  try { sessionStorage.setItem('suseom-reloaded', b); sessionStorage.setItem('suseom-pos', JSON.stringify({ x: me.x, z: me.z, f: me.face, t: Date.now(), v: MAP_V })); } catch { /* */ }
  dirty = true; flush();
  const q = new URLSearchParams(location.search); q.set('v', b); location.replace(location.pathname + '?' + q);
}
setInterval(checkGame, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkGame(); });
