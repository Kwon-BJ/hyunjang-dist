/* 내 캐릭터 그리기 — 남 · 여 기본 몸에 얼굴형 · 머리 · 눈 · 눈썹 · 코 · 입 · 피부 · 얼굴 장식 · 옷 색을 겹쳐 그린다 (2026-10-27).
   제미나이 부위 그림이 오기 전까지 쓰는 코드 그림. 발 가운데가 (0,0), 오른쪽을 본다. pose = { st, t, walk, step }
   st: idle · walk · run · atk(step 0~2) · airatk · jump · cast · dash · hit · fall · down · dead */
"use strict";
/* 기본 캐릭터 — 연병장 다섯 명. 내 캐릭터는 이 중 하나의 모습(look.hero) */
const HEROES = [["kh", "강혁", "무사", "m"], ["hr", "혜린", "도사", "f"], ["ds", "대성", "수호자", "m"], ["je", "지은", "사수", "f"], ["mj", "무진", "자객", "m"]];
const HERO_IMG = (() => { const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || ""; const i = new Image(); i.src = "img/heroes5.png" + (V ? "?v=" + V : ""); return i; })();
/* 동작 → 그림 칸 · 몸 가운데 자리(칼 · 활이 앞으로 뻗은 칸은 몸이 왼쪽에 있음) */
const HERO_AX = { atk1: 0.38, atk2: 0.42, atk3: 0.34, fall: 0.5, dead: 0.5 };
function heroFrame(st, pose) {
  if (st === "atk") return ["atk1", "atk2", "atk3"][pose.step | 0] || "atk1";
  if (st === "airatk") return "atk2"; if (st === "cast" || st === "dash") return "atk3";
  if (st === "walk" || st === "run") return Math.floor((pose.walk || 0) / Math.PI) % 2 ? "side2" : "side";
  if (st === "jump") return "side2"; if (st === "hit") return "hit"; if (st === "fall" || st === "roll") return "fall";
  if (st === "down" || st === "dead") return "dead"; if (st === "front") return "front";
  return "idle";
}
function heroOf(L) { const h = L && L.hero; return HEROES.some((x) => x[0] === h) ? h : (L && L.g === "f" ? "hr" : "kh"); }
function drawHero(g, L, pose, sc) {
  const F = FR.heroes && FR.heroes[heroOf(L)]; if (!F || !HERO_IMG.complete || !HERO_IMG.naturalWidth) return false;
  const n = heroFrame(pose.st, pose), r = F[n] || F.idle || F.front, k = sc * 0.95, ax = HERO_AX[n] || 0.5;
  const bob = pose.st === "idle" ? Math.sin((pose.t || 0) * 3) * 1.2 : (pose.st === "walk" || pose.st === "run") ? -Math.abs(Math.sin(pose.walk || 0)) * 2 : 0;
  g.drawImage(HERO_IMG, r[0], r[1], r[2], r[3], -r[2] * k * ax, -r[3] * k + 2 + bob, r[2] * k, r[3] * k);
  return true;
}

const LOOK = {
  parts: [
    ["face", "얼굴형", ["둥근", "갸름한", "각진"]],
    ["hair", "머리 모양", null],
    ["hc", "머리색", null],
    ["eye", "눈", ["둥근 눈", "날카로운 눈", "큰 눈", "졸린 눈", "치켜뜬 눈", "감은 눈"]],
    ["ec", "눈동자", null],
    ["brow", "눈썹", ["일자", "짙은", "둥근", "치켜올린"]],
    ["nose", "코", ["작은", "둥근", "오똑한", "매부리"]],
    ["mouth", "입", ["미소", "다문 입", "활짝", "외침", "굳은 입", "삐죽"]],
    ["skin", "피부", null],
    ["mark", "얼굴 장식", null],
    ["oc", "옷 색", null],
  ],
  HAIR: { m: ["상투", "짧은 머리", "꽁지머리", "더벅머리", "머리띠", "넘긴 긴머리"], f: ["땋은 머리", "단발", "쪽진 머리", "긴 생머리", "양갈래", "포니테일"] },
  MARK: { m: ["없음", "흉터", "점", "수염", "붉은 문신", "반창고"], f: ["없음", "흉터", "점", "볼터치", "붉은 문신", "반창고"] },
  SKIN: ["#f6d7b8", "#efc39b", "#d9a274", "#b97a4f", "#8d5a3b"],
  HC: ["#1b1b22", "#4a2e1c", "#8a5a2b", "#c99a4e", "#e8e4dc", "#b2322a", "#2f4f8a", "#6a3d8a"],
  EC: ["#1d2433", "#5a3a1c", "#2f6db0", "#2e8a52", "#a3262c"],
  OC: ["#8a2a1c", "#1f3f6b", "#2e5a3a", "#3a3a44", "#6b4a8a", "#d8d0c0"],
  count(k, g) { return { face: 3, hair: 6, hc: 8, eye: 6, ec: 5, brow: 4, nose: 4, mouth: 6, skin: 5, mark: 6, oc: 6 }[k]; },
  label(k, i, g) {
    if (k === "hair") return LOOK.HAIR[g][i];
    if (k === "mark") return LOOK.MARK[g][i];
    const P = LOOK.parts.find((p) => p[0] === k); return P && P[2] ? P[2][i] : null;
  },
  color(k, i) { return { hc: LOOK.HC, ec: LOOK.EC, skin: LOOK.SKIN, oc: LOOK.OC }[k] ? { hc: LOOK.HC, ec: LOOK.EC, skin: LOOK.SKIN, oc: LOOK.OC }[k][i] : null; },
  random() { const H = HEROES[Math.floor(Math.random() * HEROES.length)], g = H[3], o = { g, hero: H[0] }; LOOK.parts.forEach(([k]) => { o[k] = Math.floor(Math.random() * LOOK.count(k, g)); }); return o; },
  base(g) { return { g: g || "m", hero: g === "f" ? "hr" : "kh", face: 0, hair: 0, hc: 0, eye: 0, ec: 0, brow: 0, nose: 0, mouth: 0, skin: 0, mark: 0, oc: 0 }; },
};

function shade(hex, k) { // k < 0 어둡게, > 0 밝게
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("");
}

function drawChar(g, L, pose, sc, opt) {
  L = L || LOOK.base("m"); pose = pose || { st: "idle", t: 0 }; opt = opt || {};
  if (drawHero(g, L, pose, sc)) return; // 기본 캐릭터 그림(없으면 아래 코드 그림)
  const st = pose.st, t = pose.t || 0, fem = L.g === "f", OUT = "#1a1012";
  const skin = LOOK.SKIN[L.skin] || LOOK.SKIN[0], hair = LOOK.HC[L.hc] || LOOK.HC[0], cloth = LOOK.OC[L.oc] || LOOK.OC[0], eyeC = LOOK.EC[L.ec] || LOOK.EC[0];
  const pants = "#2a2430", boot = "#3a2a1e";
  g.save(); g.scale(sc, sc); g.lineJoin = "round"; g.lineCap = "round";
  // 몸 전체 기울기 · 눕기
  let lean = 0, bodyY = 0;
  if (st === "hit") lean = -0.25;
  if (st === "fall") { g.rotate(-0.9); bodyY = -6; }
  if (st === "down" || st === "dead") { g.translate(0, -6); g.rotate(-Math.PI / 2); g.translate(0, 0); }
  const walking = st === "walk" || st === "run";
  const ph = pose.walk || 0, swing = walking ? Math.sin(ph) * (st === "run" ? 0.8 : 0.55) : 0;
  const bob = walking ? -Math.abs(Math.cos(ph)) * 2 : st === "idle" ? Math.sin(t * 3) * 0.8 : 0;
  g.translate(0, bob + bodyY); g.rotate(lean);
  /* 팔 각도(0 = 오른쪽, π/2 = 아래) — 칼 든 앞팔 */
  let front = Math.PI / 2 - 0.25 - swing * 0.6, back = Math.PI / 2 + 0.2 + swing * 0.6;
  const p = Math.min(1, t / 0.18);
  if (st === "atk") {
    if (pose.step === 0) front = -2.3 + p * 3.2;           // 위 뒤에서 앞 아래로 베기
    else if (pose.step === 1) front = 1.0 - p * 2.6;       // 아래에서 위로 올려 베기
    else front = 1.3 - p * 3.9;                             // 크게 올려 띄우기
    back = Math.PI / 2 + 0.6;
  } else if (st === "airatk") front = -1.8 + Math.min(1, t / 0.15) * 3.0;
  else if (st === "cast") { front = -0.15; back = -0.3; }
  else if (st === "dash") { front = 0.1; back = 2.6; }
  else if (st === "jump") { front = -0.6; back = 3.6; }
  else if (st === "hit") { front = 2.2; back = 2.6; }
  const legL = walking ? swing : st === "jump" || st === "airatk" ? -0.7 : st === "atk" ? -0.25 : 0;
  const legR = walking ? -swing : st === "jump" || st === "airatk" ? 0.5 : st === "atk" ? 0.35 : 0;
  const hipY = -26, shY = -54, hx = 2, hy = -80;
  const limb = (x, y, a, len, w, col, end) => { // 한 마디 — 끝 자리를 돌려줌
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    g.strokeStyle = OUT; g.lineWidth = w + 3; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
    if (end) { g.fillStyle = end; g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.arc(ex, ey, w * 0.55, 0, Math.PI * 2); g.fill(); g.stroke(); }
    return [ex, ey];
  };
  const leg = (x, a, far) => { // 다리 — 엉덩이에서
    const [kx, ky] = limb(x, hipY, Math.PI / 2 + a, 14, 8, far ? shade(pants, -0.25) : pants);
    const [fx, fy] = limb(kx, ky, Math.PI / 2 + a * 0.4, 12, 7.5, far ? shade(pants, -0.25) : pants);
    g.fillStyle = far ? shade(boot, -0.25) : boot; g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.ellipse(fx + 3, fy + 1, 6, 3.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  };
  const arm = (a, far, sword) => {
    const sx = far ? -4 : 5, col = far ? shade(cloth, -0.25) : cloth;
    const [ex, ey] = limb(sx, shY, a, 13, 7, col);
    const [hx2, hy2] = limb(ex, ey, a + (sword ? -0.35 : 0.25), 11, 6, col, far ? shade(skin, -0.15) : skin);
    if (sword) { // 칼 — 손에서 팔 방향 조금 위로
      const sa = a - 0.55, bx = hx2 + Math.cos(sa) * 40, by = hy2 + Math.sin(sa) * 40;
      g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = "#e6edf5"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(hx2 + Math.cos(sa) * 6, hy2 + Math.sin(sa) * 6); g.lineTo(bx, by); g.stroke();
      g.strokeStyle = "#c9a24a"; g.lineWidth = 3; g.beginPath(); g.moveTo(hx2 + Math.cos(sa + 1.57) * 5, hy2 + Math.sin(sa + 1.57) * 5); g.lineTo(hx2 - Math.cos(sa + 1.57) * 5, hy2 - Math.sin(sa + 1.57) * 5); g.stroke();
      if (opt.glow) { g.strokeStyle = "rgba(255,160,60,.55)"; g.lineWidth = 9; g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(bx, by); g.stroke(); }
    }
  };
  arm(back, true, false);
  leg(-4, legL, true);
  /* 몸통 — 도복(여자는 아래가 퍼지는 치마 도복) */
  const sw = fem ? 10 : 12;
  g.fillStyle = cloth; g.strokeStyle = OUT; g.lineWidth = 2.5;
  g.beginPath();
  if (fem) { g.moveTo(-sw, shY + 2); g.lineTo(sw, shY + 2); g.lineTo(sw - 2, hipY - 6); g.lineTo(sw + 5, hipY + 10); g.lineTo(-sw - 5, hipY + 10); g.lineTo(-sw + 2, hipY - 6); }
  else { g.moveTo(-sw, shY + 2); g.lineTo(sw, shY + 2); g.lineTo(sw - 1, hipY + 2); g.lineTo(-sw + 1, hipY + 2); }
  g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = shade(cloth, 0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(-3, shY + 2); g.lineTo(5, shY + 14); g.stroke(); // 깃
  g.fillStyle = "#1c1418"; g.fillRect(-sw + 1, hipY - 8, sw * 2 - 2, 4); g.fillStyle = "#c9a24a"; g.fillRect(-1, hipY - 8, 3, 4); // 띠
  leg(4, legR, false);
  /* 머리 — 제미나이 그림이 있으면 그것(머리 모양 그림 위에 눈 · 눈썹 · 코 · 입 · 장식 그림), 없으면 코드 그림 */
  const dead = st === "dead" || st === "down";
  if (headPic(g, L, hx, hy, skin, hair, eyeC, dead || st === "hit")) { arm(front, false, true); g.restore(); return; }
  hairDraw(g, L, hx, hy, hair, OUT, "back");
  g.fillStyle = skin; g.strokeStyle = OUT; g.lineWidth = 2.5; g.fillRect(-3, shY - 6, 7, 8); // 목
  g.beginPath();
  if (L.face === 1) g.ellipse(hx, hy + 1, 18, 22, 0, 0, Math.PI * 2);
  else if (L.face === 2 && g.roundRect) g.roundRect(hx - 20, hy - 20, 40, 41, 9);
  else g.arc(hx, hy, 21, 0, Math.PI * 2);
  g.fill(); g.stroke();
  g.fillStyle = shade(skin, -0.1); g.beginPath(); g.ellipse(hx - 9, hy + 4, 3.5, 5, 0, 0, Math.PI * 2); g.fill(); // 귀
  face(g, L, hx + 3, hy, eyeC, skin, OUT, dead || st === "hit");
  hairDraw(g, L, hx, hy, hair, OUT, "front");
  arm(front, false, true);
  g.restore();
}

/* ── 그림 머리 ── 회색 그림을 겹(s 피부 · h 두 번째 색 · l 그대로)으로 나눠 두었다가 색을 곱해 칠한다(색마다 한 번 만들어 둠).
   자리는 얼굴 칸의 앞 · 아래(코끝 · 턱) 를 기준으로 — 머리 모양마다 앞머리가 이마를 덮는 정도가 달라도 턱 · 코는 같은 자리 */
const PIC = (() => {
  const V = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || "";
  const im = (s) => { const i = new Image(); i.src = s + (V ? "?v=" + V : ""); return i; };
  return { m: im("img/hair-m.png"), f: im("img/hair-f.png"), face: im("img/face.png"), cache: new Map() };
})();
function tinted(img, r, col) { // 겹 하나를 col 색으로 — 캔버스를 만들어 둠
  const key = img.src + r.join() + col; let c = PIC.cache.get(key); if (c) return c;
  c = document.createElement("canvas"); c.width = r[2]; c.height = r[3]; const t = c.getContext("2d");
  t.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  if (col) { t.globalCompositeOperation = "multiply"; t.fillStyle = col; t.fillRect(0, 0, r[2], r[3]); t.globalCompositeOperation = "destination-in"; t.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); }
  if (PIC.cache.size > 400) PIC.cache.clear();
  PIC.cache.set(key, c); return c;
}
function layers(g, img, R, name, s, h, x, y, k, ax, ay) { // ax · ay = 그림의 어느 비율 자리를 (x, y) 에 둘지
  const r = R[name + "_l"]; if (!r) return; const w = r[2] * k, hh = r[3] * k, X = x - w * ax, Y = y - hh * ay;
  if (s) g.drawImage(tinted(img, R[name + "_s"], s), X, Y, w, hh);
  if (h) g.drawImage(tinted(img, R[name + "_h"], h), X, Y, w, hh);
  g.drawImage(tinted(img, r, null), X, Y, w, hh);
}
const HEAD_K = 0.3, FEAT_K = 0.42; // 머리 그림 → 화면 비율, 얼굴 부위 그림 → 머리 그림 비율
function headPic(g, L, hx, hy, skin, hair, eyeC, shut) {
  const sex = L.g === "f" ? "f" : "m", P = FR.parts && FR.parts["h" + sex], img = PIC[sex];
  if (!P || !img.complete || !img.naturalWidth || !PIC.face.complete || !PIC.face.naturalWidth) return false;
  const name = sex + (L.hair || 0), fb = P.meta[name], hr = P.rects[name + "_l"]; if (!fb || !hr) return false;
  const k = HEAD_K, fx = hx + 20, fy = hy + 27;              // 코끝 · 턱이 올 자리(코드 머리 둘레와 맞춤)
  const ox = fx - (fb[0] + fb[2]) * k, oy = fy - (fb[1] + fb[3]) * k;  // 머리 그림 왼쪽 위
  g.save(); g.translate(fx, fy); g.scale([1, 0.93, 1.06][L.face] || 1, 1); g.translate(-fx, -fy); // 얼굴형 — 폭만 조금
  layers(g, img, P.rects, name, skin, hair, ox, oy, k, 0, 0);
  const F = FR.parts.face.rects, fk = k * FEAT_K, at = (dx, dy) => [fx + dx * k, fy + dy * k];  // dx · dy = 머리 그림 픽셀(코끝 · 턱 기준)
  const brow = shade(hair, -0.15), mark = L.mark | 0;
  let [x, y] = at(-36, -70); layers(g, PIC.face, F, "eye" + (shut ? 5 : L.eye | 0), skin, eyeC, x, y, fk, 0.5, 0.5);
  [x, y] = at(-36, -95); layers(g, PIC.face, F, "brow" + (L.brow | 0), null, brow, x, y, fk, 0.5, 0.5);
  [x, y] = at(-2, -50); layers(g, PIC.face, F, "nose" + (L.nose | 0), skin, null, x, y, fk * 0.8, 0.85, 0.6);
  [x, y] = at(-26, -34); layers(g, PIC.face, F, "mouth" + (L.mouth | 0), null, L.mouth === 3 ? null : "#f4ece2", x, y, fk * (L.mouth === 3 ? 0.5 : 0.8), 0.55, 0.5);
  if (mark === 1 || mark === 2 || mark >= 4) { const n = { 1: 0, 2: 1, 4: 2, 5: 3 }[mark]; [x, y] = at(-62, -42); layers(g, PIC.face, F, "mark" + n, null, n === 3 ? "#ead2ae" : "#9a3a36", x, y, fk, 0.5, 0.5); }
  if (mark === 3 && sex === "m") { [x, y] = at(-30, -6); g.fillStyle = hair; g.strokeStyle = "#1a1012"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 14, y - 10); g.quadraticCurveTo(x - 2, y + 14, x + 10, y - 6); g.quadraticCurveTo(x - 2, y + 2, x - 14, y - 10); g.fill(); g.stroke(); }
  if (mark === 3 && sex === "f") { [x, y] = at(-48, -36); g.fillStyle = "rgba(240,110,120,.45)"; g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  return true;
}

function face(g, L, x, y, eyeC, skin, OUT, shut) {
  const E = L.eye, eyes = [[x - 4, y + 2, 0.8], [x + 8, y + 2, 1]];
  g.lineWidth = 2; g.strokeStyle = OUT;
  eyes.forEach(([ex, ey, k]) => {
    if (shut || E === 5) { g.beginPath(); g.arc(ex, ey + 1, 3 * k, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
    const h = [4.2, 2.6, 5.4, 2.2, 3.4][E] * k, w = [3, 3.6, 3.8, 3.2, 3.4][E] * k;
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, ey, w, h, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = eyeC; g.beginPath(); g.ellipse(ex + 0.8, ey + 0.3, w * 0.62, h * 0.75, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + 1.6, ey - h * 0.35, 1, 0, Math.PI * 2); g.fill();
    if (E === 3) { g.fillStyle = skin; g.fillRect(ex - w - 1, ey - h - 1, w * 2 + 2, h); g.beginPath(); g.moveTo(ex - w, ey); g.lineTo(ex + w, ey); g.stroke(); } // 졸린 눈 — 위 반을 덮음
    if (E === 4 || E === 1) { g.beginPath(); g.moveTo(ex - w - 1, ey - h + (E === 4 ? -1 : 1)); g.lineTo(ex + w + 1, ey - h + (E === 4 ? 2 : -1)); g.stroke(); }
  });
  // 눈썹
  g.lineWidth = [2, 3.4, 2, 2.4][L.brow]; g.strokeStyle = shade(LOOK.HC[L.hc] || "#222", -0.2);
  eyes.forEach(([ex, ey, k]) => { g.beginPath();
    if (L.brow === 2) g.arc(ex, ey - 4, 4 * k, Math.PI * 1.15, Math.PI * 1.85);
    else if (L.brow === 3) { g.moveTo(ex - 4 * k, ey - 9); g.lineTo(ex + 4 * k, ey - 6 - (ex > x ? 0 : 0)); }
    else { g.moveTo(ex - 4 * k, ey - 7.5); g.lineTo(ex + 4 * k, ey - 7.5); }
    g.stroke(); });
  // 코
  g.strokeStyle = shade(skin, -0.35); g.lineWidth = 1.8; g.beginPath();
  if (L.nose === 0) { g.fillStyle = shade(skin, -0.3); g.arc(x + 11, y + 8, 1.2, 0, Math.PI * 2); g.fill(); }
  else if (L.nose === 1) { g.moveTo(x + 10, y + 5); g.lineTo(x + 12, y + 9); g.lineTo(x + 10, y + 9.5); g.stroke(); }
  else if (L.nose === 2) { g.moveTo(x + 10, y + 2); g.lineTo(x + 14, y + 9); g.lineTo(x + 10.5, y + 10); g.stroke(); }
  else { g.moveTo(x + 10, y + 2); g.quadraticCurveTo(x + 16, y + 6, x + 12, y + 10); g.lineTo(x + 10, y + 10); g.stroke(); }
  // 입
  g.strokeStyle = "#6a2a24"; g.lineWidth = 2; g.beginPath(); const mx = x + 6, my = y + 14;
  if (L.mouth === 0) g.arc(mx, my - 2, 4, Math.PI * 0.2, Math.PI * 0.8);
  else if (L.mouth === 1) { g.moveTo(mx - 3.5, my); g.lineTo(mx + 3.5, my); }
  else if (L.mouth === 2) { g.fillStyle = "#7a2a2a"; g.moveTo(mx - 5, my - 1); g.quadraticCurveTo(mx, my + 7, mx + 5, my - 1); g.closePath(); g.fill(); }
  else if (L.mouth === 3) { g.arc(mx, my, 2.2, 0, Math.PI * 2); }
  else if (L.mouth === 4) { g.moveTo(mx - 4, my); g.quadraticCurveTo(mx + 1, my + 2, mx + 5, my - 2); }
  else { g.moveTo(mx - 4, my + 1); g.quadraticCurveTo(mx, my - 3, mx + 4, my + 1); }
  g.stroke();
  // 얼굴 장식
  const fem = L.g === "f";
  if (L.mark === 1) { g.strokeStyle = "#a33a3a"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + 4, y - 8); g.lineTo(x + 9, y + 6); g.moveTo(x + 4, y - 2); g.lineTo(x + 9, y - 3); g.stroke(); }
  if (L.mark === 2) { g.fillStyle = "#3a2a22"; g.beginPath(); g.arc(x + 12, y + 13, 1.3, 0, Math.PI * 2); g.fill(); }
  if (L.mark === 3 && !fem) { g.fillStyle = shade(LOOK.HC[L.hc] || "#222", 0); g.beginPath(); g.moveTo(x - 6, y + 10); g.quadraticCurveTo(x + 6, y + 26, x + 15, y + 12); g.quadraticCurveTo(x + 6, y + 18, x - 6, y + 10); g.fill(); }
  if (L.mark === 3 && fem) { g.fillStyle = "rgba(240,110,120,.45)"; g.beginPath(); g.ellipse(x + 11, y + 9, 3.5, 2.2, 0, 0, Math.PI * 2); g.ellipse(x - 5, y + 9, 3, 2, 0, 0, Math.PI * 2); g.fill(); }
}

/* 머리 — back(머리 뒤로 늘어지는 것) · front(정수리 · 앞머리) */
function hairDraw(g, L, x, y, col, OUT, layer) {
  const fem = L.g === "f", H = L.hair;
  g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 2.5;
  const blob = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); g.stroke(); };
  if (layer === "back") {
    if (!fem && H === 2) blob([[x - 14, y - 10], [x - 22, y + 4], [x - 26, y + 22], [x - 20, y + 24], [x - 15, y + 6]]);
    if (!fem && H === 5) blob([[x - 18, y - 6], [x - 22, y + 26], [x - 6, y + 30], [x - 2, y + 10]]);
    if (fem && H === 0) { blob([[x - 14, y - 4], [x - 20, y + 12], [x - 18, y + 40], [x - 12, y + 40], [x - 10, y + 8]]); g.fillStyle = "#c8323a"; g.fillRect(x - 20, y + 38, 9, 6); }
    if (fem && H === 1) blob([[x - 20, y - 8], [x - 22, y + 14], [x - 4, y + 16], [x - 4, y - 4]]);
    if (fem && H === 3) blob([[x - 20, y - 10], [x - 24, y + 46], [x - 2, y + 48], [x + 2, y + 6]]);
    if (fem && H === 4) { blob([[x - 16, y - 2], [x - 26, y + 6], [x - 30, y + 30], [x - 22, y + 30], [x - 18, y + 8]]); }
    if (fem && H === 5) blob([[x - 10, y - 20], [x - 24, y - 16], [x - 30, y + 14], [x - 22, y + 16], [x - 14, y - 6]]);
    return;
  }
  // 정수리 덮개 + 앞머리
  g.beginPath(); g.arc(x, y - 1, 23, Math.PI * 0.95, Math.PI * 2.05);
  const zig = (H === 3 && !fem) ? [[x + 22, y - 2], [x + 16, y - 10], [x + 12, y - 2], [x + 6, y - 12], [x + 2, y - 3], [x - 4, y - 12], [x - 9, y - 2], [x - 16, y - 8], [x - 22, y + 2]]
    : fem && (H === 1 || H === 3) ? [[x + 22, y + 4], [x + 16, y - 6], [x + 8, y - 2], [x + 2, y - 8], [x - 6, y - 2], [x - 14, y - 6], [x - 22, y + 10]]
    : [[x + 22, y - 4], [x + 14, y - 9], [x + 8, y - 5], [x, y - 10], [x - 8, y - 5], [x - 16, y - 8], [x - 22, y + 2]];
  zig.forEach(([a, b]) => g.lineTo(a, b));
  g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = shade(col, 0.3); g.lineWidth = 2; g.beginPath(); g.arc(x - 2, y - 6, 16, Math.PI * 1.2, Math.PI * 1.55); g.stroke(); // 윤기
  g.strokeStyle = OUT; g.lineWidth = 2.5; g.fillStyle = col;
  if (!fem && H === 0) { g.beginPath(); g.arc(x - 3, y - 26, 6.5, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = "#c9a24a"; g.fillRect(x - 7, y - 22, 8, 3); }
  if (!fem && H === 4) { g.fillStyle = "#c8323a"; g.fillRect(x - 22, y - 9, 44, 4); g.fillRect(x - 26, y - 8, 6, 12); }
  if (fem && H === 2) { g.beginPath(); g.arc(x - 12, y - 22, 9, 0, Math.PI * 2); g.fill(); g.stroke(); g.strokeStyle = "#c9a24a"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 24, y - 26); g.lineTo(x - 2, y - 18); g.stroke(); }
  if (fem && H === 4) { g.beginPath(); g.arc(x + 10, y - 16, 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  if (fem && H === 5) { g.fillStyle = "#c8323a"; g.fillRect(x - 15, y - 20, 6, 5); }
  if (fem && H === 0) { g.fillStyle = "#c8323a"; g.fillRect(x - 16, y - 4, 5, 5); }
}
