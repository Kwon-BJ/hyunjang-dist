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
  const IMG = { items: img("img/items.webp"), mon3a: img("img/mon3a.webp"), mon3b: img("img/mon3b.webp"), mon3c: img("img/mon3c.webp"), hsk: img("img/hsk.webp"), mfx: img("img/mfx.webp"), ui2: img("img/ui2.webp") };
  let monOld = null; Object.defineProperty(IMG, "mon", { get: () => monOld || (monOld = img("img/mon2.png")) }); // 예전 몬스터 그림 — 쓸 때만(지금은 안 씀)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── 몬스터 ── native = 그림이 보는 쪽(1 오른쪽, 0 앞), sprite = 다른 몬스터 그림을 빌려 씀, tint = 색 바꿈 */
  const MON = {
    slime: { name: "슬라임", hp: 70, spd: 80, sc: 0.42, dmg: 7, act: "lunge", range: 70, wind: 0.45, native: 1, w: 30 },
    goblin: { name: "고블린", hp: 110, spd: 115, sc: 0.42, dmg: 10, act: "swing", range: 80, wind: 0.42, native: 1, w: 32 },
    wolf: { name: "늑대", hp: 95, spd: 200, sc: 0.36, dmg: 9, act: "pounce", range: 230, wind: 0.38, native: 1, w: 38 },
    golem: { name: "바위 거인", hp: 2600, spd: 70, sc: 0.5, dmg: 24, act: "boss", range: 150, wind: 0.8, native: 1, w: 70, boss: true },
    gchief: { name: "고블린 족장", hp: 3400, spd: 105, sc: 0.55, dmg: 26, act: "boss", range: 150, wind: 0.7, native: 1, w: 60, boss: true },
    /* 오크족 — 그림 한 장짜리(FR.mon 의 img 가 mon3a). shoot = 줄 맞춰 화살, curse = 발밑에 저주 */
    orc: { name: "오크 전사", hp: 260, spd: 100, sc: 0.44, dmg: 18, act: "swing", range: 95, wind: 0.5, native: 1, w: 40 },
    orcArcher: { name: "오크 궁수", hp: 170, spd: 95, sc: 0.44, dmg: 14, act: "shoot", range: 520, wind: 0.7, native: 1, w: 32 },
    orcShaman: { name: "오크 주술사", hp: 200, spd: 80, sc: 0.44, dmg: 20, act: "curse", range: 460, wind: 0.9, native: 1, w: 32 },
    orcChief: { name: "오크 대장 우르각", hp: 5200, spd: 95, sc: 0.6, dmg: 32, act: "boss", range: 160, wind: 0.7, native: 1, w: 70, boss: true },
    wchief: { name: "늑대 우두머리", hp: 3800, spd: 170, sc: 0.62, dmg: 28, act: "boss", range: 160, wind: 0.6, native: 1, w: 64, boss: true, sprite: "wolf", tint: "grayscale(.6) brightness(1.25) contrast(1.2)" },
  };
  /* ── 던전 — 서버 DUNGEONS 와 같은 열쇠 ── */
  /* 던전 = 방 여러 개 + 보스룸 — "맵이 너무 단조롭다. 최소 · 최대 레벨 표시하고 맵을 3개~20개씩, 검은 숲 어귀 3 · 고블린의 숲 4 · 늑대 골짜기 5 · 오크족의 성지 6, 이어서 보스룸까지" (2026-10-27).
     방을 다 비우면 오른쪽 끝에 「차원의 문」 — 문 앞에서 ↑(또는 문을 눌러) 다음 방. 방마다 그림 · 시간대(빛깔) · 안개를 바꿔 같은 맵이 이어지지 않게.
     look = { pic: 그림, off: 그림의 어느 부분부터, tint: 덮는 빛깔, fog } · waves = 그 방에서 차례로 나오는 무리 */
  const room = (name, look, ...waves) => ({ name, look, waves });
  const W = (text, list) => ({ text, list });
  const mkDun = (name, theme, lv, rooms) => ({ name, theme, lv, rooms, waves: rooms.flatMap((r, ri) => r.waves.map((w) => Object.assign({ room: ri }, w))) });
  const DUN = {
    forest: mkDun("검은 숲 어귀", "forest", [1, 3], [
      room("숲 어귀", { pic: "forest" }, W("검은 숲 어귀 — 슬라임이 몰려온다!", ["slime", "slime", "slime", "slime", "slime"])),
      room("이끼 낀 오솔길", { pic: "forest", off: 900, tint: "rgba(20,60,30,.28)", fog: 0.25 }, W("고블린 무리!", ["goblin", "goblin", "goblin", "slime", "slime"]), W("뒤에서 슬라임이!", ["slime", "slime", "slime", "goblin"])),
      room("붉은 달 공터", { pic: "forest", off: 1800, tint: "rgba(120,10,10,.25)" }, W("늑대가 달려든다 — 구르기로 피해!", ["wolf", "wolf", "wolf", "goblin", "goblin"])),
      room("보스룸 — 바위 제단", { pic: "temple", boss: true, tint: "rgba(30,0,40,.25)" }, W("대장 바위 거인 등장!", ["golem"])) ]),
    goblin: mkDun("고블린의 숲", "goblin", [3, 5], [
      room("고블린 초소", { pic: "goblin" }, W("고블린의 숲 — 고블린 정찰대!", ["goblin", "goblin", "goblin", "goblin", "wolf"])),
      room("덫이 깔린 길", { pic: "goblin", off: 800, tint: "rgba(60,40,0,.25)", fog: 0.2 }, W("늑대를 탄 고블린 무리!", ["wolf", "wolf", "wolf", "goblin", "goblin", "goblin"])),
      room("버섯 늪", { pic: "forest", off: 400, tint: "rgba(40,90,40,.32)", fog: 0.35 }, W("늪에서 슬라임이 솟는다!", ["slime", "slime", "slime", "slime", "goblin", "goblin"]), W("고블린 매복!", ["goblin", "goblin", "goblin", "wolf"])),
      room("고블린 마을", { pic: "goblin", off: 1700, tint: "rgba(90,40,0,.22)" }, W("숲 깊은 곳 — 모두 몰려온다!", ["goblin", "goblin", "wolf", "wolf", "slime", "slime", "goblin"])),
      room("보스룸 — 족장의 막사", { pic: "castle", boss: true, tint: "rgba(60,30,0,.3)" }, W("대장 고블린 족장 등장!", ["gchief", "goblin", "goblin"])) ]),
    wolf: mkDun("늑대 골짜기", "wolf", [5, 7], [
      room("골짜기 입구", { pic: "wolf" }, W("늑대 골짜기 — 울음소리가 사방에서!", ["wolf", "wolf", "wolf", "wolf"])),
      room("달빛 바위길", { pic: "wolf", off: 900, tint: "rgba(20,30,90,.3)" }, W("늑대와 고블린 사냥꾼!", ["wolf", "wolf", "wolf", "goblin", "goblin", "goblin"])),
      room("안개 계곡", { pic: "wolf", off: 300, tint: "rgba(120,130,150,.18)", fog: 0.45 }, W("안개 속에서 늑대가!", ["wolf", "wolf", "wolf", "wolf", "wolf"]), W("바위 거인이 깨어난다!", ["golem", "wolf", "wolf"])),
      room("뼈 무덤", { pic: "forest", off: 1300, tint: "rgba(70,70,90,.35)", fog: 0.2 }, W("무덤을 지키는 무리!", ["wolf", "wolf", "goblin", "goblin", "slime", "slime", "slime"])),
      room("늑대 굴", { pic: "wolf", off: 1700, tint: "rgba(60,0,0,.28)" }, W("골짜기 깊은 곳 — 무리가 몰려온다!", ["wolf", "wolf", "wolf", "wolf", "wolf", "goblin", "goblin"])),
      room("보스룸 — 우두머리의 바위산", { pic: "lava", boss: true, tint: "rgba(20,0,30,.3)" }, W("대장 늑대 우두머리 등장!", ["wchief", "wolf", "wolf"])) ]),
    orc: mkDun("오크족의 성지", "orc", [7, 10], [
      room("성지 바깥 성벽", { pic: "orc" }, W("오크족의 성지 — 전사들이 막아선다!", ["orc", "orc", "orc", "orcArcher"])),
      room("화살 성문", { pic: "orc", off: 800, tint: "rgba(90,40,0,.25)" }, W("화살이 날아온다 — 붉은 줄을 피해!", ["orc", "orc", "orcArcher", "orcArcher", "orcShaman"])),
      room("주술사의 뜰", { pic: "temple", off: 500, tint: "rgba(60,0,80,.3)", fog: 0.25 }, W("주술사의 저주 — 발밑 붉은 원을 피해!", ["orc", "orc", "orc", "orcArcher", "orcShaman", "orcShaman"])),
      room("전사의 훈련장", { pic: "orc", off: 1600, tint: "rgba(110,30,10,.25)" }, W("오크 전사 무리!", ["orc", "orc", "orc", "orc", "orcArcher"]), W("바위 거인을 부렸다!", ["golem", "orc", "orcShaman"])),
      room("피의 제단", { pic: "lava", off: 700, tint: "rgba(120,0,0,.25)", fog: 0.15 }, W("제단을 지키는 무리!", ["orc", "orc", "orcArcher", "orcArcher", "orcShaman", "orcShaman"])),
      room("족장의 회랑", { pic: "castle", off: 900, tint: "rgba(80,30,0,.3)" }, W("회랑의 정예 전사들!", ["orc", "orc", "orc", "orc", "orcArcher", "orcShaman"])),
      room("보스룸 — 우르각의 왕좌", { pic: "lava", boss: true, tint: "rgba(80,0,0,.3)" }, W("대장 오크 우르각 등장!", ["orcChief", "orcArcher", "orcShaman"])) ]),
  };
  /* 무한의 탑 — 층 n 의 무리 · 강해지는 정도. 10층마다 대장 */
  const TOWER = { name: "무한의 탑", theme: "castle", tower: true, waves: [] };
  DUN.tower = TOWER;
  DUN.arena = { name: "결투장", theme: "castle", pvp: true, waves: [] }; // 결투 — 몬스터 없음, 둘이 싸움
  function towerFloor(n) {
    const pool = ["slime", "goblin", "wolf"].concat(n >= 8 ? ["orc"] : [], n >= 15 ? ["orcArcher"] : [], n >= 22 ? ["orcShaman"] : []);
    const bosses = ["golem", "gchief", "wchief", "orcChief"], list = [];
    if (n % 10 === 0) { list.push(bosses[(n / 10 - 1) % bosses.length]); for (let i = 0; i < Math.min(4, 1 + n / 20); i++) list.push(pool[i % pool.length]); }
    else { const cnt = Math.min(10, 4 + Math.floor(n / 6)); for (let i = 0; i < cnt; i++) list.push(pool[(i * 7 + n) % pool.length]); }
    return list;
  }
  function towerScale(D, n) { // 체력 · 공격 · 이동 속도 · 마법(원거리 · 대장 재주) 이 층마다 강해짐
    const k = n - 1, magic = D.act === "shoot" || D.act === "curse" || D.boss;
    return Object.assign({}, D, { hp: Math.round(D.hp * (1 + 0.16 * k)), dmg: Math.round(D.dmg * (1 + 0.06 * k) * (magic ? 1 + 0.02 * k : 1)), spd: D.spd * Math.min(1.7, 1 + 0.009 * k), wind: D.wind * Math.max(0.55, 1 - 0.005 * k), range: magic && !D.boss ? D.range * Math.min(1.3, 1 + 0.004 * k) : D.range });
  }
  const ATK = [
    { dur: 0.3, act: [0.06, 0.16], range: 100, dmg: 12, type: "stagger", lunge: 70 },
    { dur: 0.3, act: [0.06, 0.16], range: 105, dmg: 14, type: "stagger", lunge: 70 },
    { dur: 0.42, act: [0.1, 0.22], range: 120, dmg: 20, type: "launch", lunge: 110 },
  ];
  /* 직업마다 평타 — shot 이 있으면 그때 날림(부적 · 화살), 없으면 앞을 벰 */
  const ATKS = {
    kh: ATK,
    hr: [{ dur: 0.3, act: [0.08, 0.12], range: 0, dmg: 11, type: "stagger", lunge: 10, shot: { fr: "hr_tali", spd: 760, life: 0.42, size: 62, n: 1 } },
         { dur: 0.3, act: [0.08, 0.12], range: 0, dmg: 12, type: "stagger", lunge: 10, shot: { fr: "hr_tali", spd: 760, life: 0.42, size: 62, n: 1 } },
         { dur: 0.42, act: [0.12, 0.16], range: 0, dmg: 10, type: "launch", lunge: 0, shot: { fr: "hr_tali", spd: 680, life: 0.5, size: 62, n: 3 } }],
    ds: [{ dur: 0.42, act: [0.12, 0.24], range: 135, dmg: 17, type: "stagger", lunge: 40 },
         { dur: 0.42, act: [0.12, 0.24], range: 140, dmg: 19, type: "knock", lunge: 40 },
         { dur: 0.6, act: [0.2, 0.32], range: 165, dmg: 32, type: "launch", lunge: 30, quake: true }],
    je: [{ dur: 0.28, act: [0.1, 0.13], range: 0, dmg: 10, type: "stagger", lunge: -20, shot: { fr: "je_wind", spd: 1100, life: 0.5, size: 90, n: 1 } },
         { dur: 0.28, act: [0.1, 0.13], range: 0, dmg: 10, type: "stagger", lunge: -20, shot: { fr: "je_wind", spd: 1100, life: 0.5, size: 90, n: 1 } },
         { dur: 0.4, act: [0.14, 0.17], range: 0, dmg: 18, type: "knock", lunge: -40, shot: { fr: "je_storm", spd: 900, life: 0.6, size: 130, n: 1 } }],
    mj: [{ dur: 0.18, act: [0.04, 0.11], range: 85, dmg: 8, type: "stagger", lunge: 60 },
         { dur: 0.18, act: [0.04, 0.11], range: 85, dmg: 8, type: "stagger", lunge: 60 },
         { dur: 0.2, act: [0.05, 0.12], range: 90, dmg: 9, type: "stagger", lunge: 60 },
         { dur: 0.32, act: [0.08, 0.18], range: 100, dmg: 15, type: "launch", lunge: 90 }],
  };
  let MYATK = ATK;
  const AIR = { dur: 0.36, act: [0.04, 0.26], range: 100, dmg: 13, type: "stagger" };
  /* 스킬 — 다섯 명마다 셋(연병장 스킬 그림 hsk). kind:
     shot = 날아가는 것(n 개를 위아래로 벌려서), aura = 내 둘레 계속, zone = 앞쪽 자리에 계속, dash = 앞으로 돌진,
     strike = 가까운 적 n 명에게 바로, blink = 가까운 적 뒤로 순간이동해 베기, slam = 앞쪽을 내려쳐 띄우기, guard = 잠깐 무적 + 둘레 밀쳐내기 */
  const SKILLS = {
    kh: [{ name: "화염 검기", short: "검기", cd: 3, fr: "kh_wave", kind: "shot", spd: 760, life: 0.75, dmg: 34, type: "knock", size: 170 },
         { name: "화염검 진", short: "검진", cd: 8, fr: "kh_ring", kind: "aura", dur: 3, tick: 0.3, r: 120, dmg: 11, size: 270, spin: 5 },
         { name: "화염 돌진", short: "돌진", cd: 5, fr: "kh_dash", kind: "dash", dmg: 28 },
         { name: "화염 회오리", short: "회오리", cd: 9, fr: "kh_ring", kind: "aura", dur: 2, tick: 0.2, r: 140, dmg: 9, size: 320, spin: 9 },
         { name: "올려베기", short: "올려", cd: 5, fr: "kh_wave", kind: "slam", range: 230, dmg: 36, size: 260 },
         { name: "검기 난무", short: "난무", cd: 6, fr: "kh_wave", kind: "shot", n: 3, spd: 900, life: 0.55, dmg: 22, type: "stagger", size: 120 },
         { name: "적염 강림", short: "궁극", cd: 45, fr: "kh_ring", kind: "ult", multi: [{ kind: "zone", fr: "kh_ring", at: 0, r: 620, dur: 2.5, tick: 0.25, dmg: 30, size: 900, spin: 4 }, { kind: "slam", fr: "kh_wave", range: 500, dmg: 80, size: 420 }] }],
    hr: [{ name: "부적 날리기", short: "부적", cd: 3, fr: "hr_tali", kind: "shot", n: 3, spd: 620, life: 0.9, dmg: 20, type: "stagger", size: 90 },
         { name: "뇌전", short: "뇌전", cd: 7, fr: "hr_bolt", kind: "strike", n: 3, range: 560, dmg: 46, type: "launch", size: 190 },
         { name: "팔괘진", short: "팔괘", cd: 9, fr: "hr_bagua", kind: "zone", at: 0, r: 160, dur: 4, tick: 0.35, dmg: 12, size: 300, spin: 1.5 },
         { name: "뇌운", short: "뇌운", cd: 8, fr: "hr_bolt", kind: "zone", at: 260, r: 150, dur: 2.5, tick: 0.3, dmg: 14, size: 280, spin: 0 },
         { name: "부적 폭발", short: "폭발", cd: 6, fr: "hr_tali", kind: "strike", n: 5, range: 420, dmg: 30, type: "knock", size: 130 },
         { name: "결계", short: "결계", cd: 12, fr: "hr_bagua", kind: "guard", dur: 2, r: 120, dmg: 8, size: 260 },
         { name: "천뢰 강림", short: "궁극", cd: 45, fr: "hr_bolt", kind: "ult", multi: [{ kind: "strike", fr: "hr_bolt", n: 12, range: 950, dmg: 85, type: "launch", size: 280 }, { kind: "zone", fr: "hr_bagua", at: 0, r: 500, dur: 2, tick: 0.3, dmg: 18, size: 700, spin: 2 }] }],
    ds: [{ name: "금강종", short: "금강", cd: 9, fr: "ds_bell", kind: "guard", dur: 2.5, r: 110, dmg: 8, size: 220 },
         { name: "대지 내려치기", short: "내려", cd: 5, fr: "ds_slam", kind: "slam", range: 300, dmg: 40, size: 320 },
         { name: "투기", short: "투기", cd: 8, fr: "ds_aura", kind: "aura", dur: 4, tick: 0.4, r: 140, dmg: 13, size: 300, spin: 0 },
         { name: "철퇴 돌진", short: "돌진", cd: 5, fr: "ds_slam", kind: "dash", dmg: 34 },
         { name: "호랑이 포효", short: "포효", cd: 9, fr: "ds_aura", kind: "aura", dur: 1.2, tick: 0.3, r: 180, dmg: 16, type: "knock", size: 360, spin: 0 },
         { name: "종소리", short: "종", cd: 7, fr: "ds_bell", kind: "strike", n: 6, range: 360, dmg: 24, type: "stagger", size: 150 },
         { name: "금강 진노", short: "궁극", cd: 45, fr: "ds_slam", kind: "ult", multi: [{ kind: "guard", fr: "ds_bell", dur: 3, r: 160, dmg: 10, size: 320 }, { kind: "slam", fr: "ds_slam", range: 700, dmg: 120, size: 520 }] }],
    je: [{ name: "바람 화살", short: "바람", cd: 2.5, fr: "je_wind", kind: "shot", spd: 1150, life: 0.6, dmg: 30, type: "stagger", size: 170 },
         { name: "화살비", short: "화살비", cd: 7, fr: "je_rain", kind: "zone", at: 280, r: 150, dur: 1.6, tick: 0.2, dmg: 10, size: 300, spin: 0 },
         { name: "폭풍 화살", short: "폭풍", cd: 6, fr: "je_storm", kind: "shot", spd: 520, life: 1.1, dmg: 58, type: "knock", size: 230 },
         { name: "연사", short: "연사", cd: 5, fr: "je_wind", kind: "shot", n: 5, spd: 1200, life: 0.5, dmg: 12, type: "stagger", size: 100 },
         { name: "꿰뚫는 화살", short: "꿰뚫", cd: 6, fr: "je_storm", kind: "strike", n: 4, range: 620, dmg: 26, type: "knock", size: 150 },
         { name: "독수리 화살", short: "독수리", cd: 7, fr: "je_storm", kind: "shot", spd: 700, life: 1.2, dmg: 42, type: "launch", size: 180 },
         { name: "천궁 화살비", short: "궁극", cd: 45, fr: "je_rain", kind: "ult", multi: [{ kind: "zone", fr: "je_rain", at: 300, r: 450, dur: 3, tick: 0.2, dmg: 22, size: 760, spin: 0 }] }],
    mj: [{ name: "그림자 습격", short: "습격", cd: 4, fr: "mj_shadow", kind: "blink", range: 520, dmg: 44, size: 200 },
         { name: "독안개", short: "독", cd: 8, fr: "mj_poison", kind: "zone", at: 170, r: 140, dur: 3.2, tick: 0.4, dmg: 12, size: 280, spin: 0 },
         { name: "표창", short: "표창", cd: 2.5, fr: "mj_star", kind: "shot", n: 3, spd: 980, life: 0.6, dmg: 18, type: "stagger", size: 80 },
         { name: "연환 습격", short: "연환", cd: 3, fr: "mj_shadow", kind: "blink", range: 420, dmg: 30, size: 180 },
         { name: "그림자 분신", short: "분신", cd: 9, fr: "mj_shadow", kind: "aura", dur: 3, tick: 0.25, r: 120, dmg: 10, size: 240, spin: 0 },
         { name: "독 표창", short: "독표", cd: 5, fr: "mj_star", kind: "shot", n: 5, spd: 900, life: 0.6, dmg: 14, type: "stagger", size: 70 },
         { name: "흑룡 난무", short: "궁극", cd: 45, fr: "mj_shadow", kind: "ult", multi: [{ kind: "strike", fr: "mj_shadow", n: 10, range: 950, dmg: 65, type: "launch", size: 230 }, { kind: "zone", fr: "mj_poison", at: 0, r: 480, dur: 2.5, tick: 0.3, dmg: 16, size: 700, spin: 0 }] }],
  };
  const ACTS = ["s1", "s2", "s3", "s4", "s5", "s6", "ult"];
  /* 운영자는 다섯 직업 스킬을 모두 — "나는 모든 스킬을 배울 수 있고 쓸 수 있게, 모든 캐릭터의 스킬을 써 봐야 어떤 문제가 있는지 안다" (2026-10-27).
     한 줄로 이어 35개(직업 순서 × 7 + 스킬 번호, 7번째마다 궁극기) */
  const HERO_ORDER = ["kh", "hr", "ds", "je", "mj"], ALL_SKILLS = HERO_ORDER.flatMap((h) => SKILLS[h]);
  HERO_ORDER.forEach((h) => SKILLS[h].forEach((s, i) => { s.ic = "sk_" + h + i; })); // 스킬마다 제 아이콘(ui2) — "스킬 칸 아이콘이 재탕" (2026-10-28)
  const MPCOST = [8, 12, 15, 18, 22, 25, 50]; // 스킬 칸 번호(스킬 순서)마다 마력
  const mpOf = (i) => (SKILL[i] && SKILL[i].mp) || MPCOST[i % 7] || 15;
  let SKILL = SKILLS.kh;

  let S = null, C = null, stop = 0, shake = 0, nextId = 1;
  const host = () => !C.party || C.party.host === C.me;

  /* cfg = { d, me, look, nick, stats:{hpMax, atk, def}, potions, party:{host, members:[{id,nick,look,lv}]} | null, send(data, to), usePotion(), onEnd(res), axis(), watch }
     watch = 운영자 투명 관전 — 내 캐릭터는 없고(몬스터가 안 노림 · 안 그림 · 안 보냄), 화면은 파티장을 따라간다 */
  function start(cfg) {
    C = cfg; const D = DUN[cfg.d] || DUN.forest;
    POTS = Array.isArray(cfg.potSlots) && cfg.potSlots.length === 8 ? cfg.potSlots.slice() : POTS_DEF.slice();
    SKILL = cfg.op ? ALL_SKILLS : SKILLS[heroOf(cfg.look)] || SKILLS.kh; MYATK = ATKS[heroOf(cfg.look)] || ATK; // 직업 평타 // 내 캐릭터(다섯 명 중) 스킬
    const n = cfg.party ? cfg.party.members.length : 1;
    stop = 0; shake = 0;
    S = {
      D, t: 0, wave: 0, room: 0, door: false, fadeT: 0, upWas: false, waveT: 1.2, spawned: false, banner: "", bannerT: 0, foes: [], shots: [], fx: [], nums: [], tele: [],
      hero: { x: 220, z: 440, h: 0, vx: 0, vh: 0, face: 1, hp: cfg.stats.hpMax, max: cfg.stats.hpMax, mp: cfg.stats.mpMax || 150, mpMax: cfg.stats.mpMax || 150, st: "idle", t: 0, inv: 0, step: 0, queued: false, hit: [], walk: 0 },
      mult: cfg.stats.atk / 33, hpK: 1 + 0.6 * (n - 1), potions: Object.assign({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, mp1: 0, mp2: 0, mp3: 0 }, typeof cfg.potions === "object" ? cfg.potions : { p1: cfg.potions || 0 }), potCd: 0, regen: null,
      combo: 0, comboT: 0, maxCombo: 0, hitsTaken: 0, cd: SKILL.map(() => 0), ring: 0, over: false, win: false, lose: false, camX: 0, endT: 0, ended: false,
      remote: {}, sendT: 0, syncT: 0, zones: [], loot: [], learned: cfg.op ? null : cfg.learned || null, slots: cfg.slots || [0, 1, 2, 3, 4, 5, 6],
    };
    if (cfg.watch) { S.hero.hp = 0; S.hero.x = -999; }
    if (D.pvp) { const left = cfg.party && cfg.party.host === cfg.me; S.hero.x = left ? 600 : 1200; S.hero.face = left ? 1 : -1; S.pvpT = 3; S.spawned = true; for (const id in S.remote) { S.remote[id].x = S.remote[id].tx = left ? 1200 : 600; S.remote[id].face = left ? -1 : 1; } } // 결투 — 양쪽 끝에서, 3초 세고 시작
    if (cfg.party) cfg.party.members.forEach((m, i) => { if (m.id !== cfg.me) S.remote[m.id] = { id: m.id, nick: m.nick, look: m.look, gear: m.gear, x: 180 - i * 30, z: 420 + i * 25, h: 0, face: 1, st: "idle", t: 0, step: 0, walk: 0, hp: 1, max: 1, tx: 180 - i * 30, tz: 420 + i * 25, th: 0, alive: true, inv: 0 }; });
  }
  function banner(t) { S.banner = t; S.bannerT = 2.2; }
  function spawn(kind, i, Dx) {
    const D = Dx || MON[kind], side = D.boss ? 1 : i % 2 ? -1 : 1;
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
  /* 타격감 (2026-10-27 "적중 순간 히트스톱, 맞은 캐릭터가 밀려나게 넉백 강공격은 더 멀리, 맞은 뒤 잠깐 행동할 수 없게 피격경직").
     강공격 = 넉백 · 띄우기 · 피해 30 넘는 것(콤보 마지막 타 · 큰 스킬). 수치는 시험(전투-시험 타격감)으로 맞춤 */
  const FEEL = { stop: 0.06, stopHeavy: 0.11, stopBoss: 0.15, push: 260, pushHeavy: 580, stun: 0.42, stunHeavy: 0.7, bossPush: 12, shake: 0.12, shakeHeavy: 0.3 };
  function hitFoe(f, dmg, type, dir, remote) {
    if (S.ghost) return false;
    if (S.remote[f.id] === f) return hitPlayer(f, dmg, type, dir); // 결투 상대
    if (f.st === "dead" || f.inv > 0) return false;
    const heavy = type === "knock" || type === "launch" || dmg >= 30; f.shk = heavy ? 0.16 : 0.1; // 맞은 몸 떨림(히트스톱 동안)
    if (!remote) { dmg = Math.round(dmg * S.mult * rnd(0.92, 1.08)); S.combo++; S.comboT = 1.6; S.maxCombo = Math.max(S.maxCombo, S.combo); stop = Math.max(stop, heavy ? FEEL.stopHeavy : FEEL.stop); shake = Math.max(shake, heavy ? FEEL.shakeHeavy : FEEL.shake); num(f.x, f.z - f.h - f.D.sc * 70, dmg, type === "launch" ? "#ffd36b" : "#fff"); }
    addFx({ k: "spark", x: f.x - dir * 10, y: f.z - f.h - 40 * f.D.sc, t: 0.22, d: 0.22, s: 70 });
    f.flash = 0.1;
    if (!host()) { C.send({ k: "hit", i: f.id, dmg, type, dir }, C.party.host); return true; }
    f.hp -= dmg;
    if (f.D.boss) {
      f.poise -= dmg; f.x += dir * (heavy ? FEEL.bossPush * 2 : FEEL.bossPush);
      if (f.poise <= 0) { f.poise = 260 * S.hpK; f.st = "hit"; f.t = 1.0; f.vx = dir * 200; stop = Math.max(stop, FEEL.stopBoss); banner(f.D.name + " 이(가) 휘청인다 — 지금이다!"); }
      if (f.hp <= 0) { f.hp = 0; f.st = "dead"; f.t = 1.6; shake = 0.6; S.kills = (S.kills || 0) + 3; }
      return true;
    }
    const airborne = f.h > 0.5 || f.st === "air";
    if (type === "launch") { f.vh = 680; f.vx = dir * 60; f.st = "air"; f.jug = 0; }
    else if (type === "knock") { f.vh = 380; f.vx = dir * FEEL.pushHeavy; f.st = "air"; f.jug = 0; }
    else if (airborne) { f.vh = Math.max(f.vh, 330 - f.jug * 55); f.jug++; f.vx = dir * 40; f.st = "air"; }
    else { f.st = "hit"; f.t = heavy ? FEEL.stunHeavy : FEEL.stun; f.stunFull = f.t; f.vx = dir * (heavy ? FEEL.pushHeavy * 0.7 : FEEL.push); }
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
    const H = S.hero; if (C.gm) return; // 운영자 — 안 맞음
    if (H.inv > 0 || H.st === "roll" || H.st === "down" || H.st === "dash" || (S.over && S.win) || H.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.6, (C.stats.def || 0) / 120)))); // 방어 — 많아야 60% 줄임
    H.hp -= dmg; S.hitsTaken++; shake = Math.max(shake, heavy ? 0.35 : 0.18);
    num(H.x, H.z - H.h - 120, dmg, "#ff6a5a");
    if (heavy) { H.st = "fall"; H.vh = 420; H.vx = dir * 300; H.t = 0; }
    else { H.st = "hit"; H.t = 0; H.vx = dir * 240; H.inv = 0.45; stop = Math.max(stop, 0.05); shake = Math.max(shake, 0.15); } // 맞으면 0.3초 경직(예전엔 H.t 를 0.3 으로 넣어 바로 풀렸다) · 밀림 · 멈칫
    H.queued = false;
    if (H.hp <= 0) { H.hp = 0; H.st = "fall"; H.vh = 300; if (!C.party || S.D.pvp) { S.over = true; S.lose = true; S.endT = 1.6; } if (S.D.pvp && C.duelLose) C.duelLose(); }
  }
  /* 몬스터가 노리는 사람 — 살아 있는 사람 중 가장 가까운 */
  /* 결투 — 상대를 몬스터처럼 때릴 수 있게. 맞힌 것은 그 사람에게 보내고(사람끼리는 피해 절반), 그쪽이 맞음 */
  function pvpFoes() { if (!S.D.pvp || S.pvpT > 0 || S.over) return []; const a = []; for (const id in S.remote) { const r = S.remote[id]; if (r.hp > 0) { r.D = r.D || { w: 30, sc: 1, boss: false }; r.st2 = "walk"; a.push(r); } } return a; }
  function hitPlayer(r, dmg, type, dir) { if (S.ghost) return false; if (S.hit2 && S.hit2[r.id] > S.t) return false; (S.hit2 = S.hit2 || {})[r.id] = S.t + 0.12; const d = Math.round(dmg * S.mult * 0.5 * rnd(0.92, 1.08)); num(r.x, r.z - r.h - 110, d, "#ffd36b"); addFx({ k: "spark", x: r.x, y: r.z - r.h - 50, t: 0.22, d: 0.22, s: 70 }); C.send({ k: "hurt", dmg: d, heavy: type === "launch" || type === "knock", dir, pvp: 1 }, r.id); S.combo++; S.comboT = 1.6; S.maxCombo = Math.max(S.maxCombo, S.combo); return true; }
  function heroes() { const a = []; if (S.hero.hp > 0 && !C.gm) a.push(S.hero); for (const id in S.remote) { const r = S.remote[id]; if (r.alive && r.hp > 0 && !r.op) a.push(r); } return a; } // 운영자(op)는 몬스터가 안 노림
  function target(f) { let best = null, bd = 1e9; heroes().forEach((h) => { const d = Math.abs(h.x - f.x) + Math.abs(h.z - f.z) * 2; if (d < bd) { bd = d; best = h; } }); return best || S.hero; }

  /* ── 한 틀 ── */
  /* 궁극기 컷인 — 던파 각성기처럼: 화면 어두워짐 · 시간 멈춤 · 대각선 띠에 캐릭터가 미끄러져 들어옴 · 큰 이름 → 하얗게 번쩍 · 크게 흔들림 · 터짐 (2026-10-28) */
  const CUT_T = 1.15;
  function cutStep(dt) { const c = S.cut; c.t += dt; if (c.t >= CUT_T) { S.cut = null; S.flash = 0.9; shake = 1.1; stop = 0.12; cast(c.sk, true); } }
  function drawCut(g) {
    const c = S.cut; if (!c) return; const t = c.t, inA = Math.min(1, t / 0.18), out = t > CUT_T - 0.16 ? (CUT_T - t) / 0.16 : 1, e = 1 - Math.pow(1 - inA, 3);
    g.save(); g.fillStyle = "rgba(0,0,0," + (0.7 * Math.min(1, t / 0.1)) + ")"; g.fillRect(0, 0, VW, VH);
    // 대각선 띠 · 속도선
    g.translate(VW / 2, VH / 2); g.rotate(-0.22); const bw = VW * 1.6, bh = 210 * e;
    const bg2 = g.createLinearGradient(0, -bh / 2, 0, bh / 2); bg2.addColorStop(0, "rgba(120,10,10,.95)"); bg2.addColorStop(0.5, "rgba(40,0,0,.97)"); bg2.addColorStop(1, "rgba(120,10,10,.95)");
    g.globalAlpha = out; g.fillStyle = bg2; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.fillStyle = "#ffcf4a"; g.fillRect(-bw / 2, -bh / 2 - 4, bw, 4); g.fillRect(-bw / 2, bh / 2, bw, 4);
    g.strokeStyle = "rgba(255,220,160,.35)"; g.lineWidth = 2; for (let k = 0; k < 26; k++) { const y = -bh / 2 + ((k * 37) % bh), x = ((k * 211 + t * 2600) % bw) - bw / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 160, y); g.stroke(); }
    g.rotate(0.22);
    // 캐릭터 — 오른쪽에서 미끄러져 들어와 살짝 계속 움직임
    const pic = typeof MASTER_IMG !== "undefined" && MASTER_IMG.complete && FR.masters && FR.masters[c.hero] ? [MASTER_IMG, FR.masters[c.hero]] : typeof CHIEF_IMG !== "undefined" && FR.npc && FR.npc.chief && c.hero === "chief" ? [CHIEF_IMG, FR.npc.chief] : null;
    if (pic) { const [im, r] = pic, hh = 420, ww = r[2] * hh / r[3], px = 120 + (1 - e) * 600 - t * 30; g.save(); g.beginPath(); g.rect(-VW / 2, -VH / 2, VW, VH); g.clip(); g.shadowColor = "rgba(255,180,60,.8)"; g.shadowBlur = 30; g.drawImage(im, r[0], r[1], r[2], r[3], px - ww / 2, -hh / 2 + 40, ww, hh); g.restore(); }
    // 이름
    const nm = c.sk.name, fs2 = 64, tx = -VW * 0.18 - (1 - e) * 300; g.font = "900 " + fs2 + "px 'Noto Sans KR', serif"; g.textAlign = "center"; g.lineWidth = 10; g.strokeStyle = "rgba(0,0,0,.9)"; g.strokeText(nm, tx, 20);
    const tg = g.createLinearGradient(0, -30, 0, 30); tg.addColorStop(0, "#fff6c8"); tg.addColorStop(0.5, "#ffcf4a"); tg.addColorStop(1, "#d8861a"); g.fillStyle = tg; g.fillText(nm, tx, 20);
    g.font = "800 20px 'Noto Sans KR', sans-serif"; g.fillStyle = "#ffe6a8"; g.fillText("— 각 성 —", tx, -42); g.restore();
  }
  function step(dt) {
    if (S && S.cut) { cutStep(dt); return; }
    if (!S || S.ended) return;
    S.foes.forEach((f) => { if (f.shk > 0) f.shk -= dt; });
    if (stop > 0) { stop -= dt; return; }
    S.t += dt;
    const H = S.hero;
    if (S.D.pvp) { if (S.pvpT > 0) { const b = Math.ceil(S.pvpT); S.pvpT -= dt; if (Math.ceil(S.pvpT) !== b) banner(S.pvpT > 0 ? String(Math.ceil(S.pvpT)) : "결투 시작!"); } }
    else if (S.D.tower && !S.win && !S.lose) { // 무한의 탑 — 층을 깨면 30초 쉬고(말걸기 키로 바로) 다음 층
      const alive = S.foes.some((f) => f.st !== "dead");
      if (S.spawned && !alive) { S.spawned = false; S.cleared = S.floor; if (S.floor >= 99) { S.win = true; S.over = true; S.endT = 1.8; banner("99층 정복!"); } else { S.rest = 30; H.hp = Math.min(H.max, H.hp + H.max * 0.25); banner(S.floor + "층 돌파! 30초 쉬고 " + (S.floor + 1) + "층으로"); } }
      if (!S.spawned && !S.over) { if (S.rest > 0) { S.rest -= dt; if (KEYS.take("talk")) S.rest = 0; } if (!(S.rest > 0)) { S.floor = (S.floor || 0) + 1; S.spawned = true; S.rest = 0; banner("무한의 탑 " + S.floor + "층" + (S.floor % 10 === 0 ? " — 대장!" : "")); towerFloor(S.floor).forEach((k, i) => spawn(k, i, towerScale(MON[k], S.floor))); } }
    } else if (host() && !S.win && !S.lose) {
      const alive = S.foes.some((f) => f.st !== "dead");
      if (S.spawned && !alive) { S.wave++; S.spawned = false; if (S.wave >= S.D.waves.length) { S.win = true; S.over = true; S.endT = 1.8; } else { S.waveT = 1.4; if (S.D.rooms && S.D.waves[S.wave].room !== S.room) { S.door = true; banner("차원의 문이 열렸다 — 문 앞에서 ↑ (또는 문을 눌러)"); } } }
      if (!S.spawned && !S.door && S.wave < S.D.waves.length && (!S.D.rooms || S.D.waves[S.wave].room === S.room) && (S.waveT -= dt) <= 0) { const W = S.D.waves[S.wave]; S.spawned = true; banner(W.text); W.list.forEach((k, i) => spawn(k, i)); }
      if (C.party && !heroes().length) { S.lose = true; S.over = true; S.endT = 1.6; banner("모두 쓰러졌다…"); }
    }
    if (S.fadeT > 0) S.fadeT -= dt;
    if (C.bubbles) for (const id in C.bubbles) if ((C.bubbles[id].t -= dt) <= 0) delete C.bubbles[id];
    if (S.door && !S.over && !C.watch) { const up = C.axis()[1] < -0.6; if (up && !S.upWas && Math.abs(H.x - DOOR_X) < 120) useDoor(); S.upWas = up; } else S.upWas = false;
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
    for (let i = 0; i < S.cd.length; i++) S.cd[i] = Math.max(0, S.cd[i] - dt);
    if (!C.watch) heroStep(dt);
    if (host()) S.foes.forEach((f) => foeStep(f, dt));
    else S.foes.forEach((f) => { f.x += (f.tx - f.x) * Math.min(1, dt * 12); f.z += (f.tz - f.z) * Math.min(1, dt * 12); f.h += (f.th - f.h) * Math.min(1, dt * 14); f.flash = Math.max(0, f.flash - dt); if (f.st === "dead") f.t -= dt; });
    S.foes.forEach((f) => { if ((f.st === "dead" || f.dying) && !f.lootDone && !f.D.boss && !S.D.pvp && !C.watch && !C.gm) { f.lootDone = true; S.loot.push({ x: f.x, z: f.z, h: 40, vh: 420, vx: rnd(-80, 80), t: 0 }); } });
    S.loot.forEach((o) => { o.t += dt; if (o.t < 0.55) { o.h = Math.max(0, o.h + o.vh * dt); o.vh -= 1500 * dt; o.x += o.vx * dt; } else { const dx = H.x - o.x, dz = H.z - o.z, d = Math.hypot(dx, dz) || 1, sp = 500 + (o.t - 0.55) * 2600; o.x += dx / d * Math.min(d, sp * dt); o.z += dz / d * Math.min(d, sp * dt); o.h += (60 - o.h) * Math.min(1, dt * 8); if (d < 30) { o.got = true; if (C.loot) C.loot(); } } }); // 자석
    S.loot = S.loot.filter((o) => !o.got);
    S.foes = S.foes.filter((f) => !(f.st === "dead" && f.t <= 0));
    if (host()) for (let i = 0; i < S.foes.length; i++) for (let j = i + 1; j < S.foes.length; j++) {
      const a = S.foes[i], b = S.foes[j], dx = b.x - a.x, dz = b.z - a.z, need = (a.D.w + b.D.w) * 0.6;
      if (Math.abs(dz) < 18 && Math.abs(dx) < need && a.h < 1 && b.h < 1) { const p = (need - Math.abs(dx)) / 2 * Math.sign(dx || 1); a.x -= p; b.x += p; }
    }
    S.shots.forEach((s) => {
      s.x += s.vx * dt; s.t -= dt; if (s.ghost) return;
      pvpFoes().forEach((r) => { if (!s.hit.includes(r) && Math.abs(r.x - s.x) < 70 && Math.abs(r.z - s.z) < 45) { s.hit.push(r); hitPlayer(r, s.sk ? s.sk.dmg : 34, s.sk ? s.sk.type : "knock", Math.sign(s.vx)); } });
      S.foes.forEach((f) => { if (!s.hit.includes(f) && Math.abs(f.x - s.x) < 60 + f.D.w && Math.abs(f.z - s.z) < 45 + (f.D.boss ? 30 : 0)) { s.hit.push(f); hitFoe(f, s.sk ? s.sk.dmg : 34, s.sk ? s.sk.type : "knock", Math.sign(s.vx)); } });
    });
    S.shots = S.shots.filter((s) => s.t > 0 && s.x > -100 && s.x < ROOM + 100);
    S.zones.forEach((zn) => { // 둘레 · 자리 스킬 — tick 마다 안에 있는 적을 침
      zn.t -= dt; if (zn.follow) { const w = zn.who || H; zn.x = w.x; zn.z = w.z; } if (zn.ghost) return;
      if ((zn.tt -= dt) <= 0) { zn.tt = zn.sk.tick; pvpFoes().forEach((r) => { if (Math.abs(r.x - zn.x) < zn.sk.r + 15 && Math.abs(r.z - zn.z) < 60) hitPlayer(r, zn.sk.dmg, zn.sk.type || "stagger", Math.sign(r.x - zn.x) || 1); }); S.foes.forEach((f) => { if (Math.abs(f.x - zn.x) < zn.sk.r + f.D.w * 0.5 && Math.abs(f.z - zn.z) < 60) hitFoe(f, zn.sk.dmg, zn.sk.type || "stagger", Math.sign(f.x - zn.x) || 1); }); }
    });
    S.zones = S.zones.filter((zn) => zn.t > 0);
    for (const id in S.remote) { const r = S.remote[id]; r.x += (r.tx - r.x) * Math.min(1, dt * 12); r.z += (r.tz - r.z) * Math.min(1, dt * 12); r.h += (r.th - r.h) * Math.min(1, dt * 14); r.t += dt; if (r.st === "walk" || r.st === "run") r.walk += dt * 10; }
    S.fx.forEach((x) => { x.t -= dt; }); S.fx = S.fx.filter((x) => x.t > 0);
    S.nums.forEach((n) => { n.t -= dt; n.y -= 60 * dt; }); S.nums = S.nums.filter((n) => n.t > 0);
    S.tele = S.tele.filter((t) => (t.t -= dt) > 0);
    const eye = C.watch ? (S.remote[C.party.host] || Object.values(S.remote)[0] || H) : H; // 관전 — 파티장을 따라감
    S.camX += (clamp(eye.x - VW * 0.42, 0, ROOM - VW) - S.camX) * Math.min(1, dt * 8);
    if (shake > 0) shake -= dt;
    /* 파티 — 내 자리 초당 15번, 파티장은 몬스터 자리 초당 12번 */
    if ((C.party || S.spec) && !C.watch) { // S.spec = 운영자가 보는 중(혼자 하는 판도 보냄)
      if ((S.sendT -= dt) <= 0) { S.sendT = 1 / 15; C.send({ k: "me", x: Math.round(H.x), z: Math.round(H.z), h: Math.round(H.h), face: H.face, st: H.st, step: H.step, hp: Math.max(0, Math.round(H.hp)), max: H.max }); }
      if (host() && (S.syncT -= dt) <= 0) { S.syncT = 1 / 12; C.send({ k: "sync", wave: S.wave, room: S.room, door: S.door ? 1 : 0, banner: S.bannerT > 2 ? S.banner : "", win: S.win ? 1 : 0, lose: S.lose ? 1 : 0, tele: S.tele.map((t) => [t.k, Math.round(t.k === "rect" ? t.x0 : t.x), Math.round(t.x1 || 0), Math.round(t.z), t.zr || t.r, +t.t.toFixed(2), t.full]), foes: S.foes.map((f) => [f.id, f.kind, Math.round(f.x), Math.round(f.z), Math.round(f.h), f.st, f.face, Math.round(f.hp), f.max]) }); }
    }
    if (S.over && !S.ended && (S.endT -= dt) <= 0) { S.ended = true; C.onEnd({ win: S.win, sec: Math.floor(S.t), maxCombo: S.maxCombo, hits: S.hitsTaken, tower: !!S.D.tower, floor: S.cleared || 0, kills: S.kills || 0 }); }
  }

  /* 다른 사람 스킬도 보이게 (2026-10-27 "내가 보는 화면이랑 상대방이 보는 화면에서 스킬을 써도 스킬 나가는 게 안 보인다").
     스킬을 쓰면 무엇을(ALL_SKILLS 번호) 파티 · 결투 상대에게 알리고, 받은 쪽은 그 사람 자리에서 같은 그림만 그림(ghost — 피해는 쓴 사람 쪽에서 이미 보냄) */
  function ghostCast(r, sk) {
    if (!r || !sk) return; const me = S.hero, n0 = S.shots.length, z0 = S.zones.length, fl = S.flash, sh = shake;
    S.hero = r; S.ghost = true; try { cast(sk, true); } finally { S.hero = me; S.ghost = false; }
    for (let k = n0; k < S.shots.length; k++) S.shots[k].ghost = true;
    for (let k = z0; k < S.zones.length; k++) { S.zones[k].ghost = true; S.zones[k].who = r; }
    S.flash = Math.max(fl, S.flash * 0.4); shake = Math.max(sh, shake * 0.4); // 남의 궁극기는 화면을 덜 흔듦
  }
  function cast(sk, sub) {
    if (!sub && !S.ghost && C.party) C.send({ k: "cast", i: ALL_SKILLS.indexOf(sk) });
    if (sk.kind === "ult" && !S.ghost && !sub && !S.cut) { S.cut = { t: 0, sk, hero: C.op && !(C.look && C.look.gm === 0) ? "chief" : heroOf(C.look) }; S.hero.inv = Math.max(S.hero.inv, 2.5); return; } // 각성 컷인(아래 cutStep)
    if (sk.kind === "ult") { S.flash = 0.5; shake = 0.7; if (S.ghost) banner("궁극기 — " + sk.name + "!"); S.hero.inv = Math.max(S.hero.inv, 1); sk.multi.forEach((m) => cast(m, true)); return; } // 궁극기 — 여러 재주를 한 번에
    const H = S.hero, near = (r) => S.foes.filter((f) => f.st !== "dead" && Math.abs(f.x - H.x) < r).concat(pvpFoes().filter((p) => Math.abs(p.x - H.x) < r)).sort((a, b) => Math.abs(a.x - H.x) - Math.abs(b.x - H.x));
    if (sk.kind === "shot") { H.st = "cast"; H.t = 0; const n = sk.n || 1; for (let k = 0; k < n; k++) S.shots.push({ x: H.x + H.face * 40, z: clamp(H.z + (k - (n - 1) / 2) * 34, Z0, Z1), vx: H.face * sk.spd, t: sk.life, hit: [], face: H.face, sk }); }
    else if (sk.kind === "aura") { S.zones.push({ follow: true, x: H.x, z: H.z, t: sk.dur, tt: 0, sk }); H.st = "cast"; H.t = 0.1; }
    else if (sk.kind === "zone") { S.zones.push({ x: H.x + H.face * sk.at, z: H.z, t: sk.dur, tt: 0, sk }); H.st = "cast"; H.t = 0; }
    else if (sk.kind === "dash") { H.st = "dash"; H.t = 0; H.inv = 0.4; H.hit = []; H.dashDmg = sk.dmg; addFx({ k: "hsk", fr: sk.fr, x: H.x + H.face * 150, y: H.z - 30, t: 0.5, d: 0.5, s: 330, flip: H.face < 0 }); }
    else if (sk.kind === "strike") { H.st = "cast"; H.t = 0; near(sk.range).slice(0, sk.n).forEach((f) => { addFx({ k: "hsk", fr: sk.fr, x: f.x, y: f.z - f.h - 70, t: 0.45, d: 0.45, s: sk.size }); hitFoe(f, sk.dmg, sk.type, Math.sign(f.x - H.x) || H.face); }); }
    else if (sk.kind === "blink") { const f = near(sk.range)[0]; addFx({ k: "hsk", fr: sk.fr, x: H.x, y: H.z - 50, t: 0.4, d: 0.4, s: sk.size, flip: H.face < 0 });
      if (f) { const side = f.x >= H.x ? 1 : -1; H.x = clamp(f.x + side * (f.D.w + 40), 30, ROOM - 30); H.z = f.z; H.face = -side; hitFoe(f, sk.dmg, "launch", -side); addFx({ k: "hsk", fr: sk.fr, x: H.x, y: H.z - 50, t: 0.4, d: 0.4, s: sk.size, flip: H.face < 0 }); }
      H.st = "atk"; H.step = 2; H.t = 0; H.inv = 0.35; }
    else if (sk.kind === "slam") { H.st = "cast"; H.t = 0; shake = 0.35; addFx({ k: "hsk", fr: sk.fr, x: H.x + H.face * 150, y: H.z - 20, t: 0.5, d: 0.5, s: sk.size, flip: H.face < 0 }); addFx({ k: "quake", x: H.x + H.face * 150, y: H.z, t: 0.5, d: 0.5, s: 300 });
      S.foes.concat(pvpFoes()).forEach((f) => { const d = (f.x - H.x) * H.face; if (d > -20 && d < sk.range + f.D.w && Math.abs(f.z - H.z) < 60) hitFoe(f, sk.dmg, "launch", H.face); }); }
    else if (sk.kind === "guard") { H.inv = sk.dur; H.st = "cast"; H.t = 0; S.zones.push({ follow: true, x: H.x, z: H.z, t: sk.dur, tt: 0, sk: Object.assign({}, sk, { tick: 0.5, type: "knock" }) }); }
  }
  /* 물약 — 빠른 칸 1~5. p1 체력 40% · p2 80% · p3 6초 동안 60% · p4 금단(가득 + 3초 무적) · p5 기력(스킬 기다림 없앰). 서로 1초 간격 */
  const POTS_DEF = ["p1", "p2", "p6", "mp1", "mp2", "mp3", "p4", "p5"]; let POTS = POTS_DEF.slice(); // 빠른 칸 8 — 유저가 가방에서 넣고 뺌(cfg.potSlots, 2026-10-28) // 체력 소 · 중 · 대 · 마력 소 · 중 · 대 · 금단 · 기력 (회복 단약 p3 는 Q 로)
  function usePot(k) {
    if (!k) return;
    const H = S.hero; if (!S.potions[k] || S.potCd > 0 || H.hp <= 0) return;
    if ((k === "p1" || k === "p2" || k === "p6" || k === "p3") && H.hp >= H.max) return;
    if (k.startsWith("mp") && H.mp >= H.mpMax) return;
    if (k === "p5" && !S.cd.some((v) => v > 0)) return;
    S.potions[k]--; S.potCd = 1; C.usePotion(k);
    if (k === "p1" || k === "p2" || k === "p6") { const heal = Math.round(H.max * { p1: 0.3, p2: 0.6, p6: 1 }[k]); H.hp = Math.min(H.max, H.hp + heal); num(H.x, H.z - 130, "+" + heal, "#5eea7a"); }
    if (k.startsWith("mp")) { const m2 = Math.round(H.mpMax * { mp1: 0.3, mp2: 0.6, mp3: 1 }[k]); H.mp = Math.min(H.mpMax, H.mp + m2); num(H.x, H.z - 130, "+" + m2 + " 마력", "#7fb7ff"); }
    if (k === "p3") { S.regen = { left: H.max * 0.6, rate: H.max * 0.1 }; num(H.x, H.z - 130, "회복", "#7fe39a"); }
    if (k === "p4") { H.hp = H.max; H.inv = 3; num(H.x, H.z - 130, "금단!", "#ffd36b"); }
    if (k === "p5") { S.cd = S.cd.map(() => 0); num(H.x, H.z - 130, "기력!", "#7fc8ff"); }
  }
  const DASH_MAX = 2, DASH_CD = 8;
  function heroStep(dt) {
    const H = S.hero, [ax, az, run] = C.axis();
    H.inv = Math.max(0, H.inv - dt); H.t += dt;
    const grounded = H.h <= 0 && H.vh <= 0, free = H.st === "idle" || H.st === "walk" || H.st === "run";
    if (H.hp <= 0) { gravity(H, dt); H.x += H.vx * dt; H.vx *= 0.9; if (H.h <= 0) H.st = "dead"; return; }
    if (S.over && S.win) { if (grounded) H.st = "idle"; return; }
    S.potCd = Math.max(0, S.potCd - dt); if (H.hp > 0) H.mp = Math.min(H.mpMax, H.mp + (2 + H.mpMax * 0.015) * dt); // 마력 저절로
    if (S.regen) { const d = Math.min(S.regen.left, S.regen.rate * dt); S.regen.left -= d; H.hp = Math.min(H.max, H.hp + d); if (S.regen.left <= 0.5) S.regen = null; }
    if (KEYS.take("potion")) usePot(["p1", "p2", "p6", "p3"].find((k) => S.potions[k] > 0) || "p1");
    if (KEYS.take("mpot")) usePot(["mp1", "mp2", "mp3"].find((k) => S.potions[k] > 0) || "mp1");
    POTS.forEach((k, i) => { if (KEYS.take("q" + (i + 1))) usePot(k); });
    S.dashCd = Math.max(0, (S.dashCd || 0) - dt);
    const dd = C.dash ? C.dash() : 0;
    /* 대시 2번 충전식 — 하나 쓰면 8초 뒤 하나 참 (2026-10-27 "대쉬도 2회 연달아 쓸 수 있게, 충전식, 1개당 8초") */
    if (S.dashN == null) { S.dashN = DASH_MAX; S.dashRe = 0; }
    if (S.dashN < DASH_MAX) { S.dashRe += dt; if (S.dashRe >= DASH_CD) { S.dashN++; S.dashRe = 0; } } else S.dashRe = 0;
    if (dd && S.dashCd <= 0 && (free || H.st === "atk") && grounded) { if (S.dashN > 0) { H.st = "sprint"; H.t = 0; H.face = dd; H.inv = Math.max(H.inv, 0.22); S.dashCd = 0.25; S.dashN--; H.queued = false; } } // 모자라면 그냥 안 나감 — 남은 횟수 · 차는 중은 오른쪽 대시 칸에 (2026-10-28)
    /* 스킬 — 누른 것을 0.4초 기억했다가 움직일 수 있게 되면 바로(다른 동작 중에 누르면 버려져 '먹통' 같던 것). 기다림 중이면 머리 위에 알려 줌 */
    S.slots.forEach((si, slot) => { const i = si, sk = SKILL[si]; if (KEYS.take(ACTS[slot]) && sk) { if (S.learned && !S.learned.includes(i)) { if (!(S.cdSay > 0)) { num(H.x, H.z - H.h - 140, sk.short + " — 아직 안 배움", "#c9c2b0"); S.cdSay = 0.6; } } else if (S.cd[i] > 0) { if (!(S.cdSay > 0)) { num(H.x, H.z - H.h - 140, sk.short + " " + Math.ceil(S.cd[i]) + "초", "#c9c2b0"); S.cdSay = 0.4; } } else if (!grounded) { if (!(S.cdSay > 0)) { num(H.x, H.z - H.h - 140, "점프 중엔 스킬 못 써요", "#c9c2b0"); S.cdSay = 0.6; } } else S.skBuf = { i, t: 0.4 }; } }); // 점프 중엔 스킬 못 씀 (2026-10-27)
    S.cdSay = Math.max(0, (S.cdSay || 0) - dt); S.flash = Math.max(0, (S.flash || 0) - dt);
    if (S.skBuf) { const i = S.skBuf.i, sk = SKILL[i], ready = free || H.st === "atk" || (H.st === "cast" && H.t >= 0.12) || H.st === "sprint";
      if (ready && grounded && S.cd[i] <= 0) { if (H.mp < mpOf(i)) { S.skBuf = null; if (!(S.cdSay > 0)) { num(H.x, H.z - H.h - 140, "마력 부족", "#7fb7ff"); S.cdSay = 0.6; } } else { H.mp -= mpOf(i); S.cd[i] = sk.cd; H.queued = false; S.skBuf = null; cast(sk); } } else if ((S.skBuf.t -= dt) <= 0) S.skBuf = null; }
    if (H.st === "dash") {
      H.x += H.face * 1150 * dt;
      S.foes.forEach((f) => { if (!H.hit.includes(f) && Math.abs(f.x - H.x) < 60 + f.D.w * 0.5 && Math.abs(f.z - H.z) < 45) { H.hit.push(f); hitFoe(f, H.dashDmg || 28, "launch", H.face); } });
      pvpFoes().forEach((r) => { if (!H.hit.includes(r) && Math.abs(r.x - H.x) < 75 && Math.abs(r.z - H.z) < 45) { H.hit.push(r); hitPlayer(r, H.dashDmg || 28, "launch", H.face); } });
      if (H.t >= 0.28) { H.st = "idle"; H.vx = 0; }
    } else if (H.st === "cast") { if (H.t >= 0.22) H.st = "idle"; }
    else if (H.st === "sprint") { H.x = clamp(H.x + H.face * 980 * dt, 20, ROOM - 20); if (H.t >= 0.2) H.st = "idle"; } // 대시
    else if (H.st === "roll") { H.x += H.face * 560 * dt; if (H.t >= 0.34) H.st = "idle"; }
    else if (H.st === "backstep") { gravity(H, dt); H.x = clamp(H.x - H.face * 720 * dt, 20, ROOM - 20); if (H.t >= 0.26 && H.h <= 0) { H.st = "idle"; H.h = 0; H.vh = 0; } } // 백스텝
    else if (H.st === "hit") { H.vx *= 0.85; H.x += H.vx * dt; if (H.t >= 0.3) H.st = "idle"; }
    else if (H.st === "fall") { gravity(H, dt); H.x += H.vx * dt; if (H.h <= 0 && H.vh <= 0) { H.st = "down"; H.t = 0; H.vx = 0; } }
    else if (H.st === "down") { if (H.t >= 0.6) { H.st = "idle"; H.inv = 1.0; } }
    else if (H.st === "atk" || H.st === "airatk") {
      const A = H.st === "airatk" ? AIR : MYATK[H.step] || MYATK[0], last = MYATK.length - 1;
      if (H.st === "atk" && H.t < A.act[0] + 0.05) H.x += H.face * A.lunge * dt * 4 * (1 - H.t / (A.act[0] + 0.05));
      if (H.t >= A.act[0] && H.t <= A.act[1]) {
        if (A.shot && H.st === "atk") { if (!H.hit.includes("shot")) { H.hit.push("shot"); const sh = A.shot; for (let k = 0; k < sh.n; k++) S.shots.push({ x: H.x + H.face * 40, z: clamp(H.z + (k - (sh.n - 1) / 2) * 30, Z0, Z1), vx: H.face * sh.spd, t: sh.life, hit: [], face: H.face, sk: { fr: sh.fr, size: sh.size, dmg: A.dmg, type: A.type } }); } } // 부적 · 화살
        else S.foes.concat(pvpFoes()).forEach((f) => { if (f.remoteHero !== undefined || S.remote[f.id] === f) { if (!H.hit.includes(f) && inFront(H, f, A.range, 32)) { H.hit.push(f); hitPlayer(f, A.dmg, A.type, H.face); } return; } if (!H.hit.includes(f) && inFront(H, f, A.range, 32)) { H.hit.push(f); hitFoe(f, A.dmg, A.type, H.face); if (A.quake && !H.hit.includes("q")) { H.hit.push("q"); shake = 0.25; addFx({ k: "quake", x: H.x + H.face * 110, y: H.z, t: 0.45, d: 0.45, s: 260 }); } } });
      }
      if (KEYS.take("back") && H.st === "atk") { H.st = "backstep"; H.t = 0; H.vh = 260; H.inv = 0.28; H.queued = false; return; }
      if (KEYS.take("atk") && H.st === "atk") H.queued = true; // 공격 중엔 언제 눌러도 다음 타로(맞힐 때 멈칫과 겹쳐 버려지던 것)
      if (H.st === "airatk") { gravity(H, dt); H.x += H.vx * dt; if (H.h <= 0 && H.vh <= 0) H.st = "idle"; else if (H.t >= A.dur) H.st = "jump"; }
      else if (H.t >= A.dur || (H.queued && H.t >= A.act[1] && H.step < last)) {
        if (H.queued && H.step < last) { H.step++; H.st = "atk"; H.t = 0; H.hit = []; H.queued = false; if (ax) H.face = Math.sign(ax); }
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
      else if (KEYS.take("jump")) { H.st = "jump"; H.vh = 760; H.t = 0; S.skBuf = null; }
      else if (KEYS.take("back")) { H.st = "backstep"; H.t = 0; H.vh = 260; H.inv = 0.28; }
      else if (KEYS.take("roll")) { H.st = "roll"; H.t = 0; H.inv = 0.34; if (ax) H.face = Math.sign(ax); }
    }
    /* 공중에 뜬 채 멈추던 것 (2026-10-27 "가끔 캐릭터가 공중에 뜬다, 점프 눌러줘야 스킬 나간다") — 중력은 점프 · 공중 공격 · 쓰러짐 · 백스텝에서만 돌아,
       공중에서 맞거나(hit) 공중에서 돌진 · 시전 등 다른 동작이 되면 높이가 그대로 남았다(서 있는 동작인데 떠 있고, 땅이 아니라 스킬도 막힘). 어떤 동작이든 떠 있으면 떨어지게 */
    if ((H.h > 0 || H.vh > 0) && !["jump", "airatk", "fall", "backstep"].includes(H.st)) gravity(H, dt);
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
        if (f.dying) { f.st = "dead"; f.t = 0.9; S.kills = (S.kills || 0) + 1; return; }
        if (f.bounced === undefined && f.jug < 3) { f.bounced = 1; f.vh = 180; f.h = 0.1; return; }
        f.st = "down"; f.t = 0.8; f.vx = 0; f.bounced = undefined;
      }
      return;
    }
    if (f.st === "down") { if (f.t <= 0) { f.st = "walk"; f.inv = 0.45; f.jug = 0; } return; }
    if (f.st === "hit") { f.x = clamp(f.x + f.vx * dt, 20, ROOM - 20); f.vx *= Math.pow(0.02, dt); if (f.t <= 0) f.st = "walk"; return; } // 밀려나다 멈춤(경직이 끝날 때까지 못 움직임)
    if (D.boss) return bossStep(f, dt, dx, dz);
    if (f.st === "walk") {
      f.face = Math.sign(dx) || f.face;
      const ranged = D.act === "shoot" || D.act === "curse";
      const want = D.act === "pounce" ? D.range * 0.8 : ranged ? D.range * 0.75 : D.range * 0.6;
      let gx = Math.abs(dx) > want ? Math.sign(dx) * D.spd : 0; if (ranged && Math.abs(dx) < 200) gx = -Math.sign(dx) * D.spd * 0.7;
      const gz = Math.abs(dz) > 8 && D.act !== "curse" ? Math.sign(dz) * D.spd * 0.55 : 0;
      f.x += gx * dt; f.z = clamp(f.z + gz * dt, Z0, Z1); f.moving = !!(gx || gz);
      if (f.cd <= 0 && Math.abs(dx) < D.range && Math.abs(dz) < (D.act === "curse" ? 200 : 22)) { f.st = "wind"; f.t = D.wind;
        if (D.act === "shoot") S.tele.push({ k: "rect", x0: f.face > 0 ? f.x + 20 : f.x - D.range, x1: f.face > 0 ? f.x + D.range : f.x - 20, z: f.z, zr: 18, t: f.t, full: f.t });
        if (D.act === "curse") { f.cx = T.x; f.cz = T.z; S.tele.push({ k: "ring", x: f.cx, z: f.cz, r: 85, t: f.t, full: f.t }); } }
    } else if (f.st === "wind") {
      if (f.t <= 0) {
        f.st = "atk"; f.hitDone = false;
        if (D.act === "shoot") { f.t = 0.3; f.hitDone = true; heroes().forEach((h) => { if ((h.x - f.x) * f.face > 0 && Math.abs(h.x - f.x) < D.range && Math.abs(h.z - f.z) < 24 && h.h < 60) { hurt(h, D.dmg, false, f.face); addFx({ k: "spark", x: h.x, y: h.z - 50, t: 0.22, d: 0.22, s: 60 }); } }); }
        else if (D.act === "curse") { f.t = 0.3; f.hitDone = true; addFx({ k: "quake", x: f.cx, y: f.cz, t: 0.5, d: 0.5, s: 180 }); heroes().forEach((h) => { if (Math.hypot(h.x - f.cx, (h.z - f.cz) * 2) < 90 && h.h < 50) hurt(h, D.dmg, false, Math.sign(h.x - f.cx) || 1); }); }
        else if (D.act === "pounce") { f.t = 0.42; f.vx = f.face * 620; }
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
  /* 차원의 문 — 방 오른쪽 끝. 파티장이 넘어가면(또는 파티원이 문을 쓰면 파티장에게 알려) 모두 다음 방으로 */
  const DOOR_X = ROOM - 300; // 스킬 단추와 안 겹치게 조금 안쪽
  function useDoor() { if (!S || !S.door) return; if (host()) goRoom(S.room + 1); else C.send({ k: "door" }); }
  function goRoom(r) {
    const H = S.hero, RM = S.D.rooms[r]; if (!RM) return;
    S.room = r; S.door = false; S.fadeT = 0.7; S.waveT = 1.0; S.camX = 0;
    H.x = 160; H.h = 0; H.vh = 0; H.vx = 0; if (H.hp > 0) H.st = "idle"; H.inv = Math.max(H.inv, 1);
    S.foes = []; S.shots = []; S.zones = []; S.tele = [];
    banner((RM.look.boss ? "⚠ " : (r + 1) + " / " + S.D.rooms.length + " — ") + RM.name);
  }
  /* 차원의 문 — 겹겹이 도는 소용돌이 · 빛나는 가운데 · 빨려 드는 불티 · 바닥 마법진 · 빛기둥 (2026-10-27 "퀄리티 좀 높여라") */
  function drawDoor(g, x, y) {
    const t = S.t, cy = -105, RX = 62, RY = 112; g.save(); g.translate(x, y);
    g.globalCompositeOperation = "lighter";
    // 바닥 마법진
    g.save(); g.scale(1, 0.32); g.rotate(t * 0.6); g.strokeStyle = "rgba(200,140,255,.55)"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 12; k++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(96, 0); g.lineTo(120, 0); g.stroke(); g.fillStyle = "rgba(230,190,255,.7)"; g.fillRect(104, -3, 6, 6); } g.restore();
    // 빛기둥
    const pg = g.createLinearGradient(0, -330, 0, 0); pg.addColorStop(0, "rgba(160,90,255,0)"); pg.addColorStop(0.7, "rgba(170,110,255,.22)"); pg.addColorStop(1, "rgba(220,180,255,.45)"); g.fillStyle = pg; g.fillRect(-RX * 0.9, -330, RX * 1.8, 330);
    // 바깥 빛
    const og = g.createRadialGradient(0, cy, 10, 0, cy, RY * 1.5); og.addColorStop(0, "rgba(190,120,255,.55)"); og.addColorStop(0.5, "rgba(110,40,220,.25)"); og.addColorStop(1, "rgba(60,0,140,0)"); g.fillStyle = og; g.beginPath(); g.ellipse(0, cy, RX * 1.9, RY * 1.5, 0, 0, Math.PI * 2); g.fill();
    // 소용돌이 — 팔 7개 × 3겹
    g.save(); g.translate(0, cy); g.scale(RX / RY, 1);
    for (let L = 0; L < 3; L++) { const sp = (1.4 + L * 0.7) * (L % 2 ? -1 : 1), R0 = RY * (1 - L * 0.24); g.lineWidth = 5 - L;
      for (let a = 0; a < 7; a++) { const base = t * sp + a * Math.PI * 2 / 7; g.beginPath(); for (let s = 0; s <= 24; s++) { const q = s / 24, r = R0 * (1 - q * 0.85), ang = base + q * 2.6; s ? g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : g.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); }
        g.strokeStyle = "rgba(" + (170 + L * 30) + "," + (110 + L * 40) + ",255," + (0.55 - L * 0.1) + ")"; g.stroke(); } }
    g.restore();
    // 가장자리 고리
    g.lineWidth = 4; g.strokeStyle = "rgba(235,200,255,.9)"; g.beginPath(); g.ellipse(0, cy, RX, RY, 0, 0, Math.PI * 2); g.stroke(); g.lineWidth = 10; g.strokeStyle = "rgba(150,80,255,.35)"; g.stroke();
    // 가운데
    const cg = g.createRadialGradient(0, cy, 2, 0, cy, RX * 0.8); cg.addColorStop(0, "rgba(255,255,255,1)"); cg.addColorStop(0.3, "rgba(240,210,255,.9)"); cg.addColorStop(1, "rgba(150,80,255,0)"); g.fillStyle = cg; g.beginPath(); g.ellipse(0, cy, RX * 0.8, RY * 0.8 * (0.9 + Math.sin(t * 4) * 0.08), 0, 0, Math.PI * 2); g.fill();
    // 빨려 드는 불티
    for (let k = 0; k < 26; k++) { const ph = (t * 0.7 + k * 0.137) % 1, ang = k * 2.39996 + t * 1.5, r = (1 - ph) * RY * 1.35, px = Math.cos(ang) * r * (RX / RY) * 1.2, py = cy + Math.sin(ang) * r; g.fillStyle = "rgba(240,215,255," + (0.85 * ph) + ")"; g.beginPath(); g.arc(px, py, 1.5 + ph * 2.5, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = "source-over";
    g.font = "800 16px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; const tx = "차원의 문  ↑", ty = -245 + Math.sin(t * 3) * 4; g.strokeText(tx, 0, ty); g.fillStyle = "#f3e0ff"; g.fillText(tx, 0, ty);
    g.restore();
  }
  function net(from, d) {
    if (!S || !C.party || !d) return;
    if (d.k === "cast") { ghostCast(S.remote[from], ALL_SKILLS[d.i]); return; }
    if (d.k === "door") { if (host() && S.door) goRoom(S.room + 1); return; }
    if (d.k === "me") { const r = S.remote[from]; if (!r) return; Object.assign(r, { tx: d.x, tz: d.z, th: d.h, face: d.face, step: d.step, hp: d.hp, max: d.max, alive: d.hp > 0 }); if (r.st !== d.st) { r.st = d.st; r.t = 0; } return; }
    if (d.k === "hit" && host()) { const f = S.foes.find((x) => x.id === d.i); if (f) hitFoe(f, Math.min(600, +d.dmg || 0), d.type, d.dir || 1, true); return; }
    if (d.k === "hurt") { if (d.pvp && (!S.D.pvp || S.pvpT > 0)) return; hurt(S.hero, +d.dmg || 0, !!d.heavy, d.dir || 1); return; }
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
      S.wave = d.wave; if (d.room != null && d.room !== S.room && S.D.rooms) goRoom(d.room); S.door = !!d.door;
      if ((d.win || d.lose) && !S.over) { S.over = true; S.win = !!d.win; S.lose = !!d.lose; S.endT = 1.8; if (d.lose) banner("모두 쓰러졌다…"); }
    }
  }

  /* ── 그리기 ── */
  function frame(g, im, fr, x, y, sc, flip, ax, alpha, rot, sx, sy) {
    if (!fr || !im.complete) return;
    const w = fr[2] * sc, h = fr[3] * sc;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale((flip ? -1 : 1) * (sx || 1), sy || 1); if (alpha != null) g.globalAlpha *= alpha;
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
  /* 운영자 — 금빛 후광 · 반짝임(다른 사람과 확실히 다르게) */
  function gmAura(g, x, y, t) {
    g.save(); const gr = g.createRadialGradient(x, y - 60, 6, x, y - 60, 80); gr.addColorStop(0, "rgba(255,230,140,.45)"); gr.addColorStop(1, "rgba(255,200,60,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - 60, 70, 90, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,215,90,.9)"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y - 132, 18, 5, 0, 0, Math.PI * 2); g.stroke(); // 머리 위 고리
    for (let i = 0; i < 5; i++) { const a = t * 1.8 + i * 1.26, px = x + Math.cos(a) * 40, py = y - 70 + Math.sin(a * 1.3) * 50; g.fillStyle = "rgba(255,240,170," + (0.5 + 0.5 * Math.sin(t * 5 + i)) + ")"; g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function drawPerson(g, P, look, cx, me, nick) {
    const x = P.x - cx, y = P.z - P.h;
    shadow(g, x, P.z, 26 * Math.max(0.5, 1 - P.h / 400));
    let a = P.inv > 0 && P.st !== "roll" && P.st !== "dash" && Math.floor(S.t * 20) % 2 ? 0.45 : 1;
    if (!me && P.hp <= 0) a = 0.6;
    g.save(); g.globalAlpha = a; g.translate(x, y + 2);
    if (P.face < 0) g.scale(-1, 1);
    if (P.st === "sprint") { g.save(); g.globalAlpha *= 0.3; g.translate(-34, 0); drawChar(g, look, { st: "sprint", t: P.t }, 1); g.restore(); } // 대시 잔상
    if (P.st === "roll") { g.translate(0, -36); g.rotate(P.t / 0.34 * Math.PI * 2); g.translate(0, 36); }
    const gear = me ? C.gear : P.gear, isOp = me ? C.op : P.op;
    if (isOp) gmAura(g, x, y, S.t);
    drawChar(g, look, { st: P.st === "roll" ? "jump" : P.st, t: P.t, walk: P.walk, step: P.step }, 1, { glow: P.st === "dash" || (P.st === "atk" && P.step === 2), gear, op: isOp });
    g.restore();
    // (평타 때 그리던 흰 반달 선은 없앰 — 부장님 2026-10-27 "이상한 흰색깔 안 보이게")
    if (nick && (me ? C.op : P.op)) nick = "⚜운영자 " + nick;
    if (nick) { g.font = "700 12px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(nick, x, y - 128); g.fillStyle = me ? "#ffe08a" : "#bfe3ff"; g.fillText(nick, x, y - 128);
      if (!me) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - 22, y - 122, 44, 4); g.fillStyle = "#3ccf6a"; g.fillRect(x - 22, y - 122, 44 * clamp(P.hp / (P.max || 1), 0, 1), 4); } }
    /* 채팅 말풍선 — 사냥터에서도 머리 위에 (2026-10-27). C.bubbles 는 마을과 같은 것(id → { text, t }) */
    const B = C.bubbles && C.bubbles[me ? C.me : P.id]; if (B) drawBubble(g, B.text, x, y - 150);
  }
  /* 영상에서 뽑은 몬스터 동작(2026-10-28 "몬스터, 보스몬스터도 다 영상으로") — mm_<종류>: move · wind · atk · hit · dead. 값 = 영상 속에서 보는 쪽(1 오른쪽, -1 왼쪽) */
  const MVID = { slime: 1, goblin: 1, wolf: -1, golem: 1, gchief: 1, orc: 1, orcArcher: -1, orcShaman: -1, orcChief: -1, wchief: -1 }, VIDIMG = {};
  const vidMon = (k) => { if (MVID[k] == null || !FR["mm_" + k]) return null; const i = VIDIMG[k] || (VIDIMG[k] = img("img/mm_" + k + ".webp")); return i.complete && i.naturalWidth ? i : null; };
  const VDUR = { wind: 0.6, atk: 0.4, hit: 0.4, dead: 0.9 }; // 같이 하는 사람(방장이 아님)은 남은 시간을 모름 — 바뀐 뒤 흐른 시간으로
  function drawFoeVid(g, f, x, y, D, A, VI, vk) {
    const R = FR["mm_" + vk], M = FR["mm_" + vk + "_meta"], C = M.counts;
    if (f.vst !== f.st) { f.vst = f.st; f.vt0 = Math.max(0.01, f.t || 0); f.vs = S.t; } else if ((f.t || 0) > f.vt0) f.vt0 = f.t;
    const p = host() ? clamp(1 - (f.t || 0) / f.vt0, 0, 1) : clamp((S.t - f.vs) / (VDUR[f.st] || 1), 0, 1), at = (k, q) => k + Math.min(C[k] - 1, Math.floor(q * C[k]));
    let nm, rot = 0;
    if (f.st === "wind") nm = at("wind", p);
    else if (f.st === "atk") nm = at("atk", p);
    else if (f.st === "hit") nm = at("hit", p);
    else if (f.st === "air") { nm = "hit" + (C.hit - 1); if (!D.boss) rot = -f.face * Math.min(1.2, f.h / 200); }
    else if (f.st === "down") nm = "dead" + Math.min(C.dead - 1, 3);
    else if (f.st === "dead") nm = at("dead", clamp(p * 1.6, 0, 1));
    else nm = "move" + (f.moving || vk === "slime" ? Math.floor((S.t + f.ph) * (D.spd > 150 ? 12 : 8)) % C.move : 0);
    const r = R[nm] || R.move0, ax = M.ax2[nm] != null ? M.ax2[nm] : 0.5, k = (A.move[0][3] * D.sc) / M.tall, flip = f.face !== MVID[vk], a = f.st === "dead" ? clamp(f.t / 0.5, 0, 1) : 1;
    g.save();
    if (D.tint && vk !== f.kind) g.filter = D.tint; // 늑대 우두머리 — 제 영상이 생기면 빛깔 바꾸기 없이
    frame(g, VI, r, x, y + 2, k, flip, ax, a, rot);
    g.filter = "none";
    if (f.flash > 0 || f.st === "wind") { g.globalCompositeOperation = "lighter"; frame(g, VI, r, x, y + 2, k, flip, ax, (f.st === "wind" ? 0.2 + 0.15 * Math.sin(S.t * 30) : 0.6) * a, rot); }
    g.restore();
    if (!D.boss && f.st !== "dead" && f.hp < f.max) { const w = 50, by = y - R.move0[3] * k - 10; g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - w / 2, by, w, 5); g.fillStyle = "#e5484d"; g.fillRect(x - w / 2, by, w * clamp(f.hp / f.max, 0, 1), 5); }
  }
  function drawFoe(g, f, cx) {
    const x = f.x - cx + (f.shk > 0 ? (Math.random() - 0.5) * 9 : 0), y = f.z - f.h, D = f.D, A = FR.mon[D.sprite || f.kind], IM = IMG[A.img || "mon"]; // 히트스톱 동안 부르르
    shadow(g, x, f.z, D.w * 0.9 * Math.max(0.5, 1 - f.h / 400));
    const vk = FR["mm_" + f.kind] ? f.kind : D.sprite || f.kind, VI = vidMon(vk); if (VI) return drawFoeVid(g, f, x, y, D, A, VI, vk);
    let list = A.move, rot = 0;
    if (f.st === "hit" || f.st === "air") list = A.hit;
    if (f.st === "wind" || f.st === "atk") list = A.attack;
    if (f.st === "down" || f.st === "dead") list = A.dead;
    const fr = list[Math.floor((S.t + f.ph) * 6) % list.length] || list[0];
    const flip = D.native ? f.face !== D.native : f.face < 0;
    const a = f.st === "dead" ? clamp(f.t / 0.5, 0, 1) : 1;
    if (f.st === "air" && !D.boss) rot = -f.face * Math.min(1.2, f.h / 200);
    let bob = f.moving && f.st === "walk" ? Math.abs(Math.sin((S.t + f.ph) * 9)) * 4 : 0, sx = 1, sy = 1, lx = 0;
    if (A.img) { // 그림 한 장 — 몸짓으로 움직임(목표 자세로 부드럽게 다가감)
      const fc = f.face, slime = f.kind === "slime", ph = (S.t + f.ph) * (slime ? 7 : 4 + D.spd / 45), stride = Math.sin(ph);
      let tr = 0, tsx = 1, tsy = 1;
      if (f.st === "walk") {
        if (f.moving) { if (slime) { tsy = 1 + 0.14 * stride; tsx = 1 - 0.1 * stride; bob = Math.max(0, stride) * 10; } else { tr = fc * (0.06 + 0.04 * stride); bob = Math.abs(stride) * (D.boss ? 4 : 6); tsy = 1 - 0.03 * Math.abs(stride); } }
        else { tsy = 1 + 0.025 * Math.sin(S.t * 3 + f.ph); tsx = 1 - 0.015 * Math.sin(S.t * 3 + f.ph); } // 숨쉬기
      } else if (f.st === "wind") { const p = clamp(1 - f.t / (D.boss ? 0.85 : D.wind), 0, 1), e = p * p * (3 - 2 * p); tr = -fc * 0.2 * e; tsx = 1 - 0.1 * e; tsy = 1 + 0.07 * e; lx = -fc * 8 * e; } // 젖히며 힘 모으기
      else if (f.st === "atk") { tr = fc * 0.28; tsx = 1.12; tsy = 0.94; lx = fc * 10; } // 덮치기
      else if (f.st === "hit") { const p = clamp(f.t / (f.stunFull || 0.42), 0, 1); tr = -fc * 0.25 * p; tsx = 1 - 0.06 * p; lx = -fc * 6 * p; }
      else if (f.st === "air") { tr = -fc * Math.min(1.2, f.h / 200); }
      else if (f.st === "down" || f.st === "dead") { tr = -fc * 1.5; tsy = 0.95; }
      const k = f.st === "atk" ? 0.5 : f.st === "down" || f.st === "dead" ? 0.18 : 0.22; // 얼마나 빨리 그 자세로
      f.ar = (f.ar || 0) + (tr - (f.ar || 0)) * k; f.asx = (f.asx || 1) + (tsx - (f.asx || 1)) * k; f.asy = (f.asy || 1) + (tsy - (f.asy || 1)) * k; f.alx = (f.alx || 0) + (lx - (f.alx || 0)) * k;
      rot = f.ar; sx = f.asx; sy = f.asy; lx = f.alx;
    }
    g.save();
    if (f.st === "wind" && !A.img) g.translate((Math.random() - 0.5) * 3, 0);
    if (D.tint) g.filter = D.tint;
    frame(g, IM, fr, x + lx, y + 2 - bob, D.sc, flip, 0.5, a, rot, sx, sy);
    g.filter = "none";
    if (f.flash > 0 || f.st === "wind") { g.globalCompositeOperation = "lighter"; frame(g, IM, fr, x + lx, y + 2 - bob, D.sc, flip, 0.5, f.st === "wind" ? 0.2 + 0.15 * Math.sin(S.t * 30) : 0.6, rot, sx, sy); }
    g.restore();
    if (!D.boss && f.st !== "dead" && f.hp < f.max) { const w = 50, by = y - fr[3] * D.sc - 10; g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x - w / 2, by, w, 5); g.fillStyle = "#e5484d"; g.fillRect(x - w / 2, by, w * clamp(f.hp / f.max, 0, 1), 5); }
  }
  function draw(g, touch) {
    if (!S) return;
    const cx = S.camX + (shake > 0 ? (Math.random() - 0.5) * 20 * shake : 0);
    const LK = (S.D.rooms && S.D.rooms[S.room] && S.D.rooms[S.room].look) || {};
    BG.draw(g, LK.pic || S.D.theme, cx + (LK.off || 0), VW, VH, Z0);
    if (LK.tint) { g.fillStyle = LK.tint; g.fillRect(0, 0, VW, VH); }
    if (LK.fog) { const fg = g.createLinearGradient(0, Z0 - 120, 0, VH); fg.addColorStop(0, "rgba(200,205,215,0)"); fg.addColorStop(0.5, "rgba(200,205,215," + LK.fog + ")"); fg.addColorStop(1, "rgba(200,205,215," + LK.fog * 0.4 + ")"); g.fillStyle = fg; g.fillRect(0, Z0 - 120, VW, VH - Z0 + 120); }
    if (S.door) { drawDoor(g, DOOR_X - cx, Z0 + 40); if (DOOR_X - cx > VW + 40) { const bob = Math.sin(S.t * 5) * 6; g.font = "800 17px 'Noto Sans KR', sans-serif"; g.textAlign = "right"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText("차원의 문 ▶", VW - 16 + bob, Z0 - 20); g.fillStyle = "#e8c8ff"; g.fillText("차원의 문 ▶", VW - 16 + bob, Z0 - 20); } } /* 화면 밖이면 오른쪽 끝에 알림 */
    S.tele.forEach((t) => {
      const p = clamp(1 - t.t / t.full, 0, 1); g.fillStyle = "rgba(255,50,40,.18)"; g.strokeStyle = "rgba(255,70,50,.9)"; g.lineWidth = 2;
      if (t.k === "rect") { g.fillRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.strokeRect(t.x0 - cx, t.z - t.zr, t.x1 - t.x0, t.zr * 2); g.fillStyle = "rgba(255,50,40,.35)"; g.fillRect(t.x0 - cx, t.z - t.zr, (t.x1 - t.x0) * p, t.zr * 2); }
      else { g.beginPath(); g.ellipse(t.x - cx, t.z, t.r, t.r * 0.42, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "rgba(255,50,40,.35)"; g.beginPath(); g.ellipse(t.x - cx, t.z, t.r * p, t.r * 0.42 * p, 0, 0, Math.PI * 2); g.fill(); }
    });
    const H = S.hero;
    S.zones.forEach((zn) => centered(g, IMG.hsk, FR.hsk[zn.sk.fr], zn.x - cx, zn.z - 30 - (zn.follow ? (zn.who || H).h || 0 : 0), zn.sk.size, false, Math.min(1, zn.t / 0.3) * 0.95, zn.sk.spin ? S.t * zn.sk.spin : 0));
    const bodies = S.foes.map((f) => [f.z, () => drawFoe(g, f, cx)]);
    if (!C.watch) bodies.push([H.z + 0.1, () => drawPerson(g, H, C.look, cx, true, C.party ? C.nick : "")]);
    for (const id in S.remote) { const r = S.remote[id]; bodies.push([r.z, () => drawPerson(g, r, r.look, cx, false, r.nick)]); }
    bodies.sort((a, b) => a[0] - b[0]).forEach((b) => b[1]());
    S.loot.forEach((o) => { const r = FR.items && FR.items.box; if (!r || !IMG.items.complete) return; const k = 30 / Math.max(r[2], r[3]), x = o.x - cx, y = o.z - o.h; g.save(); g.shadowColor = "rgba(255,220,90,.9)"; g.shadowBlur = 10; g.drawImage(IMG.items, r[0], r[1], r[2], r[3], x - r[2] * k / 2, y - r[3] * k / 2, r[2] * k, r[3] * k); g.restore(); }); // 드롭 주머니
    S.shots.forEach((s) => centered(g, IMG.hsk, FR.hsk[s.sk ? s.sk.fr : "kh_wave"], s.x - cx, s.z - 60, s.sk ? s.sk.size : 170, s.face < 0, Math.min(1, s.t / 0.15)));
    S.fx.forEach((x) => {
      const p = 1 - x.t / x.d;
      if (x.k === "spark") { const L = FR.mfx.spark; centered(g, IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y, x.s * (0.8 + p * 0.5), false, 1 - p * 0.6); }
      else if (x.k === "quake") { const L = FR.mfx.quake; centered(g, IMG.mfx, L[Math.min(L.length - 1, Math.floor(p * L.length))], x.x - cx, x.y - 20, x.s, false, 1 - p * 0.5); }
      else if (x.k === "hsk") centered(g, IMG.hsk, FR.hsk[x.fr], x.x - cx, x.y, x.s, x.flip, 1 - p);
    });
    g.textAlign = "center"; g.textBaseline = "middle";
    S.nums.forEach((n) => { g.font = "900 22px 'Noto Sans KR', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.globalAlpha = Math.min(1, n.t / 0.3); g.strokeText(n.v, n.x - cx, n.y); g.fillStyle = n.c; g.fillText(n.v, n.x - cx, n.y); g.globalAlpha = 1; });
    g.textBaseline = "alphabetic";
    hud(g, touch);
  }
  function bar(g, x, y, w, h, p, c) { g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = c; g.fillRect(x, y, w * clamp(p, 0, 1), h); }
  /* 체력 · 마력 게이지 — 금속 틀 그림(ui2 hpbar · mpbar) 안을 유리 같은 빛깔로 채움 (2026-10-28 "초등학생 같다, 진짜 RPG 처럼"). 돌려줌 = 틀 높이 */
  const GAUGE_COL = { hp: ["#ff7a6a", "#d4202a", "#6a0a10"], low: ["#ffb36a", "#e0501a", "#6a1a08"], mp: ["#7ab8ff", "#2a62e0", "#0a1e6a"] };
  function gauge(g, kind, x, y, w, p, text, col) {
    const F = FR.ui2 && FR.ui2[kind + "bar"], M = FR.ui2_meta && FR.ui2_meta[kind + "bar"], c = GAUGE_COL[col || kind];
    if (!F || !IMG.ui2.complete || !IMG.ui2.naturalWidth) { const h = kind === "hp" ? 14 : 8; bar(g, x, y, w, h, p, c[1]); return h + 4; }
    const fh = F[3] * w / F[2], ix = x + M[0] * w, iy = y + M[1] * fh, iw = M[2] * w, ih = M[3] * fh, pw = iw * clamp(p, 0, 1);
    g.fillStyle = "#08060a"; g.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
    if (pw > 0) { const gr = g.createLinearGradient(0, iy, 0, iy + ih); gr.addColorStop(0, c[0]); gr.addColorStop(0.45, c[1]); gr.addColorStop(1, c[2]); g.fillStyle = gr; g.fillRect(ix, iy, pw, ih);
      g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(ix, iy + 1, pw, Math.max(1, ih * 0.22)); // 윗면 반짝임
      const sx = ix + ((S.t * 0.35) % 1) * iw; if (sx < ix + pw) { const sg = g.createLinearGradient(sx - 18, 0, sx + 18, 0); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.22)"); sg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = sg; g.fillRect(Math.max(ix, sx - 18), iy, Math.min(36, ix + pw - sx + 18), ih); } } // 흐르는 빛
    g.drawImage(IMG.ui2, F[0], F[1], F[2], F[3], x, y, w, fh);
    if (text) { g.textAlign = "center"; g.font = "800 " + Math.max(9, Math.round(ih * 0.72)) + "px 'Noto Sans KR', sans-serif"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(text, ix + iw / 2, iy + ih * 0.78); g.fillStyle = "#fff"; g.fillText(text, ix + iw / 2, iy + ih * 0.78); g.textAlign = "left"; }
    return fh;
  }
  function skIcon(g, sk, x, y, size, alpha) { // 스킬 아이콘 — 새 그림(ui2)이 있으면 그것, 없으면 예전 효과 그림
    const r = FR.ui2 && FR.ui2[sk.ic]; if (!r || !IMG.ui2.complete || !IMG.ui2.naturalWidth) return centered(g, IMG.hsk, FR.hsk[sk.fr], x, y, size, false, alpha);
    g.save(); g.globalAlpha *= alpha; g.drawImage(IMG.ui2, r[0], r[1], r[2], r[3], x - size / 2, y - size / 2, size, size); g.restore();
  }
  function hud(g, touch) {
    const H = S.hero; if (S.cut) { drawCut(g); return; }
    if (S.fadeT > 0) { g.fillStyle = "rgba(0,0,0," + Math.min(1, S.fadeT / 0.5) + ")"; g.fillRect(0, 0, VW, VH); } // 방을 넘어갈 때 잠깐 어둡게
    g.textAlign = "left";
    if (C.watch) { g.font = "800 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#c58cff"; g.fillText("👁 투명 관전 중 · " + S.D.name + " — 이 판 사람들에게는 안 보여요", 22, 30); g.font = "600 12px 'Noto Sans KR', sans-serif"; let py = 56; for (const id in S.remote) { const r = S.remote[id]; g.fillStyle = "#bfe3ff"; g.fillText(r.nick, 22, py); bar(g, 110, py - 9, 90, 7, r.hp / (r.max || 1), "#3ccf6a"); py += 18; } return; }
    g.font = "700 15px 'Noto Sans KR', sans-serif"; g.fillStyle = "#f6d27a"; g.fillText(C.nick + "  ·  " + S.D.name, 22, 30);
    const gh = gauge(g, "hp", 12, 36, 300, H.hp / H.max, Math.ceil(H.hp) + " / " + H.max, H.hp / H.max > 0.3 ? "hp" : "low");
    gauge(g, "mp", 12, 36 + gh - 6, 250, H.mp / H.mpMax, Math.floor(H.mp) + " / " + H.mpMax); // 마력
    g.font = "600 12px 'Noto Sans KR', sans-serif"; g.fillStyle = "#c9b48a"; g.textAlign = "left"; g.fillText((S.D.rooms ? "방 " + (S.room + 1) + " / " + S.D.rooms.length + "   " : "무리 " + Math.min(S.wave + 1, S.D.waves.length) + " / " + S.D.waves.length + "   ") + Math.floor(S.t / 60) + ":" + String(Math.floor(S.t % 60)).padStart(2, "0")  + "   물약 " + Object.values(S.potions).reduce((a, b) => a + b, 0) + (touch ? "" : " (" + KEYS.label("potion") + ")"), 22, 112);
    let py = 134; for (const id in S.remote) { const r = S.remote[id]; g.fillStyle = "#bfe3ff"; g.fillText(r.nick, 22, py); bar(g, 110, py - 9, 90, 7, r.hp / (r.max || 1), "#3ccf6a"); py += 18; }
    if (S.D.tower) { g.textAlign = "right"; g.font = "900 22px 'Noto Sans KR', sans-serif"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.8)"; const tt = "무한의 탑 " + (S.floor || 1) + "층"; g.strokeText(tt, VW - 22, 70); g.fillStyle = "#ffd36b"; g.fillText(tt, VW - 22, 70);
      if (S.rest > 0 && !S.over) { g.textAlign = "center"; g.font = "800 20px 'Noto Sans KR', sans-serif"; const r = "쉬는 시간 " + Math.ceil(S.rest) + "초 — " + (touch ? "화면을 누르면" : KEYS.label("talk") + " 또는 화면 클릭으로") + " 바로 " + (S.floor + 1) + "층"; g.strokeText(r, VW / 2, 120); g.fillStyle = "#9df59a"; g.fillText(r, VW / 2, 120); } }
    if (S.flash > 0) { g.fillStyle = "rgba(255,240,200," + Math.min(0.5, S.flash) + ")"; g.fillRect(0, 0, VW, VH); }
    const B = S.foes.find((f) => f.D.boss && f.st !== "dead");
    if (B) gauge(g, "hp", VW / 2 - 230, 4, 460, B.hp / B.max, B.D.name + "  " + Math.max(0, Math.round(B.hp / B.max * 100)) + "%", "low"); // 보스 — 같은 금속 틀, 이름을 안에
    if (S.combo >= 2) { g.textAlign = "right"; g.font = "900 " + (30 + Math.min(20, S.combo)) + "px 'Noto Sans KR', sans-serif"; g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; const t = S.combo + " 연속!"; g.strokeText(t, VW - 24, 120); g.fillStyle = "#ffd36b"; g.fillText(t, VW - 24, 120); }
    if (S.bannerT > 0) { g.textAlign = "center"; g.font = "800 26px 'Noto Sans KR', sans-serif"; g.globalAlpha = Math.min(1, S.bannerT / 0.4); g.lineWidth = 5; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(S.banner, VW / 2, 170); g.fillStyle = "#fff1d0"; g.fillText(S.banner, VW / 2, 170); g.globalAlpha = 1; }
    if (H.hp <= 0 && C.party && !S.over) { g.textAlign = "center"; g.font = "800 20px 'Noto Sans KR', sans-serif"; g.fillStyle = "#ff8a7a"; g.fillText("쓰러졌어요 — 파티원이 이기면 같이 보상을 받아요", VW / 2, 220); }
    if (!touch) { // 물약 빠른 칸 — 가운데 아래(휴대폰은 「물약」 단추 하나로)
      const x0 = 150, y0 = VH - 58, W8 = POTS.length * 50 - 4, cxm = x0 + W8 / 2;
      g.fillStyle = "rgba(10,8,8,.55)"; if (g.roundRect) { g.beginPath(); g.roundRect(x0 - 8, y0 - 36, W8 + 16, 94, 10); g.fill(); } else g.fillRect(x0 - 8, y0 - 36, W8 + 16, 94);
      gauge(g, "hp", x0 - 8, y0 - 37, W8 / 2 + 12, H.hp / H.max, Math.ceil(H.hp) + " / " + H.max, H.hp / H.max > 0.3 ? "hp" : "low"); gauge(g, "mp", x0 + W8 / 2 - 4, y0 - 37, W8 / 2 + 12, H.mp / H.mpMax, Math.floor(H.mp) + " / " + H.mpMax); // 체력 · 마력 나란히
      POTS.forEach((k, i) => { const x = x0 + i * 50, y = y0, r = FR.items && FR.items[k], n = S.potions[k] || 0;
        g.fillStyle = "rgba(30,26,30,.85)"; g.fillRect(x, y, 46, 40); g.strokeStyle = n ? (k.startsWith("mp") ? "#4a7ac8" : "#8a7a5a") : "#3a3434"; g.lineWidth = 1; g.strokeRect(x, y, 46, 40);
        if (r && IMG.items.complete) { const kk = 32 / Math.max(r[2], r[3]); g.globalAlpha = n ? 1 : 0.3; g.drawImage(IMG.items, r[0], r[1], r[2], r[3], x + 23 - r[2] * kk / 2, y + 20 - r[3] * kk / 2, r[2] * kk, r[3] * kk); g.globalAlpha = 1; }
        if (S.potCd > 0 && n) { g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(x, y + 40 * (1 - S.potCd), 46, 40 * S.potCd); }
        g.textAlign = "right"; g.font = "800 12px 'Noto Sans KR', sans-serif"; g.lineWidth = 3; g.strokeStyle = "#000"; g.strokeText(String(n), x + 44, y + 38); g.fillStyle = "#fff"; g.fillText(String(n), x + 44, y + 38);
        g.textAlign = "center"; g.font = "700 9px sans-serif"; g.fillStyle = "#c9c2b0"; g.fillText(KEYS.label("q" + (i + 1)), x + 23, y + 51); });
    }
    { /* 대시 칸 — 스킬 칸 왼쪽(휴대폰은 위 오른쪽). 점 = 남은 횟수, 차는 중이면 아래에서 차오름 */
      const n = S.dashN == null ? DASH_MAX : S.dashN, x = touch ? VW - 70 : VW - 300 - 62, y = touch ? 60 : VH - 66, cx2 = x + 28, cy2 = y + 28;
      g.save(); g.beginPath(); g.arc(cx2, cy2, 24, 0, Math.PI * 2); g.fillStyle = "rgba(15,12,20,.8)"; g.fill(); g.lineWidth = 2; g.strokeStyle = n ? "rgba(120,200,255,.8)" : "rgba(220,210,190,.35)"; g.stroke(); g.clip();
      if (n < DASH_MAX) { const p = (S.dashRe || 0) / DASH_CD; g.fillStyle = "rgba(90,170,255,.28)"; g.fillRect(x, y + 56 * (1 - p), 56, 56 * p); }
      g.fillStyle = n ? "#cfe8ff" : "rgba(207,232,255,.4)"; g.font = "900 20px sans-serif"; g.textAlign = "center"; g.fillText("»", cx2, cy2 + 5); g.restore();
      for (let k = 0; k < DASH_MAX; k++) { g.beginPath(); g.arc(cx2 - 6 + k * 12, y + 62, 4, 0, Math.PI * 2); g.fillStyle = k < n ? "#7fd0ff" : "rgba(255,255,255,.18)"; g.fill(); }
      g.fillStyle = "#e8e2d0"; g.font = "800 10px 'Noto Sans KR', sans-serif"; g.textAlign = "center"; g.fillText("대시", cx2, y - 3);
    }
    if (!touch) for (let slot = 0; slot < 7; slot++) { // 둥근 스킬 칸 — 위 1·2·3·궁극, 아래 4·5·6 (스킬창에서 끌어다 바꿈)
      const i = S.slots[slot], sk = SKILL[i], ult = slot === 6, x = VW - 300 + (slot < 3 ? slot * 62 + 31 : ult ? 3 * 62 + 31 : (slot - 3) * 62), y = slot < 3 || ult ? VH - 128 : VH - 66, R = ult ? 28 : 26;
      g.save(); g.beginPath(); if (ult) { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + 28 + Math.cos(a) * (R + 3), y + 28 + Math.sin(a) * (R + 3)); } g.closePath(); } else g.arc(x + 28, y + 28, R, 0, Math.PI * 2);
      g.fillStyle = "rgba(15,12,20,.8)"; g.fill(); g.lineWidth = ult ? 3 : 2; g.strokeStyle = ult ? "#ffcf4a" : "rgba(220,210,190,.55)"; if (ult) { g.shadowColor = "rgba(255,200,60,.9)"; g.shadowBlur = 12; } g.stroke(); g.shadowBlur = 0; g.clip();
      if (sk) { const lock = S.learned && !S.learned.includes(i); skIcon(g, sk, x + 28, y + 28, 56, lock ? 0.15 : S.cd[i] > 0 ? 0.4 : 1);
        if (S.cd[i] > 0) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x, y + 56 * (1 - S.cd[i] / sk.cd), 56, 56 * S.cd[i] / sk.cd); g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "800 16px sans-serif"; g.fillText(Math.ceil(S.cd[i]), x + 28, y + 34); } }
      g.restore();
      const lab = KEYS.label(ACTS[slot]); g.fillStyle = "rgba(0,0,0,.75)"; g.fillRect(x + 36, y + 42, 18, 15); g.fillStyle = "#e8e2d0"; g.textAlign = "center"; g.font = "800 11px sans-serif"; g.fillText(lab.length > 2 ? lab.slice(0, 2) : lab, x + 45, y + 54);
    }
  }
  return { HERO_ORDER, ALL_SKILLS, /* 화면을 눌렀을 때 — 차원의 문을 누르면 들어감(화면 좌표 x, y) */ click(x, y) { if (S && S.D.tower && S.rest > 0 && !S.spawned && !S.over && !C.watch) { S.rest = 0; return true; } /* 무한의 탑 쉬는 시간 — 화면을 누르면 바로 다음 층(휴대폰엔 말걸기 단추가 없어 30초를 다 쉬어야 했다, 2026-10-27) */ if (!S || !S.door || S.over || C.watch) return false; const dx = DOOR_X - S.camX; if (Math.abs(x - dx) < 90 && y > Z0 - 230 && y < Z0 + 60) { useDoor(); return true; } return false; }, get room() { return S && S.room; }, lootText(t2) { if (S) num(S.hero.x, S.hero.z - S.hero.h - 125, t2, "#ffe08a"); }, duelWon() { if (S && !S.over) { S.over = true; S.win = true; S.endT = 1.6; banner("승리!"); } }, gmAura: (g, x, y) => gmAura(g, x, y, performance.now() / 1000), start, step, draw, net, MON, DUN, SKILLS, get SKILL() { return SKILL; }, get S() { return S; }, quit() { if (S) S.ended = true; S = null; }, addRemote(p) { if (!S || S.remote[p.id]) return; if (!C.party) C.party = { host: C.me, members: [] }; S.spec = true; /* 혼자 하던 판에 운영자가 들어오면 그때부터 주고받음 */ S.remote[p.id] = { id: p.id, nick: p.nick, look: p.look, gear: p.gear, op: !!p.op, x: S.hero.x - 60, z: S.hero.z, h: 0, face: 1, st: "idle", t: 0, step: 0, walk: 0, hp: 1, max: 1, tx: S.hero.x - 60, tz: S.hero.z, th: 0, alive: true, inv: 0 }; }, watched() { if (S) S.spec = true; } };
})();

/* ── 배경 — 마을 · 던전마다. 제미나이 맵 그림(img/maps/<이름>.jpg, frames.js 의 MAPS 에 적힌 것)이 있으면 그것을, 없으면 코드로 그린다
   그림은 끝이 서로 안 맞으므로 한 번은 그대로, 한 번은 좌우를 뒤집어 번갈아 붙인다(뒤집으면 끝끼리 똑같이 맞닿음).
   GF = 그림에서 땅이 시작하는 높이(0~1) — 그 줄이 게임 바닥(Z0)쯤 오게 그림을 위로 올리고 키운다 ── */
const BG = (() => {
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || "";
  const pics = {}, GF = { town: 0.79, gate: 0.78, forest: 0.8, goblin: 0.72, wolf: 0.76, orc: 0.7, castle: 0.73 };
  (window.MAPS || []).forEach((n) => { const i = new Image(); i.src = "img/maps/" + n + ".webp" + (V ? "?v=" + V : ""); pics[n] = i; });
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
    let stopX = Infinity, base = 0, we = 0, fw = 0;
    if (E) { we = E.naturalWidth * h / E.naturalHeight; fw = we * (o.end.fade == null ? 0.25 : o.end.fade); stopX = o.end.at - o.end.f * we; base = stopX + fw; } // 마지막 그림은 앞 그림과 fw 만큼 겹쳐 서서히 바뀜
    const n0 = Math.floor((sx - base) / w);
    for (let n = n0; ; n++) { const wx = base + n * w; if (wx - sx > VW || (E && wx >= base)) break; tile(g, P, wx - sx, w, y, h, (n & 1) !== 0); } // 끝 그림이 없으면 끝없이 이어 붙임
    if (E && stopX - sx < VW) g.drawImage(fw ? faded(E, o.end.fade == null ? 0.25 : o.end.fade) : E, stopX - sx, y, we + 1, h);
  }
  const fades = new Map();
  function faded(P, f) { // 왼쪽 f 만큼 투명 → 불투명으로 — 그림끼리 이음새 없이 겹치기
    let c = fades.get(P); if (c) return c;
    c = document.createElement("canvas"); c.width = P.naturalWidth; c.height = P.naturalHeight; const t = c.getContext("2d");
    t.drawImage(P, 0, 0); const gr = t.createLinearGradient(0, 0, c.width * f, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
    t.globalCompositeOperation = "destination-in"; t.fillStyle = gr; t.fillRect(0, 0, c.width * f, c.height);
    fades.set(P, c); return c;
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
