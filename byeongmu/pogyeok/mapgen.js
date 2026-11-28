// 경기 지형 만들기 (서버·화면 공용): 같은 설정이면 서버와 모든 화면이 똑같은 땅을 만든다.
//   kind 'random' | 'maze' : 원본 생성기(landgen.js) → 놀이 상자만 잘라냄 → 테두리 → 테마 장식(원본 uLandObjects.pas 방식)
//   kind 'image'           : 원본 이미지 맵(map.png + mask.png 를 미리 계산한 land.json)
// 땅 값: 0 빈칸, 1 땅, 2 부서지지 않는 땅(테두리·빨강 마스크)
// 장식 배치(TryPut/CheckLand/CheckCanPlace/AddThemeObjects)와 테두리 규칙은 hedgewars/uLandObjects.pas, uLand.pas(GenMap)를
// 읽고 JS로 옮긴 것이라 이 파일도 GNU GPL v2 (or later) 를 따른다. Copyright (C) Hedgewars Project.
(function (root) {
  'use strict';
  const Sim = root.Sim || require('./sim.js');
  const LandGen = root.LandGen || require('./landgen.js');
  const PAD = 65;                // 땅 아래 물 공간 (물 높이 = 원본 그림/템플릿 높이 = 원본 cWaterLine)
  const BORDER = 6;              // cBorderWidth
  const OBJ = 3;                 // 배치 중 장식 표시(끝나면 1): 원본 lfObject 는 lfBasic 과 다르게 취급됨

  function unrle(runs, n) {
    const a = new Uint8Array(n); let p = 0;
    for (let i = 0; i < runs.length; i += 2) { const v = runs[i], c = runs[i + 1]; if (v) a.fill(v, p, p + c); p += c; }
    return a;
  }
  function blank(W, H0) { const m = new Uint8Array(W * (H0 + PAD)); m.W = W; m.H = H0 + PAD; m.waterY = H0; return m; }

  // ---- 장식 (uLandObjects.pas) ----
  // CheckLand: 사각형 테두리 픽셀이 모두 color (원본과 같은 픽셀만 검사: 짝수 폭이면 가운데 한 칸은 안 봄)
  function checkLand(m, W, H0, r, dX, dY, color) {
    const x0 = r[0] + dX, y0 = r[1] + dY, bx = x0 + r[2], by = y0 + r[3];
    const kx = bx - (r[2] >> 1) - 1;
    if (kx >= x0) {
      if (y0 < 0 || by >= H0 || x0 < 0 || bx >= W) return false;
      const r0 = y0 * W, r1 = by * W;
      for (let tx = x0, tx2 = bx; tx <= kx; tx++, tx2--) {
        if (m[r0 + tx] !== color || m[r1 + tx] !== color || m[r0 + tx2] !== color || m[r1 + tx2] !== color) return false;
      }
    }
    const ky = by - (r[3] >> 1) - 1;
    if (ky >= y0 + 1) {
      if (y0 + 1 < 0 || by - 1 >= H0 || x0 < 0 || bx >= W) return false;
      for (let ty = y0 + 1, ty2 = by - 1; ty <= ky; ty++, ty2--) {
        const a = ty * W, b = ty2 * W;
        if (m[a + x0] !== color || m[a + bx] !== color || m[b + x0] !== color || m[b + bx] !== color) return false;
      }
    }
    return true;
  }
  function checkLandAny(m, W, H0, r, dX, dY) {            // CheckLandAny: 테두리에 땅이 하나라도
    const x0 = r[0] + dX, y0 = r[1] + dY, bx = x0 + r[2] - 1, by = y0 + r[3] - 1;
    if (x0 < 0 || y0 < 0 || bx >= W || by >= H0) return false;
    for (let x = x0; x <= bx; x++) if (m[y0 * W + x] || m[by * W + x]) return true;
    for (let y = y0; y <= by; y++) if (m[y * W + x0] || m[y * W + bx]) return true;
    return false;
  }
  function canPlace(m, W, H0, rects, x, y, o) {
    const inl = o.inland, outl = o.outland, an = o.anchors;
    for (let i = 0; i < inl.length; i++) if (!checkLand(m, W, H0, inl[i], x, y, 1)) return false;
    for (let i = 0; i < outl.length; i++) if (!checkLand(m, W, H0, outl[i], x, y, 0)) return false;
    if (an && an.length) { let ok = false; for (let i = 0; i < an.length && !ok; i++) ok = checkLandAny(m, W, H0, an[i], x, y); if (!ok) return false; }
    for (let i = 0; i < rects.length; i++) { const q = rects[i]; if (q[0] < x + o.w && x < q[0] + q[2] && q[1] < y + o.h && y < q[1] + q[3]) return false; }
    return true;
  }
  function tryPut(m, H0, rects, o, rnd, placed, idx) {
    if (o.left === 0) return false;
    const W = m.W, pts = [];
    const fixedBottom = o.inland.length && o.inland[0].every(v => v === 0);
    let x = 0;
    do {
      let y = 32;                                         // topY + 32: 고슴도치가 순간이동해 올 자리
      do {
        if (fixedBottom) y = H0 - o.h;
        if (canPlace(m, W, H0, rects, x, y, o)) { pts.push(x, y); if (pts.length >= 4096) { x = W; y = H0; } }
        y += 3;
      } while (y < H0 - o.h);
      x += Math.floor(rnd() * 6) + 3;
    } while (x < W - o.w);
    if (!pts.length) { o.left = 0; return false; }
    const i = Math.floor(rnd() * (pts.length / 2)), px = pts[i * 2], py = pts[i * 2 + 1];
    stamp(m, o, px, py);
    rects.push([px, py, o.w, o.h]);
    placed.push([idx, px, py]);
    o.left--;
    return true;
  }
  function stamp(m, o, px, py) {
    const W = m.W, mk = o._mask || (o._mask = unrle(o.mask, o.w * o.h));
    for (let yy = 0; yy < o.h; yy++) {
      const row = (py + yy) * W;
      for (let xx = 0; xx < o.w; xx++) { const v = mk[yy * o.w + xx]; if (v && !m[row + px + xx]) m[row + px + xx] = v === 2 ? 2 : OBJ; }
    }
  }
  // 화면용: 서버가 보낸 배치 목록을 그대로 찍음 (자리 찾기 계산은 생략: 결과가 같은지는 땅 수로 확인)
  function applyPlaced(m, theme, placed) {
    for (const [i, x, y] of placed) { const o = theme && theme.objects[i]; if (o) stamp(m, o, x, y); }
    for (let i = 0; i < m.length; i++) if (m[i] === OBJ) m[i] = 1;
    return placed;
  }
  function addObjects(m, H0, theme, maxHogs, rnd) {
    const objs = (theme && theme.objects) || [];
    const placed = [];
    if (!objs.length) return placed;
    for (const o of objs) o.left = Math.max(1, Math.floor(o.maxcnt * maxHogs / 18));
    const rects = [];
    let b;
    do {
      const t = Math.floor(rnd() * objs.length); b = false;
      for (let i = 0; i < objs.length; i++) { const ii = (i + t) % objs.length; if (objs[ii].left !== 0) b = tryPut(m, H0, rects, objs[ii], rnd, placed, ii) || b; }
    } while (b);
    for (let i = 0; i < m.length; i++) if (m[i] === OBJ) m[i] = 1;
    return placed;
  }

  // ---- 테두리 (uLand.pas GenMap: 맨 위 6줄에 땅이 폭의 절반을 넘으면 위·왼쪽·오른쪽에 부서지지 않는 줄무늬 테두리) ----
  function addBorder(m, H0) {
    const W = m.W; let c = 0;
    for (let y = 0; y <= 5; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) c++;
    if (c <= W / 2) return false;
    for (let y = 0; y < H0; y++) for (let w = 0; w < BORDER; w++) { m[y * W + w] = 2; m[y * W + W - 1 - w] = 2; }
    for (let w = 0; w < BORDER; w++) m.fill(2, w * W, (w + 1) * W);
    return true;
  }

  // spec: { kind, sub, seed, hogs }, data: { templates, theme(theme.json), image(land.json) }
  // 쉬움 지도 고르기 (10차 묶음 1, 사용자 요청: 더 평평하게: 처마처럼 튀어나온 곳·깊은 골·동굴·떠 있는 섬 없앰)
  // 원본 생성기가 만든 땅의 칸별 맨 위 높이를 재서 → 빈 칸(골·물 틈)은 양옆 높이를 이어 메우고 → 넓게 고르게(이동 평균 두 번)
  // → 높낮이를 amp 배로 줄이고 → 그 높이 아래를 모두 땅으로 채움. 서버·화면이 같은 코드로 같은 땅을 만든다.
  function flatten(m, H0, opt) {
    const W = m.W, amp = opt.amp != null ? opt.amp : 0.4, rad = opt.rad || 90;
    const top = new Float64Array(W), has = new Uint8Array(W);
    for (let x = 0; x < W; x++) for (let y = 0; y < H0; y++) if (m[y * W + x]) { top[x] = y; has[x] = 1; break; }
    let prev = -1;
    for (let x = 0; x <= W; x++) {
      if (x < W && !has[x]) continue;
      if (prev < 0 && x < W) { for (let i = 0; i < x; i++) top[i] = top[x]; }
      else if (x === W) { for (let i = prev + 1; i < W; i++) top[i] = prev >= 0 ? top[prev] : H0 * 0.6; }
      else for (let i = prev + 1; i < x; i++) top[i] = top[prev] + (top[x] - top[prev]) * (i - prev) / (x - prev);
      prev = x;
    }
    const avg = (src) => { const out = new Float64Array(W); let s = 0; const n = (i) => src[Math.max(0, Math.min(W - 1, i))];
      for (let i = -rad; i <= rad; i++) s += n(i);
      for (let x = 0; x < W; x++) { out[x] = s / (2 * rad + 1); s += n(x + rad + 1) - n(x - rad); }
      return out; };
    let h = avg(avg(top));
    const sorted = Array.from(h).sort((a, b) => a - b), med = sorted[W >> 1];
    const lo = Math.round(H0 * 0.3), hi = H0 - 60;
    m.fill(0, 0, H0 * W);
    for (let x = 0; x < W; x++) {
      const y0 = Math.max(lo, Math.min(hi, Math.round(med + (h[x] - med) * amp)));
      for (let y = y0; y < H0; y++) m[y * W + x] = 1;
    }
  }
  function build(spec, data) {
    let m, H0, maxHogs, typeName = spec.sub || '';
    if (spec.kind === 'image') {
      const im = data.image; H0 = im.h;
      m = blank(im.w, H0);
      m.set(unrle(im.runs, im.w * im.h), 0);
      maxHogs = im.maxHogs || 18;
    } else {
      const L = LandGen.generate(data.templates, spec.kind, spec.seed, spec.hogs, spec.sub);
      const b = L.box, W = b.r - b.l + 1; H0 = b.b - b.t + 1;
      m = blank(W, H0);
      for (let y = 0; y < H0; y++) m.set(L.subarray((b.t + y) * L.W + b.l, (b.t + y) * L.W + b.l + W), y * W);
      maxHogs = L.maxHogs; typeName = L.typeName;
    }
    if (spec.flat && spec.kind !== 'image') flatten(m, H0, spec.flat);
    m.border = addBorder(m, H0);
    if (data.keepBase) m.base = m.slice();      // 화면용: 장식 넣기 전 땅 (땅 무늬는 여기에만 칠함)
    m.objects = spec.kind === 'image' ? [] : data.placed ? applyPlaced(m, data.theme, data.placed) : addObjects(m, H0, data.theme, maxHogs, Sim.rng32((spec.seed ^ 0x2545f491) >>> 0));
    m.kind = spec.kind; m.typeName = typeName; m.maxHogs = maxHogs;
    return m;
  }
  function landCount(m) { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; }

  const MapGen = { build, unrle, landCount, PAD, BORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = MapGen; else root.MapGen = MapGen;
})(typeof window !== 'undefined' ? window : globalThis);
