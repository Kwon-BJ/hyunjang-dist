// 수달섬 — 채팅(작업지시서 3 D · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 말하면 머리 위 말풍선 5초 · 가까운 사람에게만(서버가 거리로 고름) · 최근 20줄. 60자 · 1.5초에 한 번 · 태그 거름은 서버가.
// 휴대폰: 「말하기」 단추 → 화면 위쪽 입력창(자판이 아래 단추를 가려도 됨) → 보내면 바로 닫힘. PC: Enter 로 열고 Enter 로 보냄 · Esc 닫기.
// 글은 모두 textContent 로만 넣음(태그가 와도 글자로 보임).
const CHAT = { max: 60, cd: 1.5, keep: 5, lines: 20 };
const chatLines = [];
const bubbles = new Map();
let chatAt = -9;

const chatBtn = document.createElement('button'); chatBtn.type = 'button'; chatBtn.id = 'chatBtn'; chatBtn.className = 'ui'; chatBtn.textContent = '말하기'; chatBtn.tabIndex = -1; chatBtn.hidden = true;
document.body.appendChild(chatBtn);
const chatBox = document.createElement('div'); chatBox.id = 'chatBox'; chatBox.hidden = true;
chatBox.innerHTML = '<div class="chat-row"><input id="chatIn" type="text" enterkeyhint="send" autocomplete="off" maxlength="60" placeholder="가까운 수달에게 말하기 (60자)"><button type="button" class="bbtn" id="chatSend">보내기</button><button type="button" class="bbtn" id="chatX">닫기</button></div><div id="chatAll"></div>';
document.body.appendChild(chatBox);
const chatIn = chatBox.querySelector('#chatIn'), chatAll = chatBox.querySelector('#chatAll');
// 닫혀 있을 때 왼쪽에 최근 3줄(10초 뒤 흐려짐)
const chatPeek = document.createElement('div'); chatPeek.id = 'chatPeek'; document.body.appendChild(chatPeek);

function chatOpen() {
  if (!srvOn()) return;
  if (!winEl.hidden) closeWin();
  keys.clear(); chatBox.hidden = false; document.body.classList.add('chatting'); paintChatAll(); chatIn.value = ''; chatIn.focus();
}
function chatClose() { chatBox.hidden = true; document.body.classList.remove('chatting'); chatIn.blur(); keys.clear(); }
function chatSend() {
  const text = chatIn.value.trim().slice(0, CHAT.max);
  if (text) {
    if (clock - chatAt < CHAT.cd) { toast('조금 천천히 말해요'); return; }
    chatAt = clock; netSend({ t: 'say', text });
  }
  chatClose();
}
chatBtn.onclick = () => (chatBox.hidden ? chatOpen() : chatClose());
chatBox.querySelector('#chatSend').onclick = chatSend;
chatBox.querySelector('#chatX').onclick = chatClose;
// 입력 중에는 게임 키(WASD · E · B …)로 안 넘김
for (const ev of ['keydown', 'keyup']) chatIn.addEventListener(ev, (e) => {
  e.stopPropagation();
  if (ev === 'keydown' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); chatSend(); }
  else if (ev === 'keydown' && e.key === 'Escape') chatClose();
});
// PC: 창이 닫혀 있을 때 Enter 로 열기
addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && chatBox.hidden && winEl.hidden && srvOn() && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); chatOpen(); } });

function paintChatAll() {
  chatAll.textContent = '';
  for (const l of chatLines) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = l.name; d.append(b, ' ' + l.text); chatAll.appendChild(d); }
  chatAll.scrollTop = chatAll.scrollHeight;
}
function paintChatPeek() {
  chatPeek.textContent = '';
  for (const l of chatLines.slice(-3)) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = l.name; d.append(b, ' ' + l.text); chatPeek.appendChild(d); }
  chatPeek.classList.remove('fade'); void chatPeek.offsetWidth; chatPeek.classList.add('fade');
}
// 서버가 보낸 말: {t:'say', id, name, text}
function onNetSay(m) {
  if (typeof m.text !== 'string' || !m.text) return;
  chatLines.push({ name: m.name || '?', text: m.text }); if (chatLines.length > CHAT.lines) chatLines.shift();
  if (!chatBox.hidden) paintChatAll();
  paintChatPeek();
  let b = bubbles.get(m.id);
  if (!b) { const el = document.createElement('div'); el.className = 'chat-bub'; document.body.appendChild(el); b = { el }; bubbles.set(m.id, b); }
  b.el.textContent = m.text; b.until = clock + CHAT.keep; b.el.hidden = false;
}
const BUBV = new THREE.Vector3();
// 매 프레임: 말풍선을 말한 수달 머리 위(이름표 위)에 · 5초 뒤 지움
function chatTick() {
  chatBtn.hidden = !srvOn();
  for (const [id, b] of bubbles) {
    const o = id === net.id ? me : net.others.get(id);
    if (!o || clock > b.until || (o !== me && !o.obj.visible)) { b.el.remove(); bubbles.delete(id); continue; }
    BUBV.set(o.x, groundY(o.x, o.z) + TAG_Y + 0.38, o.z).project(camera);
    const vis = BUBV.z < 1 && Math.abs(BUBV.x) < 1.1 && Math.abs(BUBV.y) < 1.1;
    b.el.style.display = vis ? '' : 'none';
    // 화면 가장자리의 수달이 말해도 말풍선이 잘리지 않게 좌우 · 위를 화면 안으로 당김
    if (vis) {
      const w = b.el.offsetWidth, h = b.el.offsetHeight;
      const x = Math.max(w / 2 + 4, Math.min(innerWidth - w / 2 - 4, (BUBV.x + 1) / 2 * innerWidth)), y = Math.max(h + 4, (1 - BUBV.y) / 2 * innerHeight);
      b.el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
    }
  }
}
function clearChat() { for (const b of bubbles.values()) b.el.remove(); bubbles.clear(); }
