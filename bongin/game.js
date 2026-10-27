/* 봉인검록 — 전투 시제품 (2026-10-27)
   옆으로 걸어가며 싸우는 판. 바닥은 옆으로 긴 띠이고 위아래(안쪽 · 바깥쪽 줄)로도 움직인다.
   세계 자리: x = 가로, z = 바닥 줄(화면 y 의 발 자리), h = 땅에서 뜬 높이. 화면 y = z − h.
   잡귀 세 무리(슬라임 → 고블린 → 늑대) 뒤에 대장 바위 거인. 그림은 연병장 것을 빌려 씀(frames.js) */
"use strict";
(() => {
  const VW = 960, VH = 540, Z0 = 368, Z1 = 512, ROOM = 1800, G = 1900;
  const cv = document.getElementById("cv"), g = cv.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || ""; // 판 번호(올리기.mjs) — 새 판이면 그림도 새로 받음
  const img = (src) => { const i = new Image(); i.src = src + (V ? "?v=" + V : ""); return i; };
  const IMG = { hero: img("img/heroes5.png"), mon: img("img/mon2.png"), hsk: img("img/hsk.png"), mfx: img("img/mfx.png") };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── 화면 크기 — 960 × 540 을 창에 맞게 늘이고 줄임 ── */
  let DPR = 1;
  function fit() {
    const k = Math.min(innerWidth / VW, innerHeight / VH), st = $("stage");
    st.style.width = VW * k + "px"; st.style.height = VH * k + "px";
    DPR = Math.min(2, (window.devicePixelRatio || 1) * k);
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  }
  addEventListener("resize", fit); fit();

  /* ── 몬스터 ── native = 그림이 보는 쪽(1 오른쪽, 0 앞) */
  const MON = {
    slime: { name: "슬라임", hp: 70, spd: 80, sc: 0.62, dmg: 7, act: "lunge", range: 70, wind: 0.45, native: 0, w: 30 },
    goblin: { name: "고블린", hp: 110, spd: 115, sc: 0.85, dmg: 10, act: "swing", range: 80, wind: 0.42, native: 1, w: 32 },
    wolf: { name: "늑대", hp: 95, spd: 200, sc: 0.8, dmg: 9, act: "pounce", range: 230, wind: 0.38, native: 1, w: 38 },
    golem: { name: "바위 거인", hp: 2600, spd: 70, sc: 1.75, dmg: 24, act: "boss", range: 150, wind: 0.8, native: 0, w: 70, boss: true },
  };
  const WAVES = [
    { text: "검은 숲 어귀 — 슬라임이 몰려온다!", list: ["slime", "slime", "slime", "slime", "slime"] },
    { text: "고블린 무리!", list: ["goblin", "goblin", "goblin", "slime", "slime"] },
    { text: "늑대가 달려든다 — 구르기(Z)로 피해!", list: ["wolf", "wolf", "wolf", "goblin", "goblin"] },
    { text: "대장 바위 거인 등장!", list: ["golem"] },
  ];
  /* ── 주인공 평타 — act = 맞히는 때(초), range = 앞으로 닿는 거리 ── */
  const ATK = [
    { dur: 0.3, act: [0.06, 0.16], range: 100, dmg: 12, type: "stagger", lunge: 70, fr: "atk1" },
    { dur: 0.3, act: [0.06, 0.16], range: 105, dmg: 14, type: "stagger", lunge: 70, fr: "atk2" },
    { dur: 0.42, act: [0.1, 0.22], range: 120, dmg: 20, type: "launch", lunge: 110, fr: "atk3" },
  ];
  const AIR = { dur: 0.36, act: [0.04, 0.26], range: 100, dmg: 13, type: "stagger", fr: "atk2" };
  const SKILL = [
    { key: "KeyA", name: "화염 검기", cd: 3 },
    { key: "KeyS", name: "화염검 진", cd: 8 },
    { key: "KeyD", name: "화염 돌진", cd: 5 },
  ];
  const AX = { atk1: 0.44 };

  let S = null, last = 0, running = false, stop = 0, shake = 0;
  const keys = {}, tap = {};
  let stick = null;

  function newGame() {
    S = {
      t: 0, wave: 0, waveT: 1.2, spawned: false, banner: "", bannerT: 0, foes: [], shots: [], fx: [], nums: [], tele: [],
      hero: { x: 220, z: 440, h: 0, vx: 0, vz: 0, vh: 0, face: 1, hp: 300, max: 300, st: "idle", t: 0, inv: 0, step: 0, queued: false, hit: [], walk: 0, run: false },
      combo: 0, comboT: 0, maxCombo: 0, hitsTaken: 0, cd: [0, 0, 0], ring: 0, over: false, win: false, camX: 0, endT: 0,
    };
  }

  /* ── 입력 ── */
  const lastTap = {};
  addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && S) { // 같은 쪽 두 번 = 달리기
      const now = performance.now(); if (now - (lastTap[e.code] || 0) < 260) S.hero.run = true; lastTap[e.code] = now;
    }
    keys[e.code] = true; tap[e.code] = true;
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && S) S.hero.run = false; });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
  function axis() {
    if (stick) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, L = Math.hypot(dx, dy); if (L < 8) return [0, 0, false]; const m = Math.min(1, L / 45); return [dx / L * m, dy / L * m, L > 60]; }
    return [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), S && S.hero.run];
  }
  /* 휴대폰 — 왼쪽 반을 누른 채 끌기 = 막대, 오른쪽 단추 */
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (touch) $("pad").hidden = false;
  function local(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; }
  cv.addEventListener("pointerdown", (e) => { const [x, y] = local(e); if (x < VW * 0.5) { stick = { id: e.pointerId, ox: x, oy: y, x, y }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} } });
  cv.addEventListener("pointermove", (e) => { if (stick && stick.id === e.pointerId) { const [x, y] = local(e); stick.x = x; stick.y = y; } });
  const lift = (e) => { if (stick && stick.id === e.pointerId) stick = null; };
  cv.addEventListener("pointerup", lift); cv.addEventListener("pointercancel", lift);
  const TB = { tAtk: "KeyX", tJump: "KeyC", tRoll: "KeyZ", tS1: "KeyA", tS2: "KeyS", tS3: "KeyD" };
  Object.keys(TB).forEach((id) => {
    const b = $(id);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); keys[TB[id]] = true; tap[TB[id]] = true; b.classList.add("on"); });
    const up = () => { keys[TB[id]] = false; b.classList.remove("on"); };
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
  });
  addEventListener("contextmenu", (e) => e.preventDefault());

  /* ── 몬스터 내보내기 — 화면 양쪽 바깥에서 ── */
  function spawn(kind, i) {
    const D = MON[kind], side = D.boss ? 1 : i % 2 ? -1 : 1;
    let x = side > 0 ? S.camX + VW + 60 + i * 40 : S.camX - 60 - i * 40;
    x = clamp(x, 40, ROOM - 40);
    if (D.boss) x = clamp(S.hero.x + 420, 200, ROOM - 120);
    S.foes.push({ kind, D, x, z: rnd(Z0 + 10, Z1 - 10), h: D.boss ? 400 : 0, vx: 0, vz: 0, vh: 0, face: -side, hp: D.hp, max: D.hp, st: D.boss ? "air" : "walk", t: 0, cd: rnd(0.6, 1.6), jug: 0, inv: 0, flash: 0, poise: 260, hitDone: false, ph: Math.random() * 5 });
    if (D.boss) { shake = 0.5; }
  }
  function banner(t) { S.banner = t; S.bannerT = 2.2; }

  /* ── 주인공 맞히기 ── */
  function addFx(o) { if (S.fx.length < 120) S.fx.push(o); }
  function num(x, y, v, c) { if (S.nums.length < 80) S.nums.push({ x, y, v, c: c || "#fff", t: 0.7 }); }
  function hitFoe(f, dmg, type, dir) {
    if (f.st === "dead" || f.inv > 0) return false;
    dmg = Math.round(dmg * rnd(0.92, 1.08));
    f.hp -= dmg; f.flash = 0.1;
    S.combo++; S.comboT = 1.6; S.maxCombo = Math.max(S.maxCombo, S.combo);
    num(f.x, f.z - f.h - f.D.sc * 70, dmg, type === "launch" ? "#ffd36b" : "#fff");
    addFx({ k: "spark", x: f.x - dir * 10, y: f.z - f.h - 40 * f.D.sc, t: 0.22, d: 0.22, s: 70 });
    stop = Math.max(stop, type === "launch" ? 0.07 : 0.045);
    if (f.D.boss) { // 대장 — 잘 안 밀림(슈퍼아머). 일정 피해마다 휘청
      f.poise -= dmg; f.x += dir * 4;
      if (f.poise <= 0) { f.poise = 260; f.st = "hit"; f.t = 0.7; banner("바위 거인이 휘청인다 — 지금이다!"); }
      if (f.hp <= 0) { f.hp = 0; f.st = "dead"; f.t = 1.6; shake = 0.6; }
      return true;
    }
    const airborne = f.h > 0.5 || f.st === "air";
    if (type === "launch") { f.vh = 680; f.vx = dir * 60; f.st = "air"; f.jug = 0; }
    else if (type === "knock") { f.vh = 380; f.vx = dir * 420; f.st = "air"; f.jug = 0; }
    else if (airborne) { f.vh = Math.max(f.vh, 330 - f.jug * 55); f.jug++; f.vx = dir * 40; f.st = "air"; } // 공중 콤보 — 맞을수록 덜 뜸
    else { f.st = "hit"; f.t = 0.38; f.vx = dir * 130; }
    if (f.hp <= 0) { f.hp = 0; f.dying = true; if (!airborne && type === "stagger") { f.vh = 360; f.vx = dir * 160; f.st = "air"; } }
    return true;
  }
  /* 앞쪽 상자 — 주인공(o)이 face 쪽 range 안, 줄 차이 ±zr, 높이 차이 안 */
  function inFront(o, f, range, zr) {
    const dx = (f.x - o.x) * o.face, w = f.D.w;
    return dx > -w * 0.6 && dx < range + w && Math.abs(f.z - o.z) < (zr || 30) + (f.D.boss ? 30 : 0) && Math.abs((f.h + 40) - (o.h + 40)) < 120 + f.D.sc * 40;
  }
  function hurtHero(dmg, heavy, dir) {
    const H = S.hero;
    if (H.inv > 0 || H.st === "roll" || H.st === "down" || S.over) return;
    H.hp -= dmg; S.hitsTaken++; shake = Math.max(shake, heavy ? 0.35 : 0.18);
    num(H.x, H.z - H.h - 120, dmg, "#ff6a5a");
    if (heavy) { H.st = "fall"; H.vh = 420; H.vx = dir * 300; H.t = 0; }
    else { H.st = "hit"; H.t = 0.3; H.vx = dir * 160; H.inv = 0.45; }
    H.queued = false;
    if (H.hp <= 0) { H.hp = 0; H.st = "fall"; H.vh = 300; S.over = true; S.endT = 1.6; }
  }

  /* ── 한 틀 ── */
  function step(dt) {
    S.t += dt;
    const H = S.hero;
    /* 무리 · 대장 */
    if (!S.win && !S.over) {
      /* waveT 가 다 되면 이번 무리(S.wave)를 내보내고, 다 잡으면 다음 무리 · 마지막(대장)까지 잡으면 클리어 */
      const alive = S.foes.some((f) => f.st !== "dead");
      if (S.spawned && !alive) { S.wave++; S.spawned = false; if (S.wave >= WAVES.length) { S.win = true; S.endT = 1.8; } else S.waveT = 1.4; }
      if (!S.spawned && S.wave < WAVES.length && (S.waveT -= dt) <= 0) { const W = WAVES[S.wave]; S.spawned = true; banner(W.text); W.list.forEach((k, i) => spawn(k, i)); }
    }
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
    for (let i = 0; i < 3; i++) S.cd[i] = Math.max(0, S.cd[i] - dt);

    heroStep(dt);
    S.foes.forEach((f) => foeStep(f, dt));
    S.foes = S.foes.filter((f) => !(f.st === "dead" && f.t <= 0));
    /* 몬스터끼리 살짝 밀어냄 */
    for (let i = 0; i < S.foes.length; i++) for (let j = i + 1; j < S.foes.length; j++) {
      const a = S.foes[i], b = S.foes[j], dx = b.x - a.x, dz = b.z - a.z, need = (a.D.w + b.D.w) * 0.6;
      if (Math.abs(dz) < 18 && Math.abs(dx) < need && a.h < 1 && b.h < 1) { const p = (need - Math.abs(dx)) / 2 * Math.sign(dx || 1); a.x -= p; b.x += p; }
    }
    /* 화염 검기 */
    S.shots.forEach((s) => {
      s.x += s.vx * dt; s.t -= dt;
      S.foes.forEach((f) => { if (!s.hit.includes(f) && Math.abs(f.x - s.x) < 60 + f.D.w && Math.abs(f.z - s.z) < 45 + (f.D.boss ? 30 : 0)) { s.hit.push(f); hitFoe(f, 34, "knock", Math.sign(s.vx)); } });
    });
    S.shots = S.shots.filter((s) => s.t > 0 && s.x > -100 && s.x < ROOM + 100);
    /* 화염검 진 — 몸 둘레를 0.3초마다 */
    if (S.ring > 0) {
      S.ring -= dt; S.ringT = (S.ringT || 0) - dt;
      if (S.ringT <= 0) { S.ringT = 0.3; S.foes.forEach((f) => { if (Math.abs(f.x - H.x) < 120 + f.D.w * 0.5 && Math.abs(f.z - H.z) < 55) hitFoe(f, 11, "stagger", Math.sign(f.x - H.x) || 1); }); }
    }
    S.fx.forEach((x) => { x.t -= dt; if (x.vx) x.x += x.vx * dt; }); S.fx = S.fx.filter((x) => x.t > 0);
    S.nums.forEach((n) => { n.t -= dt; n.y -= 60 * dt; }); S.nums = S.nums.filter((n) => n.t > 0);
    S.tele = S.tele.filter((t) => (t.t -= dt) > 0);
    /* 카메라 */
    S.camX += (clamp(H.x - VW * 0.42, 0, ROOM - VW) - S.camX) * Math.min(1, dt * 8);
    if (shake > 0) shake -= dt;
    if ((S.win || S.over) && (S.endT -= dt) <= 0 && $("result").hidden) showResult();
    for (const k in tap) tap[k] = false;
  }

  function heroStep(dt) {
    const H = S.hero, [ax, az, run] = axis();
    H.inv = Math.max(0, H.inv - dt); H.t += dt;
    const grounded = H.h <= 0 && H.vh <= 0;
    const free = H.st === "idle" || H.st === "walk";
    if (S.over) { gravity(H, dt); H.vx *= 0.9; return; }
    /* 스킬 */
    SKILL.forEach((sk, i) => {
      if (!tap[sk.key] || S.cd[i] > 0 || !(free || H.st === "atk") || !grounded) return;
      S.cd[i] = sk.cd; H.queued = false;
      if (i === 0) { H.st = "cast"; H.t = 0; S.shots.push({ x: H.x + H.face * 40, z: H.z, vx: H.face * 760, t: 0.75, hit: [], face: H.face }); }
      if (i === 1) { S.ring = 3; S.ringT = 0; H.st = "cast"; H.t = 0.1; }
      if (i === 2) { H.st = "dash"; H.t = 0; H.inv = 0.4; H.hit = []; addFx({ k: "kh_dash", x: H.x + H.face * 150, y: H.z - 30, t: 0.5, d: 0.5, s: 330, flip: H.face < 0 }); }
    });
    if (H.st === "dash") { // 화염 돌진 — 0.28초 동안 앞으로, 지나간 적을 띄움
      H.x += H.face * 1150 * dt;
      S.foes.forEach((f) => { if (!H.hit.includes(f) && Math.abs(f.x - H.x) < 60 + f.D.w * 0.5 && Math.abs(f.z - H.z) < 45) { H.hit.push(f); hitFoe(f, 28, "launch", H.face); } });
      if (H.t >= 0.28) { H.st = "idle"; H.vx = 0; }
    } else if (H.st === "cast") { if (H.t >= 0.22) H.st = "idle"; }
    else if (H.st === "roll") { H.x += H.face * 560 * dt; if (H.t >= 0.34) H.st = "idle"; }
    else if (H.st === "hit") { H.vx *= 0.85; H.x += H.vx * dt; if (H.t >= 0.3) H.st = "idle"; }
    else if (H.st === "fall") { gravity(H, dt); H.x += H.vx * dt; if (H.h <= 0 && H.vh <= 0) { H.st = "down"; H.t = 0; H.vx = 0; } }
    else if (H.st === "down") { if (H.t >= 0.6) { H.st = "idle"; H.inv = 1.0; } }
    else if (H.st === "atk" || H.st === "airatk") {
      const A = H.st === "airatk" ? AIR : ATK[H.step];
      if (H.st === "atk" && H.t < A.act[0] + 0.05) H.x += H.face * A.lunge * dt * 4 * (1 - H.t / (A.act[0] + 0.05));
      if (H.t >= A.act[0] && H.t <= A.act[1]) S.foes.forEach((f) => { if (!H.hit.includes(f) && inFront(H, f, A.range, 32)) { H.hit.push(f); hitFoe(f, A.dmg, A.type, H.face); } });
      if (tap.KeyX && H.st === "atk" && H.t > 0.05) H.queued = true;
      if (H.st === "airatk") { gravity(H, dt); H.x += H.vx * dt; if (H.h <= 0 && H.vh <= 0) { H.st = "idle"; } else if (H.t >= A.dur) H.st = "jump"; }
      else if (H.t >= A.dur || (H.queued && H.t >= A.act[1] && H.step < 2)) {
        if (H.queued && H.step < 2) { H.step++; H.st = "atk"; H.t = 0; H.hit = []; H.queued = false; if (ax) H.face = Math.sign(ax); }
        else { H.st = "idle"; H.step = 0; H.queued = false; }
      }
    } else if (H.st === "jump") {
      gravity(H, dt); H.x += ax * 240 * dt; H.z = clamp(H.z + az * 120 * dt, Z0, Z1); if (ax) H.face = Math.sign(ax);
      if (tap.KeyX) { H.st = "airatk"; H.t = 0; H.hit = []; H.vx = ax * 240; }
      if (H.h <= 0 && H.vh <= 0) H.st = "idle";
    } else { // idle · walk
      const sp = run ? 420 : 260;
      H.x += ax * sp * dt; H.z = clamp(H.z + az * 170 * dt, Z0, Z1);
      if (ax) H.face = Math.sign(ax);
      H.st = ax || az ? "walk" : "idle"; if (ax || az) H.walk += dt * (run ? 14 : 9);
      if (tap.KeyX) { H.st = "atk"; H.step = 0; H.t = 0; H.hit = []; H.queued = false; }
      else if (tap.KeyC) { H.st = "jump"; H.vh = 760; H.t = 0; }
      else if (tap.KeyZ) { H.st = "roll"; H.t = 0; H.inv = 0.34; if (ax) H.face = Math.sign(ax); }
    }
    H.x = clamp(H.x, 30, ROOM - 30);
  }
  function gravity(o, dt) { o.h += o.vh * dt; o.vh -= G * dt; if (o.h < 0) o.h = 0; }

  function foeStep(f, dt) {
    const H = S.hero, D = f.D;
    f.t -= dt; f.flash = Math.max(0, f.flash - dt); f.inv = Math.max(0, f.inv - dt); f.cd -= dt;
    const dx = H.x - f.x, dz = H.z - f.z;
    if (f.st === "dead") { if (f.h > 0 || f.vh > 0) { gravity(f, dt); f.x += f.vx * dt; } return; }
    if (f.st === "air") {
      gravity(f, dt); f.x += f.vx * dt; f.vx *= 0.99;
      if (f.h <= 0 && f.vh <= 0) {
        if (D.boss) { f.st = "walk"; shake = 0.5; addFx({ k: "quake", x: f.x, y: f.z, t: 0.5, d: 0.5, s: 260 }); return; }
        if (f.dying) { f.st = "dead"; f.t = 0.9; return; }
        if (f.vhLand === undefined && f.jug < 3) { f.vhLand = 1; f.vh = 180; f.h = 0.1; return; } // 바닥에 한 번 튐
        f.st = "down"; f.t = 0.8; f.vx = 0; f.vhLand = undefined;
      }
      return;
    }
    if (f.st === "down") { if (f.t <= 0) { f.st = "walk"; f.inv = 0.45; f.jug = 0; } return; }
    if (f.st === "hit") { f.x += f.vx * dt; f.vx *= 0.88; if (f.t <= 0) f.st = "walk"; return; }
    if (D.boss) return bossStep(f, dt, dx, dz);
    if (f.st === "walk") {
      f.face = Math.sign(dx) || f.face;
      const want = D.act === "pounce" ? D.range * 0.8 : D.range * 0.6;
      const gx = Math.abs(dx) > want ? Math.sign(dx) * D.spd : 0, gz = Math.abs(dz) > 8 ? Math.sign(dz) * D.spd * 0.55 : 0;
      f.x += gx * dt; f.z = clamp(f.z + gz * dt, Z0, Z1); f.moving = !!(gx || gz);
      if (f.cd <= 0 && Math.abs(dx) < D.range && Math.abs(dz) < 22) { f.st = "wind"; f.t = D.wind; }
    } else if (f.st === "wind") {
      if (f.t <= 0) {
        f.st = "atk"; f.hitDone = false;
        if (D.act === "pounce") { f.t = 0.42; f.vx = f.face * 620; }
        else if (D.act === "lunge") { f.t = 0.5; f.vx = f.face * 260; f.vh = 300; }
        else { f.t = 0.25; f.vx = f.face * 60; }
      }
    } else if (f.st === "atk") {
      if (f.vh || f.h > 0) gravity(f, dt);
      f.x += f.vx * dt; f.vx *= 0.97;
      const reach = D.act === "swing" ? 85 : 45;
      if (!f.hitDone && (S.hero.x - f.x) * f.face > -20 && (S.hero.x - f.x) * f.face < reach + D.w && Math.abs(S.hero.z - f.z) < 26 && S.hero.h < 60) { f.hitDone = true; hurtHero(D.dmg, false, f.face); }
      if (f.t <= 0) { f.st = "walk"; f.cd = rnd(1.1, 2.2); f.vx = 0; f.h = 0; f.vh = 0; }
    }
    f.x = clamp(f.x, 20, ROOM - 20);
  }
  /* 대장 바위 거인 — 내려찍기(앞 땅에 붉은 표시) · 돌진(줄 표시) · 발 구르기(둘레 원). 표시가 뜨면 피하라 */
  function bossStep(f, dt, dx, dz) {
    if (f.st === "walk") {
      f.face = Math.sign(dx) || f.face;
      f.x += (Math.abs(dx) > 130 ? Math.sign(dx) * f.D.spd : 0) * dt; f.z = clamp(f.z + (Math.abs(dz) > 10 ? Math.sign(dz) * 55 : 0) * dt, Z0, Z1); f.moving = Math.abs(dx) > 130;
      if (f.cd <= 0) {
        const r = Math.random(), far = Math.abs(dx) > 320;
        f.pat = far ? "charge" : r < 0.5 ? "slam" : "stomp";
        f.st = "wind"; f.t = f.pat === "charge" ? 0.75 : 0.85; f.hitDone = false;
        if (f.pat === "slam") S.tele.push({ k: "rect", x0: f.face > 0 ? f.x + 30 : f.x - 250, x1: f.face > 0 ? f.x + 250 : f.x - 30, z: f.z, zr: 50, t: f.t, full: f.t });
        if (f.pat === "charge") S.tele.push({ k: "rect", x0: f.face > 0 ? f.x : f.x - 700, x1: f.face > 0 ? f.x + 700 : f.x, z: f.z, zr: 34, t: f.t, full: f.t });
        if (f.pat === "stomp") S.tele.push({ k: "ring", x: f.x, z: f.z, r: 190, t: f.t, full: f.t });
      }
    } else if (f.st === "wind") {
      if (f.t <= 0) {
        f.st = "atk"; f.t = f.pat === "charge" ? 0.6 : 0.3; shake = 0.3;
        if (f.pat === "charge") f.vx = f.face * 1150;
        else { addFx({ k: "quake", x: f.pat === "slam" ? f.x + f.face * 140 : f.x, y: f.z, t: 0.5, d: 0.5, s: f.pat === "slam" ? 300 : 420 }); const H = S.hero;
          const hit = f.pat === "slam" ? (H.x - f.x) * f.face > 20 && (H.x - f.x) * f.face < 260 && Math.abs(H.z - f.z) < 55 : Math.hypot(H.x - f.x, (H.z - f.z) * 2) < 200;
          if (hit && H.h < 40) hurtHero(f.D.dmg + (f.pat === "slam" ? 6 : 0), true, f.face); }
      }
    } else if (f.st === "atk") {
      if (f.pat === "charge") {
        f.x += f.vx * dt;
        if (!f.hitDone && Math.abs(S.hero.x - f.x) < 70 && Math.abs(S.hero.z - f.z) < 40 && S.hero.h < 50) { f.hitDone = true; hurtHero(f.D.dmg, true, f.face); }
        if (f.x < 60 || f.x > ROOM - 60) f.t = 0;
      }
      if (f.t <= 0) { f.st = "walk"; f.cd = f.hp < f.max * 0.4 ? rnd(0.8, 1.3) : rnd(1.3, 2.1); f.vx = 0; }
    }
    f.x = clamp(f.x, 60, ROOM - 60);
  }

  /* ── 그리기 ── */
  function frame(im, fr, x, y, sc, flip, ax, alpha, rot) {
    if (!fr || !im.complete) return;
    const w = fr[2] * sc, h = fr[3] * sc;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(im, fr[0], fr[1], fr[2], fr[3], -w * (ax == null ? 0.5 : ax), -h, w, h); g.restore();
  }
  function centered(im, fr, x, y, size, flip, alpha, rot) {
    if (!fr || !im.complete) return;
    const k = size / Math.max(fr[2], fr[3]), w = fr[2] * k, h = fr[3] * k;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(im, fr[0], fr[1], fr[2], fr[3], -w / 2, -h / 2, w, h); g.restore();
  }
  /* 배경 — 붉은 달 · 먼 산 · 숲 그림자 · 돌바닥 (나중에 제미나이 배경 그림으로 바꿈) */
  const HILLS = Array.from({ length: 40 }, (_, i) => [i * 120, 150 + Math.sin(i * 1.7) * 40 + Math.sin(i * 0.6) * 30]);
  const TREES = Array.from({ length: 70 }, (_, i) => [i * 55 + Math.sin(i * 3.1) * 20, 60 + (i * 37 % 50), 0.8 + (i * 13 % 7) / 10]);
  function bg(cx) {
    const sky = g.createLinearGradient(0, 0, 0, Z0); sky.addColorStop(0, "#12070b"); sky.addColorStop(0.6, "#3a1218"); sky.addColorStop(1, "#5a1d17");
    g.fillStyle = sky; g.fillRect(0, 0, VW, Z0);
    const mx = 700 - cx * 0.05; g.fillStyle = "rgba(255,90,60,.18)"; g.beginPath(); g.arc(mx, 110, 90, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d8432c"; g.beginPath(); g.arc(mx, 110, 58, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(120,20,20,.35)"; g.beginPath(); g.arc(mx + 14, 100, 14, 0, Math.PI * 2); g.arc(mx - 18, 124, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#24090d"; g.beginPath(); g.moveTo(0, Z0);
    HILLS.forEach(([x, y]) => g.lineTo(x - cx * 0.2, Z0 - y)); g.lineTo(VW, Z0); g.fill();
    g.fillStyle = "#14060a";
    TREES.forEach(([x, hgt, s]) => { const tx = ((x - cx * 0.5) % 3900 + 3900) % 3900 - 100; if (tx < -80 || tx > VW + 80) return; const base = Z0 - 6;
      g.beginPath(); g.moveTo(tx, base - hgt * 2.2 * s); g.lineTo(tx - 34 * s, base); g.lineTo(tx + 34 * s, base); g.fill(); g.fillRect(tx - 4, base - 10, 8, 12); });
    const gr = g.createLinearGradient(0, Z0 - 30, 0, VH); gr.addColorStop(0, "#2a1b16"); gr.addColorStop(1, "#140c0a");
    g.fillStyle = gr; g.fillRect(0, Z0 - 30, VW, VH - Z0 + 30);
    g.strokeStyle = "rgba(255,200,140,.06)"; g.lineWidth = 1; g.beginPath();
    for (let x = -((cx) % 90); x < VW; x += 90) { g.moveTo(x, Z0 - 30); g.lineTo(x - 60, VH); }
    for (let y = Z0; y < VH; y += 38) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, Z0 - 32, VW, 4);
  }
  function shadow(x, z, w) { g.fillStyle = "rgba(0,0,0,.38)"; g.beginPath(); g.ellipse(x, z, w, w * 0.28, 0, 0, Math.PI * 2); g.fill(); }
  function drawHero(H, cx) {
    const x = H.x - cx, y = H.z - H.h, F = FR.hero;
    shadow(x, H.z, 30 * Math.max(0.5, 1 - H.h / 400));
    let fr = F.side, ax = 0.5, rot = 0, a = H.inv > 0 && H.st !== "roll" && H.st !== "dash" && Math.floor(S.t * 20) % 2 ? 0.45 : 1;
    if (H.st === "walk") fr = Math.sin(H.walk) > 0 ? F.side2 : F.side;
    else if (H.st === "atk") { fr = F[ATK[H.step].fr]; ax = AX[ATK[H.step].fr] || 0.5; }
    else if (H.st === "airatk") fr = F.atk2;
    else if (H.st === "cast" || H.st === "dash") fr = F.atk3;
    else if (H.st === "jump") fr = F.side2;
    else if (H.st === "hit") fr = F.hit;
    else if (H.st === "fall") fr = F.fall;
    else if (H.st === "down") fr = S.over ? F.dead : F.fall;
    else if (H.st === "roll") { fr = F.fall; rot = H.face * H.t / 0.34 * Math.PI * 2; }
    if (rot) centered(IMG.hero, fr, x, y - 40, 100, H.face < 0, a, rot);
    else frame(IMG.hero, fr, x, y + 4, 0.95, H.face < 0, ax, a);
    if (H.st === "atk" && H.t >= ATK[H.step].act[0] - 0.02 && H.t <= ATK[H.step].act[1] + 0.06) { // 칼 궤적
      const A = ATK[H.step], p = (H.t - A.act[0]) / (A.act[1] - A.act[0] + 0.06);
      g.save(); g.translate(x + H.face * 30, y - 60); g.scale(H.face, 1);
      g.strokeStyle = H.step === 2 ? "rgba(255,160,60,.9)" : "rgba(255,240,210,.85)"; g.lineWidth = H.step === 2 ? 7 : 5; g.lineCap = "round";
      g.beginPath(); if (H.step === 2) g.arc(10, 10, A.range * 0.7, Math.PI * 0.6, Math.PI * (0.6 - 1.1 * Math.min(1, p)), true); else g.arc(0, 0, A.range * 0.7, -Math.PI * 0.55, -Math.PI * 0.55 + Math.PI * 1.0 * Math.min(1, p)); g.stroke(); g.restore();
    }
  }
  function drawFoe(f, cx) {
    const x = f.x - cx, y = f.z - f.h, D = f.D, A = FR.mon[f.kind];
    shadow(x, f.z, D.w * 0.9 * Math.max(0.5, 1 - f.h / 400));
    let list = A.move, rot = 0;
    if (f.st === "hit" || f.st === "air") list = A.hit;
    if (f.st === "wind" || f.st === "atk") list = A.attack;
    if (f.st === "down" || f.st === "dead") list = A.dead;
    const fr = list[Math.floor((S.t + f.ph) * 6) % list.length] || list[0];
    const flip = D.native ? f.face !== D.native : f.face < 0;
    let a = f.st === "dead" ? Math.min(1, f.t / 0.5) : 1;
    if (f.st === "air" && !D.boss) rot = -f.face * Math.min(1.2, f.h / 200);
    const bob = f.moving && f.st === "walk" ? Math.abs(Math.sin((S.t + f.ph) * 9)) * 4 : 0;
    g.save();
    if (f.st === "wind") { g.translate((Math.random() - 0.5) * 3, 0); }
    frame(IMG.mon, fr, x, y + 2 - bob, D.sc, flip, 0.5, a, rot);
    if (f.flash > 0 || f.st === "wind") { g.globalCompositeOperation = "lighter"; frame(IMG.mon, fr, x, y + 2 - bob, D.sc, flip, 0.5, f.st === "wind" ? 0.35 + 0.25 * Math.sin(S.t * 40) : 0.6, rot); }
    g.restore();
    if (!D.boss && f.st !== "dead" && f.hp < f.max) { const w = 50, by = y - fr[3] * D.sc - 10; g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - w / 2, by, w, 5); g.fillStyle = "#e5484d"; g.fillRect(x - w / 2, by, w * f.hp / f.max, 5); }
  }
  function draw() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cx = S ? S.camX + (shake > 0 ? (Math.random() - 0.5) * 10 * shake * 2 : 0) : 0;
    bg(cx);
    if (!S) return;
    // 땅 표시(대장 공격 예고)
    S.tele.forEach((t) => {
      const p = 1 - t.t / t.full; g.fillStyle = "rgba(255,50,40,.18)"; g.strokeStyle = "rgba(255,70,50,.9)"; g.lineWidth = 2;
      if (t.k === "rect") { g.fillRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.strokeRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.fillStyle = "rgba(255,50,40,.35)"; const w = (t.x1 - t.x0) * p; g.fillRect((t.x0 > (t.x0 + t.x1) / 2 ? t.x1 - w : t.x0) - cx, t.z - t.zr, w, t.zr * 2); }
      else { g.beginPath(); g.ellipse(t.x - cx, t.z, t.r, t.r * 0.42, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "rgba(255,50,40,.35)"; g.beginPath(); g.ellipse(t.x - cx, t.z, t.r * p, t.r * 0.42 * p, 0, 0, Math.PI * 2); g.fill(); }
    });
    // 화염검 진 — 발밑 뒤쪽 반
    const H = S.hero;
    if (S.ring > 0) centered(IMG.hsk, FR.hsk.kh_ring, H.x - cx, H.z - 30 - H.h, 270, false, Math.min(1, S.ring / 0.3) * 0.95, S.t * 5);
    // 몸들 — 앞뒤(z) 순서로
    const bodies = S.foes.map((f) => [f.z, () => drawFoe(f, cx)]); bodies.push([H.z + 0.1, () => drawHero(H, cx)]);
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    S.shots.forEach((s) => centered(IMG.hsk, FR.hsk.kh_wave, s.x - cx, s.z - 60, 170, s.face < 0, Math.min(1, s.t / 0.15)));
    S.fx.forEach((x) => {
      const p = 1 - x.t / x.d;
      if (x.k === "spark") { const L = FR.mfx.spark; centered(IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y, x.s * (0.8 + p * 0.5), false, 1 - p * 0.6); }
      else if (x.k === "quake") { const L = FR.mfx.quake; centered(IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y - 20, x.s, false, 1 - p * 0.5); }
      else if (x.k === "kh_dash") centered(IMG.hsk, FR.hsk.kh_dash, x.x - cx, x.y, x.s, x.flip, 1 - p);
    });
    g.textAlign = "center"; g.textBaseline = "middle";
    S.nums.forEach((n) => { g.font = "900 22px 'Noto Sans KR', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.globalAlpha = Math.min(1, n.t / 0.3); g.strokeText(n.v, n.x - cx, n.y); g.fillStyle = n.c; g.fillText(n.v, n.x - cx, n.y); g.globalAlpha = 1; });
    hud();
  }
  function bar(x, y, w, h, p, c) { g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = c; g.fillRect(x, y, w * clamp(p, 0, 1), h); }
  function hud() {
    const H = S.hero;
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = "700 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#f6d27a"; g.fillText("무사 강혁", 22, 30);
    bar(22, 40, 260, 14, H.hp / H.max, H.hp / H.max > 0.3 ? "#3ccf6a" : "#e5484d");
    g.font = "600 12px 'Noto Sans KR', sans-serif"; g.fillStyle = "#fff"; g.fillText(Math.ceil(H.hp) + " / " + H.max, 28, 52);
    g.fillStyle = "#c9b48a"; g.fillText(("무리 " + Math.min(S.wave + 1, WAVES.length) + " / " + WAVES.length) + "   " + Math.floor(S.t / 60) + ":" + String(Math.floor(S.t % 60)).padStart(2, "0"), 22, 74);
    const B = S.foes.find((f) => f.D.boss && f.st !== "dead");
    if (B) { g.textAlign = "center"; g.font = "800 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#ffb08a"; g.fillText(B.D.name, VW / 2, 28); bar(VW / 2 - 220, 36, 440, 12, B.hp / B.max, "#e0662a"); }
    if (S.combo >= 2) { g.textAlign = "right"; g.font = "900 " + (30 + Math.min(20, S.combo)) + "px 'Noto Sans KR', sans-serif"; g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; const t = S.combo + " 연속!"; g.strokeText(t, VW - 24, 120); g.fillStyle = "#ffd36b"; g.fillText(t, VW - 24, 120); }
    if (S.bannerT > 0) { g.textAlign = "center"; g.font = "800 26px 'Noto Sans KR', sans-serif"; g.globalAlpha = Math.min(1, S.bannerT / 0.4); g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(S.banner, VW / 2, 170); g.fillStyle = "#fff1d0"; g.fillText(S.banner, VW / 2, 170); g.globalAlpha = 1; }
    if (!touch) { // PC — 스킬 칸
      SKILL.forEach((sk, i) => { const x = VW - 210 + i * 66, y = VH - 70; g.fillStyle = "rgba(20,10,8,.75)"; g.fillRect(x, y, 56, 56); g.strokeStyle = "#b8893a"; g.strokeRect(x, y, 56, 56);
        const fr = FR.hsk[["kh_wave", "kh_ring", "kh_dash"][i]]; centered(IMG.hsk, fr, x + 28, y + 28, 48, false, S.cd[i] > 0 ? 0.35 : 1);
        if (S.cd[i] > 0) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x, y + 56 * (1 - S.cd[i] / sk.cd), 56, 56 * S.cd[i] / sk.cd); g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "800 16px sans-serif"; g.fillText(Math.ceil(S.cd[i]), x + 28, y + 34); }
        g.fillStyle = "#f6d27a"; g.textAlign = "left"; g.font = "700 11px sans-serif"; g.fillText("ASD"[i], x + 4, y + 13); });
    } else SKILL.forEach((sk, i) => { $("tS" + (i + 1)).querySelector(".cd").style.setProperty("--cd", S.cd[i] / sk.cd); });
    if (stick) { g.strokeStyle = "rgba(246,210,122,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(stick.ox, stick.oy, 45, 0, Math.PI * 2); g.stroke(); const [ax, az] = axis(); g.fillStyle = "rgba(246,210,122,.4)"; g.beginPath(); g.arc(stick.ox + ax * 45, stick.oy + az * 45, 18, 0, Math.PI * 2); g.fill(); }
  }

  /* ── 결과 ── */
  function showResult() {
    running = false;
    const sec = Math.floor(S.t), grade = !S.win ? "-" : S.hitsTaken <= 3 && sec < 150 ? "S" : S.hitsTaken <= 8 ? "A" : S.hitsTaken <= 16 ? "B" : "C";
    $("resTitle").textContent = S.win ? "클리어!" : "쓰러졌다…";
    $("resGrade").textContent = grade;
    $("resLine").textContent = Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + " · 최대 " + S.maxCombo + " 연속 · 맞은 횟수 " + S.hitsTaken;
    $("result").hidden = false;
  }
  function loop(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0); last = ts;
    if (running) { if (stop > 0) stop -= dt; else step(dt); }
    draw();
    requestAnimationFrame(loop);
  }
  function start() { newGame(); $("intro").hidden = true; $("result").hidden = true; running = true; for (const k in keys) keys[k] = false; }
  $("startBtn").onclick = start; $("againBtn").onclick = start;
  $("fullBtn").onclick = () => { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} };
  /* 병무청 홈페이지에 로그인한 닉네임(같은 주소라 그대로 읽힘) — 베타 동안만 */
  try { const me = JSON.parse(localStorage.getItem("bmc-me") || "null"); if (me && me.gameId) $("hello").textContent = me.gameId + " 님, 무사 강혁으로 검은 숲 어귀의 잡귀를 물리치고 바위 거인을 쓰러뜨리세요."; } catch (e) {}
  if (/[?&]test=1/.test(location.search)) window.__bg = { get S() { return S; }, start, step, keys, tap, MON };
  requestAnimationFrame(loop);
})();
