// 10차 묶음 1: 무기 표와 총알 계산 (서버·화면 공용). 수치는 원본에서 읽어 옮김:
//   hedgewars/uVariables.pas (Ammoz: Slot·NumPerTurn·TimeAfterTurn·각도 제한), uGearsList.pas (Boom·Radius·Health·Timer·Karma),
//   uGearsHedgehog.pas (발사 속도 xx*0.5, 미니건 0.8), uGearsHandlersMess.pas (doStepBulletWork·doStepShotgunShot·doStepMinigunWork),
//   uGearsUtils.pas (ShotgunShot·AmmoShoveImpl), uConsts.pas (cShotgunRadius 22)
// 시작 개수: 사용자 결정(2026-11-28) 샷건 무제한·데저트 이글 2·저격총 2·미니건 1 (원본 기본 구성은 이글 2·저격 2·미니건 0 → 미니건만 다름)
(function (root) {
  'use strict';
  const Sim = root.Sim || require('./sim.js');
  const INF = -1;   // 무한
  // icon: 원본 TAmmoType 번호 (Ammos_base.png 칸 = 번호-1, 세로 16칸씩), slot: 원본 메뉴 줄(F1=0), aim: arc(각도+힘) | direct(각도만)
  const AMMO = {
    bazooka: { icon: 3, slot: 0, name: '바주카', aim: 'arc', wind: true, count: INF, shots: 1, retreat: 3000,
      desc: '곡사: 각도와 누른 만큼의 힘으로 쏩니다. 바람을 탑니다. 닿는 곳에서 터집니다.' },
    grenade: { icon: 1, slot: 1, name: '수류탄', aim: 'arc', wind: false, count: INF, shots: 1, retreat: 3000, timer: true,
      desc: '곡사: 바람을 타지 않습니다. 튕기다가 1~5초 뒤 터집니다(타이머 1~5).' },
    shotgun: { icon: 5, slot: 2, name: '샷건', aim: 'direct', wind: false, count: INF, shots: 2, retreat: 3000, delay: 900,
      desc: '직사 2발: 조준한 방향으로 바로 쏩니다(힘 없음). 맞은 곳 근처 땅을 파고 최대 25 피해. 바람을 안 탑니다.' },
    deagle: { icon: 10, slot: 2, name: '데저트 이글', aim: 'direct', wind: false, count: 2, shots: 4, retreat: 3000,
      desc: '직사 4발: 땅을 조금 뚫고 지나가며 맞은 고슴도치마다 7 피해. 바람을 안 탑니다.' },
    sniper: { icon: 38, slot: 2, name: '저격총', aim: 'direct', wind: false, count: 2, shots: 2, retreat: 3000, osc: true, noMoveAfter: true,
      desc: '직사 2발: 멀리 날아갈수록 피해가 커지고 세게 밀어냅니다. 조준이 조금씩 흔들립니다. 쏜 뒤에는 못 움직입니다.' },
    minigun: { icon: 59, slot: 2, name: '미니건', aim: 'direct', wind: false, count: 1, shots: 1, retreat: 3000,
      minAngle: Math.floor(2048 / 6), maxAngle: Math.floor(5 * 2048 / 6), windup: 601, fireMs: 3451,
      desc: '연사: 누르면 0.6초 뒤 3.5초 동안 총알을 퍼붓습니다(한 발 2 피해). 쏘는 동안 위아래로 조준을 움직일 수 있습니다.' },
    // 넘기기 (원본 amSkip, 슬롯 9 = F10): 고른 뒤 발사를 눌러야 차례가 끝남 (실수 방지). AI 는 쓰지 않음
    skip: { icon: 7, slot: 9, name: '넘기기', aim: 'instant', wind: false, count: INF, shots: 1, retreat: 0,
      desc: '아무것도 쏘지 않고 차례를 넘깁니다. 무기 창에서 고른 뒤 발사를 눌러야 넘어갑니다.' },
  };
  const ORDER = ['bazooka', 'grenade', 'shotgun', 'deagle', 'sniper', 'minigun', 'skip'];
  function startAmmo() { const a = {}; for (const k of ORDER) a[k] = AMMO[k].count; return a; }

  // ---- 총알: 원본 doStepBulletWork — 한 틱에 (dx,dy) 를 100번 더함. 땅 칸을 지날 때마다 Damage+1, Health 를 넘으면 멈춤.
  //      경로에 걸린 고슴도치(반지름 9)는 한 번씩 맞음(쏜 고슴도치 제외). 땅을 지난 칸은 굴(폭 3)이 됨.
  // opts: health(이글·저격 50, 미니건 2 — 미니건은 땅에 닿자마자 멈춤), stopOnLand, owner, maxTicks
  // 반환: { x, y, ticks, hits: [{ h, tick }], tunnel: [시작 x, y, dx, dy, 칸 수] 목록, end: 'land'|'water'|'out'|'spent' }
  function traceBullet(world, x, y, dx, dy, opts) {
    const L = world.land, R = Sim.HH_RADIUS, hogs = (world.hogs || []).filter(h => h.alive && h !== opts.owner);
    let dmg = 0, ticks = 0, end = 'out';
    const hits = [], hitSet = new Set(), tunnel = [];
    let run = null;
    const maxT = opts.maxTicks || 400;
    outer: for (ticks = 1; ticks <= maxT; ticks++) {
      for (let i = 0; i < 100; i++) {
        x += dx; y += dy;
        const ix = Math.round(x), iy = Math.round(y);
        if (ix < -200 || ix > L.W + 200 || iy < -3000 || iy >= L.H) { end = 'out'; break outer; }
        if (y >= (world.waterY != null ? world.waterY : L.waterY)) { end = 'water'; break outer; }
        for (const h of hogs) if (!hitSet.has(h) && (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y) <= R * R) { hitSet.add(h); hits.push({ h, tick: ticks, x, y }); }
        const solid = ix >= 0 && ix < L.W && iy >= 0 && L[iy * L.W + ix] !== 0;
        if (solid) {
          if (opts.stopOnLand) { end = 'land'; break outer; }
          dmg++;
          if (L[iy * L.W + ix] === 2) { end = 'land'; break outer; }          // 부서지지 않는 땅
          if (!run) { run = [x - dx, y - dy, dx, dy, 0]; tunnel.push(run); }
          run[4]++;
          if (dmg >= opts.health) { end = 'spent'; break outer; }
        } else run = null;
      }
    }
    return { x, y, ticks, hits, tunnel, end };
  }
  // 굴 파기 (원본 DrawTunnel 폭 1 → 3픽셀): 시작점에서 (dx,dy) 를 n 번 더하며 반지름 1 원을 지움. 서버·화면이 같은 값으로 부름
  function carveTunnel(land, x, y, dx, dy, n) {
    for (let i = 0; i < n; i++) { x += dx; y += dy; Sim.carve(land, x, y, 1); }
  }
  // 샷건 탄 (doStepShotgunShot): 반지름 2, 땅이나 고슴도치에 닿으면 6칸 더 들어간 자리에서 ShotgunShot
  function traceShotgun(world, x, y, dx, dy, owner) {
    const L = world.land, R = Sim.HH_RADIUS, hogs = (world.hogs || []).filter(h => h.alive && h !== owner);
    for (let t = 0; t < 400; t++) for (let i = 0; i < 100; i++) {
      x += dx; y += dy;
      const ix = Math.round(x), iy = Math.round(y);
      if (ix < -200 || ix > L.W + 200 || iy < -3000) return null;
      if (y >= (world.waterY != null ? world.waterY : L.waterY)) return null;
      let hit = false;
      for (let a = -2; a <= 2 && !hit; a++) for (let b = -2; b <= 2 && !hit; b++) if (a * a + b * b <= 4 && Sim.landAt(L, ix + a, iy + b)) hit = true;
      if (!hit) for (const h of hogs) if ((h.x - x) * (h.x - x) + (h.y - y) * (h.y - y) <= (R + 2) * (R + 2)) { hit = true; break; }
      if (hit) return { x: x + dx * 6, y: y + dy * 6 };
    }
    return null;
  }
  // ShotgunShot: 반지름 22 + 상대 반지름 9 안의 고슴도치에게 min(r - 거리, 25) 피해, 반지름 22 땅 파기
  const SHOTGUN_R = 22, SHOTGUN_BOOM = 25;
  function shotgunDamage(dist) { const r = SHOTGUN_R + Sim.HH_RADIUS; return Math.max(0, Math.min(r - Math.round(dist), SHOTGUN_BOOM)); }

  const Weapons = { AMMO, ORDER, INF, startAmmo, traceBullet, carveTunnel, traceShotgun, shotgunDamage, SHOTGUN_R,
    DEAGLE_DMG: 7, MINIGUN_DMG: 2, MINIGUN_HOLE: 5, BULLET_SPEED: 0.5, MINIGUN_SPEED: 0.8 };
  if (typeof module !== 'undefined' && module.exports) module.exports = Weapons; else root.Weapons = Weapons;
})(typeof self !== 'undefined' ? self : this);
