/* 봉인검록 — 화면 흐름 (2026-10-27)
   로그인(병무청 홈페이지 열쇠) → 캐릭터 만들기(한 사람 1개) → 캐릭터 화면 → 마을(NPC · 다른 사람 · 채팅 · 파티 · 거래) → 오른쪽 던전 입구 → 던전
   서버: 서버/src/index.js (마을 하나). 주소 끝 ?server=ws://… · ?token=dev:이름 은 이 PC 시험용 */
"use strict";
const APP = (() => {
  const VW = 960, VH = 540, Z0 = 368, Z1 = 512, TOWN_W = 2600;
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
    if (m.t === "hello") { A.me = m.me; A.items = m.items; A.shop = m.shop; A.dungeons = m.dungeons; A.char = m.char; return m.char ? charScreen() : createScreen(); }
    if (m.t === "char") { const first = !A.char && m.char; A.char = m.char; if (!m.char) return createScreen(); if (first) return charScreen(); refresh(); return; }
    if (m.t === "err") return toast(m.text, "bad");
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
  function createScreen() {
    A.scene = "menu"; let L = LOOK.base("m");
    const pv = preview(L, 220, "walk"), rows = el("div", "parts");
    const job = el("div", "jobs"); [["무사", true], ["도사", false], ["수호자", false], ["사수", false], ["자객", false]].forEach(([n, ok]) => { const b = el("button", "chip" + (ok ? " on" : ""), n + (ok ? "" : " · 준비 중")); b.type = "button"; b.disabled = !ok; job.appendChild(b); });
    const sex = el("div", "jobs"), mk = (gg, n) => { const b = el("button", "chip" + (L.g === gg ? " on" : ""), n); b.type = "button"; b.onclick = () => { L.g = gg; L.hair = Math.min(L.hair, 5); draw(); }; return b; };
    const draw = () => {
      pv.look = L;
      sex.replaceChildren(mk("m", "남자"), mk("f", "여자"));
      rows.replaceChildren(...LOOK.parts.map(([k, name]) => {
        const r = el("div", "prow"), n = LOOK.count(k, L.g), col = LOOK.color(k, L[k]);
        const val = el("span", "pval", LOOK.label(k, L[k], L.g) || ""); if (col) { const sw = el("i", "sw"); sw.style.background = col; val.prepend(sw); }
        const left = btn("◀", () => { L[k] = (L[k] + n - 1) % n; draw(); }, "tiny"), right = btn("▶", () => { L[k] = (L[k] + 1) % n; draw(); }, "tiny");
        left.dataset.k = k; right.dataset.k = k; right.classList.add("next");
        r.append(el("b", null, name), left, val, el("small", null, (L[k] + 1) + "/" + n), right); return r;
      }));
    };
    draw();
    const make = btn("이 모습으로 만들기", () => { make.disabled = true; send({ t: "create", look: L }); });
    make.id = "makeBtn";
    panel([el("h2", null, "캐릭터 만들기"), el("p", "sub", (A.me ? A.me.nick : "") + " 님의 캐릭터 — 한 사람에 하나, 이름은 홈페이지 닉네임"),
      (() => { const w = el("div", "create"); const left = el("div", "cleft"); left.append(pv, sex, btn("무작위", () => { L = LOOK.random(); draw(); }, "ghost")); const right = el("div", "cright"); right.append(rows, el("p", "sub", "직업(스승)"), job); w.append(left, right); return w; })(),
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
      const nm = el("span", null, itemName(it) + (eq ? " (끼는 중)" : "")); nm.style.color = GRADE[I.grade];
      const stat = el("small", null, I.atk ? "공격 " + Math.round(I.atk * (1 + (it.plus || 0) * 0.1)) : I.def ? "방어 " + Math.round(I.def * (1 + (it.plus || 0) * 0.1)) : I.heal ? "체력 40% 회복" : "재료");
      r.append(nm, stat);
      if (where === "char" && (I.kind === "weapon" || I.kind === "armor")) r.appendChild(btn(eq ? "빼기" : "끼기", () => send({ t: "equip", uid: it.uid }), "tiny"));
      if (where === "shop" && !eq) r.appendChild(btn("팔기 " + Math.floor(I.price / 2) * (it.n || 1) + "G", () => send({ t: "sell", uid: it.uid }), "tiny"));
      if (where === "smith" && !I.stack) r.appendChild(btn(it.plus >= 10 ? "최대" : "강화 " + 100 * (it.plus + 1) + "G · " + Math.round([1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][it.plus] * 100) + "%", () => send({ t: "enhance", uid: it.uid }), "tiny"));
      if (where === "trade" && !eq) { const on = pick.has(it.uid); const b = btn(on ? "빼기" : "올리기", () => { if (on) pick.delete(it.uid); else pick.add(it.uid); tradePanel(); }, "tiny" + (on ? " on" : "")); r.appendChild(b); }
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
    { id: "chief", name: "문주", x: 330, z: 420, look: { g: "m", face: 1, hair: 0, hc: 4, eye: 3, ec: 0, brow: 1, nose: 3, mouth: 1, skin: 1, mark: 3, oc: 5 }, talk: chiefTalk },
    { id: "shop", name: "상인 만복", x: 720, z: 410, look: { g: "m", face: 0, hair: 4, hc: 1, eye: 5, ec: 1, brow: 2, nose: 0, mouth: 2, skin: 2, mark: 2, oc: 2 }, talk: shopTalk },
    { id: "smith", name: "대장장이 철산", x: 1080, z: 410, look: { g: "m", face: 2, hair: 3, hc: 0, eye: 4, ec: 0, brow: 1, nose: 2, mouth: 4, skin: 3, mark: 1, oc: 3 }, talk: smithTalk },
    { id: "kh", name: "스승 강혁", x: 1420, z: 405, sprite: "kh", talk: () => masterTalk("kh") },
    { id: "hr", name: "스승 혜린", x: 1540, z: 415, sprite: "hr", talk: () => masterTalk("hr") },
    { id: "ds", name: "스승 대성", x: 1660, z: 405, sprite: "ds", talk: () => masterTalk("ds") },
    { id: "je", name: "스승 지은", x: 1780, z: 415, sprite: "je", talk: () => masterTalk("je") },
    { id: "mj", name: "스승 무진", x: 1900, z: 405, sprite: "mj", talk: () => masterTalk("mj") },
    { id: "gate", name: "수문장", x: 2380, z: 430, look: { g: "m", face: 2, hair: 4, hc: 0, eye: 1, ec: 0, brow: 3, nose: 1, mouth: 1, skin: 2, mark: 0, oc: 1 }, talk: gateTalk },
  ];
  const H5 = new Image(); H5.src = "img/heroes5.png";
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
    BG.draw(g, "town", cx, VW, VH, Z0);
    if (!BG.pics.town || !BG.pics.town.naturalWidth) townHouses(cx);
    const bodies = [];
    NPC.forEach((n) => bodies.push([n.z, () => drawNpc(n, cx)]));
    for (const id in A.others) { const o = A.others[id]; bodies.push([o.z, () => drawPerson(o, o.look, cx, o.nick, false, id)]); }
    const H = A.hero; bodies.push([H.z + 0.1, () => drawPerson(H, A.char.look, cx, A.char.name, true, A.me.id)]);
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    const n = nearNpc();
    if (n && $("panel").hidden) { g.textAlign = "center"; g.font = "700 14px 'Noto Sans KR', sans-serif"; const t = (touch ? "말걸기 단추" : KEYS.label("talk")) + " — " + n.name + " 와(과) 이야기"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(t, n.x - cx, n.z - 150); g.fillStyle = "#ffe08a"; g.fillText(t, n.x - cx, n.z - 150); }
    // 오른쪽 끝 — 던전 입구
    const gx = TOWN_W - 70 - cx; if (gx < VW + 100) { g.fillStyle = "rgba(160,60,255,.25)"; g.beginPath(); g.ellipse(gx, 410, 60, 130, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#c58cff"; g.lineWidth = 4; g.stroke(); g.fillStyle = "#fff"; g.font = "800 14px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.fillText("던전 입구 →", gx, 260); }
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
    if (n.sprite) { const F = FR.heroes && FR.heroes[n.sprite]; if (F && H5.complete) { const f = F.front, k = 0.95; g.drawImage(H5, f[0], f[1], f[2], f[3], x - f[2] * k / 2, n.z - f[3] * k + 4, f[2] * k, f[3] * k); } }
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
  function chiefTalk() {
    const pages = ["오백 년 전, 다섯 문파의 고수들이 붉은 마왕 적염을 다섯 봉인석에 묶어 두었다네.", "그런데 요즘 봉인석이 하나씩 깨지고 있어. 숲에는 잡귀가 들끓고, 고블린들까지 날뛰지.", "자네 같은 신입이라도 힘을 보태 주게. 오른쪽 수문장에게 가면 던전으로 갈 수 있다네.", "스승들에게 배우고, 대장장이에게 칼을 벼리고, 동료와 함께 가게. 혼자서는 멀리 못 가는 법이지."];
    let i = 0; const p = el("p", "story", pages[0]);
    const next = btn("다음", () => { i++; if (i >= pages.length) return closePanel(); p.textContent = pages[i]; if (i === pages.length - 1) next.textContent = "알겠습니다"; });
    panel([el("h2", null, "문주"), p, row(next)]);
  }
  function shopTalk() {
    refreshFn = shopTalk;
    const buy = el("div", "bag"); A.shop.forEach((k) => { const I = A.items[k], r = el("div", "item"); const nm = el("span", null, I.name); nm.style.color = GRADE[I.grade]; r.append(nm, el("small", null, I.price + " G"), btn("1개", () => send({ t: "buy", key: k, n: 1 }), "tiny")); if (I.stack) r.appendChild(btn("10개", () => send({ t: "buy", key: k, n: 10 }), "tiny")); buy.appendChild(r); });
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
    const lock = el("div", "item"); lock.append(el("span", null, "오크족의 성지"), el("small", null, "그림 준비 중 — 곧 열려요")); list.appendChild(lock);
    panel([el("h2", null, "수문장 — 「어디로 가겠나?」"), list, el("p", "sub", P ? "파티장이 들어가면 마을에 있는 파티원이 모두 같이 들어가요." : "파티를 맺으면 같이 들어갈 수 있어요(다른 사람을 눌러 파티 신청)."), row(btn("닫기", closePanel, "ghost"))], true);
  }
  function bagPanel() { refreshFn = bagPanel; panel([el("h2", null, "가방 · " + A.char.gold.toLocaleString() + " G"), equipList(), bagList("char"), row(btn("닫기", () => { refreshFn = null; closePanel(); }, "ghost"))], true); }

  /* ── 거래 창 ── */
  let pick = new Set(), offerGold = 0;
  function tradePanel() {
    const T = A.trade; if (!T) return;
    const mine = el("div", "tcol"), theirs = el("div", "tcol");
    if (!pick.size && T.mine.uids.length) pick = new Set(T.mine.uids);
    const gold = el("input"); gold.type = "number"; gold.min = 0; gold.value = offerGold || T.mine.gold || 0; gold.oninput = () => { offerGold = Math.max(0, parseInt(gold.value, 10) || 0); };
    mine.append(el("b", null, "내가 줄 것"), bagList("trade", pick), el("label", null, "골드 "), gold, btn("올리기", () => send({ t: "toffer", uids: [...pick], gold: offerGold }), "tiny"));
    theirs.append(el("b", null, T.otherNick + " 님이 줄 것"), ...(T.theirs.items || []).map((n) => el("div", "item", n)), el("p", null, "골드 " + T.theirs.gold));
    const w = el("div", "trade"); w.append(mine, theirs);
    panel([el("h2", null, "거래 — " + T.otherNick), w, el("p", "sub", (T.okMe ? "나: 확인함" : "나: 아직") + " · " + (T.okThem ? "상대: 확인함" : "상대: 아직") + " — 둘 다 확인하면 바로 바뀌어요. 올린 것을 바꾸면 확인이 풀려요."),
      row(btn(T.okMe ? "확인함" : "확인", () => send({ t: "tok" })), btn("거래 취소", () => { send({ t: "tcancel" }); pick = new Set(); offerGold = 0; }, "ghost"))], true);
  }

  /* ── 던전 ── */
  function goDungeon(m) {
    closePanel(); A.scene = "dungeon"; A.reward = null; $("hud").hidden = true; $("partyBox").hidden = true; setPad("dungeon");
    const C = A.char, party = m.members && m.members.length > 1 ? { host: m.host, members: m.members } : null;
    const pot = (C.inv || []).find((x) => x.key === "p1");
    Dungeon.start({ d: m.d, me: A.me.id, look: C.look, nick: C.name, stats: { hpMax: C.hpMax, atk: C.atk, def: C.def }, potions: pot ? pot.n : 0, party,
      send: (data, to) => send({ t: "relay", data, to }), usePotion: () => send({ t: "usePotion" }), axis,
      onEnd: (res) => { A.result = res; if (res.win && !A.solo) send({ t: "dclear" }); showResult(); } });
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
  const PADS = { town: [["말걸기", "talk", "right:4%;bottom:10%;width:13%;height:23%"], ["가방", "bag", "right:19%;bottom:6%;width:9%;height:16%"], ["채팅", "chat", "right:4%;bottom:38%;width:9%;height:16%"]],
    dungeon: [["공격", "atk", "right:4%;bottom:8%;width:17%;height:30.2%;font-size:17px"], ["점프", "jump", "right:23%;bottom:5%;width:10%;height:17.8%"], ["회피", "roll", "right:4%;bottom:42%;width:10%;height:17.8%"], ["검기", "s1", "right:24%;bottom:26%;width:9%;height:16%"], ["검진", "s2", "right:16%;bottom:43%;width:9%;height:16%"], ["돌진", "s3", "right:15%;bottom:62%;width:9%;height:16%"], ["물약", "potion", "right:26%;bottom:46%;width:8%;height:14%"]] };
  function setPad(which) {
    const pad = $("pad"); pad.hidden = !touch; if (!touch) return;
    pad.replaceChildren(...PADS[which].map(([t, a, css]) => { const b = el("div", "tb", t); b.style.cssText = css; b.dataset.a = a;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (a === "chat") { $("chatIn").focus(); return; } KEYS.press(a, true); b.classList.add("on"); });
      const up = () => { KEYS.press(a, false); b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up); return b; }));
  }
  $("hudBag").onclick = bagPanel; $("hudKeys").onclick = keyPanel; $("hudOut").onclick = () => { send({ t: "back" }); charScreen(); };

  /* ── 한 틀 ── */
  let last = 0;
  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
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
  return A;
})();
