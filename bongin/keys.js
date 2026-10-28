/* 키 설정 — "사람마다 쓰는 방식이 다르니 자체적으로 키설정 할 수 있게" (2026-10-27).
   동작마다 키 하나(PC). 이 기기에 저장(bg-keys). 같은 키를 두 동작에 쓰면 원래 쓰던 동작과 바꿔 준다 */
"use strict";
const KEYS = (() => {
  const ACTS = [
    ["left", "왼쪽", "ArrowLeft"], ["right", "오른쪽", "ArrowRight"], ["up", "안쪽(위)", "ArrowUp"], ["down", "바깥쪽(아래)", "ArrowDown"],
    ["atk", "공격", "KeyX"], ["jump", "점프", "KeyC"],
    ["back", "백스텝", "KeyV"], ["dash", "대시", "Space"], ["s1", "스킬 1", "KeyA"], ["s2", "스킬 2", "KeyS"], ["s3", "스킬 3", "KeyD"], ["s4", "스킬 4", "KeyW"], ["s5", "스킬 5", "KeyR"], ["s6", "스킬 6", "KeyT"], ["ult", "궁극기", "KeyG"], ["potion", "물약(빠른 칸 1)", "KeyQ"], ["q1", "물약 칸 1", "Digit1"], ["q2", "물약 칸 2", "Digit2"], ["q3", "물약 칸 3", "Digit3"], ["q4", "물약 칸 4", "Digit4"], ["q5", "물약 칸 5", "Digit5"], ["q6", "물약 칸 6", "Digit6"], ["q7", "물약 칸 7", "Digit7"], ["q8", "물약 칸 8", "Digit8"], ["mpot", "마력 물약", "KeyB"],
    ["talk", "말 걸기 · 들어가기", "KeyF"], ["bag", "가방", "KeyI"], ["equip", "장비", "KeyE"], ["skills", "스킬창", "KeyK"], ["chat", "채팅", "Enter"], ["menu", "메뉴 · 닫기", "Escape"],
  ];
  let map = {};
  const def = () => { const m = {}; ACTS.forEach(([a, , k]) => { m[a] = k; }); return m; };
  try { map = Object.assign(def(), JSON.parse(localStorage.getItem("bg-keys") || "{}")); } catch (e) { map = def(); }
  const down = {}, hit = {};
  let wait = null; // 키를 바꾸는 중이면 다음 키를 받는다
  const typing = (e) => /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
  addEventListener("keydown", (e) => {
    if (wait) { e.preventDefault(); if (e.code !== "Escape") set(wait.act, e.code); const w = wait; wait = null; w.done(); return; }
    if (typing(e)) return;
    const a = actOf(e.code);
    if (a && a !== "menu") e.preventDefault();
    if (e.repeat) return;
    if (a) { down[a] = true; hit[a] = true; }
  });
  addEventListener("keyup", (e) => { const a = actOf(e.code); if (a) down[a] = false; });
  addEventListener("blur", () => { for (const k in down) down[k] = false; });
  function actOf(code) { for (const a in map) if (map[a] === code) return a; return null; }
  function set(act, code) { const other = actOf(code); if (other && other !== act) map[other] = map[act]; map[act] = code; save(); }
  function save() { try { localStorage.setItem("bg-keys", JSON.stringify(map)); } catch (e) {} }
  function name(code) {
    if (!code) return "—";
    const N = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "Space", Enter: "Enter", Escape: "Esc", ShiftLeft: "왼 Shift", ShiftRight: "오른 Shift", ControlLeft: "왼 Ctrl", ControlRight: "오른 Ctrl", AltLeft: "왼 Alt", Tab: "Tab", Backspace: "Backspace" };
    return N[code] || code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "숫자판 ");
  }
  return {
    ACTS,
    down, // 누르고 있는 동작
    take(a) { if (hit[a]) { hit[a] = false; return true; } return false; }, // 이번에 눌렀나(한 번만)
    press(a, on) { if (on) { if (!down[a]) hit[a] = true; down[a] = true; } else down[a] = false; }, // 휴대폰 단추
    clear() { for (const k in hit) hit[k] = false; },
    key(a) { return map[a]; }, name, label: (a) => name(map[a]),
    listen(act, done) { wait = { act, done }; },
    reset() { map = def(); save(); },
    /* 키 설정 창 — box 에 줄마다 [동작 · 키] 단추 */
    panel(box) {
      const draw = () => {
        box.replaceChildren(...ACTS.map(([a, label]) => {
          const row = document.createElement("div"); row.className = "krow";
          const b = document.createElement("button"); b.type = "button"; b.className = "kbtn"; b.textContent = name(map[a]); b.dataset.a = a;
          b.onclick = () => { b.textContent = "누르세요…"; b.classList.add("wait"); KEYS.listen(a, draw); };
          const s = document.createElement("span"); s.textContent = label;
          row.append(s, b); return row;
        }));
      };
      draw(); return draw;
    },
  };
})();
