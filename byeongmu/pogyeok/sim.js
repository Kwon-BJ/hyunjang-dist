// 공용 물리·지형 모듈 (서버와 브라우저가 같이 사용)
// 수치는 Hedgewars 원본 소스(hedgewars/*.pas, rust/lib-hwengine-future)에서 읽어 JS로 새로 작성했다.
// 시간 단위: 1틱 = 1ms (원본과 동일), 거리 단위: 픽셀.
(function (root) {
  'use strict';

  const W = 2560, H = 1280;          // 지형 크기 (원본 4096x2048보다 작게)
  const WATER_Y = 1215;              // 수면. 이보다 아래로 가면 익사
  const GRAVITY = 0.0005;            // cGravity = cMaxWindSpeed*2
  const MAX_WIND = 0.00025;          // cMaxWindSpeed
  const MAX_POWER = 1500;            // cMaxPower / cPowerDivisor
  const MAX_ANGLE = 2048;            // cMaxAngle (0=위, 1024=수평, 2048=아래)
  const HH_RADIUS = 9;               // cHHRadius
  const HH_STEP_TICKS = 29;          // cHHStepTicks
  const HH_HEALTH = 100;             // cInitHealth
  const TURN_TIME = 45000;           // cHedgehogTurnTime
  const RETREAT_TIME = 3000;         // TimeAfterTurn
  const HH_KICK = 0.01;              // cHHKick

  const WEAPONS = {
    bazooka: { name: '바주카', radius: 4, elasticity: 0.8, friction: 0.8, boom: 50, wind: true, timer: 0 },
    grenade: { name: '수류탄', radius: 5, elasticity: 0.8, friction: 0.8, boom: 50, wind: false, timer: 3000 },
  };
  const HOG = { radius: HH_RADIUS, elasticity: 0.35, friction: 0.999, density: 3 };

  // ---- 결정적 난수 (서버·브라우저가 같은 지형을 만들도록) ----
  function rng32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- 지형 생성: 사칙연산만 사용(브라우저마다 결과가 같도록) ----
  function genLand(seed) {
    const rnd = rng32(seed);
    const m = new Uint8Array(W * H);
    function noise(step, amp) {
      const n = Math.ceil(W / step) + 2, p = [];
      for (let i = 0; i < n; i++) p.push(rnd() * 2 - 1);
      return function (x) {
        const i = Math.floor(x / step), t = (x - i * step) / step, s = t * t * (3 - 2 * t);
        return (p[i] * (1 - s) + p[i + 1] * s) * amp;
      };
    }
    const n1 = noise(420, 220), n2 = noise(120, 70), n3 = noise(30, 12);
    const base = 720 + (rnd() * 2 - 1) * 60;
    const surf = new Int32Array(W);
    const margin = 240;
    for (let x = 0; x < W; x++) {
      let y = base + n1(x) + n2(x) + n3(x);
      const e = Math.min(x, W - 1 - x);
      if (e < margin) { const k = (margin - e) / margin; y += k * k * 800; }
      if (y < 260) y = 260;
      surf[x] = Math.floor(y);
      for (let yy = surf[x]; yy < H; yy++) m[yy * W + x] = 1;
    }
    function ellipse(cx, cy, rx, ry, v) {
      for (let y = Math.max(0, cy - ry); y <= Math.min(H - 1, cy + ry); y++) {
        const dy = (y - cy) / ry, w = rx * rx * (1 - dy * dy);
        for (let x = Math.max(0, cx - rx); x <= Math.min(W - 1, cx + rx); x++) {
          const dx = x - cx;
          if (dx * dx <= w) m[y * W + x] = v;
        }
      }
    }
    // 동굴
    const caves = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < caves; i++) {
      const cx = 320 + Math.floor(rnd() * (W - 640));
      const top = surf[cx] + 70;
      if (top > 1120) continue;
      const cy = top + Math.floor(rnd() * (1140 - top));
      ellipse(cx, cy, 45 + Math.floor(rnd() * 70), 30 + Math.floor(rnd() * 40), 0);
    }
    // 떠 있는 섬
    const isl = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < isl; i++) {
      const cx = 400 + Math.floor(rnd() * (W - 800));
      let cy = surf[cx] - 160 - Math.floor(rnd() * 120);
      if (cy < 160) cy = 160;
      ellipse(cx, cy, 70 + Math.floor(rnd() * 90), 22 + Math.floor(rnd() * 20), 1);
    }
    return m;
  }

  // 원형으로 지형 깎기 (폭발)
  function carve(m, x, y, r) {
    x = Math.round(x); y = Math.round(y);
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= H) continue;
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      const x0 = Math.max(0, x - w), x1 = Math.min(W - 1, x + w);
      for (let xx = x0; xx <= x1; xx++) m[yy * W + xx] = 0;
    }
  }

  function landAt(m, x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    return m[y * W + x] === 1;
  }

  // 원본 CI(충돌 원)처럼: 정지한 고슴도치는 다른 물체에게 단단한 벽이다.
  function solidAt(world, x, y, self) {
    if (landAt(world.land, x, y)) return true;
    const hogs = world.hogs;
    if (hogs) for (let i = 0; i < hogs.length; i++) {
      const h = hogs[i];
      if (!h.alive || h === self || h.moving || h === world.ignore) continue;
      const dx = x - h.x, dy = y - h.y;
      if (dx * dx + dy * dy <= HH_RADIUS * HH_RADIUS) return h;
    }
    return false;
  }

  // TestCollisionYwithGear: 원의 위/아래 가장자리 줄 검사
  function testY(world, g, r, dir) {
    const cx = Math.round(g.x), y = Math.round(g.y) + dir * r;
    for (let x = cx - r + 2; x <= cx + r - 2; x++) { const s = solidAt(world, x, y, g); if (s) return s; }
    return false;
  }
  // TestCollisionXwithGear: 원의 좌/우 가장자리 열 검사
  function testX(world, g, r, dir) {
    const cy = Math.round(g.y), x = Math.round(g.x) + dir * r;
    for (let y = cy - r + 2; y <= cy + r - 2; y++) { const s = solidAt(world, x, y, g); if (s) return s; }
    return false;
  }
  function overlaps(world, g, r) {
    const cx = Math.round(g.x), cy = Math.round(g.y);
    for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) {
      if (dx * dx + dy * dy > r * r) continue;
      if (solidAt(world, cx + dx, cy + dy, g)) return true;
    }
    return false;
  }

  // doStepFallingGear 를 단순화해 옮긴 것. 반환: {coll, landed(아래로 부딪힘), hit(부딪힌 고슴도치)}
  function stepFalling(world, g, p) {
    const r = p.radius;
    if (Math.abs(g.dx) > 1.9) g.dx = Math.sign(g.dx) * 1.9;
    if (Math.abs(g.dy) > 1.9) g.dy = Math.sign(g.dy) * 1.9;
    let coll = false, landed = false, falling = true, hit = null;
    const vdir = g.dy < 0 ? -1 : 1;
    const v = testY(world, g, r, vdir);
    if (v) {
      if (v !== true) hit = v;
      coll = true; falling = false; if (vdir > 0) landed = true;
      g.dx *= p.friction;
      g.dy = -g.dy * p.elasticity;
    }
    const hdir = g.dx < 0 ? -1 : 1;
    if (g.dx !== 0) {
      const h = testX(world, g, r, hdir);
      if (h) {
        if (h !== true) hit = h;
        coll = true;
        g.dx = -g.dx * p.elasticity;
        g.dy = g.dy * p.elasticity;
      }
    }
    if (falling) g.dy += GRAVITY;
    g.x += g.dx; g.y += g.dy;
    return { coll, landed, hit };
  }

  // 원본 doMakeExplosion 의 피해 공식
  function explosionDamage(dist, R) {
    const dmgBase = R * 2 + (HH_RADIUS >> 1);
    let dmg = dmgBase - Math.round(dist);
    if (dmg <= 1) return 0;
    return Math.min(dmg >> 1, R);
  }
  // 원본 CheckHHDamage: 낙하 피해
  function fallDamage(dy) {
    if (dy <= 0.4) return 0;
    return 1 + Math.round((dy - 0.4) * 70);
  }

  // 조준 각도 → 발사 방향 (xx = sin(a)*facing, yy = -cos(a))
  function aimVector(angle, facing) {
    const a = angle / MAX_ANGLE * Math.PI;
    return { x: Math.sin(a) * facing, y: -Math.cos(a) };
  }

  // 탄 한 발을 끝까지 계산(테스트 봇의 조준용). 반환: 터진 위치 또는 null(물·밖)
  function simulateShot(world, kind, x, y, angle, facing, power, wind, owner) {
    const p = WEAPONS[kind], v = aimVector(angle, facing), s = power / MAX_POWER;
    const g = { x, y, dx: v.x * s, dy: v.y * s, timer: p.timer || 0 };
    let ign = owner;
    for (let t = 0; t < 12000; t++) {
      world.ignore = null;
      if (ign && !overlaps(world, g, p.radius)) ign = null;
      world.ignore = ign;
      if (p.wind) g.dx += wind;
      const c = stepFalling(world, g, p);
      if (g.y > WATER_Y || g.x < -400 || g.x > W + 400) { world.ignore = null; return null; }
      if (kind === 'bazooka' && c.coll) { world.ignore = null; return { x: g.x, y: g.y, t }; }
      if (kind === 'grenade' && --g.timer <= 0) { world.ignore = null; return { x: g.x, y: g.y, t }; }
    }
    world.ignore = null;
    return null;
  }

  const Sim = {
    W, H, WATER_Y, GRAVITY, MAX_WIND, MAX_POWER, MAX_ANGLE, HH_RADIUS, HH_STEP_TICKS, HH_HEALTH,
    TURN_TIME, RETREAT_TIME, HH_KICK, WEAPONS, HOG,
    rng32, genLand, carve, landAt, solidAt, testX, testY, overlaps, stepFalling,
    explosionDamage, fallDamage, aimVector, simulateShot,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim; else root.Sim = Sim;
})(this);
