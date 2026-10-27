/* 봉인검록 — 화면 흐름 (2026-10-27)
   로그인(병무청 홈페이지 열쇠) → 캐릭터 만들기(한 사람 1개) → 캐릭터 화면 → 마을(NPC · 다른 사람 · 채팅 · 파티 · 거래) → 오른쪽 던전 입구 → 던전
   서버: 서버/src/index.js (마을 하나). 주소 끝 ?server=ws://… · ?token=dev:이름 은 이 PC 시험용 */
"use strict";
const APP = (() => {
  const VW = 960, VH = 540, Z0 = 368, Z1 = 512, TOWN_W = 2600;
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || ""; // 판 번호 — 새 판이면 그림도 새로
  const $ = (id) => document.getElementById(id);
  const cv = $("cv"), g = cv.getContext("2d");
  const q = new URLSearchParams(location.search);
  const SERVER = q.get("server") || "wss://bongin.byeongmu-munpa.workers.dev";
  let token = q.get("token") || ""; try { token = token || localStorage.getItem("bmc-token") || ""; } catch (e) {}
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (text, fn, cls) => { const b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.onclick = fn; return b; };
  const GRADE = ["#e9e4d6", "#6fb3ff", "#c58cff", "#ffcf4a"];

  /* ── 화면 크기 ── */
  let DPR = 1;
  function fit() { const k = Math.min(innerWidth / VW, innerHeight / VH), st = $("stage"); st.style.width = VW * k + "px"; st.style.height = VH * k + "px"; DPR = Math.min(2, (window.devicePixelRatio || 1) * k); cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); }
  addEventListener("resize", fit); fit();

  /* ── 상태 ── */
  const A = { me: null, char: null, items: {}, shop: [], dungeons: {}, scene: "menu", party: null, trade: null, others: {}, bubbles: {}, hero: null, camX: 0, msgT: 0, solo: false };

  /* ── 서버 ── */
  let ws = null, wsOpen = false;
  function connect() {
    wsOpen = false;
    try { ws = new WebSocket(SERVER + "/ws?token=" + encodeURIComponent(token)); } catch (e) { return fail("서버에 닿지 못했어요."); }
    ws.onopen = () => { wsOpen = true; };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } on(m); };
    ws.onclose = (e) => { wsOpen = false; if (e.code === 4000) return fail("다른 곳에서 접속해 여기는 끊었어요."); if (!A.solo) fail(A.me ? "서버와 연결이 끊겼어요." : "로그인을 확인하지 못했어요. 병무청 홈페이지에 다시 로그인해 주세요."); };
  }
  function send(m) { if (ws && wsOpen) ws.send(JSON.stringify(m)); }
  function fail(text) { panel([el("h2", null, "연결"), el("p", null, text), row(btn("다시 연결", () => { panel([el("p", null, "연결하는 중…")]); connect(); }), btn("병무청 홈페이지", () => { location.href = "../byeongmu/"; }, "ghost"))]); A.scene = "menu"; }
  function on(m) {
    if (m.t === "hello") { A.me = m.me; $("hudOp").hidden = !m.me.op; A.items = m.items; A.shop = m.shop; A.dungeons = m.dungeons; A.char = m.char; return m.char ? charScreen() : createScreen(); }
    if (m.t === "char") { const first = !A.char && m.char; A.char = m.char; if (!m.char) return createScreen(); if (first) return charScreen(); refresh(); return; }
    if (m.t === "err") return toast(m.text, "bad");
    if (m.t === "opok") return toast(m.text, "good");
    if (m.t === "oplist") return opPanel(m.runs);
    if (m.t === "dwatch") return goDungeon(m, true);
    if (m.t === "spec") return Dungeon.watched();
    if (m.t === "notice") { // 운영자 전체 공지 — 화면 위 띠(남은 시간이 있으면 1초마다 줄임)
      const N = $("notice"), end = Date.now() + m.sec * 1000; clearInterval(A.noticeT);
      const show = () => { const left = Math.ceil((end - Date.now()) / 1000); N.textContent = "📢 " + m.text + (m.sec ? (left > 0 ? "  (" + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") + ")" : "  — 지금 업데이트 중이에요. 잠시 뒤 새로고침해 주세요") : ""); };
      N.hidden = false; show(); A.noticeT = setInterval(show, 1000); if (!m.sec) setTimeout(() => { N.hidden = true; clearInterval(A.noticeT); }, 15000); return;
    }
    if (m.t === "info") return toast(m.text);
    if (m.t === "others") { A.others = {}; m.list.forEach(addOther); return; }
    if (m.t === "join") return addOther(m.p);
    if (m.t === "leave") { delete A.others[m.id]; return; }
    if (m.t === "mv") { const o = A.others[m.id]; if (o) { o.tx = m.x; o.tz = m.z; o.face = m.face; o.st = m.st; } return; }
    if (m.t === "chat") { chatLine(m.nick, m.text); A.bubbles[m.id] = { text: m.text, t: 4 }; return; }
    if (m.t === "pinv") return ask(m.nick + " 님이 파티를 신청했어요.", () => send({ t: "pacc", from: m.from }));
    if (m.t === "treq") return ask(m.nick + " 님이 거래를 신청했어요.", () => send({ t: "tacc", from: m.from }));
    if (m.t === "party") { A.party = m.party; drawParty(); return; }
    if (m.t === "trade") { A.trade = m; tradePanel(); return; }
    if (m.t === "tend") { A.trade = null; closePanel(); toast(m.text, m.ok ? "" : "bad"); return; }
    if (m.t === "enh") { toast(m.name + (m.ok ? " 강화 성공! +" + m.after : m.after < m.before ? " 강화 실패 — +" + m.after + " 로 내려갔어요" : " 강화 실패 — +" + m.after + " 그대로"), m.ok ? "good" : "bad"); return; }
    if (m.t === "dgo") return goDungeon(m);
    if (m.t === "relay") return Dungeon.net(m.from, m.data);
    if (m.t === "reward") { A.reward = m; showReward(); return; }
    if (m.t === "dabort") { Dungeon.quit(); toast(m.text, "bad"); backToTown(); return; }
    if (m.t === "who") { const p = m.p; panel([el("h2", null, p.nick), el("p", null, "Lv " + p.lv + " · " + p.job + " · 던전 클리어 " + p.clears + "번"), preview(p.look, 160), row(btn("닫기", closePanel, "ghost"))]); return; }
  }
  function addOther(p) { A.others[p.id] = Object.assign({ tx: p.x, tz: p.z, walk: 0, t: 0 }, p); }

  /* ── 안내판(가운데 창) ── */
  function panel(nodes, wide) { const P = $("panel"); $("panelIn").replaceChildren(...nodes); $("panelIn").classList.toggle("wide", !!wide); P.hidden = false; }
  function closePanel() { $("panel").hidden = true; $("panelIn").replaceChildren(); }
  function row(...b) { const r = el("div", "btns"); r.append(...b); return r; }
  let toastT = 0;
  function toast(text, kind) { const t = $("toast"); t.textContent = text; t.className = "toast on " + (kind || ""); clearTimeout(toastT); toastT = setTimeout(() => { t.className = "toast"; }, 2600); }
  function ask(text, yes) { const box = el("div", "ask"); box.append(el("span", null, text), btn("수락", () => { yes(); box.remove(); }), btn("거절", () => box.remove(), "ghost")); $("asks").appendChild(box); setTimeout(() => box.remove(), 30000); }
  function preview(look, h, pose) { // 작은 캔버스에 캐릭터 — 걷는 모습을 계속 돌림
    const c = el("canvas", "pv"); c.width = h * 0.9 * 2; c.height = h * 1.15 * 2; c.style.width = h * 0.9 + "px"; c.style.height = h * 1.15 + "px";
    const x = c.getContext("2d"); let t = 0, alive = true;
    const tick = () => { if (!c.isConnected) { if (alive && t > 1) return; } t += 1 / 60; x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, c.width, c.height); x.save(); x.translate(h * 0.45, h * 1.1); drawChar(x, c.look || look, { st: pose || "idle", t, walk: t * 8 }, h / 120); x.restore(); requestAnimationFrame(tick); };
    c.look = look; requestAnimationFrame(tick); return c;
  }

  /* ── 로그인 없이 — 혼자 연습만 ── */
  function noLogin() {
    panel([el("h1", null, "封印劍錄"), el("p", "sub", "봉인검록 — 병무청 문파원 클로즈 베타"),
      el("p", null, "마을 · 캐릭터 저장 · 파티 · 거래는 병무청 홈페이지에 로그인한 문파원만 할 수 있어요. 홈페이지에 로그인한 뒤 위 메뉴 「봉인검록 베타」 로 들어와 주세요."),
      row(btn("병무청 홈페이지로", () => { location.href = "../byeongmu/"; }), btn("혼자 연습(저장 안 됨)", soloPractice, "ghost"))]);
  }
  function soloPractice() {
    A.solo = true; A.me = { id: "solo", nick: "연습생" }; A.char = { name: "연습생", look: LOOK.base("m"), lv: 1, atk: 33, def: 5, hpMax: 300, inv: [] };
    goDungeon({ d: "forest", members: [], host: "solo" });
  }

  /* ── 캐릭터 만들기 ── */
  function createScreen() { // 다섯 명 중 하나 — 옷 · 모자는 장비로 입힘(준비 중)
    A.scene = "menu"; let L = LOOK.base("m");
    const pv = preview(L, 220, "walk"), cards = el("div", "heroes");
    const draw = () => {
      pv.look = L;
      cards.replaceChildren(...HEROES.map(([k, name, job, g]) => {
        const b = el("button", "hero-card" + (L.hero === k ? " on" : "")); b.type = "button"; b.dataset.h = k;
        b.append(preview({ g, hero: k }, 70, "idle"), el("b", null, name), el("small", null, job));
        b.onclick = () => { L = Object.assign(LOOK.base(g), { hero: k }); draw(); }; return b;
      }));
    };
    draw();
    const make = btn("이 캐릭터로 만들기", () => { make.disabled = true; send({ t: "create", look: L }); });
    make.id = "makeBtn";
    panel([el("h2", null, "캐릭터 만들기"), el("p", "sub", (A.me ? A.me.nick : "") + " 님의 캐릭터 — 한 사람에 하나, 이름은 홈페이지 닉네임"),
      (() => { const w = el("div", "create"); const left = el("div", "cleft"); left.append(pv, btn("무작위", () => { L = LOOK.random(); draw(); }, "ghost")); const right = el("div", "cright"); right.append(el("p", "sub", "모습 고르기 — 연병장 다섯 명 중 하나. 옷 · 모자는 장비를 끼면 바뀌게 할 거예요(준비 중). 베타 동안 싸우는 법은 모두 무사(화염검)"), cards); w.append(left, right); return w; })(),
      row(make)], true);
  }


  /* ── 캐릭터 화면 ── */
  function charScreen() {
    A.scene = "menu"; Dungeon.quit(); const C = A.char;
    const info = el("div", "cinfo");
    info.append(el("h2", null, C.name), el("p", null, "Lv " + C.lv + " · " + C.job + " · 경험치 " + C.exp + " / " + C.need), el("p", null, "공격 " + C.atk + " · 방어 " + C.def + " · 체력 " + C.hpMax + " · " + C.gold.toLocaleString() + " 골드"), equipList(), bagList("char"));
    const keys = btn("키 설정", keyPanel, "ghost"), remake = btn("캐릭터 다시 만들기", () => { if (remake.dataset.sure) { send({ t: "remake" }); return; } remake.dataset.sure = 1; remake.textContent = "정말 지울까요? (Lv · 가방이 모두 사라져요)"; }, "ghost danger");
    const w = el("div", "create"); const left = el("div", "cleft"); left.append(preview(C.look, 220, "idle")); w.append(left, info);
    panel([w, row(btn("마을로 들어가기", enterTown), keys, remake)], true);
    $("hud").hidden = true;
  }
  function itemName(it) { const I = A.items[it.key]; return I.name + (it.plus ? " +" + it.plus : "") + (it.n > 1 ? " × " + it.n : ""); }
  function equipList() { const C = A.char, b = el("div", "equip"); ["weapon", "armor"].forEach((k) => { const it = C.inv.find((x) => x.uid === C.equip[k]); const s = el("span", null, (k === "weapon" ? "무기 " : "옷 ") + (it ? itemName(it) : "—")); if (it) s.style.color = GRADE[A.items[it.key].grade]; b.appendChild(s); }); return b; }
  /* 가방 — where: char(끼기) · shop(팔기) · smith(강화) · trade(올리기) */
  function bagList(where, pick) {
    const C = A.char, box = el("div", "bag");
    if (!C.inv.length) box.appendChild(el("p", "sub", "가방이 비었어요"));
    C.inv.forEach((it) => {
      const I = A.items[it.key], r = el("div", "item"), eq = it.uid === C.equip.weapon || it.uid === C.equip.armor;
      { const ic = el("span", "slot ico g" + (I.grade || 0)); ic.appendChild(icon(it.key, 40)); r.appendChild(ic); } // 아이콘
      const nm = el("span", null, itemName(it) + (eq ? " (끼는 중)" : "")); nm.style.color = GRADE[I.grade];
      const stat = el("small", null, I.atk ? "공격 " + Math.round(I.atk * (1 + (it.plus || 0) * 0.1)) : I.def ? "방어 " + Math.round(I.def * (1 + (it.plus || 0) * 0.1)) : I.heal ? "체력 40% 회복" : "재료");
      r.append(nm, stat);
      if (where === "char" && (I.kind === "weapon" || I.kind === "armor")) r.appendChild(btn(eq ? "빼기" : "끼기", () => send({ t: "equip", uid: it.uid }), "tiny"));
      if (where === "shop" && !eq) r.appendChild(btn("팔기 " + Math.floor(I.price / 2) * (it.n || 1) + "G", () => send({ t: "sell", uid: it.uid }), "tiny"));
      if (where === "smith" && !I.stack) r.appendChild(btn(it.plus >= 10 ? "최대" : "강화 " + 100 * (it.plus + 1) + "G · " + Math.round([1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][it.plus] * 100) + "%", () => send({ t: "enhance", uid: it.uid }), "tiny"));
      if (where === "trade" && !eq) { const on = pick.has(it.uid); const b = btn(on ? "빼기" : "올리기", () => { if (on) pick.delete(it.uid); else pick.add(it.uid); send({ t: "toffer", uids: [...pick], gold: offerGold }); }, "tiny" + (on ? " on" : "")); r.appendChild(b); } // 누르면 바로 서버에 올림
      box.appendChild(r);
    });
    return box;
  }
  let refreshFn = null;
  function refresh() { if (A.scene === "menu" && A.char && !$("panel").hidden && $("panelIn").querySelector(".cinfo")) return charScreen(); if (refreshFn) refreshFn(); hudText(); }

  /* ── 키 설정 ── */
  function keyPanel() {
    const box = el("div", "keys"); KEYS.panel(box);
    const back = A.scene === "town" ? closePanel : charScreen;
    panel([el("h2", null, "키 설정"), el("p", "sub", "바꿀 동작의 키를 누른 뒤 원하는 키를 누르세요. 이 기기에 저장돼요. 같은 키를 다른 동작이 쓰고 있으면 서로 바뀌어요."), box,
      row(btn("처음대로", () => { KEYS.reset(); KEYS.panel(box); }, "ghost"), btn("닫기", back))], true);
  }

  /* ── 마을 ── */
  const NPC = [
    { id: "chief", name: "문주", pic: "chief", x: 330, z: 420, look: { g: "m", face: 1, hair: 0, hc: 4, eye: 3, ec: 0, brow: 1, nose: 3, mouth: 1, skin: 1, mark: 3, oc: 5 }, talk: chiefTalk },
    { id: "shop", name: "상인 만복", pic: "shop", x: 720, z: 410, look: { g: "m", face: 0, hair: 4, hc: 1, eye: 5, ec: 1, brow: 2, nose: 0, mouth: 2, skin: 2, mark: 2, oc: 2 }, talk: shopTalk },
    { id: "smith", name: "대장장이 철산", pic: "smith", x: 1080, z: 410, look: { g: "m", face: 2, hair: 3, hc: 0, eye: 4, ec: 0, brow: 1, nose: 2, mouth: 4, skin: 3, mark: 1, oc: 3 }, talk: smithTalk },
    { id: "kh", name: "스승 강혁", x: 1420, z: 405, sprite: "kh", talk: () => masterTalk("kh") },
    { id: "hr", name: "스승 혜린", x: 1540, z: 415, sprite: "hr", talk: () => masterTalk("hr") },
    { id: "ds", name: "스승 대성", x: 1660, z: 405, sprite: "ds", talk: () => masterTalk("ds") },
    { id: "je", name: "스승 지은", x: 1780, z: 415, sprite: "je", talk: () => masterTalk("je") },
    { id: "mj", name: "스승 무진", x: 1900, z: 405, sprite: "mj", talk: () => masterTalk("mj") },
    { id: "herb", name: "약초꾼 순덕", pic: "herb", x: 530, z: 470, talk: () => say("약초꾼 순덕", ["숲에 갈 거면 물약은 꼭 챙겨 가요. 상인 만복네서 팔아요.", "요즘 숲 안쪽은 늑대가 많아서 약초 캐러 가기도 무서워요."]) },
    { id: "kid", name: "꼬마 돌쇠", pic: "kid", x: 2120, z: 470, talk: () => say("꼬마 돌쇠", ["나도 크면 스승님들처럼 칼 쓸 거야!", "형(누나), 수문장 아저씨 뒤 문으로 들어가면 고블린 있대!"]) },
    { id: "gate", name: "수문장", pic: "gate", x: 2380, z: 430, look: { g: "m", face: 2, hair: 4, hc: 0, eye: 1, ec: 0, brow: 3, nose: 1, mouth: 1, skin: 2, mark: 0, oc: 1 }, talk: gateTalk },
  ];
  const H5 = new Image(); H5.src = "img/heroes5.png";
  const NPCIMG = new Image(); NPCIMG.src = "img/npc.png" + (V ? "?v=" + V : ""); // 제미나이 마을 사람 그림
  function enterTown() {
    closePanel(); A.scene = "town"; A.hero = A.hero || { x: 260, z: 440, face: 1, st: "idle", walk: 0, t: 0 };
    A.hero.x = Math.min(A.hero.x, TOWN_W - 300);
    send({ t: "town", x: Math.round(A.hero.x), z: Math.round(A.hero.z) });
    $("hud").hidden = false; hudText(); drawParty(); setPad("town");
  }
  function hudText() { if (!A.char) return; $("hudName").textContent = A.char.name + " · Lv " + A.char.lv; $("hudGold").textContent = A.char.gold.toLocaleString() + " G"; }
  let mvT = 0, lastMv = "";
  function townStep(dt) {
    const H = A.hero, [ax, az, run] = axis(), typing = document.activeElement && document.activeElement.tagName === "INPUT";
    H.t += dt;
    if (!$("panel").hidden || typing) { H.st = "idle"; }
    else {
      const sp = run ? 380 : 240;
      H.x = clamp(H.x + ax * sp * dt, 40, TOWN_W - 40); H.z = clamp(H.z + az * 160 * dt, Z0, Z1);
      if (ax) H.face = Math.sign(ax);
      H.st = ax || az ? (run ? "run" : "walk") : "idle"; if (ax || az) H.walk += dt * (run ? 14 : 9);
      if (KEYS.take("talk")) talkNear();
      if (KEYS.take("bag")) bagPanel();
      if (H.x > TOWN_W - 60) { H.x = TOWN_W - 140; gateTalk(); }
    }
    if (KEYS.take("chat")) $("chatIn").focus();
    if (KEYS.take("menu")) { if (!$("panel").hidden) closePanel(); }
    for (const id in A.others) { const o = A.others[id]; o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.z += (o.tz - o.z) * Math.min(1, dt * 10); o.t += dt; if (o.st === "walk" || o.st === "run") o.walk += dt * 9; }
    for (const id in A.bubbles) if ((A.bubbles[id].t -= dt) <= 0) delete A.bubbles[id];
    A.camX += (clamp(H.x - VW * 0.45, 0, TOWN_W - VW) - A.camX) * Math.min(1, dt * 8);
    if ((mvT -= dt) <= 0) { mvT = 0.1; const k = Math.round(H.x) + "," + Math.round(H.z) + "," + H.face + "," + H.st; if (k !== lastMv) { lastMv = k; send({ t: "mv", x: Math.round(H.x), z: Math.round(H.z), face: H.face, st: H.st }); } }
  }
  function nearNpc() { const H = A.hero; let best = null, bd = 110; NPC.forEach((n) => { const d = Math.abs(n.x - H.x) + Math.abs(n.z - H.z) * 0.5; if (d < bd) { bd = d; best = n; } }); return best; }
  function talkNear() { const n = nearNpc(); if (n) n.talk(); }
  function townDraw() {
    const cx = A.camX;
    BG.draw(g, "town", cx, VW, VH, Z0, { par: 1, end: { pic: "town", at: TOWN_W - 70, f: 0.959, fade: 0 } }); // 마을은 한 장으로 길게 이어 붙인 그림(뒤집은 마을 · 마을 · 이어지는 마을과 던전 문) — 문 가운데가 입구 자리
    if (!BG.pics.town || !BG.pics.town.naturalWidth) townHouses(cx);
    const bodies = [];
    NPC.forEach((n) => bodies.push([n.z, () => drawNpc(n, cx)]));
    for (const id in A.others) { const o = A.others[id]; bodies.push([o.z, () => drawPerson(o, o.look, cx, o.nick, false, id)]); }
    const H = A.hero; bodies.push([H.z + 0.1, () => drawPerson(H, A.char.look, cx, A.char.name, true, A.me.id)]);
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    const n = nearNpc();
    if (n && $("panel").hidden) { g.textAlign = "center"; g.font = "700 14px 'Noto Sans KR', sans-serif"; const t = (touch ? "말걸기 단추" : KEYS.label("talk")) + " — " + n.name + " 와(과) 이야기"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(t, n.x - cx, n.z - 150); g.fillStyle = "#ffe08a"; g.fillText(t, n.x - cx, n.z - 150); }
    // 오른쪽 끝 — 던전 입구
    const gx = TOWN_W - 70 - cx, gate = BG.pics.town && BG.pics.town.naturalWidth; if (gx < VW + 100) { if (!gate) { g.fillStyle = "rgba(160,60,255,.25)"; g.beginPath(); g.ellipse(gx, 410, 60, 130, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#c58cff"; g.lineWidth = 4; g.stroke(); } g.fillStyle = "#fff"; g.font = "800 14px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText("던전 입구", gx, gate ? 120 : 260); g.fillText("던전 입구", gx, gate ? 120 : 260); }
  }
  /* 집 · 가게 — 기와지붕(제미나이 마을 그림이 오면 그것으로) */
  function townHouses(cx) {
    const house = (x, w, label, col) => { const X = x - cx; if (X > VW + 300 || X + w < -300) return;
      g.fillStyle = "#5a4636"; g.fillRect(X, Z0 - 170, w, 140); g.fillStyle = "#3a2c22"; for (let i = 0; i < w; i += 40) g.fillRect(X + i, Z0 - 170, 4, 140);
      g.fillStyle = col || "#2a2a36"; g.beginPath(); g.moveTo(X - 30, Z0 - 165); g.quadraticCurveTo(X + w / 2, Z0 - 230, X + w + 30, Z0 - 165); g.lineTo(X + w + 10, Z0 - 150); g.lineTo(X - 10, Z0 - 150); g.fill();
      g.fillStyle = "#c9a24a"; g.fillRect(X + w / 2 - 50, Z0 - 140, 100, 26); g.fillStyle = "#2a1a10"; g.font = "800 15px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.fillText(label, X + w / 2, Z0 - 121); };
    house(200, 260, "병무청 본산", "#3a2a40"); house(600, 230, "만복 상회"); house(950, 230, "철산 대장간", "#40302a"); house(1360, 620, "스승의 수련장", "#2a3a40"); house(2240, 200, "수문 초소");
    const fx = 1080 - cx; g.fillStyle = "rgba(255,140,40," + (0.3 + Math.random() * 0.2) + ")"; g.beginPath(); g.arc(fx - 60, Z0 - 50, 26, 0, Math.PI * 2); g.fill(); // 대장간 불
  }
  function drawNpc(n, cx) {
    const x = n.x - cx; if (x < -100 || x > VW + 100) return;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, n.z, 26, 7, 0, 0, Math.PI * 2); g.fill();
    const NP = n.pic && FR.npc && FR.npc[n.pic];
    if (NP && NPCIMG.complete && NPCIMG.naturalWidth) { const k = (n.pic === "kid" ? 92 : 124) / NP[3], bob = Math.sin(performance.now() / 600 + n.x) * 1.2; g.drawImage(NPCIMG, NP[0], NP[1], NP[2], NP[3], x - NP[2] * k / 2, n.z + 4 - NP[3] * k + bob, NP[2] * k, NP[3] * k); }
    else if (n.sprite) { const F = FR.heroes && FR.heroes[n.sprite]; if (F && H5.complete) { const f = F.front, k = 0.95; g.drawImage(H5, f[0], f[1], f[2], f[3], x - f[2] * k / 2, n.z - f[3] * k + 4, f[2] * k, f[3] * k); } }
    else { g.save(); g.translate(x, n.z + 2); g.scale(-1, 1); drawChar(g, n.look, { st: "idle", t: performance.now() / 1000 }, 1); g.restore(); }
    g.font = "800 13px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(n.name, x, n.z - 128); g.fillStyle = "#9df59a"; g.fillText(n.name, x, n.z - 128);
  }
  function drawPerson(P, look, cx, nick, me, id) {
    const x = P.x - cx; if (x < -100 || x > VW + 100) return;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, P.z, 24, 7, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(x, P.z + 2); if (P.face < 0) g.scale(-1, 1); drawChar(g, look, { st: P.st === "run" ? "run" : P.st === "walk" ? "walk" : "idle", t: P.t, walk: P.walk }, 1); g.restore();
    const party = A.party && A.party.members.some((m) => m.id === id);
    g.font = "700 12px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; const label = nick + (P.lv ? " Lv" + P.lv : ""); g.strokeText(label, x, P.z - 128); g.fillStyle = me ? "#ffe08a" : party ? "#7fe3ff" : "#fff"; g.fillText(label, x, P.z - 128);
    const B = A.bubbles[id]; if (B) { g.font = "600 13px 'Noto Sans KR', sans-serif"; const w = Math.min(260, g.measureText(B.text).width + 20); g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); if (g.roundRect) g.roundRect(x - w / 2, P.z - 176, w, 28, 10); else g.rect(x - w / 2, P.z - 176, w, 28); g.fill(); g.fillStyle = "#1a1012"; g.fillText(B.text.slice(0, 30), x, P.z - 157); }
  }
  /* 다른 사람 누르기 — 정보 · 파티 · 거래 */
  cv.addEventListener("click", (e) => {
    if (A.scene !== "town" || !$("panel").hidden) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * VW + A.camX, y = (e.clientY - r.top) / r.height * VH;
    for (const id in A.others) { const o = A.others[id]; if (Math.abs(o.x - x) < 30 && y > o.z - 125 && y < o.z + 10) return personMenu(o); }
    for (const n of NPC) if (Math.abs(n.x - x) < 30 && y > n.z - 125 && y < n.z + 10 && Math.abs(n.x - A.hero.x) < 200) return n.talk();
  });
  function personMenu(o) {
    panel([el("h2", null, o.nick + " · Lv " + (o.lv || 1)), preview(o.look, 140),
      row(btn("정보 보기", () => send({ t: "who", id: o.id }), "ghost"), btn("파티 신청", () => { send({ t: "pinv", to: o.id }); closePanel(); }), btn("거래 신청", () => { send({ t: "treq", to: o.id }); closePanel(); }), btn("닫기", closePanel, "ghost"))]);
  }
  /* 파티 칸 */
  function drawParty() {
    const P = A.party, box = $("partyBox");
    box.hidden = !P || A.scene !== "town";
    if (!P) return;
    box.replaceChildren(el("b", null, "파티 " + P.members.length + "/4"), ...P.members.map((m) => el("div", null, (m.id === P.leader ? "★ " : "· ") + m.nick + " Lv" + m.lv + (m.room && m.room.startsWith("d:") ? " (던전)" : ""))), btn("파티 나가기", () => send({ t: "pleave" }), "tiny"));
  }
  /* 채팅 */
  function chatLine(nick, text) { const log = $("chatLog"), d = el("div"); d.append(el("b", null, nick + ": "), document.createTextNode(text)); log.appendChild(d); while (log.children.length > 7) log.firstChild.remove(); }
  $("chatIn").addEventListener("keydown", (e) => { if (e.key === "Enter") { const t = e.target.value.trim(); if (t) send({ t: "chat", text: t }); e.target.value = ""; e.target.blur(); e.preventDefault(); } else if (e.key === "Escape") e.target.blur(); e.stopPropagation(); });

  /* ── NPC 이야기 ── */
  function say(name, pages) { // 짧은 말 — 여러 장 넘기기
    let i = 0; const p = el("p", "story", pages[0]);
    const next = btn(pages.length > 1 ? "다음" : "닫기", () => { i++; if (i >= pages.length) return closePanel(); p.textContent = pages[i]; if (i === pages.length - 1) next.textContent = "닫기"; });
    panel([el("h2", null, name), p, row(next)]);
  }
  function chiefTalk() {
    const pages = ["오백 년 전, 다섯 문파의 고수들이 붉은 마왕 적염을 다섯 봉인석에 묶어 두었다네.", "그런데 요즘 봉인석이 하나씩 깨지고 있어. 숲에는 잡귀가 들끓고, 고블린들까지 날뛰지.", "자네 같은 신입이라도 힘을 보태 주게. 오른쪽 수문장에게 가면 던전으로 갈 수 있다네.", "스승들에게 배우고, 대장장이에게 칼을 벼리고, 동료와 함께 가게. 혼자서는 멀리 못 가는 법이지."];
    let i = 0; const p = el("p", "story", pages[0]);
    const next = btn("다음", () => { i++; if (i >= pages.length) return closePanel(); p.textContent = pages[i]; if (i === pages.length - 1) next.textContent = "알겠습니다"; });
    panel([el("h2", null, "문주"), p, row(next)]);
  }
  function shopTalk() {
    refreshFn = shopTalk;
    const buy = el("div", "bag"); A.shop.forEach((k) => { const I = A.items[k], r = el("div", "item"); { const ic = el("span", "slot ico g" + (I.grade || 0)); ic.appendChild(icon(k, 40)); r.appendChild(ic); } const nm = el("span", null, I.name); nm.style.color = GRADE[I.grade]; r.append(nm, el("small", null, I.price + " G"), btn("1개", () => send({ t: "buy", key: k, n: 1 }), "tiny")); if (I.stack) r.appendChild(btn("10개", () => send({ t: "buy", key: k, n: 10 }), "tiny")); buy.appendChild(r); });
    panel([el("h2", null, "상인 만복 — 「싸게 드립니다요!」"), el("p", "sub", "가진 돈 " + A.char.gold.toLocaleString() + " G"), el("b", null, "사기"), buy, el("b", null, "팔기(산 값의 절반)"), bagList("shop"), row(btn("닫기", () => { refreshFn = null; closePanel(); }, "ghost"))], true);
  }
  function smithTalk() {
    refreshFn = smithTalk;
    panel([el("h2", null, "대장장이 철산 — 「칼은 두드릴수록 단단해지지」"), el("p", "sub", "강화는 +10 까지. +5 까지는 실패해도 그대로, +6 부터는 실패하면 한 단계 내려가요. 장비가 깨지지는 않아요. 가진 돈 " + A.char.gold.toLocaleString() + " G"), bagList("smith"), row(btn("닫기", () => { refreshFn = null; closePanel(); }, "ghost"))], true);
  }
  function masterTalk(k) {
    const N = { kh: "강혁", hr: "혜린", ds: "대성", je: "지은", mj: "무진" }, J = { kh: "무사", hr: "도사", ds: "수호자", je: "사수", mj: "자객" };
    if (k === "kh") return panel([el("h2", null, "스승 강혁 — 무사"), el("p", "story", "칼끝에 불을 실어라. 세 번 베면 적이 뜨고, 뜬 적은 떨어질 때까지 벨 수 있다."),
      el("p", null, "평타 " + KEYS.label("atk") + " (3타째 띄우기) · 점프 " + KEYS.label("jump") + " · 구르기 " + KEYS.label("roll") + " · 화염 검기 " + KEYS.label("s1") + " · 화염검 진 " + KEYS.label("s2") + " · 화염 돌진 " + KEYS.label("s3") + " · 물약 " + KEYS.label("potion")), row(btn("명심하겠습니다", closePanel))]);
    panel([el("h2", null, "스승 " + N[k] + " — " + J[k]), el("p", "story", "아직 " + J[k] + "의 길은 열리지 않았다. 곧 가르쳐 주마."), el("p", "sub", "베타에서는 무사만 고를 수 있어요. 다른 직업은 준비 중이에요."), row(btn("닫기", closePanel))]);
  }
  function gateTalk() {
    const list = el("div", "bag"), P = A.party, leader = !P || P.leader === A.me.id;
    Object.keys(A.dungeons).forEach((k) => { const D = A.dungeons[k], r = el("div", "item"), locked = D.lv && A.char.lv < D.lv;
      r.append(el("span", null, D.name), el("small", null, locked ? "Lv " + D.lv + " 부터" : "보상 " + D.gold[0] + "~" + D.gold[1] + " G · 경험치 " + D.exp));
      const b = btn(P ? (leader ? "파티로 들어가기" : "파티장이 들어가요") : "들어가기", () => { send({ t: "dstart", d: k }); }, "tiny"); b.disabled = locked || !leader; r.appendChild(b); list.appendChild(r); });
    panel([el("h2", null, "수문장 — 「어디로 가겠나?」"), list, el("p", "sub", P ? "파티장이 들어가면 마을에 있는 파티원이 모두 같이 들어가요." : "파티를 맺으면 같이 들어갈 수 있어요(다른 사람을 눌러 파티 신청)."), row(btn("닫기", closePanel, "ghost"))], true);
  }
  /* ── 가방 — 오른쪽 창. 종류별로 묶고(접기 · 펴기), 칸은 등급 색 · 아이콘 · +강화 · 개수 · E(끼는 중). 칸을 누르면 아래에 정보 · 끼기 ── */
  const ITEM_IMG = new Image(); ITEM_IMG.src = "img/items.png" + (V ? "?v=" + V : "");
  const BAG_MAX = 100, KINDS = [["weapon", "무기", "⚔"], ["armor", "방어구", "🛡"], ["potion", "소모품", "🧪"], ["material", "재료", "💎"]];
  const bagUI = { tab: "bag", sort: "kind", shut: {}, sel: null };
  function icon(key, size) {
    const c = document.createElement("canvas"); c.width = c.height = size; const r = FR.items && FR.items[key], g2 = c.getContext("2d");
    const put = () => { if (!r) return; const k = size * 0.84 / Math.max(r[2], r[3]); g2.drawImage(ITEM_IMG, r[0], r[1], r[2], r[3], (size - r[2] * k) / 2, (size - r[3] * k) / 2, r[2] * k, r[3] * k); };
    if (ITEM_IMG.complete) put(); else ITEM_IMG.addEventListener("load", put, { once: true });
    return c;
  }
  function slot(it) {
    const I = A.items[it.key], C = A.char, b = el("button", "slot g" + (I.grade || 0)); b.type = "button";
    b.appendChild(icon(it.key, 64));
    if (it.uid === C.equip.weapon || it.uid === C.equip.armor) b.appendChild(el("span", "eq", "E"));
    if (it.plus) b.appendChild(el("span", "pl", "+" + it.plus));
    if (it.n > 1) b.appendChild(el("span", "ct", String(it.n)));
    if (bagUI.sel === it.uid) b.classList.add("sel");
    b.onclick = () => { bagUI.sel = bagUI.sel === it.uid ? null : it.uid; bagPanel(); };
    return b;
  }
  /* 장비 — 가운데 내 모습, 왼쪽 무기 · 옷, 오른쪽은 앞으로 생길 칸(투구 · 장갑 · 신발 · 허리띠 · 목걸이 · 반지) */
  function equipView() {
    const C = A.char, w = el("div", "eqv");
    const head = el("div", "eqv-head"); head.append(el("div", "eqv-name", "레벨 " + C.lv + "  " + C.name), el("div", "eqv-guild", "🏯 병무청"));
    const power = Math.round(C.atk * 10 + C.def * 12 + C.hpMax * 0.5 + C.lv * 30);
    const stat = el("div", "eqv-stat"); stat.append(el("div", null, "⚔ " + power.toLocaleString()), el("small", null, "전투력"), el("div", null, "공격 " + C.atk + " · 방어 " + C.def + " · 체력 " + C.hpMax));
    const eqSlot = (k, name) => { const it = C.inv.find((x) => x.uid === C.equip[k]); if (!it) { const e = el("div", "slot eqv-empty", name); return e; } return slot(it); };
    const lock = (name) => el("div", "slot eqv-lock", "🔒\n" + name);
    const left = el("div", "eqv-col"); left.append(eqSlot("weapon", "무기"), eqSlot("armor", "옷"));
    const mid = el("div", "eqv-mid"); mid.appendChild(preview(C.look, 150, "idle"));
    const right = el("div", "eqv-col2"); ["투구", "목걸이", "장갑", "반지", "허리띠", "신발"].forEach((n) => right.appendChild(lock(n)));
    const body = el("div", "eqv-body"); body.append(left, mid, right);
    w.append(head, stat, body, el("p", "sub", "🔒 칸은 다음 업데이트에 열려요. 장비는 「가방」 탭에서 눌러 끼워요."));
    return w;
  }
  function bagPanel() {
    refreshFn = bagPanel; const C = A.char, S = $("bagSide"); if (!C) return;
    const sortK = { kind: () => 0, grade: (a, b) => A.items[b.key].grade - A.items[a.key].grade, plus: (a, b) => (b.plus || 0) - (a.plus || 0) }[bagUI.sort];
    const tabs = el("div", "bs-top");
    [["bag", "🎒 가방"], ["equip", "🗡 장비"]].forEach(([k, n]) => { const b = el("button", "bs-tab" + (bagUI.tab === k ? " on" : ""), n); b.onclick = () => { bagUI.tab = k; bagPanel(); }; tabs.appendChild(b); });
    const x = el("button", "bs-x", "✕"); x.onclick = () => { refreshFn = null; S.hidden = true; }; tabs.appendChild(x);
    const sel = document.createElement("select");
    [["kind", "종류순"], ["grade", "등급순"], ["plus", "강화순"]].forEach(([v, n]) => { const o = document.createElement("option"); o.value = v; o.textContent = n; sel.appendChild(o); });
    sel.value = bagUI.sort; sel.onchange = () => { bagUI.sort = sel.value; bagPanel(); };
    const bar = el("div", "bs-bar"); bar.append(el("span", "bs-cnt", "▦ " + C.inv.length + " / " + BAG_MAX + "   ·   " + C.gold.toLocaleString() + " G"), sel);
    const list = el("div", "bs-list"), rail = el("div", "bs-rail");
    const show = bagUI.tab === "equip" ? [] : C.inv;
    if (bagUI.tab === "equip") list.appendChild(equipView());
    const all = el("button"); all.innerHTML = "<b>▦</b>" + show.length; all.onclick = () => { list.scrollTop = 0; }; rail.appendChild(all);
    KINDS.forEach(([k, name, ic]) => {
      const items = show.filter((it) => A.items[it.key].kind === k).sort(sortK); if (!items.length) return;
      const sec = el("div", "bs-sec"), head = el("div", "bs-head"); head.append(el("span", null, name), el("span", null, bagUI.shut[k] ? "▼" : "▲"));
      const grid = el("div", "bs-grid" + (bagUI.shut[k] ? " shut" : "")); items.forEach((it) => grid.appendChild(slot(it)));
      for (let i = items.length % 4 ? 4 - items.length % 4 : 0; i > 0; i--) grid.appendChild(el("div", "slot")); // 빈 칸으로 줄 채우기
      head.onclick = () => { bagUI.shut[k] = !bagUI.shut[k]; bagPanel(); };
      sec.append(head, grid); list.appendChild(sec);
      const rb = el("button"); rb.innerHTML = "<b>" + ic + "</b>" + items.length; rb.onclick = () => sec.scrollIntoView({ behavior: "smooth", block: "start" }); rail.appendChild(rb);
    });
    if (!show.length && bagUI.tab !== "equip") list.appendChild(el("p", "sub", "가방이 비었어요"));
    if (bagUI.tab === "equip") rail.hidden = true;
    const info = el("div", "bs-info"), it = C.inv.find((o) => o.uid === bagUI.sel);
    if (it) {
      const I = A.items[it.key], eq = it.uid === C.equip.weapon || it.uid === C.equip.armor, txt = el("div"); txt.style.flex = "1";
      const nm = el("div", "nm", itemName(it)); nm.style.color = GRADE[I.grade];
      txt.append(nm, el("small", null, (I.atk ? "공격 " + Math.round(I.atk * (1 + (it.plus || 0) * 0.1)) : I.def ? "방어 " + Math.round(I.def * (1 + (it.plus || 0) * 0.1)) : I.heal ? "체력 40% 회복 · 던전에서 " + KEYS.label("potion") : "재료 · 상인에게 팔 수 있어요") + (eq ? " · 끼는 중" : "")));
      const s2 = el("div", "slot g" + (I.grade || 0)); s2.style.width = "48px"; s2.appendChild(icon(it.key, 48)); info.append(s2, txt);
      if (I.kind === "weapon" || I.kind === "armor") info.appendChild(btn(eq ? "빼기" : "끼기", () => send({ t: "equip", uid: it.uid }), "tiny"));
    } else info.appendChild(el("small", null, "칸을 누르면 정보 · 끼기"));
    const body = el("div", "bs-body"); body.append(list, rail);
    const keep = S.querySelector(".bs-list"), top = keep ? keep.scrollTop : 0;
    S.replaceChildren(tabs, bar, body, info); S.hidden = false; list.scrollTop = top;
  }

  /* ── 거래 창 ── */
  let pick = new Set(), offerGold = 0;
  function tradePanel() {
    const T = A.trade; if (!T) return;
    const mine = el("div", "tcol"), theirs = el("div", "tcol");
    if (!pick.size && T.mine.uids.length) pick = new Set(T.mine.uids);
    const gold = el("input"); gold.type = "number"; gold.min = 0; gold.value = offerGold || T.mine.gold || 0; gold.oninput = () => { offerGold = Math.max(0, parseInt(gold.value, 10) || 0); }; gold.onchange = () => send({ t: "toffer", uids: [...pick], gold: offerGold }); // 칸을 벗어나면 바로 올림
    mine.append(el("b", null, "내가 줄 것"), bagList("trade", pick), el("label", null, "골드 "), gold, btn("골드 올리기", () => send({ t: "toffer", uids: [...pick], gold: offerGold }), "tiny"));
    theirs.append(el("b", null, T.otherNick + " 님이 줄 것"), ...(T.theirs.items || []).map((n) => el("div", "item", n)), el("p", null, "골드 " + T.theirs.gold));
    const w = el("div", "trade"); w.append(mine, theirs);
    panel([el("h2", null, "거래 — " + T.otherNick), w, el("p", "sub", (T.okMe ? "나: 확인함" : "나: 아직") + " · " + (T.okThem ? "상대: 확인함" : "상대: 아직") + " — 둘 다 확인하면 바로 바뀌어요. 올린 것을 바꾸면 확인이 풀려요."),
      row(btn(T.okMe ? "확인함" : "확인", () => { if (offerGold !== (T.mine.gold || 0) || pick.size !== T.mine.uids.length) send({ t: "toffer", uids: [...pick], gold: offerGold }); send({ t: "tok" }); }), btn("거래 취소", () => { send({ t: "tcancel" }); pick = new Set(); offerGold = 0; }, "ghost"))], true);
  }

  /* ── 던전 ── */
  function goDungeon(m, watch) {
    closePanel(); A.scene = "dungeon"; A.reward = null; A.watch = !!watch; $("hud").hidden = true; $("partyBox").hidden = true; setPad(watch ? "none" : "dungeon");
    const C = A.char, party = watch || (m.members && m.members.length > 1) ? { host: m.host, members: m.members } : null;
    const pot = (C.inv || []).find((x) => x.key === "p1");
    Dungeon.start({ d: m.d, me: A.me.id, look: C.look, nick: C.name, stats: { hpMax: C.hpMax, atk: C.atk, def: C.def }, potions: pot ? pot.n : 0, party,
      send: (data, to) => send({ t: "relay", data, to }), usePotion: () => send({ t: "usePotion" }), axis, watch: !!watch,
      onEnd: (res) => { if (watch) return panel([el("h2", null, "관전 끝 — " + (res.win ? "클리어" : "실패")), el("p", null, Math.floor(res.sec / 60) + "분 " + (res.sec % 60) + "초"), row(btn("마을로", backToTown))]); A.result = res; if (res.win && !A.solo) send({ t: "dclear" }); showResult(); } });
  }
  function showResult() {
    const R = A.result, W = A.reward, sec = R.sec;
    const grade = !R.win ? "-" : R.hits <= 3 && sec < 150 ? "S" : R.hits <= 8 ? "A" : R.hits <= 16 ? "B" : "C";
    const lines = [el("h1", null, R.win ? "클리어!" : "실패…"), el("div", "grade", grade), el("p", null, Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + " · 최대 " + R.maxCombo + " 연속 · 맞은 횟수 " + R.hits)];
    if (R.win && !A.solo) lines.push(el("p", "reward", W ? "보상 " + W.gold + " G · 경험치 " + W.exp + (W.items.length ? " · " + W.items.join(", ") : "") + (W.lvUp ? " · 레벨 업! Lv " + W.lv : "") : "보상 받는 중…"));
    lines.push(row(A.solo ? btn("다시 하기", soloPractice) : btn("마을로", backToTown), A.solo ? btn("처음으로", () => { A.solo = false; noLogin(); }, "ghost") : el("span")));
    panel(lines);
  }
  function showReward() { if (A.result && A.scene === "dungeon") showResult(); }
  /* ── 운영자(기준량만 — 서버가 확인) ── 골드 · 아이템 주기/복사 · 레벨 · 던전 투명 관전 */
  function opPanel(runs) {
    refreshFn = () => { if (!$("panel").hidden && $("panelIn").querySelector(".opw")) opPanel(runs); else refreshFn = null; }; // 가방이 바뀌면 복사 목록도 새로
    const who = el("input", "opw"); who.value = A.opWho || ""; who.oninput = () => { A.opWho = who.value; }; who.placeholder = "받을 사람 닉네임(비우면 나)"; who.style.cssText = "width:100%;box-sizing:border-box;margin:4px 0;padding:6px 8px;border-radius:6px;border:1px solid #6b5a3a;background:#120a0c;color:#fff;font:inherit";
    const num = (v, w) => { const i = el("input"); i.type = "number"; i.value = v; i.style.cssText = "width:" + (w || 90) + "px;padding:4px 6px;border-radius:6px;border:1px solid #6b5a3a;background:#120a0c;color:#fff;font:inherit"; return i; };
    const gold = num(10000, 110), lv = num(A.char ? A.char.lv : 1, 60), cnt = num(1, 60), plus = num(0, 50);
    const pick = document.createElement("select"); pick.style.cssText = "padding:4px;border-radius:6px;background:#120a0c;color:#fff;border:1px solid #6b5a3a;font:inherit";
    Object.keys(A.items || {}).forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = A.items[k].name; pick.appendChild(o); });
    const nick = () => who.value.trim();
    const line = (...n) => { const r = el("div", "item"); r.append(...n); return r; };
    const copy = el("div", "bag"); (A.char.inv || []).filter((x) => !A.items[x.key].stack).forEach((x) => copy.appendChild(line(el("span", null, A.items[x.key].name + (x.plus ? " +" + x.plus : "")), btn("복사해 주기", () => send({ t: "op", a: "copy", uid: x.uid, nick: nick(), n: 1 }), "tiny"))));
    const watch = el("div", "bag");
    if (runs) { if (!runs.length) watch.appendChild(el("p", "sub", "지금 열린 던전이 없어요."));
      runs.forEach((R) => watch.appendChild(line(el("span", null, R.name + " · " + R.members.join(", ")), el("small", null, Math.floor(R.sec / 60) + "분째"), btn("투명 관전", () => send({ t: "op", a: "watch", run: R.run }), "tiny")))); }
    panel([el("h2", null, "운영자 — 기준량"), el("p", "sub", "이 창과 기능은 기준량 계정에만 보이고, 서버도 기준량만 받아 줘요."), who,
      line(el("span", null, "골드 주기(빼려면 −)"), gold, btn("주기", () => send({ t: "op", a: "gold", nick: nick(), n: gold.value }), "tiny")),
      line(el("span", null, "아이템 만들어 주기"), pick, el("small", null, "+"), plus, el("small", null, "×"), cnt, btn("주기", () => send({ t: "op", a: "item", nick: nick(), key: pick.value, plus: plus.value, n: cnt.value }), "tiny")),
      (() => { const nt = el("input"); nt.value = "봉인검록 1분 뒤 업데이트로 인해 강제 종료되오니, 안전하게 접속 종료하시길 바랍니다."; nt.style.cssText = "flex:1;min-width:0;padding:4px 6px;border-radius:6px;border:1px solid #6b5a3a;background:#120a0c;color:#fff;font:inherit"; const sec = num(60, 60); return line(el("span", null, "전체 공지"), nt, sec, el("small", null, "초"), btn("보내기", () => send({ t: "op", a: "notice", text: nt.value, sec: sec.value }), "tiny")); })(),
      line(el("span", null, "레벨 정하기"), lv, btn("정하기", () => send({ t: "op", a: "lv", nick: nick(), lv: lv.value }), "tiny")),
      el("p", "sub", "내 가방 장비 복사 — 강화 수치까지 그대로"), copy,
      el("p", "sub", "사냥터 투명 관전 — 들어가도 그 판 사람들 화면 · 목록에 안 나와요"), runs ? watch : row(btn("열린 던전 보기", () => send({ t: "op", a: "list" }), "tiny")),
      row(btn("닫기", closePanel, "ghost"))], true);
  }
  function backToTown() { Dungeon.quit(); send({ t: "back" }); enterTown(); }

  /* ── 움직임 입력 — 키(설정한 키) · 휴대폰 막대. 같은 쪽 두 번 = 달리기 ── */
  let stick = null, runOn = false; const lastTap = {};
  addEventListener("keydown", (e) => { if (e.repeat || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; if (e.code === KEYS.key("left") || e.code === KEYS.key("right")) { const now = performance.now(); if (now - (lastTap[e.code] || 0) < 260) runOn = true; lastTap[e.code] = now; } });
  addEventListener("keyup", (e) => { if (e.code === KEYS.key("left") || e.code === KEYS.key("right")) runOn = false; });
  function axis() {
    if (stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, L = Math.hypot(dx, dy); if (L < 8) return [0, 0, false]; const m = Math.min(1, L / 45); return [dx / L * m, dy / L * m, L > 60]; }
    const D = KEYS.down; return [(D.right ? 1 : 0) - (D.left ? 1 : 0), (D.down ? 1 : 0) - (D.up ? 1 : 0), runOn];
  }
  function local(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; }
  cv.addEventListener("pointerdown", (e) => { if (!touch && e.pointerType === "mouse") return; const [x, y] = local(e); if (x < VW * 0.5) { stick = { id: e.pointerId, ox: x, oy: y, x, y }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} } });
  cv.addEventListener("pointermove", (e) => { if (stick && stick.id === e.pointerId) { const [x, y] = local(e); stick.x = x; stick.y = y; } });
  const lift = (e) => { if (stick && stick.id === e.pointerId) stick = null; };
  cv.addEventListener("pointerup", lift); cv.addEventListener("pointercancel", lift);
  /* 휴대폰 단추 — 마을: 말걸기 · 가방 · 채팅 / 던전: 공격 · 점프 · 회피 · 스킬 3 · 물약 */
  const PADS = { none: [], town: [["말걸기", "talk", "right:4%;bottom:10%;width:13%;height:23%"], ["가방", "bag", "right:19%;bottom:6%;width:9%;height:16%"], ["채팅", "chat", "right:4%;bottom:38%;width:9%;height:16%"]],
    dungeon: [["공격", "atk", "right:4%;bottom:8%;width:17%;height:30.2%;font-size:17px"], ["점프", "jump", "right:23%;bottom:5%;width:10%;height:17.8%"], ["회피", "roll", "right:4%;bottom:42%;width:10%;height:17.8%"], ["검기", "s1", "right:24%;bottom:26%;width:9%;height:16%"], ["검진", "s2", "right:16%;bottom:43%;width:9%;height:16%"], ["돌진", "s3", "right:15%;bottom:62%;width:9%;height:16%"], ["물약", "potion", "right:26%;bottom:46%;width:8%;height:14%"]] };
  function setPad(which) {
    const pad = $("pad"); pad.hidden = !touch; if (!touch) return;
    pad.replaceChildren(...PADS[which].map(([t, a, css]) => { const b = el("div", "tb", t); b.style.cssText = css; b.dataset.a = a;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (a === "chat") { $("chatIn").focus(); return; } KEYS.press(a, true); b.classList.add("on"); });
      const up = () => { KEYS.press(a, false); b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up); return b; }));
  }
  $("hudOp").onclick = () => opPanel(null); $("hudBag").onclick = bagPanel; $("hudKeys").onclick = keyPanel; $("hudOut").onclick = () => { send({ t: "back" }); charScreen(); };

  /* ── 한 틀 ── */
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = "#0c0708"; g.fillRect(0, 0, VW, VH); // 매번 지움 — 배경 그림이 늦게 와도 겹쳐 쌓이지 않게
    if (A.scene === "town" && A.char) { townStep(dt); townDraw(); }
    else if (A.scene === "dungeon") { Dungeon.step(dt); Dungeon.draw(g, touch); }
    else { BG.draw(g, "town", performance.now() / 50, VW, VH, Z0); g.fillStyle = "rgba(8,4,6,.55)"; g.fillRect(0, 0, VW, VH); }
    if (stick) { g.strokeStyle = "rgba(246,210,122,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(stick.ox, stick.oy, 45, 0, Math.PI * 2); g.stroke(); const [ax, az] = axis(); g.fillStyle = "rgba(246,210,122,.4)"; g.beginPath(); g.arc(stick.ox + ax * 45, stick.oy + az * 45, 18, 0, Math.PI * 2); g.fill(); }
    KEYS.clear();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  if (token) { panel([el("p", null, "봉인검록에 들어가는 중…")]); connect(); } else noLogin();
  setInterval(() => send({ t: "ping" }), 25000);
  A.__send = send; // 시험용(보내는 것은 서버가 모두 다시 확인)
  return A;
})();
