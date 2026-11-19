// 수달섬 — 운영자 물건 만들기 창(작업지시서 4 B6 · 2026-11-19). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 단추는 서버가 입장 인사(welcome)에 op 를 보냈을 때만 보임. 만들기 요청(op.make)도 서버가 운영자인지 다시 확인하고 기록을 남김(워커 op.js)
const opBtn = document.createElement('button');
opBtn.type = 'button'; opBtn.id = 'opBtn'; opBtn.className = 'ui'; opBtn.textContent = '운영자'; opBtn.tabIndex = -1; opBtn.hidden = true;
document.body.appendChild(opBtn);
opBtn.onclick = () => { opBtn.blur(); openWin('op'); };
function opShow(on) { opBtn.hidden = !on; }
function opHtml() {
  // 보관함은 물건이 아니라 칸 늘리기(서버 물건 목록에 없음 — 리뷰)
  const ids = Object.keys(ITEMS).filter((id) => id !== '보관함');
  return `<div class="op-form"><label>물건<select id="opId">${ids.map((id) => `<option value="${id}">${nameOf(id)}</option>`).join('')}</select></label>`
    + '<label>수량<input id="opN" type="number" inputmode="numeric" min="0" max="999" value="1"></label>'
    + '<label>조개<input id="opMoney" type="number" inputmode="numeric" min="0" max="1000000" value="0"></label>'
    + '<button type="button" class="gbtn" id="opMake">만들기</button><div class="empty">운영자만 — 서버가 로그인한 회원을 확인하고 만든 기록을 남겨요</div></div>';
}
bodyEl.addEventListener('click', (e) => {
  if (!e.target.closest('#opMake')) return;
  const id = $('opId').value, n = Math.max(0, Math.floor(+$('opN').value || 0)), money = Math.max(0, Math.floor(+$('opMoney').value || 0));
  netSend({ t: 'op.make', items: n > 0 ? [[id, n]] : [], money });
});
