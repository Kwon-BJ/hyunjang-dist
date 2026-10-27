/* 봉인검록 — 던전 전투 (2026-10-27 시제품 → 내 캐릭터 · 파티)
   옆으로 걸어가며 싸우는 판. 바닥은 옆으로 긴 띠이고 위아래(안쪽 · 바깥쪽 줄)로도 움직인다.
   세계 자리: x = 가로, z = 바닥 줄(화면 y 의 발 자리), h = 땅에서 뜬 높이. 화면 y = z − h.
   파티면 파티장(host) 화면이 몬스터를 돌리고, 다른 사람은 받은 자리를 그린다. 맞히면 파티장에게 「맞혔다」 를 보내고,
   몬스터가 다른 사람을 때리면 파티장이 그 사람에게 「맞았다」 를 보낸다(서버는 같은 판끼리 주고받기만) */
"use strict";
const Dungeon = (() => {
  const VW = 960, VH = 540, Z0 = 368, Z1 = 512, ROOM = 1800, G = 1900;
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || ""; // 판 번호 — 새 판이면 그림도 새로 받음
  const img = (src) => { const i = new Image(); i.src = src + (V ? "?v=" + V : ""); return i; };
  const IMG = { hero: img("img/heroes5.png"), mon: img("img/mon2.png"), hsk: img("img/hsk.png"), mfx: img("img/mfx.png") };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── 몬스터 ── native = 그림이 보는 쪽(1 오른쪽, 0 앞), sprite = 다른 몬스터 그림을 빌려 씀, tint = 색 바꿈 */
  const MON = {
    slime: { name: "슬라임", hp: 70, spd: 80, sc: 0.62, dmg: 7, act: "lunge", range: 70, wind: 0.45, native: 0, w: 30 },
    goblin: { name: "고블린", hp: 110, spd: 115, sc: 0.85, dmg: 10, act: "swing", range: 80, wind: 0.42, native: 1, w: 32 },
    wolf: { name: "늑대", hp: 95, spd: 200, sc: 0.8, dmg: 9, act: "pounce", range: 230, wind: 0.38, native: 1, w: 38 },
    golem: { name: "바위 거인", hp: 2600, spd: 70, sc: 1.75, dmg: 24, act: "boss", range: 150, wind: 0.8, native: 0, w: 70, boss: true },
    gchief: { name: "고블린 족장", hp: 3400, spd: 105, sc: 1.5, dmg: 26, act: "boss", range: 150, wind: 0.7, native: 1, w: 60, boss: true, sprite: "goblin", tint: "hue-rotate(-70deg) saturate(1.5) brightness(.9)" },
    wchief: { name: "늑대 우두머리", hp: 3800, spd: 170, sc: 1.4, dmg: 28, act: "boss", range: 160, wind: 0.6, native: 1, w: 64, boss: true, sprite: "wolf", tint: "grayscale(.6) brightness(1.25) contrast(1.2)" },
  };
  /* ── 던전 — 서버 DUNGEONS 와 같은 열쇠 ── */
  const DUN = {
    forest: { name: "검은 숲 어귀", theme: "forest", waves: [
      { text: "검은 숲 어귀 — 슬라임이 몰려온다!", list: ["slime", "slime", "slime", "slime", "slime"] },
      { text: "고블린 무리!", list: ["goblin", "goblin", "goblin", "slime", "slime"] },
      { text: "늑대가 달려든다 — 구르기로 피해!", list: ["wolf", "wolf", "wolf", "goblin", "goblin"] },
      { text: "대장 바위 거인 등장!", list: ["golem"] } ] },
    goblin: { name: "고블린의 숲", theme: "goblin", waves: [
      { text: "고블린의 숲 — 고블린 정찰대!", list: ["goblin", "goblin", "goblin", "goblin", "wolf"] },
      { text: "늑대를 탄 고블린 무리!", list: ["wolf", "wolf", "wolf", "goblin", "goblin", "goblin"] },
      { text: "숲 깊은 곳 — 모두 몰려온다!", list: ["goblin", "goblin", "wolf", "wolf", "slime", "slime", "goblin"] },
      { text: "대장 고블린 족장 등장!", list: ["gchief"] } ] },
    wolf: { name: "늑대 골짜기", theme: "wolf", waves: [
      { text: "늑대 골짜기 — 울음소리가 사방에서!", list: ["wolf", "wolf", "wolf", "wolf"] },
      { text: "늑대와 고블린 사냥꾼!", list: ["wolf", "wolf", "wolf", "goblin", "goblin", "goblin"] },
      { text: "골짜기 깊은 곳 — 무리가 몰려온다!", list: ["wolf", "wolf", "wolf", "wolf", "wolf", "goblin", "goblin"] },
      { text: "대장 늑대 우두머리 등장!", list: ["wchief"] } ] },
  };
  const ATK = [
    { dur: 0.3, act: [0.06, 0.16], range: 100, dmg: 12, type: "stagger", lunge: 70 },
    { dur: 0.3, act: [0.06, 0.16], range: 105, dmg: 14, type: "stagger", lunge: 70 },
    { dur: 0.42, act: [0.1, 0.22], range: 120, dmg: 20, type: "launch", lunge: 110 },
  ];
  const AIR = { dur: 0.36, act: [0.04, 0.26], range: 100, dmg: 13, type: "stagger" };
  const SKILL = [{ act: "s1", name: "화염 검기", cd: 3, fr: "kh_wave" }, { act: "s2", name: "화염검 진", cd: 8, fr: "kh_ring" }, { act: "s3", name: "화염 돌진", cd: 5, fr: "kh_dash" }];

  let S = null, C = null, stop = 0, shake = 0, nextId = 1;
  const host = () => !C.party || C.party.host === C.me;

  /* cfg = { d, me, look, nick, stats:{hpMax, atk, def}, potions, party:{host, members:[{id,nick,look,lv}]} | null, send(data, to), usePotion(), onEnd(res), axis() } */
  function start(cfg) {
    C = cfg; const D = DUN[cfg.d] || DUN.forest;
    const n = cfg.party ? cfg.party.members.length : 1;
    stop = 0; shake = 0;
    S = {
      D, t: 0, wave: 0, waveT: 1.2, spawned: false, banner: "", bannerT: 0, foes: [], shots: [], fx: [], nums: [], tele: [],
      hero: { x: 220, z: 440, h: 0, vx: 0, vh: 0, face: 1, hp: cfg.stats.hpMax, max: cfg.stats.hpMax, st: "idle", t: 0, inv: 0, step: 0, queued: false, hit: [], walk: 0 },
      mult: cfg.stats.atk / 33, hpK: 1 + 0.6 * (n - 1), potions: cfg.potions || 0,
      combo: 0, comboT: 0, maxCombo: 0, hitsTaken: 0, cd: [0, 0, 0], ring: 0, over: false, win: false, lose: false, camX: 0, endT: 0, ended: false,
      remote: {}, sendT: 0, syncT: 0,
    };
    if (cfg.party) cfg.party.members.forEach((m, i) => { if (m.id !== cfg.me) S.remote[m.id] = { id: m.id, nick: m.nick, look: m.look, x: 180 - i * 30, z: 420 + i * 25, h: 0, face: 1, st: "idle", t: 0, step: 0, walk: 0, hp: 1, max: 1, tx: 180 - i * 30, tz: 420 + i * 25, th: 0, alive: true, inv: 0 }; });
  }
  function banner(t) { S.banner = t; S.bannerT = 2.2; }
  function spawn(kind, i) {
    const D = MON[kind], side = D.boss ? 1 : i % 2 ? -1 : 1;
    let x = side > 0 ? S.camX + VW + 60 + i * 40 : S.camX - 60 - i * 40;
    x = clamp(x, 40, ROOM - 40);
    if (D.boss) x = clamp(S.hero.x + 420, 200, ROOM - 120);
    const hp = Math.round(D.hp * S.hpK);
    S.foes.push({ id: nextId++, kind, D, x, z: rnd(Z0 + 10, Z1 - 10), h: D.boss ? 400 : 0, vx: 0, vh: 0, face: -side, hp, max: hp, st: D.boss ? "air" : "walk", t: 0, cd: rnd(0.6, 1.6), jug: 0, inv: 0, flash: 0, poise: 260 * S.hpK, hitDone: false, ph: Math.random() * 5 });
    if (D.boss) shake = 0.5;
  }
  function addFx(o) { if (S.fx.length < 120) S.fx.push(o); }
  function num(x, y, v, c) { if (S.nums.length < 80) S.nums.push({ x, y, v, c: c || "#fff", t: 0.7 }); }

  /* 맞히기 — 파티원은 보이는 것만 하고 파티장에게 보낸다. remote = 파티원이 보낸 것 */
  function hitFoe(f, dmg, type, dir, remote) {
    if (f.st === "dead" || f.inv > 0) return false;
    if (!remote) { dmg = Math.round(dmg * S.mult * rnd(0.92, 1.08)); S.combo++; S.comboT = 1.6; S.maxCombo = Math.max(S.maxCombo, S.combo); stop = Math.max(stop, type === "launch" ? 0.07 : 0.045); num(f.x, f.z - f.h - f.D.sc * 70, dmg, type === "launch" ? "#ffd36b" : "#fff"); }
    addFx({ k: "spark", x: f.x - dir * 10, y: f.z - f.h - 40 * f.D.sc, t: 0.22, d: 0.22, s: 70 });
    f.flash = 0.1;
    if (!host()) { C.send({ k: "hit", i: f.id, dmg, type, dir }, C.party.host); return true; }
    f.hp -= dmg;
    if (f.D.boss) {
      f.poise -= dmg; f.x += dir * 4;
      if (f.poise <= 0) { f.poise = 260 * S.hpK; f.st = "hit"; f.t = 0.7; banner(f.D.name + " 이(가) 휘청인다 — 지금이다!"); }
      if (f.hp <= 0) { f.hp = 0; f.st = "dead"; f.t = 1.6; shake = 0.6; }
      return true;
    }
    const airborne = f.h > 0.5 || f.st === "air";
    if (type === "launch") { f.vh = 680; f.vx = dir * 60; f.st = "air"; f.jug = 0; }
    else if (type === "knock") { f.vh = 380; f.vx = dir * 420; f.st = "air"; f.jug = 0; }
    else if (airborne) { f.vh = Math.max(f.vh, 330 - f.jug * 55); f.jug++; f.vx = dir * 40; f.st = "air"; }
    else { f.st = "hit"; f.t = 0.38; f.vx = dir * 130; }
    if (f.hp <= 0) { f.hp = 0; f.dying = true; if (!airborne && type === "stagger") { f.vh = 360; f.vx = dir * 160; f.st = "air"; } }
    return true;
  }
  function inFront(o, f, range, zr) {
    const dx = (f.x - o.x) * o.face, w = f.D.w;
    return dx > -w * 0.6 && dx < range + w && Math.abs(f.z - o.z) < (zr || 30) + (f.D.boss ? 30 : 0) && Math.abs((f.h + 40) - (o.h + 40)) < 120 + f.D.sc * 40;
  }
  /* 맞기 — who 가 나면 여기서, 파티원이면 그 사람에게 보낸다 */
  function hurt(who, dmg, heavy, dir) {
    if (who !== S.hero) { if (who.alive) C.send({ k: "hurt", dmg, heavy, dir }, who.id); return; }
    const H = S.hero;
    if (H.inv > 0 || H.st === "roll" || H.st === "down" || H.st === "dash" || (S.over && S.win) || H.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, (C.stats.def || 0) / 120)))); // 방어 — 많아야 60% 줄임
    H.hp -= dmg; S.hitsTaken++; shake = Math.max(shake, heavy ? 0.35 : 0.18);
    num(H.x, H.z - H.h - 120, dmg, "#ff6a5a");
    if (heavy) { H.st = "fall"; H.vh = 420; H.vx = dir * 300; H.t = 0; }
    else { H.st = "hit"; H.t = 0.3; H.vx = dir * 160; H.inv = 0.45; }
    H.queued = false;
    if (H.hp <= 0) { H.hp = 0; H.st = "fall"; H.vh = 300; if (!C.party) { S.over = true; S.lose = true; S.endT = 1.6; } }
  }
  /* 몬스터가 노리는 사람 — 살아 있는 사람 중 가장 가까운 */
  function heroes() { const a = []; if (S.hero.hp > 0) a.push(S.hero); for (const id in S.remote) { const r = S.remote[id]; if (r.alive && r.hp > 0) a.push(r); } return a; }
  function target(f) { let best = null, bd = 1e9; heroes().forEach((h) => { const d = Math.abs(h.x - f.x) + Math.abs(h.z - f.z) * 2; if (d < bd) { bd = d; best = h; } }); return best || S.hero; }

  /* ── 한 틀 ── */
  function step(dt) {
    if (!S || S.ended) return;
    if (stop > 0) { stop -= dt; return; }
    S.t += dt;
    const H = S.hero;
    if (host() && !S.win && !S.lose) {
      const alive = S.foes.some((f) => f.st !== "dead");
      if (S.spawned && !alive) { S.wave++; S.spawned = false; if (S.wave >= S.D.waves.length) { S.win = true; S.over = true; S.endT = 1.8; } else S.waveT = 1.4; }
      if (!S.spawned && S.wave < S.D.waves.length && (S.waveT -= dt) <= 0) { const W = S.D.waves[S.wave]; S.spawned = true; banner(W.text); W.list.forEach((k, i) => spawn(k, i)); }
      if (C.party && !heroes().length) { S.lose = true; S.over = true; S.endT = 1.6; banner("모두 쓰러졌다…"); }
    }
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
    for (let i = 0; i < 3; i++) S.cd[i] = Math.max(0, S.cd[i] - dt);
    heroStep(dt);
    if (host()) S.foes.forEach((f) => foeStep(f, dt));
    else S.foes.forEach((f) => { f.x += (f.tx - f.x) * Math.min(1, dt * 12); f.z += (f.tz - f.z) * Math.min(1, dt * 12); f.h += (f.th - f.h) * Math.min(1, dt * 14); f.flash = Math.max(0, f.flash - dt); if (f.st === "dead") f.t -= dt; });
    S.foes = S.foes.filter((f) => !(f.st === "dead" && f.t <= 0));
    if (host()) for (let i = 0; i < S.foes.length; i++) for (let j = i + 1; j < S.foes.length; j++) {
      const a = S.foes[i], b = S.foes[j], dx = b.x - a.x, dz = b.z - a.z, need = (a.D.w + b.D.w) * 0.6;
      if (Math.abs(dz) < 18 && Math.abs(dx) < need && a.h < 1 && b.h < 1) { const p = (need - Math.abs(dx)) / 2 * Math.sign(dx || 1); a.x -= p; b.x += p; }
    }
    S.shots.forEach((s) => {
      s.x += s.vx * dt; s.t -= dt;
      S.foes.forEach((f) => { if (!s.hit.includes(f) && Math.abs(f.x - s.x) < 60 + f.D.w && Math.abs(f.z - s.z) < 45 + (f.D.boss ? 30 : 0)) { s.hit.push(f); hitFoe(f, 34, "knock", Math.sign(s.vx)); } });
    });
    S.shots = S.shots.filter((s) => s.t > 0 && s.x > -100 && s.x < ROOM + 100);
    if (S.ring > 0) {
      S.ring -= dt; S.ringT = (S.ringT || 0) - dt;
      if (S.ringT <= 0) { S.ringT = 0.3; S.foes.forEach((f) => { if (Math.abs(f.x - H.x) < 120 + f.D.w * 0.5 && Math.abs(f.z - H.z) < 55) hitFoe(f, 11, "stagger", Math.sign(f.x - H.x) || 1); }); }
    }
    for (const id in S.remote) { const r = S.remote[id]; r.x += (r.tx - r.x) * Math.min(1, dt * 12); r.z += (r.tz - r.z) * Math.min(1, dt * 12); r.h += (r.th - r.h) * Math.min(1, dt * 14); r.t += dt; if (r.st === "walk" || r.st === "run") r.walk += dt * 10; }
    S.fx.forEach((x) => { x.t -= dt; }); S.fx = S.fx.filter((x) => x.t > 0);
    S.nums.forEach((n) => { n.t -= dt; n.y -= 60 * dt; }); S.nums = S.nums.filter((n) => n.t > 0);
    S.tele = S.tele.filter((t) => (t.t -= dt) > 0);
    S.camX += (clamp(H.x - VW * 0.42, 0, ROOM - VW) - S.camX) * Math.min(1, dt * 8);
    if (shake > 0) shake -= dt;
    /* 파티 — 내 자리 초당 15번, 파티장은 몬스터 자리 초당 12번 */
    if (C.party) {
      if ((S.sendT -= dt) <= 0) { S.sendT = 1 / 15; C.send({ k: "me", x: Math.round(H.x), z: Math.round(H.z), h: Math.round(H.h), face: H.face, st: H.st, step: H.step, hp: Math.max(0, Math.round(H.hp)), max: H.max }); }
      if (host() && (S.syncT -= dt) <= 0) { S.syncT = 1 / 12; C.send({ k: "sync", wave: S.wave, banner: S.bannerT > 2 ? S.banner : "", win: S.win ? 1 : 0, lose: S.lose ? 1 : 0, tele: S.tele.map((t) => [t.k, Math.round(t.k === "rect" ? t.x0 : t.x), Math.round(t.x1 || 0), Math.round(t.z), t.zr || t.r, +t.t.toFixed(2), t.full]), foes: S.foes.map((f) => [f.id, f.kind, Math.round(f.x), Math.round(f.z), Math.round(f.h), f.st, f.face, Math.round(f.hp), f.max]) }); }
    }
    if (S.over && !S.ended && (S.endT -= dt) <= 0) { S.ended = true; C.onEnd({ win: S.win, sec: Math.floor(S.t), maxCombo: S.maxCombo, hits: S.hitsTaken }); }
  }

  function heroStep(dt) {
    const H = S.hero, [ax, az, run] = C.axis();
    H.inv = Math.max(0, H.inv - dt); H.t += dt;
    const grounded = H.h <= 0 && H.vh <= 0, free = H.st === "idle" || H.st === "walk" || H.st === "run";
    if (H.hp <= 0) { gravity(H, dt); H.x += H.vx * dt; H.vx *= 0.9; if (H.h <= 0) H.st = "dead"; return; }
    if (S.over && S.win) { if (grounded) H.st = "idle"; return; }
    if (KEYS.take("potion") && S.potions > 0 && H.hp < H.max) { S.potions--; const heal = Math.round(H.max * 0.4); H.hp = Math.min(H.max, H.hp + heal); num(H.x, H.z - 130, "+" + heal, "#5eea7a"); C.usePotion(); }
    SKILL.forEach((sk, i) => {
      if (!KEYS.take(sk.act) || S.cd[i] > 0 || !(free || H.st === "atk") || !grounded) return;
      S.cd[i] = sk.cd; H.queued = false;
      if (i === 0) { H.st = "cast"; H.t = 0; S.shots.push({ x: H.x + H.face * 40, z: H.z, vx: H.face * 760, t: 0.75, hit: [], face: H.face }); }
      if (i === 1) { S.ring = 3; S.ringT = 0; H.st = "cast"; H.t = 0.1; }
      if (i === 2) { H.st = "dash"; H.t = 0; H.inv = 0.4; H.hit = []; addFx({ k: "kh_dash", x: H.x + H.face * 150, y: H.z - 30, t: 0.5, d: 0.5, s: 330, flip: H.face < 0 }); }
    });
    if (H.st === "dash") {
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
      if (KEYS.take("atk") && H.st === "atk") H.queued = true; // 공격 중엔 언제 눌러도 다음 타로(맞힐 때 멈칫과 겹쳐 버려지던 것)
      if (H.st === "airatk") { gravity(H, dt); H.x += H.vx * dt; if (H.h <= 0 && H.vh <= 0) H.st = "idle"; else if (H.t >= A.dur) H.st = "jump"; }
      else if (H.t >= A.dur || (H.queued && H.t >= A.act[1] && H.step < 2)) {
        if (H.queued && H.step < 2) { H.step++; H.st = "atk"; H.t = 0; H.hit = []; H.queued = false; if (ax) H.face = Math.sign(ax); }
        else { H.st = "idle"; H.step = 0; H.queued = false; }
      }
    } else if (H.st === "jump") {
      gravity(H, dt); H.x += ax * 240 * dt; H.z = clamp(H.z + az * 120 * dt, Z0, Z1); if (ax) H.face = Math.sign(ax);
      if (KEYS.take("atk")) { H.st = "airatk"; H.t = 0; H.hit = []; H.vx = ax * 240; }
      if (H.h <= 0 && H.vh <= 0) H.st = "idle";
    } else {
      const sp = run ? 420 : 260;
      H.x += ax * sp * dt; H.z = clamp(H.z + az * 170 * dt, Z0, Z1);
      if (ax) H.face = Math.sign(ax);
      H.st = ax || az ? (run ? "run" : "walk") : "idle"; if (ax || az) H.walk += dt * (run ? 14 : 9);
      if (KEYS.take("atk")) { H.st = "atk"; H.step = 0; H.t = 0; H.hit = []; H.queued = false; }
      else if (KEYS.take("jump")) { H.st = "jump"; H.vh = 760; H.t = 0; }
      else if (KEYS.take("roll")) { H.st = "roll"; H.t = 0; H.inv = 0.34; if (ax) H.face = Math.sign(ax); }
    }
    H.x = clamp(H.x, 30, ROOM - 30);
  }
  function gravity(o, dt) { o.h += o.vh * dt; o.vh -= G * dt; if (o.h < 0) o.h = 0; }

  function foeStep(f, dt) {
    const D = f.D, T = target(f);
    f.t -= dt; f.flash = Math.max(0, f.flash - dt); f.inv = Math.max(0, f.inv - dt); f.cd -= dt;
    const dx = T.x - f.x, dz = T.z - f.z;
    if (f.st === "dead") { if (f.h > 0 || f.vh > 0) { gravity(f, dt); f.x += f.vx * dt; } return; }
    if (f.st === "air") {
      gravity(f, dt); f.x += f.vx * dt; f.vx *= 0.99;
      if (f.h <= 0 && f.vh <= 0) {
        if (D.boss) { f.st = "walk"; shake = 0.5; addFx({ k: "quake", x: f.x, y: f.z, t: 0.5, d: 0.5, s: 260 }); return; }
        if (f.dying) { f.st = "dead"; f.t = 0.9; return; }
        if (f.bounced === undefined && f.jug < 3) { f.bounced = 1; f.vh = 180; f.h = 0.1; return; }
        f.st = "down"; f.t = 0.8; f.vx = 0; f.bounced = undefined;
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
      if (!f.hitDone) heroes().forEach((h) => { if (!f.hitDone && (h.x - f.x) * f.face > -20 && (h.x - f.x) * f.face < reach + D.w && Math.abs(h.z - f.z) < 26 && h.h < 60) { f.hitDone = true; hurt(h, D.dmg, false, f.face); } });
      if (f.t <= 0) { f.st = "walk"; f.cd = rnd(1.1, 2.2); f.vx = 0; f.h = 0; f.vh = 0; }
    }
    f.x = clamp(f.x, 20, ROOM - 20);
  }
  function bossStep(f, dt, dx, dz) {
    if (f.st === "walk") {
      f.face = Math.sign(dx) || f.face;
      f.x += (Math.abs(dx) > 130 ? Math.sign(dx) * f.D.spd : 0) * dt; f.z = clamp(f.z + (Math.abs(dz) > 10 ? Math.sign(dz) * 55 : 0) * dt, Z0, Z1); f.moving = Math.abs(dx) > 130;
      if (f.cd <= 0) {
        const r = Math.random(), far = Math.abs(dx) > 320;
        f.pat = far ? "charge" : r < 0.5 ? "slam" : "stomp";
        f.st = "wind"; f.t = (f.pat === "charge" ? 0.75 : 0.85) * (f.kind === "gchief" ? 0.85 : 1); f.hitDone = false;
        if (f.pat === "slam") S.tele.push({ k: "rect", x0: f.face > 0 ? f.x + 30 : f.x - 250, x1: f.face > 0 ? f.x + 250 : f.x - 30, z: f.z, zr: 50, t: f.t, full: f.t });
        if (f.pat === "charge") S.tele.push({ k: "rect", x0: f.face > 0 ? f.x : f.x - 700, x1: f.face > 0 ? f.x + 700 : f.x, z: f.z, zr: 34, t: f.t, full: f.t });
        if (f.pat === "stomp") S.tele.push({ k: "ring", x: f.x, z: f.z, r: 190, t: f.t, full: f.t });
      }
    } else if (f.st === "wind") {
      if (f.t <= 0) {
        f.st = "atk"; f.t = f.pat === "charge" ? 0.6 : 0.3; shake = 0.3;
        if (f.pat === "charge") f.vx = f.face * 1150;
        else { addFx({ k: "quake", x: f.pat === "slam" ? f.x + f.face * 140 : f.x, y: f.z, t: 0.5, d: 0.5, s: f.pat === "slam" ? 300 : 420 });
          heroes().forEach((h) => { const hit = f.pat === "slam" ? (h.x - f.x) * f.face > 20 && (h.x - f.x) * f.face < 260 && Math.abs(h.z - f.z) < 55 : Math.hypot(h.x - f.x, (h.z - f.z) * 2) < 200; if (hit && h.h < 40) hurt(h, f.D.dmg + (f.pat === "slam" ? 6 : 0), true, f.face); }); }
      }
    } else if (f.st === "atk") {
      if (f.pat === "charge") {
        f.x += f.vx * dt; f.hitList = f.hitList || [];
        heroes().forEach((h) => { if (!f.hitList.includes(h) && Math.abs(h.x - f.x) < 70 && Math.abs(h.z - f.z) < 40 && h.h < 50) { f.hitList.push(h); hurt(h, f.D.dmg, true, f.face); } });
        if (f.x < 60 || f.x > ROOM - 60) f.t = 0;
      }
      if (f.t <= 0) { f.st = "walk"; f.hitList = null; f.cd = f.hp < f.max * 0.4 ? rnd(0.8, 1.3) : rnd(1.3, 2.1); f.vx = 0; }
    }
    f.x = clamp(f.x, 60, ROOM - 60);
  }

  /* ── 파티 주고받기 ── */
  function net(from, d) {
    if (!S || !C.party || !d) return;
    if (d.k === "me") { const r = S.remote[from]; if (!r) return; Object.assign(r, { tx: d.x, tz: d.z, th: d.h, face: d.face, step: d.step, hp: d.hp, max: d.max, alive: d.hp > 0 }); if (r.st !== d.st) { r.st = d.st; r.t = 0; } return; }
    if (d.k === "hit" && host()) { const f = S.foes.find((x) => x.id === d.i); if (f) hitFoe(f, Math.min(600, +d.dmg || 0), d.type, d.dir || 1, true); return; }
    if (d.k === "hurt") { hurt(S.hero, +d.dmg || 0, !!d.heavy, d.dir || 1); return; }
    if (d.k === "sync" && !host()) {
      const seen = new Set();
      d.foes.forEach(([id, kind, x, z, h, st, face, hp, max]) => {
        if (!MON[kind]) return;
        seen.add(id); let f = S.foes.find((o) => o.id === id);
        if (!f) { f = { id, kind, D: MON[kind], x, z, h, tx: x, tz: z, th: h, face, hp, max, st, t: 1, flash: 0, ph: Math.random() * 5, inv: 0 }; S.foes.push(f); }
        Object.assign(f, { tx: x, tz: z, th: h, face, hp, max, moving: st === "walk" }); if (st !== f.st) { f.st = st; f.t = st === "dead" ? 0.9 : 1; }
      });
      S.foes.forEach((f) => { if (!seen.has(f.id) && f.st !== "dead") { f.st = "dead"; f.t = 0.6; } });
      S.tele = d.tele.map(([k, a, b, z, r, t, full]) => k === "rect" ? { k, x0: a, x1: b, z, zr: r, t, full } : { k, x: a, z, r, t, full });
      if (d.banner && d.banner !== S.banner) banner(d.banner);
      S.wave = d.wave;
      if ((d.win || d.lose) && !S.over) { S.over = true; S.win = !!d.win; S.lose = !!d.lose; S.endT = 1.8; if (d.lose) banner("모두 쓰러졌다…"); }
    }
  }

  /* ── 그리기 ── */
  function frame(g, im, fr, x, y, sc, flip, ax, alpha, rot) {
    if (!fr || !im.complete) return;
    const w = fr[2] * sc, h = fr[3] * sc;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(im, fr[0], fr[1], fr[2], fr[3], -w * (ax == null ? 0.5 : ax), -h, w, h); g.restore();
  }
  function centered(g, im, fr, x, y, size, flip, alpha, rot) {
    if (!fr || !im.complete) return;
    const k = size / Math.max(fr[2], fr[3]), w = fr[2] * k, h = fr[3] * k;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); if (alpha != null) g.globalAlpha *= alpha;
    g.drawImage(im, fr[0], fr[1], fr[2], fr[3], -w / 2, -h / 2, w, h); g.restore();
  }
  function shadow(g, x, z, w) { g.fillStyle = "rgba(0,0,0,.38)"; g.beginPath(); g.ellipse(x, z, w, w * 0.28, 0, 0, Math.PI * 2); g.fill(); }
  /* 사람(나 · 파티원) — 내 캐릭터 그림(look.js) */
  function drawPerson(g, P, look, cx, me, nick) {
    const x = P.x - cx, y = P.z - P.h;
    shadow(g, x, P.z, 26 * Math.max(0.5, 1 - P.h / 400));
    let a = P.inv > 0 && P.st !== "roll" && P.st !== "dash" && Math.floor(S.t * 20) % 2 ? 0.45 : 1;
    if (!me && P.hp <= 0) a = 0.6;
    g.save(); g.globalAlpha = a; g.translate(x, y + 2);
    if (P.face < 0) g.scale(-1, 1);
    if (P.st === "roll") { g.translate(0, -36); g.rotate(P.t / 0.34 * Math.PI * 2); g.translate(0, 36); }
    drawChar(g, look, { st: P.st === "roll" ? "jump" : P.st, t: P.t, walk: P.walk, step: P.step }, 1, { glow: P.st === "dash" || (P.st === "atk" && P.step === 2) });
    g.restore();
    if (P.st === "atk" && ATK[P.step] && P.t >= ATK[P.step].act[0] - 0.02 && P.t <= ATK[P.step].act[1] + 0.06) {
      const A = ATK[P.step], p = (P.t - A.act[0]) / (A.act[1] - A.act[0] + 0.06);
      g.save(); g.translate(x + P.face * 30, y - 60); g.scale(P.face, 1);
      g.strokeStyle = P.step === 2 ? "rgba(255,160,60,.9)" : "rgba(255,240,210,.85)"; g.lineWidth = P.step === 2 ? 7 : 5; g.lineCap = "round";
      g.beginPath(); if (P.step === 2) g.arc(10, 10, A.range * 0.7, Math.PI * 0.6, Math.PI * (0.6 - 1.1 * Math.min(1, p)), true); else g.arc(0, 0, A.range * 0.7, -Math.PI * 0.55, -Math.PI * 0.55 + Math.PI * Math.min(1, p)); g.stroke(); g.restore();
    }
    if (nick) { g.font = "700 12px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(nick, x, y - 128); g.fillStyle = me ? "#ffe08a" : "#bfe3ff"; g.fillText(nick, x, y - 128);
      if (!me) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - 22, y - 122, 44, 4); g.fillStyle = "#3ccf6a"; g.fillRect(x - 22, y - 122, 44 * clamp(P.hp / (P.max || 1), 0, 1), 4); } }
  }
  function drawFoe(g, f, cx) {
    const x = f.x - cx, y = f.z - f.h, D = f.D, A = FR.mon[D.sprite || f.kind];
    shadow(g, x, f.z, D.w * 0.9 * Math.max(0.5, 1 - f.h / 400));
    let list = A.move, rot = 0;
    if (f.st === "hit" || f.st === "air") list = A.hit;
    if (f.st === "wind" || f.st === "atk") list = A.attack;
    if (f.st === "down" || f.st === "dead") list = A.dead;
    const fr = list[Math.floor((S.t + f.ph) * 6) % list.length] || list[0];
    const flip = D.native ? f.face !== D.native : f.face < 0;
    const a = f.st === "dead" ? clamp(f.t / 0.5, 0, 1) : 1;
    if (f.st === "air" && !D.boss) rot = -f.face * Math.min(1.2, f.h / 200);
    const bob = f.moving && f.st === "walk" ? Math.abs(Math.sin((S.t + f.ph) * 9)) * 4 : 0;
    g.save();
    if (f.st === "wind") g.translate((Math.random() - 0.5) * 3, 0);
    if (D.tint) g.filter = D.tint;
    frame(g, IMG.mon, fr, x, y + 2 - bob, D.sc, flip, 0.5, a, rot);
    g.filter = "none";
    if (f.flash > 0 || f.st === "wind") { g.globalCompositeOperation = "lighter"; frame(g, IMG.mon, fr, x, y + 2 - bob, D.sc, flip, 0.5, f.st === "wind" ? 0.35 + 0.25 * Math.sin(S.t * 40) : 0.6, rot); }
    g.restore();
    if (!D.boss && f.st !== "dead" && f.hp < f.max) { const w = 50, by = y - fr[3] * D.sc - 10; g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - w / 2, by, w, 5); g.fillStyle = "#e5484d"; g.fillRect(x - w / 2, by, w * clamp(f.hp / f.max, 0, 1), 5); }
  }
  function draw(g, touch) {
    if (!S) return;
    const cx = S.camX + (shake > 0 ? (Math.random() - 0.5) * 20 * shake : 0);
    BG.draw(g, S.D.theme, cx, VW, VH, Z0);
    S.tele.forEach((t) => {
      const p = clamp(1 - t.t / t.full, 0, 1); g.fillStyle = "rgba(255,50,40,.18)"; g.strokeStyle = "rgba(255,70,50,.9)"; g.lineWidth = 2;
      if (t.k === "rect") { g.fillRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.strokeRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.fillStyle = "rgba(255,50,40,.35)"; g.fillRect(t.x0 - cx, t.z - t.zr, (t.x1 - t.x0) * p, t.zr * 2); }
      else { g.beginPath(); g.ellipse(t.x - cx, t.z, t.r, t.r * 0.42, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "rgba(255,50,40,.35)"; g.beginPath(); g.ellipse(t.x - cx, t.z, t.r * p, t.r * 0.42 * p, 0, 0, Math.PI * 2); g.fill(); }
    });
    const H = S.hero;
    if (S.ring > 0) centered(g, IMG.hsk, FR.hsk.kh_ring, H.x - cx, H.z - 30 - H.h, 270, false, Math.min(1, S.ring / 0.3) * 0.95, S.t * 5);
    const bodies = S.foes.map((f) => [f.z, () => drawFoe(g, f, cx)]);
    bodies.push([H.z + 0.1, () => drawPerson(g, H, C.look, cx, true, C.party ? C.nick : "")]);
    for (const id in S.remote) { const r = S.remote[id]; bodies.push([r.z, () => drawPerson(g, r, r.look, cx, false, r.nick)]); }
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    S.shots.forEach((s) => centered(g, IMG.hsk, FR.hsk.kh_wave, s.x - cx, s.z - 60, 170, s.face < 0, Math.min(1, s.t / 0.15)));
    S.fx.forEach((x) => {
      const p = 1 - x.t / x.d;
      if (x.k === "spark") { const L = FR.mfx.spark; centered(g, IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y, x.s * (0.8 + p * 0.5), false, 1 - p * 0.6); }
      else if (x.k === "quake") { const L = FR.mfx.quake; centered(g, IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y - 20, x.s, false, 1 - p * 0.5); }
      else if (x.k === "kh_dash") centered(g, IMG.hsk, FR.hsk.kh_dash, x.x - cx, x.y, x.s, x.flip, 1 - p);
    });
    g.textAlign = "center"; g.textBaseline = "middle";
    S.nums.forEach((n) => { g.font = "900 22px 'Noto Sans KR', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.globalAlpha = Math.min(1, n.t / 0.3); g.strokeText(n.v, n.x - cx, n.y); g.fillStyle = n.c; g.fillText(n.v, n.x - cx, n.y); g.globalAlpha = 1; });
    g.textBaseline = "alphabetic";
    hud(g, touch);
  }
  function bar(g, x, y, w, h, p, c) { g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = c; g.fillRect(x, y, w * clamp(p, 0, 1), h); }
  function hud(g, touch) {
    const H = S.hero;
    g.textAlign = "left";
    g.font = "700 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#f6d27a"; g.fillText(C.nick + "  ·  " + S.D.name, 22, 30);
    bar(g, 22, 40, 260, 14, H.hp / H.max, H.hp / H.max > 0.3 ? "#3ccf6a" : "#e5484d");
    g.font = "600 12px 'Noto Sans KR', sans-serif"; g.fillStyle = "#fff"; g.fillText(Math.ceil(H.hp) + " / " + H.max, 28, 52);
    g.fillStyle = "#c9b48a"; g.fillText("무리 " + Math.min(S.wave + 1, S.D.waves.length) + " / " + S.D.waves.length + "   " + Math.floor(S.t / 60) + ":" + String(Math.floor(S.t % 60)).padStart(2, "0") + "   물약 " + S.potions + (touch ? "" : " (" + KEYS.label("potion") + ")"), 22, 74);
    let py = 96; for (const id in S.remote) { const r = S.remote[id]; g.fillStyle = "#bfe3ff"; g.fillText(r.nick, 22, py); bar(g, 110, py - 9, 90, 7, r.hp / (r.max || 1), "#3ccf6a"); py += 18; }
    const B = S.foes.find((f) => f.D.boss && f.st !== "dead");
    if (B) { g.textAlign = "center"; g.font = "800 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#ffb08a"; g.fillText(B.D.name, VW / 2, 28); bar(g, VW / 2 - 220, 36, 440, 12, B.hp / B.max, "#e0662a"); }
    if (S.combo >= 2) { g.textAlign = "right"; g.font = "900 " + (30 + Math.min(20, S.combo)) + "px 'Noto Sans KR', sans-serif"; g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; const t = S.combo + " 연속!"; g.strokeText(t, VW - 24, 120); g.fillStyle = "#ffd36b"; g.fillText(t, VW - 24, 120); }
    if (S.bannerT > 0) { g.textAlign = "center"; g.font = "800 26px 'Noto Sans KR', sans-serif"; g.globalAlpha = Math.min(1, S.bannerT / 0.4); g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(S.banner, VW / 2, 170); g.fillStyle = "#fff1d0"; g.fillText(S.banner, VW / 2, 170); g.globalAlpha = 1; }
    if (H.hp <= 0 && C.party && !S.over) { g.textAlign = "center"; g.font = "800 20px 'Noto Sans KR', sans-serif"; g.fillStyle = "#ff8a7a"; g.fillText("쓰러졌어요 — 파티원이 이기면 같이 보상을 받아요", VW / 2, 220); }
    if (!touch) SKILL.forEach((sk, i) => { const x = VW - 210 + i * 66, y = VH - 70; g.fillStyle = "rgba(20,10,8,.75)"; g.fillRect(x, y, 56, 56); g.strokeStyle = "#b8893a"; g.lineWidth = 1; g.strokeRect(x, y, 56, 56);
      centered(g, IMG.hsk, FR.hsk[sk.fr], x + 28, y + 28, 48, false, S.cd[i] > 0 ? 0.35 : 1);
      if (S.cd[i] > 0) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x, y + 56 * (1 - S.cd[i] / sk.cd), 56, 56 * S.cd[i] / sk.cd); g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "800 16px sans-serif"; g.fillText(Math.ceil(S.cd[i]), x + 28, y + 34); }
      g.fillStyle = "#f6d27a"; g.textAlign = "left"; g.font = "700 11px sans-serif"; g.fillText(KEYS.label(sk.act), x + 4, y + 13); });
  }
  return { start, step, draw, net, MON, DUN, SKILL, get S() { return S; }, quit() { if (S) S.ended = true; S = null; } };
})();

/* ── 배경 — 마을 · 던전마다. 제미나이 맵 그림(img/maps/<이름>.jpg, frames.js 의 MAPS 에 적힌 것)이 있으면 그것을, 없으면 코드로 그린다
   그림은 끝이 서로 안 맞으므로 한 번은 그대로, 한 번은 좌우를 뒤집어 번갈아 붙인다(뒤집으면 끝끼리 똑같이 맞닿음).
   GF = 그림에서 땅이 시작하는 높이(0~1) — 그 줄이 게임 바닥(Z0)쯤 오게 그림을 위로 올리고 키운다 ── */
const BG = (() => {
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || "";
  const pics = {}, GF = { town: 0.79, gate: 0.78, forest: 0.8, goblin: 0.72, wolf: 0.76 };
  (window.MAPS || []).forEach((n) => { const i = new Image(); i.src = "img/maps/" + n + ".jpg" + (V ? "?v=" + V : ""); pics[n] = i; });
  const ok = (P) => P && P.complete && P.naturalWidth;
  function tile(g, P, x, w, y, h, flip) {
    if (!flip) return g.drawImage(P, x, y, w + 1, h);
    g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(P, 0, 0, w + 1, h); g.restore();
  }
  /* o.par = 따라 움직이는 빠르기(마을 1 — 문이 땅에 붙어 있게), o.end = { pic, at, f } — 세계 at 자리에 그림의 f 지점이 오게 마지막 판을 붙임 */
  function drawPic(g, theme, P, cx, VW, VH, Z0, o) {
    const gf = GF[theme] || 0.75, yo = Math.max(0, Math.min(140, (gf * VH - Z0 - 16) / (1 - gf)));
    const h = VH + yo, w = P.naturalWidth * h / P.naturalHeight, y = -yo, sx = cx * (o.par || 0.6);
    const E = o.end && ok(pics[o.end.pic]) ? pics[o.end.pic] : null;
    let stopX = Infinity, base = 0;
    if (E) { const we = E.naturalWidth * h / E.naturalHeight; stopX = o.end.at - o.end.f * we; base = stopX; tile(g, E, stopX - sx, we, y, h, false); }
    const n0 = Math.floor((sx - base) / w);
    for (let n = n0; ; n++) { const wx = base + n * w; if (wx - sx > VW || wx >= stopX) break; tile(g, P, wx - sx, w, y, h, (n & 1) !== 0); }
  }
  const HILLS = Array.from({ length: 40 }, (_, i) => [i * 120, 150 + Math.sin(i * 1.7) * 40 + Math.sin(i * 0.6) * 30]);
  const TREES = Array.from({ length: 70 }, (_, i) => [i * 55 + Math.sin(i * 3.1) * 20, 60 + (i * 37 % 50), 0.8 + (i * 13 % 7) / 10]);
  const TH = {
    forest: { sky: ["#12070b", "#3a1218", "#5a1d17"], moon: "#d8432c", hill: "#24090d", tree: "#14060a", ground: ["#2a1b16", "#140c0a"] },
    goblin: { sky: ["#07100a", "#14301c", "#2a4a1e"], moon: "#d6c25a", hill: "#0e1f10", tree: "#08140a", ground: ["#23281a", "#11140c"] },
    town: { sky: ["#1a1030", "#4a2a4a", "#c86a4a"], moon: "#ffd9a0", hill: "#2a1a2e", tree: "#1e1424", ground: ["#4a3a2a", "#2a2018"] },
  };
  function draw(g, theme, cx, VW, VH, Z0, o) {
    const P = pics[theme];
    if (ok(P)) return drawPic(g, theme, P, cx, VW, VH, Z0, o || {});
    const T = TH[theme] || TH.forest;
    const sky = g.createLinearGradient(0, 0, 0, Z0); sky.addColorStop(0, T.sky[0]); sky.addColorStop(0.6, T.sky[1]); sky.addColorStop(1, T.sky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, VW, Z0);
    const mx = 700 - cx * 0.05; g.globalAlpha = 0.18; g.fillStyle = T.moon; g.beginPath(); g.arc(mx, 110, 90, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = T.moon; g.beginPath(); g.arc(mx, 110, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = T.hill; g.beginPath(); g.moveTo(0, Z0); HILLS.forEach(([x, y]) => g.lineTo(x - cx * 0.2, Z0 - y)); g.lineTo(VW, Z0); g.fill();
    if (theme !== "town") { g.fillStyle = T.tree;
      TREES.forEach(([x, hgt, s]) => { const tx = ((x - cx * 0.5) % 3900 + 3900) % 3900 - 100; if (tx < -80 || tx > VW + 80) return; const base = Z0 - 6;
        g.beginPath(); g.moveTo(tx, base - hgt * 2.2 * s); g.lineTo(tx - 34 * s, base); g.lineTo(tx + 34 * s, base); g.fill(); g.fillRect(tx - 4, base - 10, 8, 12); }); }
    const gr = g.createLinearGradient(0, Z0 - 30, 0, VH); gr.addColorStop(0, T.ground[0]); gr.addColorStop(1, T.ground[1]);
    g.fillStyle = gr; g.fillRect(0, Z0 - 30, VW, VH - Z0 + 30);
    g.strokeStyle = "rgba(255,200,140,.06)"; g.lineWidth = 1; g.beginPath();
    for (let x = -(cx % 90); x < VW; x += 90) { g.moveTo(x, Z0 - 30); g.lineTo(x - 60, VH); }
    for (let y = Z0; y < VH; y += 38) { g.moveTo(0, y); g.lineTo(VW, y); }
    g.stroke();
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, Z0 - 32, VW, 4);
  }
  return { draw, pics };
})();
