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
    ws.onclose = (e) => { wsOpen = false; if (e.code === 4000) return fail("다른 곳에서 접속해 여기는 끊었어요.");
      if (A.me && A.char && !A.solo && (A.re || 0) < 8) { // 잠깐 끊김(휴대폰 화면 꺼짐 · 망 · 업데이트) — 저절로 다시 이음
        A.re = (A.re || 0) + 1; toast("연결이 잠깐 끊겨 다시 잇는 중… (" + A.re + ")", "bad"); setTimeout(connect, Math.min(8000, 800 * 2 ** (A.re - 1))); return; } if (!A.solo) fail(A.me ? "서버와 연결이 끊겼어요." : "로그인을 확인하지 못했어요. 병무청 홈페이지에 다시 로그인해 주세요."); };
  }
  /* 새 판 확인 — 올린 판 번호(index.html 의 ?v=)가 지금 것과 다르면 새로고침 */
  function newBuild() { if (!V) return; fetch("./?nb=" + Date.now(), { cache: "no-store" }).then((r) => r.text()).then((h) => { const m2 = h.match(/app.js?v=(d+)/); if (m2 && m2[1] !== V) { toast("새 판으로 바꾸는 중…", "good"); setTimeout(() => location.reload(), 600); } }).catch(() => {}); }
  function send(m) { if (ws && wsOpen) ws.send(JSON.stringify(m)); }
  function fail(text) { panel([el("h2", null, "연결"), el("p", null, text), row(btn("다시 연결", () => { panel([el("p", null, "연결하는 중…")]); connect(); }), btn("병무청 홈페이지", () => { location.href = "../byeongmu/"; }, "ghost"))]); A.scene = "menu"; document.body.classList.remove("in-dun"); document.body.classList.remove("in-town"); $("topMenu").hidden = true; }
  function on(m) {
    if (m.t === "hello" && A.re) newBuild(); // 다시 이었는데 새 판이 올라와 있으면 저절로 새로고침(업데이트)
    if (m.t === "hello" && A.re && A.char && m.char) { // 다시 이음 — 하던 곳으로
      A.re = 0; A.me = m.me; A.char = m.char; $("hudOp").hidden = !m.me.op; toast("다시 연결됐어요.", "good");
      if (A.scene === "town") { A.others = {}; enterTown(); } else if (A.scene === "dungeon" && A.run && !A.watch) send({ t: "dresume", run: A.run }); else if (A.scene !== "dungeon") charScreen();
      return; }
    if (m.t === "hello") { A.re = 0; A.me = m.me; $("hudOp").hidden = !m.me.op; A.items = m.items; A.shop = m.shop; A.dungeons = m.dungeons; A.char = m.char; return m.char ? charScreen() : createScreen(); }
    if (m.t === "char") { const first = !A.char && m.char; A.char = m.char; if (!m.char) return createScreen(); if (first) return charScreen(); refresh(); return; }
    if (m.t === "err") return toast(m.text, "bad");
    if (m.t === "opok") return toast(m.text, "good");
    if (m.t === "oplist") return opPanel(m.runs);
    if (m.t === "dwatch") return goDungeon(m, true);
    if (m.t === "dgm") return goDungeon(m, false, true);
    if (m.t === "gmjoin") return Dungeon.addRemote(m.p);
    if (m.t === "spec") return Dungeon.watched();
    if (m.t === "twr") return towerPanel(m);
    if (m.t === "loot") { Dungeon.lootText(m.gold ? "+" + m.gold + " G" : "+ " + m.name); return; }
    if (m.t === "cardRes") { A.cardRes = m; if (A.result) showResult(); return; }
    if (m.t === "look") { const o = A.others[m.id]; if (o) o.look = m.look; return; }
    if (m.t === "gear") { const o = A.others[m.id]; if (o) o.gear = m.gear; return; }
    if (m.t === "ground") { const t = Date.now(), sn = m.now || t; A.ground = (m.list || []).map((o) => Object.assign(o, { lt: t - (sn - (o.at || sn)) })); return; } // lt = 내 시계로 떨어진 때
    if (m.t === "gadd") { A.ground = (A.ground || []).concat(Object.assign(m.g, { lt: Date.now() })); return; }
    if (m.t === "gdel") { A.ground = (A.ground || []).filter((x) => x.gid !== m.gid); if (m.by === (A.me && A.me.nick)) toast(m.name + " 을(를) 주웠어요.", "good"); return; }
    if (m.t === "notice") { // 운영자 전체 공지 — 화면 위 띠(남은 시간이 있으면 1초마다 줄임)
      const N = $("notice"), end = Date.now() + m.sec * 1000; clearInterval(A.noticeT);
      const show = () => { const left = Math.ceil((end - Date.now()) / 1000); N.textContent = "📢 " + m.text + (m.sec ? (left > 0 ? "  (" + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") + ")" : "  — 지금 업데이트 중이에요. 잠시 뒤 새로고침해 주세요") : ""); };
      N.hidden = false; show(); A.noticeT = setInterval(show, 1000); if (!m.sec) setTimeout(() => { N.hidden = true; clearInterval(A.noticeT); }, 15000); return;
    }
    if (m.t === "info") return toast(m.text);
    if (m.t === "others") { A.others = {}; m.list.filter((p) => p.id !== A.me.id).forEach(addOther); return; }
    if (m.t === "join") return m.p.id === A.me.id ? null : addOther(m.p); // 나 자신은 다른 사람 목록에 안 넣음
    if (m.t === "leave") { delete A.others[m.id]; return; }
    if (m.t === "mv") { const o = A.others[m.id]; if (o) { o.tx = m.x; o.tz = m.z; o.face = m.face; o.st = m.st; o.th = m.h || 0; } return; }
    if (m.t === "online") return onlinePanel(m.list);
    if (m.t === "rank") return rankPanel(m.list);
    if (m.t === "chat") { chatLine(m.nick, m.text); A.bubbles[m.id] = { text: m.text, t: 4 }; return; }
    if (m.t === "pinv") return ask(m.nick + " 님이 파티를 신청했어요.", () => send({ t: "pacc", from: m.from }));
    if (m.t === "duelReq") return ask("⚔ " + m.nick + " 님이 결투를 신청했어요.", () => send({ t: "duelAcc", from: m.from }));
    if (m.t === "duelEnd") { if (m.win) Dungeon.duelWon(); A.duelRes = m; return; }
    if (m.t === "treq") return ask(m.nick + " 님이 거래를 신청했어요.", () => send({ t: "tacc", from: m.from }));
    if (m.t === "party") { A.party = m.party; drawParty(); return; }
    if (m.t === "trade") { A.trade = m; tradePanel(); return; }
    if (m.t === "tend") { tradeView = "main"; pick = new Set(); offerGold = 0; A.trade = null; closePanel(); toast(m.text, m.ok ? "" : "bad"); return; }
    if (m.t === "enh") { toast(m.name + (m.ok ? " 강화 성공! +" + m.after : m.after < m.before ? " 강화 실패 — +" + m.after + " 로 내려갔어요" : " 강화 실패 — +" + m.after + " 그대로"), m.ok ? "good" : "bad"); return; }
    if (m.t === "dgo") return goDungeon(m);
    if (m.t === "relay") return Dungeon.net(m.from, m.data);
    if (m.t === "reward") { A.reward = m; showReward(); return; }
    if (m.t === "dabort") { Dungeon.quit(); toast(m.text, "bad"); backToTown(); return; }
    if (m.t === "who") return whoPanel(m.p);
  }
  function addOther(p) { A.others[p.id] = Object.assign({ tx: p.x, tz: p.z, walk: 0, t: 0 }, p); }

  /* ── 안내판(가운데 창) ── */
  function panel(nodes, wide) { const P = $("panel"); $("panelIn").replaceChildren(...nodes); $("panelIn").classList.toggle("wide", !!wide); P.hidden = false; }
  function closePanel() { $("panel").hidden = true; $("panelIn").replaceChildren(); refreshFn = null; } // 닫으면 다시 그리기도 멈춤 — Esc 로 닫은 스킬창 · 상점이 가방이 바뀔 때 저절로 다시 열리던 것 (2026-10-27)
  function row(...b) { const r = el("div", "btns"); r.append(...b); return r; }
  let toastT = 0;
  function toast(text, kind) { const t = $("toast"); t.textContent = text; t.className = "toast on " + (kind || ""); clearTimeout(toastT); toastT = setTimeout(() => { t.className = "toast"; }, 2600); }
  function ask(text, yes) { const box = el("div", "ask"); box.append(el("span", null, text), btn("수락", () => { yes(); box.remove(); }), btn("거절", () => box.remove(), "ghost")); $("asks").appendChild(box); setTimeout(() => box.remove(), 30000); }
  function preview(look, h, pose) { // 작은 캔버스에 캐릭터 — 걷는 모습을 계속 돌림
    const c = el("canvas", "pv"); c.width = h * 0.9 * 2; c.height = h * 1.15 * 2; c.style.width = h * 0.9 + "px"; c.style.height = h * 1.15 + "px";
    const x = c.getContext("2d"); let t = 0, alive = true;
    const tick = () => { if (!c.isConnected) { if (alive && t > 1) return; } t += 1 / 60; x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, c.width, c.height); x.save(); x.translate(h * 0.45, h * 1.1); drawChar(x, c.look || look, { st: pose || "idle", t, walk: t * 8 }, h / 120, { town: true, gear: c.gear, op: c.op }); x.restore(); requestAnimationFrame(tick); };
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
    A.scene = "menu"; document.body.classList.remove("in-dun"); document.body.classList.remove("in-town"); $("topMenu").hidden = true; let L = LOOK.base("m");
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
    A.scene = "menu"; document.body.classList.remove("in-dun"); document.body.classList.remove("in-town"); $("topMenu").hidden = true; Dungeon.quit(); const C = A.char;
    const info = el("div", "cinfo");
    info.append(el("h2", null, C.name), el("p", null, "Lv " + C.lv + " · " + C.job + " · 경험치 " + C.exp + " / " + C.need), el("p", null, "공격 " + C.atk + " · 방어 " + C.def + " · 체력 " + C.hpMax + " · " + C.gold.toLocaleString() + " 골드"), equipList(), bagList("char"));
    const keys = btn("키 설정", keyPanel, "ghost"), remake = btn("캐릭터 다시 만들기", () => { if (remake.dataset.sure) { send({ t: "remake" }); return; } remake.dataset.sure = 1; remake.textContent = "정말 지울까요? (Lv · 가방이 모두 사라져요)"; }, "ghost danger");
    const w = el("div", "create"); const left = el("div", "cleft"); const pvC = preview(C.look, 220, "idle"); pvC.op = !!(A.me && A.me.op); pvC.gear = C.gear; left.append(pvC); w.append(left, info);
    const opSw = A.me && A.me.op ? btn("캐릭터 바꾸기", lookPanel, "ghost") : el("span"); /* 운영자 — 다시 만들기 없이 다섯 명 · 문주로 바로 */
    panel([w, row(btn("마을로 들어가기", enterTown), opSw, keys, remake)], true);
    $("hud").hidden = true;
  }
  function itemName(it) { const I = A.items[it.key]; return I.name + (it.plus ? " +" + it.plus : "") + (it.n > 1 ? " × " + it.n : ""); }
  function equipList() { const C = A.char, b = el("div", "equip"); ["weapon", "armor"].forEach((k) => { const it = C.inv.find((x) => x.uid === C.equip[k]); const s = el("span", null, (k === "weapon" ? "무기 " : "옷 ") + (it ? itemName(it) : "—")); if (it) s.style.color = GRADE[A.items[it.key].grade]; b.appendChild(s); }); return b; }
  /* 가방 — where: char(끼기) · shop(팔기) · smith(강화) · trade(올리기) */
  function bagList(where, pick) {
    const C = A.char, box = el("div", "bag");
    if (!C.inv.length) box.appendChild(el("p", "sub", "가방이 비었어요"));
    C.inv.forEach((it) => {
      const I = A.items[it.key], r = el("div", "item"), eq = isEq(it.uid);
      { const ic = el("span", "slot ico g" + (I.grade || 0)); ic.appendChild(icon(it.key, 40)); r.appendChild(ic); } // 아이콘
      const nm = el("span", null, itemName(it) + (eq ? " (끼는 중)" : "")); nm.style.color = GRADE[I.grade];
      const stat = el("small", null, I.atk ? "공격 " + Math.round(I.atk * (1 + (it.plus || 0) * 0.1)) : I.def ? "방어 " + Math.round(I.def * (1 + (it.plus || 0) * 0.1)) : I.heal ? "체력 40% 회복" : "재료");
      r.append(nm, stat);
      if (where === "char" && (I.kind === "weapon" || I.kind === "armor")) r.appendChild(btn(eq ? "빼기" : "끼기", () => send({ t: "equip", uid: it.uid }), "tiny"));
      if (where === "shop" && !eq) r.appendChild(btn("팔기 " + Math.floor(I.price / 2) * (it.n || 1) + "G", () => send({ t: "sell", uid: it.uid }), "tiny"));
      if (where === "smith" && !I.stack) r.appendChild(btn(it.plus >= (A.char.maxPlus || 10) ? "최대" : "강화 " + ((A.char.cost || [])[it.plus] || 100 * (it.plus + 1)).toLocaleString() + "G · " + Math.round((A.char.rate || [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3])[it.plus] * 100) + "%", () => send({ t: "enhance", uid: it.uid }), "tiny"));
      if (where === "trade" && !eq) { const on = pick.has(it.uid); const b = btn(on ? "빼기" : "올리기", () => { if (on) pick.delete(it.uid); else pick.add(it.uid); send({ t: "toffer", uids: [...pick], gold: offerGold }); }, "tiny" + (on ? " on" : "")); r.appendChild(b); } // 누르면 바로 서버에 올림
      box.appendChild(r);
    });
    return box;
  }
  let refreshFn = null;
  /* Esc(메뉴 · 닫기) — 열린 창을 닫음. 키 이름만 있고 닫히지 않던 것 (2026-10-27) */
  addEventListener("keydown", (e) => { if (e.code !== KEYS.key("menu") || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; if (!$("panel").hidden && A.scene === "town" && !A.trade) closePanel(); /* 마을에서만 — 거래 중 · 던전 결과 · 캐릭터 화면은 그대로 */ else if (!$("bagSide").hidden || !$("equipSide").hidden) { $("bagSide").hidden = true; $("equipSide").hidden = true; } });
  function refresh() { if (A.scene === "menu" && A.char && !$("panel").hidden && $("panelIn").querySelector(".cinfo")) return charScreen(); if (refreshFn) refreshFn(); if (!$("bagSide").hidden) bagPanel(); if (!$("equipSide").hidden) equipPanel(); hudText(); }

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
  const H5 = HERO_IMG; // 캐릭터 그림 — look.js 와 같은 것(두 번 받지 않게)
  const NPCIMG = new Image(); NPCIMG.src = "img/npc.webp" + (V ? "?v=" + V : ""); // 제미나이 마을 사람 그림
  const MASTERIMG = new Image(); MASTERIMG.src = "img/masters.webp" + (V ? "?v=" + V : ""); // 스승 다섯 — 마을 사람과 같은 그림체
  function enterTown() {
    closePanel(); A.scene = "town"; document.body.classList.remove("in-dun"); document.body.classList.add("in-town"); $("topMenu").hidden = false; A.hero = A.hero || { x: 260, z: 440, face: 1, st: "idle", walk: 0, t: 0 };
    A.hero.x = Math.min(A.hero.x, TOWN_W - 300);
    send({ t: "town", x: Math.round(A.hero.x), z: Math.round(A.hero.z) });
    $("hud").hidden = false; hudText(); drawParty(); setPad("town"); Dungeon.preload((A.char.look && A.char.look.hero) || "kh", A.me && A.me.op);
  }
  function hudText() { if (!A.char) return; $("hudName").textContent = A.char.name + " · Lv " + A.char.lv; $("hudGold").textContent = A.char.gold.toLocaleString() + " G"; }
  let mvT = 0, lastMv = "";
  function townStep(dt) {
    const H = A.hero, [ax, az, run] = axis(), typing = document.activeElement && document.activeElement.tagName === "INPUT";
    H.t += dt;
    if (!$("panel").hidden || typing) { H.st = "idle"; }
    else {
      if (KEYS.take("jump") && !(H.h > 0)) { H.vh = 620; H.h = 0.1; } // 마을 점프
      if (H.h > 0 || H.vh > 0) { H.h = Math.max(0, (H.h || 0) + H.vh * dt); H.vh -= 1900 * dt; if (H.h <= 0) { H.h = 0; H.vh = 0; } }
      const dd = dash(); if (dd && !(H.dashT > 0)) { H.dashT = 0.2; H.dashDir = dd; H.face = dd; }
      if (H.dashT > 0) { H.dashT -= dt; H.x = clamp(H.x + H.dashDir * 950 * dt, 40, TOWN_W - 40); }
      const sp = run ? 380 : 240;
      H.x = clamp(H.x + ax * sp * dt, 40, TOWN_W - 40); H.z = clamp(H.z + az * 160 * dt, Z0, Z1);
      if (ax) H.face = Math.sign(ax);
      H.st = H.dashT > 0 ? "sprint" : ax || az ? (run ? "run" : "walk") : "idle"; if (ax || az) H.walk += dt * (run ? 14 : 9);
      if (KEYS.take("talk")) talkNear();
      if (KEYS.take("bag")) { const S = $("bagSide"); if (S.hidden) bagPanel(); else S.hidden = true; }
      if (KEYS.take("skills")) skillPanel();
      if (KEYS.take("equip")) { const E = $("equipSide"); if (E.hidden) equipPanel(); else E.hidden = true; }
      { const up = axis()[1] < -0.6; if (up && !A.upWas && Math.abs(H.x - (TOWN_W - 70)) < 140) gateTalk(); A.upWas = up; } // 던전 입구 = 차원의 문 — 앞에서 ↑ (끝까지 걸어가면 열리던 것 없앰)
    }
    if (KEYS.take("chat")) $("chatIn").focus();
    if (KEYS.take("menu")) { if (!$("panel").hidden) closePanel(); }
    for (const id in A.others) { const o = A.others[id]; o.x += (o.tx - o.x) * Math.min(1, dt * 10); o.z += (o.tz - o.z) * Math.min(1, dt * 10); o.h = (o.h || 0) + ((o.th || 0) - (o.h || 0)) * Math.min(1, dt * 14); o.t += dt; if (o.st === "walk" || o.st === "run") o.walk += dt * 9; }
    for (const id in A.bubbles) if ((A.bubbles[id].t -= dt) <= 0) delete A.bubbles[id];
    A.camX += (clamp(H.x - VW * 0.45, 0, TOWN_W - VW) - A.camX) * Math.min(1, dt * 8);
    if ((mvT -= dt) <= 0) { mvT = 0.1; const k = Math.round(H.x) + "," + Math.round(H.z) + "," + H.face + "," + H.st + "," + Math.round(H.h || 0); if (k !== lastMv) { lastMv = k; send({ t: "mv", h: Math.round(H.h || 0), x: Math.round(H.x), z: Math.round(H.z), face: H.face, st: H.st }); } }
  }
  function nearNpc() { const H = A.hero; let best = null, bd = 110; NPC.forEach((n) => { const d = Math.abs(n.x - H.x) + Math.abs(n.z - H.z) * 0.5; if (d < bd) { bd = d; best = n; } }); return best; }
  function nearItem() { const H = A.hero; let best = null, bd = 80; (A.ground || []).forEach((o) => { const d = Math.abs(o.x - H.x) + Math.abs(o.z - H.z) * 0.6; if (d < bd) { bd = d; best = o; } }); return best; }
  function talkNear() { const it = nearItem(); if (it) return send({ t: "pick", gid: it.gid }); const n = nearNpc(); if (n) n.talk(); }
  function townDraw() {
    const cx = A.camX;
    BG.draw(g, "town", cx, VW, VH, Z0, { par: 1, end: { pic: "town", at: TOWN_W - 70, f: 0.958, fade: 0 } }); // 마을은 한 장으로 길게 이어 붙인 그림(뒤집은 마을 · 마을 · 이어지는 마을과 던전 문) — 문 가운데가 입구 자리
    if (!BG.pics.town || !BG.pics.town.naturalWidth) townHouses(cx);
    const bodies = [];
    NPC.forEach((n) => bodies.push([n.z, () => drawNpc(n, cx)]));
    if (A.ground && A.ground.length) { const t = Date.now(); A.ground = A.ground.filter((o) => t - (o.lt || t) < GROUND_MS); } // 3분 지나면 사라짐
    (A.ground || []).forEach((o) => bodies.push([o.z - 0.5, () => drawGround(o, cx)]));
    for (const id in A.others) { const o = A.others[id]; bodies.push([o.z, () => drawPerson(o, o.look, cx, o.nick, false, id)]); }
    const H = A.hero; bodies.push([H.z + 0.1, () => drawPerson(H, A.char.look, cx, A.char.name, true, A.me.id)]);
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    const gi = nearItem();
    if (gi && $("panel").hidden) { const I = A.items[gi.key], t = (touch ? "화면 누르기" : KEYS.label("talk")) + " — 줍기: " + I.name + (gi.plus ? " +" + gi.plus : "") + (gi.n > 1 ? " × " + gi.n : ""); g.textAlign = "center"; g.font = "700 14px 'Noto Sans KR', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(t, gi.x - cx, gi.z - 56); g.fillStyle = "#ffe08a"; g.fillText(t, gi.x - cx, gi.z - 56); }
    const n = gi ? null : nearNpc();
    if (n && $("panel").hidden) { g.textAlign = "center"; g.font = "700 14px 'Noto Sans KR', sans-serif"; const t = (touch ? "화면 누르기" : KEYS.label("talk")) + " — " + n.name + " 와(과) 이야기"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(t, n.x - cx, n.z - 150); g.fillStyle = "#ffe08a"; g.fillText(t, n.x - cx, n.z - 150); }
    // 오른쪽 끝 — 던전 입구
    const gx = TOWN_W - 70 - cx, gate = BG.pics.town && BG.pics.town.naturalWidth; if (gx < VW + 100) { if (!gate) { g.fillStyle = "rgba(160,60,255,.25)"; g.beginPath(); g.ellipse(gx, 410, 60, 130, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#c58cff"; g.lineWidth = 4; g.stroke(); } g.fillStyle = "#fff"; g.font = "800 14px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText("차원의 문 ↑ (던전)", gx, gate ? 120 : 260); g.fillText("차원의 문 ↑ (던전)", gx, gate ? 120 : 260); }
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
  /* 땅에 떨어진 물건 — 아이콘이 등급 색 빛 위에서 둥실 */
  const GLOW = ["rgba(230,230,240,.5)", "rgba(90,160,255,.6)", "rgba(190,120,255,.65)", "rgba(255,200,70,.7)"];
  const GROUND_MS = 3 * 60 * 1000; // 바닥 물건 남는 시간(서버와 같게)
  function drawGround(o, cx) {
    const x = o.x - cx; if (x < -60 || x > VW + 60) return; const left = GROUND_MS - (Date.now() - (o.lt || Date.now())); if (left < 20000 && Math.floor(performance.now() / 200) % 2) return; /* 사라지기 20초 전 깜빡임 */ const I = A.items[o.key] || {}, r = FR.items && FR.items[o.key], bob = Math.sin(performance.now() / 400 + o.x) * 3;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, o.z, 18, 5, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x, o.z - 20 + bob, 2, x, o.z - 20 + bob, 26); gr.addColorStop(0, GLOW[I.grade || 0]); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, o.z - 20 + bob, 26, 0, Math.PI * 2); g.fill();
    if (r && ITEM_IMG.complete) { const k = 36 / Math.max(r[2], r[3]); g.drawImage(ITEM_IMG, r[0], r[1], r[2], r[3], x - r[2] * k / 2, o.z - 38 + bob, r[2] * k, r[3] * k); }
    if (o.plus || o.n > 1) { g.font = "800 11px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "#000"; const t = o.plus ? "+" + o.plus : "×" + o.n; g.strokeText(t, x + 14, o.z - 4); g.fillStyle = "#fff"; g.fillText(t, x + 14, o.z - 4); }
  }
  function drawNpc(n, cx) {
    const x = n.x - cx; if (x < -100 || x > VW + 100) return;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, n.z, 26, 7, 0, 0, Math.PI * 2); g.fill();
    const MP = n.sprite && FR.masters && FR.masters[n.sprite], NP = MP || (n.pic && FR.npc && FR.npc[n.pic]), NI = MP ? MASTERIMG : NPCIMG;
    if (NP && NI.complete && NI.naturalWidth) { const k = (n.pic === "kid" ? 92 : 124) / NP[3], bob = Math.sin(performance.now() / 600 + n.x) * 1.2; g.drawImage(NI, NP[0], NP[1], NP[2], NP[3], x - NP[2] * k / 2, n.z + 4 - NP[3] * k + bob, NP[2] * k, NP[3] * k); }
    else if (n.sprite) { const F = FR.heroes && FR.heroes[n.sprite]; if (F && H5.complete) { const f = F.front, k = 0.95; g.drawImage(H5, f[0], f[1], f[2], f[3], x - f[2] * k / 2, n.z - f[3] * k + 4, f[2] * k, f[3] * k); } }
    else { g.save(); g.translate(x, n.z + 2); g.scale(-1, 1); drawChar(g, n.look, { st: "idle", t: performance.now() / 1000 }, 1); g.restore(); }
    g.font = "800 13px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(n.name, x, n.z - 128); g.fillStyle = "#9df59a"; g.fillText(n.name, x, n.z - 128);
  }
  function drawPerson(P, look, cx, nick, me, id) {
    const x = P.x - cx; if (x < -100 || x > VW + 100) return;
    g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, P.z, 24, 7, 0, 0, Math.PI * 2); g.fill();
    const isOp = me ? A.me && A.me.op : P.op; if (isOp) Dungeon.gmAura(g, x, P.z + 2);
    g.save(); g.translate(x, P.z + 2 - (P.h || 0)); if (P.face < 0) g.scale(-1, 1); if (P.st === "sprint") { g.save(); g.globalAlpha = 0.3; g.translate(-34, 0); drawChar(g, look, { st: "sprint", t: P.t }, 1); g.restore(); }
    drawChar(g, look, { st: P.st === "run" ? "run" : P.st === "walk" ? "walk" : P.st === "sprint" ? "sprint" : "idle", t: P.t, walk: P.walk }, 1, { gear: me ? A.char.gear : P.gear, op: isOp, town: true }); g.restore();
    const party = A.party && A.party.members.some((m) => m.id === id);
    g.font = "700 12px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; const label = (isOp ? "⚜운영자 " : "") + nick + (P.lv ? " Lv" + P.lv : ""); g.strokeText(label, x, P.z - 128); g.fillStyle = me ? "#ffe08a" : party ? "#7fe3ff" : "#fff"; g.fillText(label, x, P.z - 128);
    const B = A.bubbles[id]; if (B) drawBubble(g, B.text, x, P.z - 150);
  }
  /* 다른 사람 누르기 — 정보 · 파티 · 거래 */
  cv.addEventListener("click", (e) => {
    if (A.scene !== "town" || !$("panel").hidden) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * VW + A.camX, y = (e.clientY - r.top) / r.height * VH;
    for (const id in A.others) { const o = A.others[id]; if (Math.abs(o.x - x) < 30 && y > o.z - 125 && y < o.z + 10) return personMenu(o); }
    for (const n of NPC) if (Math.abs(n.x - x) < 30 && y > n.z - 125 && y < n.z + 10 && Math.abs(n.x - A.hero.x) < 200) return n.talk();
  });
  function personMenu(o) {
    panel([el("h2", null, o.nick + " · Lv " + (o.lv || 1)), (() => { const v = preview(o.look, 140); v.op = !!o.op; return v; })(),
      row(btn("정보 보기", () => send({ t: "who", id: o.id }), "ghost"), btn("파티 신청", () => { send({ t: "pinv", to: o.id }); closePanel(); }), btn("거래 신청", () => { send({ t: "treq", to: o.id }); closePanel(); }), btn("결투 신청", () => { send({ t: "duelReq", to: o.id }); closePanel(); }, "danger"), btn("닫기", closePanel, "ghost"))]);
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
    panel([el("h2", null, "대장장이 철산 — 「칼은 두드릴수록 단단해지지」"), el("p", "sub", "강화는 +" + (A.char.maxPlus || 10) + " 까지. +5 까지는 실패해도 그대로, +6 부터는 실패하면 한 단계 내려가요. 장비가 깨지지는 않아요. 가진 돈 " + A.char.gold.toLocaleString() + " G"), bagList("smith"), row(btn("닫기", () => { refreshFn = null; closePanel(); }, "ghost"))], true);
  }
  function masterTalk(k) { // 스승 — 그 사람의 스킬 셋을 알려 줌(내 캐릭터가 그 사람이면 그 스킬을 씀)
    const N = { kh: "강혁", hr: "혜린", ds: "대성", je: "지은", mj: "무진" }, J = { kh: "무사", hr: "도사", ds: "수호자", je: "사수", mj: "자객" }, sk = Dungeon.SKILLS[k];
    const mine = A.char && A.char.look && (A.char.look.hero || "kh") === k;
    panel([el("h2", null, "스승 " + N[k] + " — " + J[k]), el("p", "story", mine ? "나와 같은 길을 걷는구나. 내 기술을 가르쳐 주마." : "내 기술은 이렇다네. 나와 같은 모습으로 길을 시작하면 쓸 수 있지."),
      el("p", null, sk.map((s, i) => s.name + " " + KEYS.label(["s1", "s2", "s3", "s4", "s5", "s6", "ult"][i])).join(" · ")), el("p", "sub", "평타 " + KEYS.label("atk") + " (3타째 띄우기) · 점프 " + KEYS.label("jump") + " · 구르기 " + KEYS.label("roll") + " · 물약 " + KEYS.label("potion")), row(mine ? btn("스킬 배우기", skillPanel) : el("span"), btn("명심하겠습니다", closePanel, mine ? "ghost" : ""))]);
  }

  function gateTalk() {
    const list = el("div", "bag"), P = A.party, leader = !P || P.leader === A.me.id;
    Object.keys(A.dungeons).forEach((k) => { const D = A.dungeons[k], r = el("div", "item"), locked = D.lv && A.char.lv < D.lv;
      r.append(el("span", null, D.name), el("small", null, "Lv " + (D.lv || 1) + "~" + (D.lvMax || "") + (D.rooms ? " · 방 " + D.rooms + " + 보스룸" : "") + " · " + (locked ? "Lv " + D.lv + " 부터 들어가요" : "보상 " + D.gold[0] + "~" + D.gold[1] + " G · 경험치 " + D.exp)));
      const b = btn(P ? (leader ? "파티로 들어가기" : "파티장이 들어가요") : "들어가기", () => { send({ t: "dstart", d: k }); }, "tiny"); b.disabled = locked || !leader; r.appendChild(b); list.appendChild(r); });
    const tw = el("div", "item"); tw.append(el("span", null, "🗼 무한의 탑 — 랭킹전(1~99층)"), el("small", null, "혼자 · 층마다 강해짐 · 30초 쉼"), btn("순위표", () => send({ t: "twrRank" }), "tiny ghost"), btn(P ? "혼자만" : "도전", () => send({ t: "twrStart" }), "tiny")); list.appendChild(tw);
    panel([el("h2", null, "수문장 — 「어디로 가겠나?」"), list, el("p", "sub", P ? "파티장이 들어가면 마을에 있는 파티원이 모두 같이 들어가요." : "파티를 맺으면 같이 들어갈 수 있어요(다른 사람을 눌러 파티 신청)."), row(btn("닫기", closePanel, "ghost"))], true);
  }
  /* ── 가방 — 오른쪽 창. 종류별로 묶고(접기 · 펴기), 칸은 등급 색 · 아이콘 · +강화 · 개수 · E(끼는 중). 칸을 누르면 아래에 정보 · 끼기 ── */
  const ITEM_IMG = new Image(); ITEM_IMG.src = "img/items.webp" + (V ? "?v=" + V : "");
  const BAG_MAX = 100, KINDS = [["weapon", "무기", "⚔"], ["armor", "방어구", "🛡"], ["acc", "장신구", "💍"], ["potion", "소모품", "🧪"], ["material", "재료", "💎"]];
  const GROUP = { skin: "acc", pants: "armor", shoes: "armor", greave: "armor", gloves: "armor", ring: "acc", earring: "acc", bracelet: "acc", necklace: "acc" };
  const SLOT_NAMES = { skin: "스킨", weapon: "무기", armor: "갑옷", pants: "하의", greave: "각반", shoes: "신발", gloves: "장갑", ring: "반지", earring: "귀걸이", bracelet: "팔찌", necklace: "목걸이" };
  const isEq = (uid) => !!uid && Object.values((A.char && A.char.equip) || {}).includes(uid); // 끼고 있는지(10칸)
  const isGear = (k) => !!SLOT_NAMES[(A.items[k] || {}).kind];
  function statText(it) { const I = A.items[it.key], m = 1 + (it.plus || 0) * 0.1, s = []; if (I.atk) s.push("공격 " + Math.round(I.atk * m)); if (I.def) s.push("방어 " + Math.round(I.def * m)); if (I.hp) s.push("체력 " + Math.round(I.hp * m));
    if (I.kind === "potion") s.push(I.mana ? "마력 " + Math.round(I.mana * 100) + "% 회복" : I.heal >= 1 && I.guard ? "체력 가득 · 3초 무적" : I.heal >= 1 ? "체력 가득 회복" : I.heal ? "체력 " + Math.round(I.heal * 100) + "% 회복" : I.regen ? "6초 동안 체력 " + Math.round(I.regen * 100) + "%" : "스킬 기다림 없앰");
    return (SLOT_NAMES[I.kind] ? SLOT_NAMES[I.kind] + " · " : "") + (s.join(" · ") || "재료 · 상인에게 팔 수 있어요"); }
  const bagUI = { tab: "bag", sort: "kind", shut: {}, sel: null };
  function icon(key, size) {
    const c = document.createElement("canvas"); c.width = c.height = size; const r = FR.items && FR.items[key], g2 = c.getContext("2d");
    const put = () => { if (!r) return; const k = size * 0.84 / Math.max(r[2], r[3]); g2.drawImage(ITEM_IMG, r[0], r[1], r[2], r[3], (size - r[2] * k) / 2, (size - r[3] * k) / 2, r[2] * k, r[3] * k); };
    if (ITEM_IMG.complete) put(); else ITEM_IMG.addEventListener("load", put, { once: true });
    return c;
  }
  /* 물약 빠른 칸 8 — 가방의 물약을 끌어다 놓으면 들어가고, 칸을 누르면 빠짐 (2026-10-28 "HP · MP 포션 자리는 유저들이 직접 넣었다 뺐다") */
  const POT_DEF = ["p1", "p2", "p6", "mp1", "mp2", "mp3", "p4", "p5"];
  function potSlots() { try { const v = JSON.parse(localStorage.getItem("bg-pots") || "null"); if (Array.isArray(v) && v.length === 8) return v; } catch (e) {} return POT_DEF.slice(); }
  function savePots(v) { try { localStorage.setItem("bg-pots", JSON.stringify(v)); } catch (e) {} }
  function potRow() {
    const row2 = el("div", "pslots"), P = potSlots();
    P.forEach((k, i) => { const s = el("div", "pslot" + (k ? "" : " empty")); s.dataset.i = i; if (k) { s.appendChild(icon(k, 34)); const n = (A.char.inv.find((x) => x.key === k) || {}).n || 0; s.appendChild(el("span", "ct", String(n))); s.title = (A.items[k] || {}).name + " — 누르면 빼기"; s.onclick = () => { const v = potSlots(); v[i] = null; savePots(v); bagPanel(); }; } s.appendChild(el("span", "pk", KEYS.label("q" + (i + 1)))); row2.appendChild(s); });
    const w = el("div", "pwrap"); w.append(el("div", "ptitle", "물약 칸 — 물약을 끌어다 넣고, 누르면 빼요"), row2); return w;
  }
  /* 아이템 도감 — 등급(일반 · 희귀 · 영웅 · 전설) · 종류(무기 · 방어구 · 장신구 · 기타)별로, 가진 것은 ✔ (2026-10-28) */
  const codexUI = { cat: "weapon", grade: -1 };
  function codexPanel() {
    refreshFn = null; const GN = ["일반", "희귀", "영웅", "전설"], CAT = [["weapon", "무기"], ["armor", "방어구"], ["acc", "장신구"], ["etc", "기타"]];
    const catOf = (I) => I.kind === "weapon" ? "weapon" : ["armor", "pants", "shoes", "greave", "gloves"].includes(I.kind) ? "armor" : ["ring", "earring", "bracelet", "necklace"].includes(I.kind) ? "acc" : "etc";
    const have = new Set((A.char && A.char.inv || []).map((x) => x.key)), keys = Object.keys(A.items).filter((k) => catOf(A.items[k]) === codexUI.cat && (codexUI.grade < 0 || (A.items[k].grade || 0) === codexUI.grade)).sort((p, q) => (A.items[p].grade || 0) - (A.items[q].grade || 0));
    const tabs = el("div", "row"); CAT.forEach(([k, n]) => tabs.appendChild(btn(n, () => { codexUI.cat = k; codexPanel(); }, "tiny" + (codexUI.cat === k ? "" : " ghost"))));
    const gr = el("div", "row"); [[-1, "전체"]].concat(GN.map((n, i) => [i, n])).forEach(([g, n]) => { const b = btn(n, () => { codexUI.grade = g; codexPanel(); }, "tiny" + (codexUI.grade === g ? "" : " ghost")); if (g >= 0) b.style.color = GRADE[g]; gr.appendChild(b); });
    const grid = el("div", "codex");
    keys.forEach((k) => { const I = A.items[k], c = el("div", "cx g" + (I.grade || 0)), ic = el("div", "slot g" + (I.grade || 0)); ic.appendChild(icon(k, 56)); if (have.has(k)) ic.appendChild(el("span", "eq", "✔"));
      const nm = el("b", null, I.name); nm.style.color = GRADE[I.grade || 0]; c.append(ic, nm, el("small", null, GN[I.grade || 0] + " · " + (SLOT_NAMES[I.kind] || ({ potion: "물약", material: "재료", skin: "스킨", weapon: "무기" })[I.kind] || I.kind)), el("small", "sub", statText({ key: k })), el("small", "sub", (I.price || 0).toLocaleString() + " G")); grid.appendChild(c); });
    if (!keys.length) grid.appendChild(el("p", "sub", "이 등급의 아이템이 없어요"));
    const total = Object.keys(A.items).length, got = Object.keys(A.items).filter((k) => have.has(k)).length;
    panel([el("h2", null, "📖 아이템 도감 — " + got + " / " + total), tabs, gr, grid, row(btn("닫기", closePanel, "ghost"))], true);
  }
  function dropAsk(it) {
    refreshFn = null;
    if (isEq(it.uid)) return toast("끼고 있는 장비는 먼저 빼 주세요.", "bad");
    if (A.scene !== "town") return toast("마을에서만 버릴 수 있어요.", "bad");
    const I = A.items[it.key]; panel([el("h2", null, "버릴까요?"), el("p", null, itemName(it) + (it.n > 1 ? " × " + it.n : "")), el("p", "sub", "발밑에 떨어져요 — 다른 사람도 주울 수 있어요."), row(btn("버리기", () => { send({ t: "drop", uid: it.uid }); bagUI.sel = null; closePanel(); }, "danger"), btn("취소", closePanel, "ghost"))]);
  }
  function slot(it) {
    const I = A.items[it.key], C = A.char, b = el("button", "slot g" + (I.grade || 0)); b.type = "button"; b.dataset.uid = it.uid;
    b.appendChild(icon(it.key, 64));
    if (isEq(it.uid)) b.appendChild(el("span", "eq", "E"));
    if (it.plus) b.appendChild(el("span", "pl", "+" + it.plus));
    if (it.n > 1) b.appendChild(el("span", "ct", String(it.n)));
    if (bagUI.sel === it.uid) b.classList.add("sel");
    b.onclick = () => { bagUI.sel = it.uid; if (!$("bagSide").hidden) bagPanel(); if (!$("equipSide").hidden) equipPanel(); };
    /* 끌어서 버리기 — 가방 · 장비 창 밖(게임 화면)에 놓으면 「버릴까요?」 (2026-10-27 "아이템은 마우스로 드래그해서 버릴 수 있게") */
    b.addEventListener("pointerdown", (e) => { if (e.button) return; const x0 = e.clientX, y0 = e.clientY; let gh = null;
      const mv = (ev) => { if (!gh && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) { gh = b.cloneNode(true); gh.style.cssText = "position:fixed;pointer-events:none;z-index:99;width:56px;height:56px;opacity:.85"; document.body.appendChild(gh); } if (gh) { gh.style.left = ev.clientX - 28 + "px"; gh.style.top = ev.clientY - 28 + "px"; } };
      const up = (ev) => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); if (!gh) return; gh.remove(); const tg = document.elementFromPoint(ev.clientX, ev.clientY), ps = tg && tg.closest(".pslot"); if (ps) { if ((A.items[it.key] || {}).kind !== "potion") return toast("물약만 넣을 수 있어요", "bad"); const v = potSlots(); for (let k = 0; k < 8; k++) if (v[k] === it.key) v[k] = null; v[+ps.dataset.i] = it.key; savePots(v); return bagPanel(); } if (tg && tg.closest("#bagSide, #equipSide, #panel")) return; dropAsk(it); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); });
    b.ondblclick = () => { if (isGear(it.key)) send({ t: "equip", uid: it.uid }); }; // 두 번 누르면 끼기 · 빼기
    return b;
  }
  /* 장비 — 가운데 내 모습, 왼쪽 무기 · 옷, 오른쪽은 앞으로 생길 칸(투구 · 장갑 · 신발 · 허리띠 · 목걸이 · 반지) */
  function equipView() {
    const C = A.char, w = el("div", "eqv");
    const head = el("div", "eqv-head"); head.append(el("div", "eqv-name", "레벨 " + C.lv + "  " + C.name), el("div", "eqv-guild", "🏯 병무청"));
    const power = Math.round(C.atk * 10 + C.def * 12 + C.hpMax * 0.5 + C.lv * 30);
    const stat = el("div", "eqv-stat"); stat.append(el("div", null, "⚔ " + power.toLocaleString()), el("small", null, "전투력"), el("div", null, "공격 " + C.atk + " · 방어 " + C.def + " · 체력 " + C.hpMax));
    const eqSlot = (k, name) => { const it = C.inv.find((x) => x.uid === (C.equip || {})[k]); if (!it) { const e = el("div", "slot eqv-empty", name); return e; } return slot(it); };
    const lock = (name) => el("div", "slot eqv-lock", "🔒\n" + name);
    const left = el("div", "eqv-col"); ["weapon", "armor", "pants", "greave", "shoes"].forEach((k) => left.appendChild(eqSlot(k, SLOT_NAMES[k])));
    const pv = preview(C.look, 150, "idle"); pv.gear = C.gear; pv.op = !!(A.me && A.me.op); const mid = el("div", "eqv-mid"); mid.appendChild(pv);
    const right = el("div", "eqv-col"); ["gloves", "ring", "earring", "bracelet", "necklace"].forEach((k) => right.appendChild(eqSlot(k, SLOT_NAMES[k])));
    const skinRow = el("div", "eqv-skin"); skinRow.append(el("small", null, "스킨"), eqSlot("skin", "스킨"));
    const body = el("div", "eqv-body"); body.append(left, mid, right);
    w.append(head, stat, skinRow, body, el("p", "sub", "가방(오른쪽)에서 두 번 누르면 끼고, 여기서 두 번 누르면 빠져요. 몸 장비 등급에 따라 몸 둘레 빛, 무기 등급에 따라 칼 빛, 장신구는 금빛 구슬, +7 이상은 불꽃이 보여요(다른 사람에게도)."));
    return w;
  }
  /* 장비 — 왼쪽 창(가방과 따로, 같이 열 수 있음). 칸을 누르면 아래 정보 · 두 번 누르면 빼기 */
  /* 모습 바꾸기 — 스승 모습에 옷 색 · 머리 색 (2026-10-27 "캐릭터마다 옷 · 무기 · 머리를 바꿀 수 있게"). 0 = 원래 색 */
  function lookPanel() {
    const C = A.char; if (!C) return; refreshFn = null; const L = Object.assign({}, C.look), pv = preview(L, 200, "walk"); pv.op = !!(A.me && A.me.op); /* 걷는 모습으로 미리 보기 */
    const sw = (key, cols, names) => { const r = el("div", "row"); cols.forEach((c, i) => { const b = btn(names[i], () => { L[key] = i; pv.look = L; draw(); }, "tiny" + ((L[key] | 0) === i ? "" : " ghost")); if (c) b.style.boxShadow = "inset 0 -5px 0 " + c; r.appendChild(b); }); return r; };
    const draw = () => { const w = el("div", "create"), left = el("div", "cleft"), right = el("div", "cright"); left.appendChild(pv); if (A.me && A.me.op) { const hr = el("div", "row"); [["gm", "문주"], ["kh", "강혁"], ["hr", "혜린"], ["ds", "대성"], ["je", "지은"], ["mj", "무진"]].forEach(([k, nm]) => { const on = k === "gm" ? L.gm !== 0 : L.gm === 0 && L.hero === k; hr.appendChild(btn(nm, () => { if (k === "gm") L.gm = 1; else { L.gm = 0; L.hero = k; } pv.look = L; draw(); }, "tiny" + (on ? "" : " ghost"))); }); right.append(el("b", null, "캐릭터 바꾸기 (운영자)"), hr); }
      right.append(el("b", null, "옷 색"), sw("mc", MASTER_MC, ["원래", "붉은", "푸른", "초록", "검정", "보라", "흰", "금빛"]), el("b", null, "머리 색"), sw("mh", MASTER_MH, ["원래", "갈색", "밤색", "금발", "은발", "붉은", "푸른", "보라"]), el("p", "sub", "스승 모습에 색만 바꿔요. 무기 모양은 끼는 무기에 따라 빛이 달라져요.")); w.append(left, right);
      panel([el("h2", null, "모습 바꾸기 — " + C.name), w, row(btn("저장", () => { send({ t: "look", mc: L.mc | 0, mh: L.mh | 0, hero: L.hero, gm: L.gm === 0 ? 0 : 1 }); A.skTab = null; if (A.scene === "menu") { A.char.look = Object.assign({}, A.char.look, L); charScreen(); } else closePanel(); }), btn("닫기", () => (A.scene === "menu" ? charScreen() : closePanel()), "ghost")) /* 캐릭터 화면에서 열었으면 그 화면으로 돌아감(예전엔 빈 화면에 멈춤) */], true); };
    draw();
  }
  function equipPanel() {
    const C = A.char, E = $("equipSide"); if (!C) return;
    const top = el("div", "bs-top"); top.appendChild(el("div", "bs-title", "🗡 장비"));
    const x = el("button", "bs-x", "✕"); x.onclick = () => { E.hidden = true; }; top.append(btn("모습", lookPanel, "tiny ghost"), x);
    const body = el("div", "bs-list"); body.appendChild(equipView());
    const info = el("div", "bs-info"), it = C.inv.find((o) => o.uid === bagUI.sel && isEq(o.uid));
    if (it) { const I = A.items[it.key], txt = el("div"); txt.style.flex = "1"; const nm = el("div", "nm", itemName(it)); nm.style.color = GRADE[I.grade]; txt.append(nm, el("small", null, statText(it) + " · 두 번 누르면 빼기"));
      const s2 = el("div", "slot g" + (I.grade || 0)); s2.style.width = "48px"; s2.appendChild(icon(it.key, 48)); info.append(s2, txt, btn("빼기", () => send({ t: "equip", uid: it.uid }), "tiny")); }
    else info.appendChild(el("small", null, "칸을 누르면 정보 · 두 번 누르면 빼기 · 가방에서 두 번 누르면 끼기"));
    E.replaceChildren(top, body, info); E.hidden = false;
  }
  function bagPanel() {
    const C = A.char, S = $("bagSide"); if (!C) return;
    const sortK = { kind: () => 0, grade: (a, b) => A.items[b.key].grade - A.items[a.key].grade, plus: (a, b) => (b.plus || 0) - (a.plus || 0) }[bagUI.sort];
    bagUI.tab = "bag"; const tabs = el("div", "bs-top"); tabs.appendChild(el("div", "bs-title", "🎒 가방")); tabs.appendChild(btn("📖 도감", codexPanel, "tiny ghost"));
    const x = el("button", "bs-x cl", "✕ 닫기"); x.onclick = () => { S.hidden = true; }; tabs.prepend(x);
    const sel = document.createElement("select");
    [["kind", "종류순"], ["grade", "등급순"], ["plus", "강화순"]].forEach(([v, n]) => { const o = document.createElement("option"); o.value = v; o.textContent = n; sel.appendChild(o); });
    sel.value = bagUI.sort; sel.onchange = () => { bagUI.sort = sel.value; bagPanel(); };
    const bar = el("div", "bs-bar"); bar.append(el("span", "bs-cnt", "▦ " + C.inv.length + " / " + BAG_MAX + "   ·   " + C.gold.toLocaleString() + " G"), sel);
    const list = el("div", "bs-list"), rail = el("div", "bs-rail"); list.appendChild(potRow());
    const show = C.inv;
    const all = el("button"); all.innerHTML = "<b>▦</b>" + show.length; all.onclick = () => { list.scrollTop = 0; }; rail.appendChild(all);
    KINDS.forEach(([k, name, ic]) => {
      const items = show.filter((it) => (GROUP[A.items[it.key].kind] || A.items[it.key].kind) === k).sort(sortK); if (!items.length) return;
      const sec = el("div", "bs-sec"), head = el("div", "bs-head"); head.append(el("span", null, name), el("span", null, bagUI.shut[k] ? "▼" : "▲"));
      const grid = el("div", "bs-grid" + (bagUI.shut[k] ? " shut" : "")); items.forEach((it) => grid.appendChild(slot(it)));
      for (let i = items.length % 4 ? 4 - items.length % 4 : 0; i > 0; i--) grid.appendChild(el("div", "slot")); // 빈 칸으로 줄 채우기
      head.onclick = () => { bagUI.shut[k] = !bagUI.shut[k]; bagPanel(); };
      sec.append(head, grid); list.appendChild(sec);
      const rb = el("button"); rb.innerHTML = "<b>" + ic + "</b>" + items.length; rb.onclick = () => sec.scrollIntoView({ behavior: "smooth", block: "start" }); rail.appendChild(rb);
    });
    if (!show.length) list.appendChild(el("p", "sub", "가방이 비었어요"));
    const info = el("div", "bs-info"), it = C.inv.find((o) => o.uid === bagUI.sel);
    if (it) {
      const I = A.items[it.key], eq = isEq(it.uid), txt = el("div"); txt.style.flex = "1";
      const nm = el("div", "nm", itemName(it)); nm.style.color = GRADE[I.grade];
      txt.append(nm, el("small", null, statText(it) + (eq ? " · 끼는 중" : "") + (isGear(it.key) ? " · 두 번 누르면 " + (eq ? "빼기" : "끼기") : "")));
      const s2 = el("div", "slot g" + (I.grade || 0)); s2.style.width = "48px"; s2.appendChild(icon(it.key, 48)); info.append(s2, txt);
      if (isGear(it.key)) info.appendChild(btn(eq ? "빼기" : "끼기", () => send({ t: "equip", uid: it.uid }), "tiny"));
      if (!eq && A.scene === "town") { const d = btn("버리기", () => { if (d.dataset.sure) { send({ t: "drop", uid: it.uid }); bagUI.sel = null; return; } d.dataset.sure = "1"; d.textContent = "한 번 더 = 버림"; }, "tiny danger"); info.appendChild(d); }
    } else info.appendChild(el("small", null, "칸을 누르면 정보 · 끼기"));
    const body = el("div", "bs-body"); body.append(list, rail);
    const keep = S.querySelector(".bs-list"), top = keep ? keep.scrollTop : 0;
    S.replaceChildren(tabs, bar, body, info); S.hidden = false; list.scrollTop = top;
  }

  /* ── 거래 창 ── */
  let pick = new Set(), offerGold = 0;
  /* 교환창 — 부장님 그림 참고: 왼쪽 내가 줄 것 · 오른쪽 상대가 줄 것 · 아래 골드 주머니 · 확인 / 추가 / 취소. 확인은 「교환하시겠습니까?」 를 한 번 더 */
  let tradeView = "main";
  function xRow(o) { const I = A.items[o.key] || {}, r = el("div", "x-item"); const ic = el("span", "slot ico g" + (I.grade || 0)); ic.appendChild(icon(o.key, 32)); r.append(ic, el("span", null, (I.name || "?") + (o.plus ? " +" + o.plus : "") + (o.n > 1 ? " × " + o.n : ""))); r.style.color = GRADE[I.grade || 0]; return r; }
  function tradePanel() {
    const T = A.trade; if (!T) return;
    if (!pick.size && T.mine.uids.length) pick = new Set(T.mine.uids);
    const offer = () => send({ t: "toffer", uids: [...pick], gold: offerGold });
    if (tradeView === "add") { // 추가 — 내 가방에서 고르기 · 골드
      const list = el("div", "x-pick"); A.char.inv.filter((it) => !isEq(it.uid)).forEach((it) => { const on = pick.has(it.uid), b = el("button", "slot g" + (A.items[it.key].grade || 0) + (on ? " sel" : "")); b.type = "button"; b.appendChild(icon(it.key, 48)); if (it.plus) b.appendChild(el("span", "pl", "+" + it.plus)); if (it.n > 1) b.appendChild(el("span", "ct", String(it.n))); b.title = itemName(it);
        b.onclick = () => { if (pick.has(it.uid)) pick.delete(it.uid); else if (pick.size < 8) pick.add(it.uid); tradePanel(); }; list.appendChild(b); });
      const gold = el("input"); gold.type = "number"; gold.min = 0; gold.value = offerGold || T.mine.gold || 0; gold.oninput = () => { offerGold = Math.max(0, Math.min(A.char.gold, parseInt(gold.value, 10) || 0)); };
      return panel([el("h2", "x-title", "올릴 것 고르기"), el("p", "sub", "누르면 올리고 다시 누르면 빼요(8개까지). 끼고 있는 장비는 못 올려요."), list, (() => { const g2 = el("div", "x-gold"); g2.append(el("span", null, "💰 골드"), gold, el("small", null, "가진 돈 " + A.char.gold.toLocaleString())); return g2; })(),
        row(btn("다 골랐어요", () => { offerGold = Math.max(0, Math.min(A.char.gold, parseInt(gold.value, 10) || 0)); offer(); tradeView = "main"; tradePanel(); }), btn("돌아가기", () => { tradeView = "main"; tradePanel(); }, "ghost"))], true);
    }
    if (tradeView === "ask") { // 교환하시겠습니까?
      const give = (T.mine.list || []), get = (T.theirs.list || []);
      return panel([el("h2", "x-title", "교환하시겠습니까?"), (() => { const w = el("div", "x-cols"); const L = el("div", "x-col"), R = el("div", "x-col"); L.append(el("div", "x-head", "내가 줄 것"), ...(give.length ? give.map(xRow) : [el("p", "sub", "없음")]), el("div", "x-gold", "💰 " + (T.mine.gold || 0).toLocaleString())); R.append(el("div", "x-head", T.otherNick + " 님이 줄 것"), ...(get.length ? get.map(xRow) : [el("p", "sub", "없음")]), el("div", "x-gold", "💰 " + (T.theirs.gold || 0).toLocaleString())); w.append(L, R); return w; })(),
        row(btn("예, 교환", () => { tradeView = "main"; send({ t: "tok" }); }), btn("아니오", () => { tradeView = "main"; tradePanel(); }, "ghost"))], true);
    }
    const L = el("div", "x-col"), R = el("div", "x-col");
    const mineList = el("div", "x-list"); (T.mine.list || []).forEach((o) => mineList.appendChild(xRow(o))); if (!(T.mine.list || []).length) mineList.appendChild(el("p", "sub", "「추가」 로 올려요"));
    const theirList = el("div", "x-list"); (T.theirs.list || []).forEach((o) => theirList.appendChild(xRow(o))); if (!(T.theirs.list || []).length) theirList.appendChild(el("p", "sub", "아직 없음"));
    L.append(el("div", "x-head", "내가 줄 것" + (T.okMe ? " ✔" : "")), mineList, el("div", "x-gold", "💰 " + (T.mine.gold || 0).toLocaleString()));
    R.append(el("div", "x-head", T.otherNick + " 님이 줄 것" + (T.okThem ? " ✔" : "")), theirList, el("div", "x-gold", "💰 " + (T.theirs.gold || 0).toLocaleString()));
    const cols = el("div", "x-cols"); cols.append(L, R);
    const box = el("div", "xchg"); box.append(el("h2", "x-title", "교 환"), cols, el("p", "sub", (T.okMe ? "나: 확인함" : "나: 아직") + " · " + (T.okThem ? "상대: 확인함" : "상대: 아직") + " — 둘 다 확인하면 바로 바뀌어요. 올린 것을 바꾸면 확인이 풀려요."),
      (() => { const b = el("div", "x-btns"); b.append(btn(T.okMe ? "확인함" : "확인", () => { tradeView = "ask"; tradePanel(); }), btn("추가", () => { tradeView = "add"; tradePanel(); }, "ghost"), btn("취소", () => { send({ t: "tcancel" }); pick = new Set(); offerGold = 0; tradeView = "main"; }, "ghost danger")); return b; })());
    panel([box], true);
  }


  /* ── 던전 ── */
  function exitBar(on) {
    let b = $("exitBar"); if (!b) { b = el("div"); b.id = "exitBar"; $("stage").appendChild(b); }
    b.hidden = !on; if (!on) return;
    const x = btn("던전 나가기", () => {
      if (!x.dataset.sure) { x.dataset.sure = "1"; x.textContent = "한 번 더 = 나가기(보상 없음)"; setTimeout(() => { if (x.isConnected) { delete x.dataset.sure; x.textContent = "던전 나가기"; } }, 3000); return; }
      const S = Dungeon.S; if (S && S.D.tower && !S.over) { S.lose = true; S.over = true; S.endT = 0.05; exitBar(false); return; } // 탑 — 여기까지 기록
      const P = A.party; if (P && P.leader === A.me.id && P.members.length > 1) send({ t: "pleave" }); // 파티장이 나가면 파티가 끝남
      exitBar(false); backToTown();
    }, "tiny ghost"); b.replaceChildren(x);
  }
  function watchBar(on) { // 관전 중 단추 — 다른 판 보기 · 관전 나가기
    let b = $("watchBar"); if (!b) { b = el("div"); b.id = "watchBar"; $("stage").appendChild(b); }
    b.hidden = !on; if (!on) return;
    b.replaceChildren(btn("👁 다른 판 보기", () => send({ t: "op", a: "list" }), "tiny"), btn("관전 나가기", () => { watchBar(false); backToTown(); }, "tiny ghost"));
  }
  function goDungeon(m, watch, gm) {
    $("bagSide").hidden = true; $("equipSide").hidden = true; A.duelRes = null;
    watchBar(!!watch); exitBar(!watch); A.run = watch ? null : m.run;
    closePanel(); A.scene = "dungeon"; document.body.classList.add("in-dun"); document.body.classList.remove("in-town"); $("topMenu").hidden = !!watch; A.reward = null; A.cardRes = null; A.cardSent = null; A.watch = !!watch; $("hud").hidden = true; $("partyBox").hidden = true; setPad(watch ? "none" : "dungeon");
    const C = A.char, party = watch || gm || m.pvp || (m.members && m.members.length > 1) ? { host: m.host, members: m.members } : null;
    const pots = {}; ["p1", "p2", "p3", "p4", "p5", "p6", "mp1", "mp2", "mp3"].forEach((k) => { const p = (C.inv || []).find((x) => x.key === k); pots[k] = p ? p.n : 0; });
    Dungeon.start({ d: m.d, me: A.me.id, look: C.look, nick: C.name, stats: { hpMax: C.hpMax, mpMax: C.mpMax, atk: C.atk, def: C.def }, potions: pots, gear: C.gear, party,
      bubbles: A.bubbles, potSlots: potSlots(), send: (data, to) => send({ t: "relay", data, to }), usePotion: (key) => send({ t: "usePotion", key }), loot: () => send({ t: "loot" }), learned: C.learned, slots: C.skillSlots, axis, dash, duelLose: () => send({ t: "duelLose" }), watch: !!watch, gm: !!gm, op: !!(A.me && A.me.op),
      onEnd: (res) => { if (m.pvp) { exitBar(false); const R = A.duelRes || {}; const pv = R.pvp || {}; return panel([el("h1", null, res.win ? "승리!" : "패배…"), el("p", null, "결투 — " + (R.nick || "") + (R.left ? " 님이 나갔어요" : "")), el("p", "reward", "내 결투 전적 " + (pv.w || 0) + "승 " + (pv.l || 0) + "패"), row(btn("마을로", backToTown))]); }
        if (res.tower) { A.result = res; send({ t: "twrDone", floor: res.floor, kills: res.kills }); return panel([el("h2", null, "무한의 탑 — " + res.floor + "층"), el("p", null, "기록 확인 중…")]); }
        if (watch) return panel([el("h2", null, "관전 끝 — " + (res.win ? "클리어" : "실패")), el("p", null, Math.floor(res.sec / 60) + "분 " + (res.sec % 60) + "초"), row(btn("마을로", backToTown))]); A.result = res; if (res.win && !A.solo) send({ t: "dclear" }); showResult(); } });
  }
  function showResult() { exitBar(false);
    const R = A.result, W = A.reward, sec = R.sec;
    const grade = !R.win ? "-" : R.hits <= 3 && sec < 150 ? "S" : R.hits <= 8 ? "A" : R.hits <= 16 ? "B" : "C";
    const lines = [el("h1", null, R.win ? "클리어!" : "실패…"), el("div", "grade", grade), el("p", null, Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + " · 최대 " + R.maxCombo + " 연속 · 맞은 횟수 " + R.hits)];
    if (R.win && !A.solo) lines.push(el("p", "reward", W ? "보상 " + W.gold + " G · 경험치 " + W.exp + (W.items.length ? " · " + W.items.join(", ") : "") + (W.lvUp ? " · 레벨 업! Lv " + W.lv : "") : "보상 받는 중…"));
    if (R.win && W && W.cards) { // 보스 카드 — 4장 중 하나
      const CR = A.cardRes, box = el("div", "cards");
      for (let i = 0; i < 4; i++) { // 뒷면으로 덮어 두고 한 장만 — 누르면 나머지는 못 누르고, 결과가 오면 뒤집힘
        const c = el("button", "card" + (CR ? (CR.pick === i ? " pick" : " open") : " back" + (A.cardSent != null ? (A.cardSent === i ? " wait" : " off") : ""))); c.type = "button";
        if (CR) c.append(el("b", null, CR.cards[i]), el("small", null, CR.pick === i ? "획득!" : ""));
        else c.onclick = () => { if (A.cardSent != null) return; A.cardSent = i; send({ t: "card", i }); showResult(); };
        box.appendChild(c); }
      lines.push(el("p", "sub", CR ? "🎉 " + CR.got + " 을(를) 얻었어요" : "보상 카드 한 장을 고르세요"), box);
    }
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
      runs.forEach((R) => watch.appendChild(line(el("span", null, R.name + " · " + R.members.join(", ")), el("small", null, Math.floor(R.sec / 60) + "분째"), btn("투명 관전", () => send({ t: "op", a: "watch", run: R.run }), "tiny"), btn("참여", () => send({ t: "op", a: "join", run: R.run }), "tiny")))); }
    panel([el("h2", null, "운영자 — 기준량"), el("p", "sub", "이 창과 기능은 기준량 계정에만 보이고, 서버도 기준량만 받아 줘요."), who,
      line(el("span", null, "골드 주기(빼려면 −)"), gold, btn("주기", () => send({ t: "op", a: "gold", nick: nick(), n: gold.value }), "tiny")),
      line(el("span", null, "아이템 만들어 주기"), pick, el("small", null, "+"), plus, el("small", null, "×"), cnt, btn("주기", () => send({ t: "op", a: "item", nick: nick(), key: pick.value, plus: plus.value, n: cnt.value }), "tiny")),
      (() => { const nt = el("input"); nt.value = "봉인검록 1분 뒤 업데이트로 인해 강제 종료되오니, 안전하게 접속 종료하시길 바랍니다."; nt.style.cssText = "flex:1;min-width:0;padding:4px 6px;border-radius:6px;border:1px solid #6b5a3a;background:#120a0c;color:#fff;font:inherit"; const sec = num(60, 60); return line(el("span", null, "전체 공지"), nt, sec, el("small", null, "초"), btn("보내기", () => send({ t: "op", a: "notice", text: nt.value, sec: sec.value }), "tiny")); })(),
      line(el("span", null, "레벨 정하기"), lv, btn("정하기", () => send({ t: "op", a: "lv", nick: nick(), lv: lv.value }), "tiny")),
      el("p", "sub", "내 가방 장비 복사 — 강화 수치까지 그대로"), copy,
      el("p", "sub", "사냥터 투명 관전 — 들어가도 그 판 사람들 화면 · 목록에 안 나와요"), runs ? watch : row(btn("열린 던전 보기", () => send({ t: "op", a: "list" }), "tiny")),
      row(btn("닫기", closePanel, "ghost"))], true);
  }
  /* 무한의 탑 — 끝나면 점수 · 순위표 · 다시 도전 / 마을로. 수문장에게서 순위표만 볼 수도 */
  const HERO_NAME = { kh: "강혁", hr: "혜린", ds: "대성", je: "지은", mj: "무진" };
  function rankTable(top, myId) {
    const tb = el("div", "bag"); if (!top || !top.length) tb.appendChild(el("p", "sub", "아직 기록이 없어요 — 첫 기록의 주인공이 되어 보세요!"));
    (top || []).slice(0, 10).forEach((r, i) => { const row2 = el("div", "item"); if (r.id === myId) row2.style.borderColor = "#f6d27a";
      row2.append(el("b", null, ["🥇", "🥈", "🥉"][i] || (i + 1) + "위"), el("span", null, r.nick + " · " + (HERO_NAME[r.hero] || "")), el("small", null, r.floor + "층 · " + r.score.toLocaleString() + "점 · " + Math.floor(r.sec / 60) + "분")); tb.appendChild(row2); });
    return tb;
  }
  function towerPanel(m) { exitBar(false);
    if (m.view) return panel([el("h2", null, "무한의 탑 순위표"), m.my ? el("p", null, "내 최고 — " + m.my.floor + "층 · " + m.my.score.toLocaleString() + "점") : el("p", "sub", "아직 도전 기록이 없어요"), rankTable(m.top, A.me.id), row(btn("도전하기", () => send({ t: "twrStart" })), btn("닫기", closePanel, "ghost"))], true);
    const lines = [el("h1", null, (m.floor || 0) + "층"), el("p", "sub", "무한의 탑 — 1층부터 99층까지, 층마다 몬스터가 강해지고 보상(골드 · 경험치)도 커져요 · 10층마다 상자")];
    if (m.err) lines.push(el("p", "reward", m.err));
    else { lines.push(el("div", "grade", (m.score || 0).toLocaleString() + "점")); lines.push(el("p", "reward", "처치 " + m.kills + " · " + Math.floor(m.sec / 60) + "분 " + (m.sec % 60) + "초 · 보상 " + m.gold.toLocaleString() + " G · 경험치 " + m.exp.toLocaleString() + (m.box && m.box.length ? " · 🎁 " + m.box.join(", ") : "") + (m.best ? " · 🎉 내 최고 기록!" : "") + (m.rank ? " · 순위 " + m.rank + "위" : ""))); }
    lines.push(el("b", null, "순위표"), rankTable(m.top, A.me.id), row(btn("다시 도전", () => { Dungeon.quit(); send({ t: "twrStart" }); }), btn("마을로", backToTown, "ghost")));
    panel(lines, true);
  }
  /* 스킬창 — 내 직업 스킬(6 + 궁극기)을 보고 배움. 1~3 기본, 나머지는 레벨 · 골드 */
  const KIND_TXT = { shot: "날려 맞힘", aura: "몸 둘레 계속", zone: "자리에 계속", dash: "앞으로 돌진", strike: "가까운 적 여럿에게 바로", blink: "적 뒤로 순간이동", slam: "앞을 내려쳐 띄움", guard: "잠깐 무적 · 밀쳐냄", ult: "궁극기 — 여러 재주를 한 번에" };
  function skillPanel() {
    const C = A.char; if (!C) return; refreshFn = skillPanel;
    const op = !!(A.me && A.me.op), myHero = (C.look && C.look.hero) || "kh", hero = op ? A.skTab || myHero : myHero, SK = Dungeon.SKILLS[hero] || [], REQ = C.skillReq || [];
    /* 운영자는 다섯 직업 스킬을 모두 배운 것으로 · 탭으로 골라 아무 칸에나 (2026-10-27). base = 이 탭 스킬의 번호 시작(직업 순서 × 7) */
    const base = op ? Dungeon.HERO_ORDER.indexOf(hero) * 7 : 0, ALL = op ? Dungeon.ALL_SKILLS : SK, L = op ? ALL.map((_, i) => i) : C.learned || [0, 1, 2], isUlt = (si) => si % 7 === 6;
    const list = el("div", "bag");
    const skPic = (s, sz) => { const c = document.createElement("canvas"); c.width = c.height = sz; const u = FR.ui2 && FR.ui2[s.ic], f = u || FR.hsk[s.fr], im = new Image(); im.src = (u ? "img/ui2.webp" : "img/hsk.webp") + (V ? "?v=" + V : ""); /* 스킬마다 제 아이콘(2026-10-28) */
      im.onload = () => { const x = c.getContext("2d"); if (u) x.drawImage(im, f[0], f[1], f[2], f[3], 0, 0, sz, sz); else { const k = (sz - 4) / Math.max(f[2], f[3]); x.drawImage(im, f[0], f[1], f[2], f[3], sz / 2 - f[2] * k / 2, sz / 2 - f[3] * k / 2, f[2] * k, f[3] * k); } }; return c; };
    SK.forEach((s, i) => { const r = el("div", "item"), ic = skPic(s, 44);
      ic.style.cssText = "width:44px;height:44px;border-radius:8px;background:" + (i === 6 ? "#5a3a0a" : "#1b1e2a"); const got = op || L.includes(i), q = REQ[i] || { lv: 1, cost: 0 };
      const txt = el("div"); txt.style.flex = "1"; txt.append(el("b", null, (i === 6 ? "궁극기 · " : i + 1 + ". ") + s.name), el("small", null, " " + (KIND_TXT[s.kind] || "") + " · 기다림 " + s.cd + "초 · 키 " + KEYS.label(["s1", "s2", "s3", "s4", "s5", "s6", "ult"][i])));
      r.append(ic, txt, got ? el("small", "reward", op ? "운영자 ✔" : "배움 ✔") : btn("배우기 · Lv " + q.lv + (q.cost ? " · " + q.cost.toLocaleString() + "G" : ""), () => send({ t: "learn", i }), "tiny" + (C.lv < q.lv || C.gold < q.cost ? " ghost" : ""))); list.appendChild(r); });
    /* 스킬 칸 — 아래 스킬을 끌어다 칸에 놓기 · 칸에서 밖으로 끌면 빼기 · 눌러 고르고 칸 누르기(휴대폰도) */
    const SL = (C.skillSlots || [0, 1, 2, 3, 4, 5, 6]).slice(), save = () => send({ t: "setSlots", s: SL });
    const iconOf = (i, sz) => skPic(ALL[i], sz);
    const bar = el("div", "sbar"), rows2 = [[0, 1, 2, 6], [3, 4, 5]];
    rows2.forEach((rr) => { const rw = el("div", "sbar-row"); rr.forEach((slot) => { const s = el("div", "sslot" + (slot === 6 ? " ult" : "")); s.dataset.slot = slot; const si = SL[slot]; if (si >= 0 && ALL[si]) { const ic = iconOf(si, 52); ic.dataset.skill = si; ic.dataset.from = slot; ic.className = "sdrag"; s.appendChild(ic); } s.appendChild(el("span", "skey", KEYS.label(["s1", "s2", "s3", "s4", "s5", "s6", "ult"][slot]))); rw.appendChild(s); }); bar.appendChild(rw); });
    let picked = null;
    const place = (si, slot, from) => { if (slot === 6 && !isUlt(si)) return toast("궁극기 칸에는 궁극기만", "bad"); if (slot !== 6 && isUlt(si)) return toast("궁극기는 금빛 칸에", "bad"); for (let k = 0; k < 7; k++) if (SL[k] === si) SL[k] = -1; if (from != null && from >= 0 && SL[slot] >= 0 && from !== slot) SL[from] = SL[slot]; SL[slot] = si; save(); };
    const drag = (e) => { const src = e.target.closest(".sdrag"); if (!src) return; const si = +src.dataset.skill, from = src.dataset.from != null ? +src.dataset.from : null; if (!L.includes(si)) return toast("아직 안 배운 스킬이에요", "bad");
      e.preventDefault(); const gh = src.cloneNode(true); gh.getContext && gh.getContext("2d").drawImage(src, 0, 0); gh.style.cssText = "position:fixed;pointer-events:none;z-index:99;width:52px;height:52px;border-radius:50%;opacity:.85"; document.body.appendChild(gh);
      const mv = (ev) => { gh.style.left = ev.clientX - 26 + "px"; gh.style.top = ev.clientY - 26 + "px"; }; mv(e); let moved = false;
      const up = (ev) => { removeEventListener("pointermove", mv2); removeEventListener("pointerup", up); gh.remove(); const tgt = document.elementFromPoint(ev.clientX, ev.clientY), sl = tgt && tgt.closest(".sslot");
        if (!moved) { picked = { si, from }; document.querySelectorAll(".sdrag.sel").forEach((x) => x.classList.remove("sel")); src.classList.add("sel"); return; } // 눌러 고르기
        if (sl) place(si, +sl.dataset.slot, from); else if (from != null) { SL[from] = -1; save(); } }; // 칸 밖으로 = 빼기
      const mv2 = (ev) => { moved = moved || Math.hypot(ev.movementX, ev.movementY) > 0; mv(ev); }; addEventListener("pointermove", mv2); addEventListener("pointerup", up); };
    bar.addEventListener("pointerdown", drag); bar.addEventListener("click", (e) => { const sl = e.target.closest(".sslot"); if (sl && picked) { place(picked.si, +sl.dataset.slot, picked.from); picked = null; } });
    list.addEventListener("pointerdown", (e) => { const ic = e.target.closest("canvas"); if (ic && ic.dataset.skill != null) { ic.classList.add("sdrag"); drag(e); } });
    list.querySelectorAll("canvas").forEach((c, i) => { c.dataset.skill = base + i; c.style.touchAction = "none"; c.style.cursor = "grab"; });
    panel([el("h2", null, "스킬 — " + ({ kh: "강혁(무사)", hr: "혜린(도사)", ds: "대성(수호자)", je: "지은(사수)", mj: "무진(자객)" }[hero] || "")), op ? (() => { const tabs = el("div", "row sk-tabs"); Dungeon.HERO_ORDER.forEach((h) => tabs.appendChild(btn({ kh: "강혁", hr: "혜린", ds: "대성", je: "지은", mj: "무진" }[h], () => { A.skTab = h; skillPanel(); }, "tiny" + (h === hero ? "" : " ghost")))); const w = el("div"); w.append(el("p", "sub", "⚜ 운영자 — 다섯 직업 스킬을 모두 배운 것으로, 탭에서 골라 아무 칸에나 넣어 써 볼 수 있어요(궁극기는 금빛 칸)."), tabs); return w; })() : el("p", "sub", "1~3 은 처음부터. 4 · 5 · 6 · 궁극기는 레벨이 되면 골드를 내고 배워요. Lv " + C.lv + " · " + C.gold.toLocaleString() + " G"), el("b", null, "스킬 칸 — 배운 스킬을 끌어다 넣고, 밖으로 끌면 빠져요(눌러 고른 뒤 칸을 눌러도 돼요)"), bar, list, row(btn("닫기", () => { refreshFn = null; closePanel(); }, "ghost"))], true);
  }
  /* 접속한 사람 — 이름 · Lv · 직업 · 어디. 다른 사람은 「정보」 (2026-10-27) */
  /* 다른 사람 자세히 — 모습(장비 빛) · 능력치 · 끼고 있는 장비 (2026-10-27 "유저들 클릭해서 상세보기, 장비 착용 상태") */
  function whoPanel(p) {
    const pv = preview(p.look, 170, "idle"); pv.gear = p.gear; pv.op = !!p.op;
    const eq = el("div", "bag"); (p.eq || []).forEach((e) => { const I = A.items[e.key] || {}, r = el("div", "item"), ic = el("div", "slot g" + (I.grade || 0)); ic.style.width = "40px"; ic.appendChild(icon(e.key, 40)); const nm = el("span", null, (SLOT_NAMES[e.slot] || e.slot) + " · " + (I.name || e.key) + (e.plus ? " +" + e.plus : "")); nm.style.color = GRADE[I.grade] || ""; r.append(ic, nm, el("small", null, statText(e))); eq.appendChild(r); });
    if (!(p.eq || []).length) eq.appendChild(el("p", "sub", "끼고 있는 장비가 없어요"));
    const w = el("div", "create"), left = el("div", "cleft"), right = el("div", "cright"); left.appendChild(pv);
    right.append(el("p", null, "Lv " + p.lv + " · " + p.job + (p.op ? " · ⚜운영자" : "")), el("p", "sub", "공격 " + (p.atk || 0) + " · 방어 " + (p.def || 0) + " · 체력 " + (p.hpMax || 0)), el("p", "sub", "던전 클리어 " + p.clears + "번 · 결투 " + ((p.pvp && p.pvp.w) || 0) + "승 " + ((p.pvp && p.pvp.l) || 0) + "패"), el("b", null, "끼고 있는 장비"), eq); w.append(left, right);
    panel([el("h2", null, p.nick), w, row(btn("닫기", closePanel, "ghost"))], true);
  }
  /* 순위표 — 모든 사람(레벨순) · 접속 중이면 이름 밝게, 아니면 어둡게 · 직업별 탭 (2026-10-28 부장님) */
  let rankTab = "all";
  function rankPanel(list) {
    const J = { kh: "강혁 · 무사", hr: "혜린 · 도사", ds: "대성 · 수호자", je: "지은 · 사수", mj: "무진 · 자객" }, tabs = el("div", "row rtabs");
    [["all", "전체"], ["kh", "강혁"], ["hr", "혜린"], ["ds", "대성"], ["je", "지은"], ["mj", "무진"]].forEach(([k, n]) => { const b = btn(n + " " + (k === "all" ? list.length : list.filter((o) => o.hero === k).length), () => { rankTab = k; rankPanel(list); }, "tiny" + (rankTab === k ? "" : " ghost")); tabs.appendChild(b); });
    const box = el("div", "bag rank"), L = list.filter((o) => rankTab === "all" || o.hero === rankTab), onN = list.filter((o) => o.on).length;
    L.forEach((o, i) => { const r = el("div", "item rk" + (o.on ? " on" : " off")), no = el("b", "rno", String(i + 1)); if (i < 3) no.classList.add("top" + (i + 1));
      const nm = el("span", "rnm", o.nick + (o.id === A.me.id ? " (나)" : "")), sub = el("small", null, "Lv " + o.lv + " · " + (J[o.hero] || "") + (o.on ? " · ● " + o.where : " · 접속 안 함"));
      r.append(no, nm, sub, btn("정보", () => send({ t: "who", id: o.id }), "tiny ghost")); box.appendChild(r); });
    if (!L.length) box.appendChild(el("small", null, "아직 이 직업 캐릭터가 없어요."));
    panel([el("h2", null, "🏆 순위표 — 접속 " + onN + "명 / 전체 " + list.length + "명"), tabs, box, row(btn("새로 보기", () => send({ t: "rank" }), "ghost"), btn("닫기", closePanel, "ghost"))]);
  }
  function onlinePanel(list) {
    const J = { kh: "무사", hr: "도사", ds: "수호자", je: "사수", mj: "자객" }, box = el("div", "bag");
    list.forEach((o) => { const r = el("div", "item"); r.append(el("span", null, (o.op ? "⚜ " : "") + o.nick + (o.id === A.me.id ? " (나)" : "")), el("small", null, "Lv " + o.lv + (J[o.hero] ? " · " + J[o.hero] : "") + " · " + o.where + (o.party ? " · 파티" : ""))); if (o.id !== A.me.id) r.appendChild(btn("정보", () => send({ t: "who", id: o.id }), "tiny ghost")); box.appendChild(r); });
    panel([el("h2", null, "접속한 사람 — " + list.length + "명"), box, row(btn("새로 보기", () => send({ t: "online" }), "ghost"), btn("닫기", closePanel, "ghost"))]);
  }
  function backToTown() { watchBar(false); exitBar(false); A.watch = false; Dungeon.quit(); send({ t: "back" }); enterTown(); }

  /* ── 움직임 입력 — 키(설정한 키) · 휴대폰 막대. 같은 쪽 두 번 = 달리기 ── */
  let stick = null, runOn = false; const lastTap = {};
  /* 방향키를 빨리 두 번 = 대시(그 쪽으로 순간 이동하듯 · 잠깐 무적). 던전 · 마을 모두 */
  let dashReq = 0; const dash = () => { const d = dashReq; dashReq = 0; return d; };
  addEventListener("keydown", (e) => { if (e.repeat || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; if (e.code === KEYS.key("left") || e.code === KEYS.key("right")) { const now = performance.now(); if (now - (lastTap[e.code] || 0) < 260) dashReq = e.code === KEYS.key("left") ? -1 : 1; lastTap[e.code] = now; } });
  function axis() {
    if (stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, L = Math.hypot(dx, dy); if (L < 8) return [0, 0, false]; const m = Math.min(1, L / 45); return [dx / L * m, dy / L * m, L > 60]; }
    const D = KEYS.down; return [(D.right ? 1 : 0) - (D.left ? 1 : 0), (D.down ? 1 : 0) - (D.up ? 1 : 0), false];
  }
  function local(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; }
  /* 차원의 문 누르기 — 던전 방 끝 문 · 마을 오른쪽 끝 던전 입구 (2026-10-27 "우측으로 완전히 가는 게 아니라 차원의 문을 ↑ 로 들어가거나 클릭해서") */
  cv.addEventListener("pointerdown", (e) => { const [x, y] = local(e);
    if (A.scene === "dungeon" && Dungeon.click(x, y)) { e.stopImmediatePropagation(); return; }
    if (A.scene === "town" && $("panel").hidden) { const gx = TOWN_W - 70 - A.camX; if (Math.abs(x - gx) < 110 && y > 140 && y < Z1 + 10) { e.stopImmediatePropagation(); gateTalk(); } } });
  cv.addEventListener("pointerdown", (e) => { if (!touch && e.pointerType === "mouse") return; const [x, y] = local(e); if (x < VW * 0.5) { stick = { id: e.pointerId, ox: x, oy: y, x, y }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} } else if (A.scene === "town" && $("panel").hidden) { KEYS.press("talk", true); KEYS.press("talk", false); } });
  cv.addEventListener("pointermove", (e) => { if (stick && stick.id === e.pointerId) { const [x, y] = local(e); stick.x = x; stick.y = y; } });
  const lift = (e) => { if (stick && stick.id === e.pointerId) stick = null; };
  cv.addEventListener("pointerup", lift); cv.addEventListener("pointercancel", lift);
  /* 휴대폰 단추 — 마을도 던전과 같게 / 던전: 공격 · 점프 · 회피 · 스킬 3 · 물약 */
  /* 휴대폰 단추 — 공격을 가운데로 둥글게(겹치지 않게, 2026-10-27 휴대폰 점검) */
  /* 휴대폰 단추 — 마을 · 던전 같게. 자리 · 그림은 game.js TPAD/drawPad(스킬 그림 · 쿨타임), 여기는 같은 자리에 투명한 누름 칸만 */
  let padWhich = "none";
  const padSkills = () => { const sk = A.me && A.me.op ? Dungeon.ALL_SKILLS : Dungeon.SKILLS[(A.char && A.char.look && A.char.look.hero) || "kh"] || Dungeon.SKILLS.kh; /* 운영자는 35개 중에서 */ return [sk, (A.char && A.char.skillSlots) || [0, 1, 2, 3, 4, 5, 6]]; };
  function setPad(which) {
    padWhich = which; const pad = $("pad"); pad.hidden = !touch; if (!touch) return;
    pad.replaceChildren(...(which === "none" ? [] : Dungeon.TPAD).map(([a, x, y, r]) => { const b = el("div", "tb tp"); b.style.cssText = "left:" + (x - r) / VW * 100 + "%;top:" + (y - r) / VH * 100 + "%;width:" + 2 * r / VW * 100 + "%;height:" + 2 * r / VH * 100 + "%"; b.dataset.a = a;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); KEYS.press(a, true); b.classList.add("on"); });
      const up = () => { KEYS.press(a, false); b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up); return b; }));
  }
  $("hudOp").onclick = () => opPanel(null); /* 위 단추에 그림 — 운영 · 접속 · 스킬 · 장비 · 가방 · 키 설정 (제미나이 그림, 2026-10-27) */
  [["hudOp", "op"], ["hudOnline", "online"], ["hudSkill", "skill"], ["hudEquip", "equip"], ["hudBag", "bag"], ["hudKeys", "keys"]].forEach(([id, k]) => { const b = $(id), r = FR.ui && FR.ui[k]; if (!b || !r) return; const s = 26 / 64, i = document.createElement("i"); i.className = "hic"; i.style.cssText = "width:" + Math.round(r[2] * s) + "px;background-position:-" + r[0] * s + "px -" + r[1] * s + "px;background-size:" + 2048 * s + "px auto"; b.prepend(i); b.title = b.textContent; });
  $("hudSkill").onclick = skillPanel; ["hudSkill", "hudEquip", "hudBag", "hudOnline", "hudKeys", "hudOut"].forEach((id) => { $(id).style.display = "none"; }); // 메뉴 탭으로 옮김(캐릭터 · 키 설정 · 접속현황도, 2026-10-28)
  /* 오른쪽 위 메뉴 — 스킬 · 장비 · 가방 (2026-10-28 "우측 상단에 메뉴 탭, 스킬 · 장비 · 가방 3가지 우선") */
  (() => { const pop = $("menuPop"), map = { skill: "skill", equip: "equip", bag: "bag", online: "online", keys: "keys" };
    pop.querySelectorAll("button").forEach((b) => { const r = FR.ui && FR.ui[map[b.dataset.m]], i = b.querySelector(".mic"); if (r && i) { const s = 40 / 64; i.style.width = Math.round(r[2] * s) + "px"; i.style.backgroundPosition = "-" + r[0] * s + "px -" + r[1] * s + "px"; i.style.backgroundSize = 2048 * s + "px auto"; }
      b.onclick = () => { pop.hidden = true; const m = b.dataset.m; if (m === "online" || m === "keys" || m === "char") { $({ online: "hudOnline", keys: "hudKeys", char: "hudOut" }[m]).click(); return; } if (b.dataset.m === "skill") skillPanel(); else if (b.dataset.m === "equip") { const E = $("equipSide"); if (E.hidden) equipPanel(); else E.hidden = true; } else { const S = $("bagSide"); if (S.hidden) bagPanel(); else S.hidden = true; } }; });
    $("menuBtn").onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
    addEventListener("pointerdown", (e) => { if (!pop.hidden && !e.target.closest("#topMenu")) pop.hidden = true; }); })(); $("hudOnline").onclick = () => send({ t: "rank" }); $("hudBag").onclick = () => { const S = $("bagSide"); if (S.hidden) bagPanel(); else S.hidden = true; }; $("hudEquip").onclick = () => { const E = $("equipSide"); if (E.hidden) equipPanel(); else E.hidden = true; }; $("hudKeys").onclick = keyPanel; $("hudOut").onclick = () => { send({ t: "back" }); charScreen(); };

  /* ── 한 틀 ── */
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = "#0c0708"; g.fillRect(0, 0, VW, VH); // 매번 지움 — 배경 그림이 늦게 와도 겹쳐 쌓이지 않게
    if (A.scene === "town" && A.char) { townStep(dt); townDraw(); if (touch && padWhich === "town") { const [sk, SL] = padSkills(); Dungeon.drawPad(g, sk, SL); } }
    else if (A.scene === "dungeon") { Dungeon.step(dt); Dungeon.draw(g, touch); }
    else { BG.draw(g, "town", performance.now() / 50, VW, VH, Z0); g.fillStyle = "rgba(8,4,6,.55)"; g.fillRect(0, 0, VW, VH); }
    if (stick) { g.strokeStyle = "rgba(246,210,122,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(stick.ox, stick.oy, 45, 0, Math.PI * 2); g.stroke(); const [ax, az] = axis(); g.fillStyle = "rgba(246,210,122,.4)"; g.beginPath(); g.arc(stick.ox + ax * 45, stick.oy + az * 45, 18, 0, Math.PI * 2); g.fill(); }
    KEYS.clear();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  if (token) { panel([el("p", null, "봉인검록에 들어가는 중…")]); connect(); } else noLogin();
  setInterval(() => send({ t: "ping" }), 25000);
  A.__send = send; A.__drop = () => ws && ws.close(); // 시험용(보내는 것은 서버가 모두 다시 확인 · 끊김 흉내)
  return A;
})();
