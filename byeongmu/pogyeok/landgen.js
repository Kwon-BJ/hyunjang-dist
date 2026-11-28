// 지형 생성기: 원본 Hedgewars 지형 생성 코드를 JS로 옮긴 것
// 출처: hedgewars-src/rust/landgen (outline_template_based/outline.rs, template_based.rs, maze.rs),
//       rust/land2d/src/lib.rs (Land2D::new, fill), rust/integral-geometry/src/lib.rs (Line·Polygon·Bezier),
//       rust/lib-hwengine-future/src/game_field.rs (distance_divisor), hedgewars/uLand.pas (SelectTemplate)
//       템플릿: share/hedgewars/Data/map_templates.yaml, maze_templates.yaml (→ maps/*.json)
// Copyright (C) Hedgewars Project. 이 파일은 원본 코드를 옮겨 적었으므로 GNU GPL v2 (or later) 를 따른다.
//
// 바뀐 점(이 게임용): 난수는 원본 LaggedFibonacciPRNG 대신 Sim.rng32(씨앗): 같은 씨앗이면 서버·모든 화면에서 같은 지형.
// 원본의 고정소수점(FPNum) 베지어 계산은 배정밀도 실수로 계산(IEEE 사칙연산·sqrt 만 써서 브라우저마다 같음).
// 미로: 원본 버그 한 곳 수정(genMaze 안 "고친 점" 참고).
(function (root) {
  'use strict';
  const T = Math.trunc;

  // ---- 난수 (rand::Rng 대응) ----
  function RNG(rnd) {
    return {
      u32: () => Math.floor(rnd() * 4294967296) >>> 0,
      bool: () => rnd() < 0.5,
      range: (lo, hiExcl) => lo + Math.floor(rnd() * (hiExcl - lo)),            // gen_range(lo..hi)
      rangeIncl: (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)),            // gen_range(lo..=hi)
      choose: (arr) => arr[Math.floor(rnd() * arr.length)],
    };
  }

  // ---- 기하 (integral-geometry) ----
  const P = (x, y) => ({ x, y });
  const add = (a, b) => P(a.x + b.x, a.y + b.y), sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const rot90 = (a) => P(a.y, -a.x), rot270 = (a) => P(-a.y, a.x);
  const cross = (a, b) => dot(a, rot90(b));
  function isqrt(v) { let r = Math.floor(Math.sqrt(v)); while (r * r > v) r--; while ((r + 1) * (r + 1) <= v) r++; return r; }
  const inorm = (a) => isqrt(a.x * a.x + a.y * a.y);
  const maxNorm = (a) => Math.max(Math.abs(a.x), Math.abs(a.y));
  const tanMul = (a, x) => T(x * a.y / a.x), cotMul = (a, y) => T(y * a.x / a.y);
  const sign = (v) => v > 0 ? 1 : v < 0 ? -1 : 0;
  const peq = (a, b) => a.x === b.x && a.y === b.y;
  // Rect: {l, t, r, b} (포함 경계)
  const rectFromSize = (x, y, w, h) => ({ l: x, t: y, r: x + w - 1, b: y + h - 1 });
  const rW = (q) => q.r - q.l + 1, rH = (q) => q.b - q.t + 1;
  function withMargin(q, m) { const ox = Math.min(m, T(rW(q) / 2)), oy = Math.min(m, T(rH(q) / 2)); return { l: q.l + ox, t: q.t + oy, r: q.r - ox, b: q.b - oy }; }
  const containsInside = (q, p) => p.x > q.l && p.x < q.r && p.y > q.t && p.y < q.b;
  const containsPt = (q, p) => p.x >= q.l && p.x <= q.r && p.y >= q.t && p.y <= q.b;
  const clampPt = (p, q) => P(Math.min(q.r, Math.max(q.l, p.x)), Math.min(q.b, Math.max(q.t, p.y)));
  const center = (s, e) => P(T((s.x + e.x) / 2), T((s.y + e.y) / 2));
  const orientation = (ray, p) => sign(cross(sub(p, ray.start), ray.dir));
  const nextPow2 = (v) => { let n = 1; while (n < v) n *= 2; return n; };
  const polygon = (pts) => { const v = pts.slice(); if (v.length && !peq(v[0], v[v.length - 1])) v.push(v[0]); return v; };   // From<Vec<Point>>
  const polygonNew = (pts) => { const v = pts.slice(); if (v.length) v.push(v[0]); return v; };                            // Polygon::new

  // ---- 땅 (land2d) ----
  // 원본 Land2D::new: 실제 크기 = 2의 거듭제곱, 놀이 상자(play box)는 가로 가운데·아래쪽에 붙음
  function newLand(pw, ph, fill) {
    const W = nextPow2(pw), H = nextPow2(ph);
    const box = rectFromSize(T((W - pw) / 2), H - ph, pw, ph);
    const m = new Uint8Array(W * H);
    if (fill) for (let y = box.t; y <= box.b; y++) m.fill(fill, y * W + box.l, y * W + box.r + 1);
    m.W = W; m.H = H; m.box = box;
    return m;
  }
  function drawLine(m, s, e, v) {           // LinePoints (원본과 같은 방식의 선 긋기)
    const dir = sub(e, s), d = P(Math.abs(dir.x), Math.abs(dir.y)), sg = P(sign(dir.x), sign(dir.y));
    const total = maxNorm(dir); let ax = 0, ay = 0, cx = s.x, cy = s.y;
    for (let step = 0; step <= total; step++) {
      ax += d.x; ay += d.y;
      if (ax > total) { ax -= total; cx += sg.x; }
      if (ay > total) { ay -= total; cy += sg.y; }
      if (cx >= 0 && cx < m.W && cy >= 0 && cy < m.H) m[cy * m.W + cx] = v;
    }
  }
  function fill(m, sp, border, value) {    // Land2D::fill (줄 단위 채우기)
    const box = m.box;
    if (!containsPt(box, sp)) return;
    const W = m.W, left = box.l, right = box.r, top = box.t, bottom = box.b;
    const stack = [];
    const push = (xl, xr, y, dir) => { const yd = y + dir; if (yd >= top && yd <= bottom) stack.push([xl, xr, yd, dir]); };
    const sxl = sp.x > left ? sp.x - 1 : sp.x, sxr = sp.x;
    for (const dir of [-1, 1]) push(sxl, sxr, sp.y, dir);
    while (stack.length) {
      let [xl, xr, y, dir] = stack.pop();
      const o = y * W;
      while (xl > left && m[o + xl] !== border && m[o + xl] !== value) xl--;
      while (xr < right && m[o + xr] !== border && m[o + xr] !== value) xr++;
      while (xl < xr) {
        while (xl <= xr && (m[o + xl] === border || m[o + xl] === value)) xl++;
        const x = xl;
        while (xl <= xr && m[o + xl] !== border && m[o + xl] !== value) { m[o + xl] = value; xl++; }
        if (x < xl) { push(x, xl - 1, y, dir); push(x, xl - 1, y, -dir); }
      }
    }
  }

  // ---- 윤곽 점 (outline.rs) ----
  function Outline(islands, walls, fillPoints, size, playBox) {
    const sq = Math.max(size.w, size.h);
    return { islands, walls, fillPoints, size, playBox, ibox: withMargin({ l: 0, t: 0, r: size.w - 1, b: size.h - 1 }, sq * -2) };
  }
  function edgesOf(poly) { const out = []; for (let i = 0; i + 1 < poly.length; i++) out.push([poly[i], poly[i + 1]]); return out; }
  function allPoints(o) { const a = []; for (const p of o.islands) a.push(...p); for (const p of o.walls) a.push(...p); a.push(...o.fillPoints); return a; }
  const totalLen = (o) => o.islands.reduce((a, p) => a + Math.max(0, p.length - 1), 0) + o.fillPoints.length;

  function solveIntersection(ibox, ray, es, ee) {
    const ed = sub(ee, es);
    const aqpb = cross(ray.dir, ed);
    if (aqpb === 0) return null;
    let iy = T(((((es.x - ray.start.x) * ray.dir.y + ray.start.y * ray.dir.x) * ed.y) - es.y * ed.x * ray.dir.y) / aqpb);
    if (iy < ibox.t) iy = ibox.t; else if (iy > ibox.b) iy = ibox.b;
    const ix = Math.abs(ray.dir.y) > Math.abs(ed.y) ? ray.start.x + cotMul(ray.dir, iy - ray.start.y) : es.x + cotMul(ed, iy - es.y);
    const ip = clampPt(P(ix, iy), ibox);
    const diff = sub(ray.start, ip);
    const t = dot(ray.dir, diff);
    if (maxNorm(diff) >= 32767) return [t, 2147483647];
    return [t, inorm(diff)];
  }
  function divideEdge(o, s, e, minDist, dlf, R) {
    const mapBox = withMargin(o.playBox, minDist);
    const normal = rot90(sub(e, s));
    const nlen = inorm(normal);
    const mid = center(s, e);
    if (nlen < minDist * 3 || !containsInside(mapBox, mid)) return null;
    const ray = { start: mid, dir: normal };
    let dl = o.size.w + o.size.h, dr = dl;
    if (normal.x !== 0) {
      const li = P(mapBox.l, mid.y + tanMul(normal, mapBox.l - mid.x));
      dl = inorm(sub(mid, li));
      const ri = P(mapBox.r, mid.y + tanMul(normal, mapBox.r - mid.x));
      dr = inorm(sub(mid, ri));
      if (normal.x > 0) { const t = dl; dl = dr; dr = t; }
    }
    if (normal.y !== 0) {
      const ti = P(mid.x + cotMul(normal, mapBox.t - mid.y), mapBox.t);
      const a = inorm(sub(mid, ti));
      const bi = P(mid.x + cotMul(normal, mapBox.b - mid.y), mapBox.b);
      const b = inorm(sub(mid, bi));
      if (normal.y < 0) { dl = Math.min(dl, a); dr = Math.min(dr, b); } else { dl = Math.min(dl, b); dr = Math.min(dr, a); }
    }
    const segs = [];
    for (const p of o.islands) segs.push(...edgesOf(p));
    for (const p of o.walls) segs.push(...edgesOf(p));
    for (const [as, ae] of segs) {
      if (peq(as, s) && peq(ae, e)) continue;
      if (orientation(ray, as) !== orientation(ray, ae)) {
        const r = solveIntersection(o.ibox, ray, as, ae);
        if (r) { if (r[0] > 0) dr = Math.min(dr, r[1]); else dl = Math.min(dl, r[1]); }
      }
    }
    for (const pi of allPoints(o)) {
      if (peq(pi, s) || peq(pi, e)) continue;
      const pr = { start: pi, dir: normal };
      if (orientation(pr, s) !== orientation(pr, e)) {
        for (const q of [s, e]) {
          const r = solveIntersection(o.ibox, ray, q, pi);
          if (r) { if (r[0] > 0) dr = Math.min(dr, r[1]); else dl = Math.min(dl, r[1]); }
        }
      }
    }
    const maxDist = T(nlen * 128 / dlf);
    dl = Math.min(dl, maxDist); dr = Math.min(dr, maxDist);
    if (dr + dl < minDist * 2 + 10) return mid;
    const d = R.rangeIncl(-dr + minDist, dl - minDist);
    return P(mid.x + T(normal.x * d / nlen), mid.y + T(normal.y * d / nlen));
  }
  function distort(o, minDist, dlf, R) {
    for (;;) {
      const old = totalLen(o);
      for (const isl of o.islands) {
        let i = 0;
        while (i < isl.length - 1) {
          const np = divideEdge(o, isl[i], isl[i + 1], minDist, dlf, R);
          if (np) { isl.splice(i + 1, 0, np); i += 2; } else i += 1;
        }
      }
      if (totalLen(o) === old) break;
    }
  }
  // Polygon::bezierize (BezierCurveSegments)
  function bezierize(v, segN) {
    if (v.length < 4) return v;
    const dist = (p) => Math.sqrt(p.x * p.x + p.y * p.y);
    const calc = (p1, p2, p3) => {
      const d13 = sub(p1, p3), n13 = dist(d13);
      if (n13 === 0) return d13;
      const md = Math.min(n13, dist(sub(p1, p2)), dist(sub(p2, p3)));
      return P(d13.x * md / n13 / 3, d13.y * md / n13 / 3);
    };
    const delta = 1 / segN, out = [];
    let pi = 0, i = 1, ni = 2;
    let right = calc(v[pi], v[i], v[ni]), left;
    pi += 1;
    while (pi !== 0) {
      pi = i; i = ni; ni += 1; if (ni >= v.length) ni = 0;
      left = right; right = calc(v[pi], v[i], v[ni]);
      const s = v[pi], e = v[i], c1 = sub(s, left), c2 = add(e, right);    // control = start - p1, end - (-right)
      for (let off = 0; off < 4095 / 4096; off += delta) {
        const o2 = off * off, o3 = o2 * off;
        const r1 = 1 - off * 3 + o2 * 3 - o3, r2 = off * 3 - o2 * 6 + o3 * 3, r3 = o2 * 3 - o3 * 3;
        out.push(P(Math.round(r1 * s.x + r2 * c1.x + r3 * c2.x + o3 * e.x), Math.round(r1 * s.y + r2 * c1.y + r3 * c2.y + o3 * e.y)));
      }
      out.push(e);
    }
    return out;
  }
  function drawOutline(m, o, v) { for (const isl of o.islands) for (let i = 0; i + 1 < isl.length; i++) drawLine(m, isl[i], isl[i + 1], v); }

  // ---- 템플릿 지형 (template_based.rs) ----
  function genTemplate(tpl, R, distanceDivisor) {
    const forceInvert = tpl._forceInvert;
    const isNeg = tpl.is_negative || forceInvert, canInvert = forceInvert ? false : tpl.can_invert;
    const doInvert = isNeg && (!canInvert || R.bool());
    const basic = doInvert ? 0 : 1, zero = doInvert ? 1 : 0;
    const land = newLand(tpl.width, tpl.height, basic);
    const box = land.box, tl = P(box.l, box.t);
    const fix = (polys) => (polys || []).map(poly => polygon(poly.map(rc => { const a = R.u32(), b = R.u32(); return add(tl, P(rc.x + a % rc.w, rc.y + b % rc.h)); })));
    const o = Outline(fix(tpl.outline_points), fix(tpl.walls), (tpl.fill_points || []).map(p => add(tl, P(p.x, p.y))), { w: land.W, h: land.H }, box);
    const pts = () => { const a = []; for (const p of o.islands) a.push(p); for (const p of o.walls) a.push(p); return a; };
    if (tpl.can_mirror && R.bool()) { const r = box.l + box.r; for (const poly of pts()) for (const p of poly) p.x = r - p.x; for (const p of o.fillPoints) p.x = r - p.x; }
    if (tpl.can_flip && R.bool()) { const t = box.t + box.b; for (const poly of pts()) for (const p of poly) p.y = t - p.y; for (const p of o.fillPoints) p.y = t - p.y; }
    const dlf = 100 + R.range(0, 8) * 10;
    distort(o, distanceDivisor, dlf, R);
    o.islands = o.islands.map(isl => bezierize(isl, 5));
    drawOutline(land, o, zero);
    for (const p of o.fillPoints) fill(land, p, zero, zero);
    drawOutline(land, o, basic);
    return land;
  }

  // ---- 미로 (maze.rs) ----
  const prevOdd = (n) => (n & 1) === 0 ? n - 1 : n;
  const DIRS = [P(0, -1), P(1, 0), P(0, 1), P(-1, 0)];
  const dirOrient = (d) => d.x === 0 ? 0 : 1;
  const toEdge = (d) => P(d.x < 0 ? 0 : d.x, d.y < 0 ? 0 : d.y);
  const inLine = (a, b, c) => (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
  function grid(w, h, v) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(v)); return g; }
  function genMaze(tpl, R, distanceDivisor) {
    const inverted = !!tpl.invert, cell = tpl.cell_size, braid = tpl.braidness;
    const basic = inverted ? 0 : 1, zero = inverted ? 1 : 0;
    const land = newLand(tpl.width, tpl.height, basic);
    const size = { w: land.W, h: land.H };
    // 고친 점: 원본 maze.rs 는 미로 칸을 전체 크기(2의 거듭제곱)로 계산해, 템플릿 폭이 2의 거듭제곱이 아니면(예: 1536)
    // 채우기 시작점이 놀이 상자 밖에 떨어져 터널이 안 파진다. 여기서는 놀이 상자(템플릿 크기) 기준으로 계산하고 위치만 옮긴다.
    const msize = { w: tpl.width, h: tpl.height };
    const numSteps = inverted ? 3 : 1;
    const nc = { w: prevOdd(T(msize.w / cell)), h: prevOdd(T(msize.h / cell)) };
    const ne = { w: nc.w - 1, h: nc.h - 1 }, sc = { w: T(nc.w / 2), h: T(nc.h / 2) };
    const lastCell = [], cameFromPos = new Array(numSteps).fill(0);
    const cameFrom = []; for (let i = 0; i < nc.w * nc.h; i++) cameFrom.push(new Array(numSteps).fill(null).map(() => P(0, 0)));
    const seen = grid(sc.w, sc.h, null), walls = [grid(sc.w, sc.h, true), grid(sc.w, sc.h, true)], edgeList = [grid(nc.w, nc.h, false), grid(nc.w, nc.h, false)];
    for (let s = 0; s < numSteps; s++) {
      const x = T(R.range(0, sc.w - 1) / numSteps);
      lastCell[s] = P(x + T(s * sc.w / numSteps), R.range(0, sc.h));
    }
    const off = P(land.box.l + T((msize.w - nc.w * cell) / 2), land.box.t + T((msize.h - nc.h * cell) / 2));
    function seeCell(s, dir) {
      for (;;) {
        const p = lastCell[s];
        seen[p.y][p.x] = s;
        const cw = R.bool();
        let moved = false;
        for (let k = 0; k < 5; k++) {
          const sp = add(p, dir);
          const ws = (sp.x < 0 || sp.x >= sc.w || sp.y < 0 || sp.y >= sc.h) ? s : seen[sp.y][sp.x];
          if (ws === s) {
            if (!inverted && R.range(0, braid) === 0) {
              const o = dirOrient(dir);
              if (dir.x === -1 && p.x > 0) walls[o][p.y][p.x - 1] = false;
              if (dir.x === 1 && p.x < sc.w - 1) walls[o][p.y][p.x] = false;
              if (dir.y === -1 && p.y > 0) walls[o][p.y - 1][p.x] = false;
              if (dir.y === 1 && p.y < sc.h - 1) walls[o][p.y][p.x] = false;
            }
            dir = cw ? rot90(dir) : rot270(dir);
          } else if (ws === null) {
            const od = rot90(rot90(dir)), op = sub(p, toEdge(od));
            walls[dirOrient(od)][op.y][op.x] = false;
            lastCell[s] = sp;
            cameFromPos[s] += 1;
            cameFrom[cameFromPos[s]][s] = p;
            moved = true;
            return false;
          } else return true;
        }
        if (!moved) {
          lastCell[s] = cameFrom[cameFromPos[s]][s];
          cameFromPos[s] -= 1;
          if (cameFromPos[s] < 0) return true;
        }
      }
    }
    const done = new Array(numSteps).fill(false);
    let all = false;
    while (!all) {
      all = true;
      for (let s = 0; s < numSteps; s++) if (!done[s]) { const d = DIRS[R.range(0, 4)]; done[s] = seeCell(s, d); all = false; }
    }
    // to_islands
    const islands = [], fillPoints = [];
    let poly = [];
    const maze = grid(nc.w, nc.h, false);
    for (let x = 0; x < sc.w; x++) {
      for (let y = 0; y < sc.h; y++) if (seen[y][x] !== null) maze[y * 2 + 1][x * 2 + 1] = true;
      for (let y = 0; y < sc.h - 1; y++) if (!walls[0][y][x]) maze[y * 2 + 2][x * 2 + 1] = true;
    }
    for (let x = 0; x < sc.w - 1; x++) for (let y = 0; y < sc.h; y++) if (!walls[1][y][x]) maze[y * 2 + 1][x * 2 + 2] = true;
    for (let x = 0; x < ne.w; x++) for (let y = 0; y < nc.h; y++) edgeList[0][y][x] = maze[y][x] !== maze[y][x + 1];
    for (let x = 0; x < nc.w; x++) for (let y = 0; y < ne.h; y++) edgeList[1][y][x] = maze[y][x] !== maze[y + 1][x];
    const addVertex = (p) => {
      const cx = (inverted || (p.x & 1) === 0) ? cell : T(cell * 2 / 3), cy = (inverted || (p.y & 1) === 0) ? cell : T(cell * 2 / 3);
      const np = P((p.x - 1) * cell + cx + off.x, (p.y - 1) * cell + cy + off.y);
      const n = poly.length;
      if (n > 2 && inLine(poly[n - 2], poly[n - 1], np)) poly.pop();
      poly.push(np);
    };
    const addEdge = (p0, dir) => {
      let next = p0;
      while (next) {
        const p = next; next = null;
        for (let k = 0; k < 4; k++) {
          const np = add(p, toEdge(dir));
          if (np.x >= 0 && np.y >= 0 && np.x < nc.w && np.y < nc.h && edgeList[dirOrient(dir)][np.y][np.x]) {
            edgeList[dirOrient(dir)][np.y][np.x] = false;
            addVertex(add(add(p, dir), P(1, 1)));
            next = add(p, dir);
            break;
          }
          dir = rot90(dir);
        }
      }
    };
    for (let x = 0; x < ne.w; x++) for (let y = 0; y < nc.h; y++) {
      if (edgeList[0][y][x]) {
        edgeList[0][y][x] = false;
        addVertex(P(x + 1, y + 1)); addVertex(P(x + 1, y));
        addEdge(P(x, y - 1), DIRS[0]);
        if (poly.length > 4) {
          if (inLine(poly[poly.length - 1], poly[0], poly[1])) poly.pop();
          islands.push(polygonNew(poly));
        }
        poly = [];
      }
    }
    for (let x = 0; x < nc.w; x++) for (let y = 0; y < nc.h; y++) {
      if (maze[y][x]) {
        const half = T(cell / 2), fp = P(x * cell + half + off.x, y * cell + half + off.y);
        islands.push(polygonNew([fp])); fillPoints.push(fp);
        const st = [[x, y]];
        while (st.length) {
          const [a, b] = st.pop();
          if (maze[b][a]) {
            maze[b][a] = false;
            if (a > 0) st.push([a - 1, b]); if (a < nc.w - 1) st.push([a + 1, b]);
            if (b > 0) st.push([a, b - 1]); if (b < nc.h - 1) st.push([a, b + 1]);
          }
        }
      }
    }
    const o = Outline(islands, [], fillPoints, size, land.box);
    o.ibox = land.box;
    distort(o, distanceDivisor, tpl.distortion_limiting_factor, R);
    o.islands = o.islands.map(isl => bezierize(isl, 5));
    drawOutline(land, o, zero);
    for (const p of o.fillPoints) fill(land, p, zero, zero);
    return land;
  }

  // ---- 템플릿 고르기 (uLand.pas SelectTemplate + max_hedgehogs) ----
  const FEATURE_SIZE = 12;                                   // 원본 프런트엔드 기본 "지형 크기"
  const DISTANCE_DIVISOR = T(FEATURE_SIZE * FEATURE_SIZE / 8) + 10;   // game_field.rs
  const OUTLINE_TYPES = ['small', 'medium', 'large', 'cavern', 'wacky'];
  const MAZE_TYPES = ['small_tunnels', 'medium_tunnels', 'large_tunnels', 'small_islands', 'medium_islands', 'large_islands'];
  // kind: 'random' | 'maze', sub: 템플릿 종류(없으면 무작위), hogs: 전체 고슴도치 수 (템플릿 max_hedgehogs 이상만)
  function generate(json, kind, seed, hogs, sub) {
    const R = RNG(root.Sim ? root.Sim.rng32(seed) : require('./sim.js').rng32(seed));
    let land, typeName;
    if (kind === 'maze') {
      typeName = sub || R.choose(MAZE_TYPES);
      const tpl = json.maze.templates[R.choose(json.maze.template_types[typeName])];
      land = genMaze(tpl, R, DISTANCE_DIVISOR);
      land.maxHogs = tpl.max_hedgehogs || 18;
    } else {
      // 휴대폰 캔버스 한계(약 4096x4096) 때문에 높이 2048 을 넘는 템플릿은 뺀다
      const ok = (i) => (json.map.templates[i].max_hedgehogs || 99) >= hogs && json.map.templates[i].height <= 2048;
      const types = OUTLINE_TYPES.filter(t => json.map.template_types[t].indices.some(ok));
      typeName = sub && types.includes(sub) ? sub : R.choose(types);
      const td = json.map.template_types[typeName];
      const idx = R.choose(td.indices.filter(ok));
      const tpl = Object.assign({}, json.map.templates[idx], { _forceInvert: !!td.force_invert });
      land = genTemplate(tpl, R, DISTANCE_DIVISOR);
      land.maxHogs = tpl.max_hedgehogs || 18;
    }
    land.waterY = land.H - 65;
    land.kind = kind; land.typeName = typeName;
    return land;
  }
  const LandGen = { generate, OUTLINE_TYPES, MAZE_TYPES, DISTANCE_DIVISOR };
  if (typeof module !== 'undefined' && module.exports) module.exports = LandGen; else root.LandGen = LandGen;
})(this);
