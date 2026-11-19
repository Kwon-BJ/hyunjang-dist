// 수달섬 — 낚시(밤샘 6단계). 낚시 자리 · 찌 · 줄 · 입질 · 연타 막대 · 잡은 물고기 튀어 오르기
// 물고기 수 · 입질 시각 · 연타 검사 · 어떤 물고기인지는 서버가 정한다. 화면은 던지기(cast) · 연타(tap) · 거두기(reel)만 보낸다.
// 함께(서버)일 때만 낚시 가능 — 혼자 놀기에선 알림만.
const FISH = ['금붕어', '비단잉어', '도미', '넙치'];
const FISH_ROD = '낚싯대';
Object.assign(ITEMS, { 낚싯대: { buy: 500, tool: true }, 금붕어: { sell: 10 }, 비단잉어: { sell: 18 }, 도미: { sell: 30 }, 넙치: { sell: 60 } }); // 서버 config 와 같게
SELLABLE.push(...FISH);

// ── 낚시 자리: 땅에서 물 쪽으로 걸어가 처음 물을 만나는 곳 — 선 자리(x, z) · 찌 자리(wx, wz) ──
const FISH_SPOTS = [];
{
  const isWater = (x, z) => height(x, z) < -0.18;
  const seeds = [[riverX(-40) - 10, -40, 1, 0], [riverX(30) - 10, 30, 1, 0], [riverX(-100) + 10, -100, -1, 0], [riverX(100) + 10, 100, -1, 0], [POND.x + 21, POND.z, -1, 0], [POND.x, POND.z - 21, 0, 1], [POND.x - 21, POND.z, 1, 0], // 개울 · 호수
    [-100, -20, -1, 0], [20, 105, 0, 1], [105, 40, 1, 0], [-70, 95, -1, 1]]; // 바닷가(항구에서 먼 곳)
  const RIP = new THREE.RingGeometry(0.35, 0.5, 20).rotateX(-Math.PI / 2), ripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  const im = new THREE.InstancedMesh(RIP, ripMat, seeds.length), m = new THREE.Matrix4();
  let n = 0;
  for (const [x0, z0, dx, dz] of seeds) {
    let x = x0, z = z0, hit = false;
    for (let k = 0; k < 80; k++) { if (isWater(x, z)) { hit = true; break; } x += dx * 0.25; z += dz * 0.25; }
    if (!hit) continue;
    let sx = x - dx * 1.1, sz = z - dz * 1.1; // 물가에서 한 걸음 뒤에 섬
    for (let k = 0; k < 12 && !free(sx, sz); k++) { sx -= dx * 0.3; sz -= dz * 0.3; }
    const wx = x + dx * 2.2, wz = z + dz * 2.2;
    m.makeTranslation(wx, SEA_Y + 0.33, wz); im.setMatrixAt(n, m);
    FISH_SPOTS.push({ im, i: n, x: +sx.toFixed(2), z: +sz.toFixed(2), wx: +wx.toFixed(2), wz: +wz.toFixed(2), m: m.clone(), circle: null, down: 0 });
    n++;
  }
  im.count = n; im.renderOrder = 2; scene.add(im);
  FISH_SPOTS.ripMat = ripMat;
}

// ── 찌 · 줄(나 + 다른 사람) ──
const BOB_G = new THREE.SphereGeometry(0.09, 10, 8), BOB_M = new THREE.MeshLambertMaterial({ color: 0xff3b2f }), BOB_W = new THREE.MeshLambertMaterial({ color: 0xffffff });
function makeBob() {
  const g = new THREE.Group(), a = new THREE.Mesh(BOB_G, BOB_M), b = new THREE.Mesh(BOB_G, BOB_W); b.position.y = 0.09; b.scale.set(0.8, 0.6, 0.8); g.add(a, b);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf2efe6 }));
  line.frustumCulled = false; scene.add(g, line); return { g, line };
}
function dropBob(b) { if (!b) return; scene.remove(b.g, b.line); b.line.geometry.dispose(); b.line.material.dispose(); }
const fishing = { st: null, s: -1, taps: 0, need: 10, until: 0, bob: null, x: 0, z: 0 }; // 내 낚시: st cast · bite
const TIP = new THREE.Vector3();
function rodTip(obj) { obj.updateMatrixWorld(true); return TIP.set(0.25, 1.75, 0.95).applyMatrix4(obj.matrixWorld); }
function placeBob(b, obj, sp, bite, t) {
  const y = SEA_Y + 0.36 + (bite ? -0.08 + Math.sin(t * 28) * 0.06 : Math.sin(t * 2.4) * 0.03);
  b.g.position.set(sp.wx, y, sp.wz);
  const p = b.line.geometry.attributes.position, tip = rodTip(obj); p.setXYZ(0, tip.x, tip.y, tip.z); p.setXYZ(1, sp.wx, y + 0.1, sp.wz); p.needsUpdate = true;
}
// 낚싯대를 앞으로 든 팔(던진 뒤 · 다른 사람도)
function fishPose(obj, on) { if (!on) return; const p = obj.userData; p.armR.rotation.set(-1.25, 0, 0.1); p.armL.rotation.set(-1.0, -0.4, 0); }

// ── 연타 막대(체력틀 · 체력 그림 조각 재사용 — ChatGPT 조각) ──
const gauge = document.createElement('div'); gauge.id = 'fishGauge'; gauge.hidden = true; gauge.innerHTML = '<b>당겨요! 연타!</b><div class="bar"><i></i></div>'; document.body.appendChild(gauge);
function showGauge() { gauge.hidden = fishing.st !== 'bite'; if (!gauge.hidden) gauge.querySelector('i').style.width = Math.min(100, fishing.taps / fishing.need * 100) + '%'; }

// ── 하기: 던지기 · 연타 · 거두기 ──
function fishAction() {
  if (fishing.st) {
    if (fishing.st === 'bite') { netSend({ t: 'tap' }); return true; }
    netSend({ t: 'reel' }); endFish(); toast('낚싯대를 거뒀어요', FISH_ROD); return true;
  }
  if (!toolIs(FISH_ROD)) return false;
  const t = findTarget(); if (!t || t.type !== 'fish') return false;
  if (!srvOn()) { toast('낚시는 홈페이지에서 로그인하면(함께) 할 수 있어요', FISH_ROD); return true; }
  const sp = t.rec; me.face = Math.atan2(sp.wx - me.x, sp.wz - me.z); me.speed = 0;
  fishing.st = 'cast'; fishing.castAt = clock; fishing.s = FISH_SPOTS.indexOf(sp); fishing.taps = 0; fishing.x = me.x; fishing.z = me.z; fishing.bob = fishing.bob || makeBob();
  netSend({ t: 'cast', s: fishing.s }); splash(0.4);
  return true;
}
function endFish() { fishing.st = null; fishing.s = -1; dropBob(fishing.bob); fishing.bob = null; gauge.hidden = true; }
const fishLabel = () => (fishing.st === 'bite' ? '당겨요! 연타' : fishing.st ? '기다리는 중…' : null); // 390 폭 단추에 맞게(리뷰 13번)

// ── 서버 말 ──
const fishOf = new Map(); // 다른 사람 id → { s, bite, bob }
function onNetFish(m) {
  if (m.t === 'bite') { if (!fishing.st) return; fishing.st = 'bite'; fishing.need = m.need; fishing.taps = 0; fishing.until = clock + m.ms / 1000; splash(0.8); showGauge(); return; }
  if (m.t === 'fishp') { fishing.taps = m.n; showGauge(); return; }
  // m.t === 'fish': 누군가의 낚시 상태
  const mine = m.id === net.id;
  if (mine) {
    if (m.st === 'catch') { jumpFish(m.f, FISH_SPOTS[m.s], me); endFish(); }
    else if (m.st === 'miss') { endFish(); toast('물고기가 도망갔어요'); }
    else if (m.st === 'stop' && (fishing.s === m.s || m.s == null || fishing.st)) endFish();
    return;
  }
  const o = net.others.get(m.id); if (!o) return;
  let f = fishOf.get(m.id);
  if (m.st === 'cast' || m.st === 'bite') { if (!f) { f = { s: m.s, bob: makeBob() }; fishOf.set(m.id, f); } f.s = m.s; f.bite = m.st === 'bite'; }
  else { if (f) { dropBob(f.bob); fishOf.delete(m.id); } if (m.st === 'catch' && FISH_SPOTS[m.s] && Math.hypot(o.x - me.x, o.z - me.z) < 30) jumpFish(m.f, FISH_SPOTS[m.s], o); } // 먼 곳은 생략(리뷰 11번)
}
// 잡은 물고기가 물에서 수달 쪽으로 튀어 오름
const jumps = [];
function jumpFish(f, sp, who) {
  if (!sp || !srcs[f]) return; const vol = Math.max(0.1, 1 - Math.hypot(who.x - me.x, who.z - me.z) / 30); const o = srcs[f].clone(true), b = new THREE.Box3().setFromObject(o), k = 0.45 / Math.max(...b.getSize(new THREE.Vector3()).toArray());
  const g = new THREE.Group(); g.add(o); g.scale.setScalar(k); scene.add(g); jumps.push({ g, t: 0, x0: sp.wx, z0: sp.wz, x1: who.x, z1: who.z }); splash(vol);
}
function fishTick(dt) {
  FISH_SPOTS.ripMat.opacity = 0.25 + 0.2 * Math.sin(clock * 2.2);
  for (const r of FISH_SPOTS) if (r.down && clock > r.down) { r.down = 0; showRec(r); } // 물고기가 다시 참(시각은 서버 res)
  if (fishing.st && !srvOn()) endFish(); // 끊기면 찌를 거둠(리뷰 4번)
  if (fishing.st && fishing.bob) {
    const sp = FISH_SPOTS[fishing.s]; if (sp) placeBob(fishing.bob, me.obj, sp, fishing.st === 'bite', clock);
    if (Math.hypot(me.x - fishing.x, me.z - fishing.z) > 1.2 || me.dead || !toolIs(FISH_ROD)) { netSend({ t: 'reel' }); endFish(); } // 움직이면 거둠
    if (fishing.st === 'bite' && clock > fishing.until + 1.5) endFish(); // 서버 답이 없을 때 대비
    if (fishing.st === 'cast' && clock > fishing.castAt + 10) { netSend({ t: 'reel' }); endFish(); } // 입질이 안 오면(최대 7초 + 여유)
  }
  for (const [id, f] of fishOf) { const o = net.others.get(id); if (!o) { dropBob(f.bob); fishOf.delete(id); continue; } const sp = FISH_SPOTS[f.s]; if (sp) placeBob(f.bob, o.obj, sp, f.bite, clock + id); }
  for (let i = jumps.length - 1; i >= 0; i--) {
    const j = jumps[i]; j.t += dt / 0.8; const t = Math.min(1, j.t);
    j.g.position.set(j.x0 + (j.x1 - j.x0) * t, SEA_Y + 0.3 + Math.sin(t * Math.PI) * 2.2 + t * 0.6, j.z0 + (j.z1 - j.z0) * t); j.g.rotation.z += dt * 9;
    if (j.t >= 1) { scene.remove(j.g); jumps.splice(i, 1); }
  }
}
// 첨벙(Web Audio · gun.js 의 audio · NOISE)
function splash(v) {
  const a = typeof audio === 'function' ? audio() : null; if (!a || !NOISE) return;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8; g.gain.value = 0.18 * v;
  s.connect(f).connect(g).connect(a.destination); s.start(); s.stop(a.currentTime + 0.25);
}
