// 수달섬 — 전투 손맛(작업지시서 3 C · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 맞으면: 몸이 붉게 번쩍 · 살짝 밀려남 · 소리 · 피해 숫자. 맞은 사람 화면은 살짝 흔들림. 때린 사람에게는 노란 숫자 · 딱 소리.
// 피해 · 밀려날 거리는 서버가 정해 hp 말(d · kx · kz)로 보냄. 여기는 보여 주기와 「수달끼리 겹치지 않기」(제 수달만 밀어냄).
let BODY = { sep: 0.8, push: 3, ghost: 3 };
let meGhost = 0, shakeT = 0;
const kbLeft = { x: 0, z: 0 };
const flashing = new Set();
const RED = new THREE.Color(0.95, 0.12, 0.06);

// ── 붉게 번쩍: 수달 재질은 모두 같이 쓰므로, 처음 맞을 때 그 수달만의 털 · 얼굴 재질을 만들어 바꿔 끼움 ──
function ownMats(obj) {
  const u = obj.userData;
  if (u.own) return u.own;
  const fur = clay(FUR), head = headMat();
  obj.traverse((m) => { if (m.isMesh) { if (m.material === FUR_MAT) m.material = fur; else if (m.material === HEAD_MAT) m.material = head; } });
  u.own = { mats: [fur, head], base: [fur.emissive.clone(), head.emissive.clone()], t: 0 };
  return u.own;
}
function flashRed(obj) { const o = ownMats(obj); o.t = 0.28; flashing.add(o); }

// ── 피해 숫자(글자만 · 화면 위에 고정 · 0.8초 동안 위로 뜨며 사라짐) ──
const nums = [];
const V3 = new THREE.Vector3();
function popNum(obj, text, kind) {
  const el = document.createElement('div');
  el.className = 'dmgn dmg-' + kind; el.textContent = text; document.body.appendChild(el);
  nums.push({ el, obj, t: 0, dx: (Math.random() - 0.5) * 24 });
}

// ── 소리: 맞은 쪽은 낮은 쿵 · 때린 쪽은 짧은 딱 ──
function thud(vol) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.16);
  v.gain.setValueAtTime(0.32 * vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(v).connect(a.destination); o.start(t); o.stop(t + 0.21);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = NOISE; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.18 * vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + 0.08);
}
function tick() {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), v = a.createGain(), t = a.currentTime;
  o.type = 'triangle'; o.frequency.value = 880; v.gain.setValueAtTime(0.12, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(v).connect(a.destination); o.start(t); o.stop(t + 0.08);
}

// ── hp 말(맞음)이 오면 fight.js 가 부름 ──
function onHitFx(m) {
  if (!(m.d > 0)) return;
  const n = String(Math.round(m.d));
  if (m.id === net.id) {
    flashRed(me.obj); popNum(me.obj, '-' + n, 'me'); thud(1); shakeT = 0.22;
    if (Number.isFinite(m.kx)) { kbLeft.x += m.kx; kbLeft.z += m.kz; }
    return;
  }
  const o = net.others.get(m.id); if (!o) return;
  flashRed(o.obj);
  // 밀려나는 모습은 바로(맞은 사람 화면이 옮긴 자리가 곧 옴)
  if (Number.isFinite(m.kx)) { o.tx += m.kx; o.tz += m.kz; }
  if (m.by === net.id) { popNum(o.obj, n, 'hit'); tick(); thud(0.5); } else popNum(o.obj, n, 'other');
}
function ghostAfterRespawn(id) {
  if (id === net.id) { meGhost = clock + BODY.ghost; kbLeft.x = kbLeft.z = 0; return; }
  const o = net.others.get(id); if (o) o.ghost = clock + BODY.ghost;
}

// ── 수달끼리 겹치지 않기: 안전지대 밖 · 둘 다 살아 있고 다시 태어난 지 3초가 지났을 때만 ──
const solid = (o) => o.alive !== false && !((o.ghost || 0) > clock) && !inSafeC(o.x, o.z);
const meSolid = () => srvOn() && !me.dead && !(meGhost > clock) && !inSafeC(me.x, me.z);
// 걸어서 남에게 파고들지 않게: 가려는 방향 중 그 수달 쪽 성분을 뺌(옆으로는 미끄러짐 → 길을 막을 수 있음)
function bodyBlock(vx, vz) {
  if (!meSolid()) return [vx, vz];
  for (const o of net.others.values()) {
    if (!solid(o)) continue;
    const dx = o.x - me.x, dz = o.z - me.z, d = Math.hypot(dx, dz);
    if (d >= BODY.sep || d < 1e-3) continue;
    const ux = dx / d, uz = dz / d, into = vx * ux + vz * uz;
    if (into > 0) { vx -= ux * into; vz -= uz * into; }
  }
  return [vx, vz];
}
// 이미 겹쳤으면(통신이 늦어 서로 늦은 자리를 봄 등) 초당 push 칸씩 서로 밀어냄 — 두 화면이 각자 제 수달을 반대로 밀어 끼지 않음
function bodyPush(dt) {
  if (!meSolid()) return;
  let px = 0, pz = 0;
  for (const o of net.others.values()) {
    if (!solid(o)) continue;
    const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz);
    if (d >= BODY.sep) continue;
    // 꼭 같은 자리면 번호로 방향을 정함(두 화면이 서로 반대쪽으로)
    const ux = d > 1e-3 ? dx / d : (net.id > o.id ? 1 : -1), uz = d > 1e-3 ? dz / d : 0;
    px += ux * (BODY.sep - d); pz += uz * (BODY.sep - d);
  }
  const L = Math.hypot(px, pz); if (!L) return;
  const s = Math.min(L, BODY.push * dt) / L, nx = me.x + px * s, nz = me.z + pz * s;
  if (free(nx, nz)) { me.x = nx; me.z = nz; }
}

// ── 매 프레임(loop.js step 끝 · 카메라를 놓은 뒤) ──
function hitTick(dt) {
  // 밀려남: 남은 거리를 0.1초쯤에 걸쳐 · 막히면 버림
  const kl = Math.hypot(kbLeft.x, kbLeft.z);
  if (kl > 0.005) {
    const k = Math.min(1, dt * 14), nx = me.x + kbLeft.x * k, nz = me.z + kbLeft.z * k;
    if (!me.dead && free(nx, nz)) { me.x = nx; me.z = nz; kbLeft.x -= kbLeft.x * k; kbLeft.z -= kbLeft.z * k; } else kbLeft.x = kbLeft.z = 0;
  }
  bodyPush(dt);
  // 붉은 빛이 빠짐
  for (const o of flashing) {
    o.t -= dt; const k = Math.max(0, o.t / 0.28);
    o.mats.forEach((m, i) => m.emissive.copy(o.base[i]).lerp(RED, k * 0.85));
    if (o.t <= 0) flashing.delete(o);
  }
  // 화면 흔들림(맞은 사람만 · 0.22초)
  if (shakeT > 0) { shakeT -= dt; const a = 0.09 * Math.max(0, shakeT / 0.22); camera.position.x += (Math.random() - 0.5) * a * 2; camera.position.y += (Math.random() - 0.5) * a; }
  // 피해 숫자: 머리 위에서 위로 뜨며 사라짐
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt;
    if (n.t > 0.8) { n.el.remove(); nums.splice(i, 1); continue; }
    // 이름표(머리 위) 보다 위에서 시작
    V3.copy(n.obj.position); V3.y += 1.75; V3.project(camera);
    const x = (V3.x + 1) / 2 * innerWidth + n.dx, y = (1 - V3.y) / 2 * innerHeight - n.t * 46;
    n.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${n.t < 0.1 ? 0.6 + n.t * 6 : 1.2 - Math.min(0.2, (n.t - 0.1) * 0.5)})`;
    n.el.style.opacity = String(Math.min(1, (0.8 - n.t) / 0.3));
    n.el.hidden = V3.z > 1;
  }
}
