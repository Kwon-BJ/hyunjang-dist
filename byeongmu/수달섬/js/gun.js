// 수달섬 — 총(권총 · 소총 · 산탄총 · 탄약 · 조준 · 발사 · 장전 · 효과 · 소리) · 밤샘 2단계
// 명중 · 피해 · 탄창은 서버가 정한다. 화면은 쏘는 방향(ang)만 보내고, 서버의 'shot' 으로 총알 길 · 맞음을 그린다.
// 조작: PC 마우스로 조준 · 누르면 발사 · R 장전 / 휴대폰 오른쪽 조준 막대를 당긴 쪽으로 조준 · 발사. 혼자 연습(서버 없음)일 땐 못 쏨.
const GUNS = ['권총', '소총', '산탄총'];
const GUN_INFO = { 권총: { rate: 3, mag: 12, ammo: '권총탄', snd: 1700, len: 0.42 }, 소총: { rate: 8, mag: 30, ammo: '소총탄', snd: 2400, len: 0.75 }, 산탄총: { rate: 1.2, mag: 6, ammo: '산탄', snd: 900, len: 0.7 } }; // 서버 config 와 같게(그리기 · 소리용)
const PACK = { 권총탄: 12, 소총탄: 30, 산탄: 6 };
Object.assign(ITEMS, { 권총: { buy: 6000, tool: true }, 소총: { buy: 14000, tool: true }, 산탄총: { buy: 9000, tool: true }, 권총탄: { buy: 300 }, 소총탄: { buy: 700 }, 산탄: { buy: 400 } }); // 서버 config buy 와 같게(3단계 — 30분 채집 ≈ 권총)
const BUY_ALL = ['도끼', '곡괭이', '낚싯대', '권총', '소총', '산탄총', '권총탄', '소총탄', '산탄', '포탑', '가시덫'];
const buyList = () => (srvOn() ? BUY_ALL : ['도끼', '곡괭이']); // 총 · 탄약 · 낚싯대는 함께일 때만 판다 // 총 · 탄약은 함께일 때만 판다
const isGun = (t) => GUNS.includes(t);
S.mag = {};
const aim = { ang: 0, firing: false, has: false, cd: 0, at: 0 }; // 조준 방향 · 쏘는 중

// ── 화면 단추: 탄약 · 장전 · 조준 막대 (그림은 ChatGPT 조각 ui-탄약틀 · ui-재장전 · ui-조이스틱 · ui-손잡이) ──
const ammoBox = document.createElement('div'); ammoBox.className = 'ui'; ammoBox.id = 'ammoBox'; ammoBox.hidden = true;
ammoBox.innerHTML = '<i class="ic"></i><b>0 / 0</b>'; document.body.appendChild(ammoBox);
const reloadBtn = document.createElement('button'); reloadBtn.type = 'button'; reloadBtn.id = 'reloadBtn'; reloadBtn.className = 'ui'; reloadBtn.setAttribute('aria-label', '장전'); reloadBtn.hidden = true;
if (HAS_TOUCH) { reloadBtn.classList.add('float'); document.body.appendChild(reloadBtn); } else $('btns').insertBefore(reloadBtn, $('actBtn')); // 휴대폰은 조준 막대 곁에 따로(390 폭에서 단추 줄이 넘치지 않게 — 리뷰 7번)
const aimPad = document.createElement('div'); aimPad.id = 'aimPad'; aimPad.hidden = true; aimPad.innerHTML = '<i></i>'; document.body.appendChild(aimPad);
const hitMark = document.createElement('div'); hitMark.id = 'hitmark'; hitMark.textContent = '✕'; document.body.appendChild(hitMark);
function refreshGunHud() {
  const g = isGun(S.tool) && srvOn() ? S.tool : null;
  ammoBox.hidden = reloadBtn.hidden = !g; aimPad.hidden = !g || !HAS_TOUCH;
  if (!g) return;
  ammoBox.querySelector('.ic').style.backgroundImage = ic(g);
  ammoBox.querySelector('b').textContent = aim.reloading > clock ? '장전 중…' : `${S.mag[g] | 0} / ${count(GUN_INFO[g].ammo)}`;
}
reloadBtn.onclick = () => reload();
function reload() { if (isGun(S.tool) && srvOn()) netSend({ t: 'reload' }); }
addEventListener('keydown', (e) => { if (e.code === 'KeyR' && !e.repeat) reload(); });

// PC: 마우스로 조준(땅 높이 평면) · 누르면 발사
const RC = new THREE.Raycaster(), MV = new THREE.Vector2(), PL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), PT = new THREE.Vector3();
cv.addEventListener('mousemove', (e) => {
  if (!isGun(S.tool)) return;
  MV.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); RC.setFromCamera(MV, camera);
  PL.constant = -(groundY(me.x, me.z) + 0.6); if (RC.ray.intersectPlane(PL, PT)) { aim.ang = Math.atan2(PT.x - me.x, PT.z - me.z); aim.has = true; }
});
cv.addEventListener('mousedown', (e) => { if (e.button === 0 && isGun(S.tool)) { aim.firing = true; if (!srvOn()) toast('총은 함께(홈페이지 로그인)일 때만 쏠 수 있어요'); } });
addEventListener('mouseup', () => { aim.firing = false; });
// 휴대폰: 오른쪽 조준 막대 — 당긴 쪽(화면 오른쪽 = 동쪽 · 아래 = 남쪽)으로 조준, 끝까지 당기면 발사
const AIM_R = 52;
function padMove(t) {
  const r = aimPad.getBoundingClientRect(), dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy);
  const k = Math.min(1, l / AIM_R); aimPad.firstChild.style.transform = `translate(${(l ? dx / l : 0) * k * AIM_R}px, ${(l ? dy / l : 0) * k * AIM_R}px)`;
  if (l > 8) { aim.ang = Math.atan2(dx, dy); aim.has = true; } aim.firing = k > 0.45;
}
aimPad.addEventListener('touchstart', (e) => { e.preventDefault(); aim.touch = e.changedTouches[0].identifier; padMove(e.changedTouches[0]); }, { passive: false });
aimPad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === aim.touch) padMove(t); }, { passive: false });
const padEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === aim.touch) { aim.touch = null; aim.firing = false; aim.has = false; aimPad.firstChild.style.transform = ''; } }; // 놓으면 걷는 쪽을 봄
aimPad.addEventListener('touchend', padEnd); aimPad.addEventListener('touchcancel', padEnd);

// ── 쏘기(서버에 요청) — 화면은 바로 불꽃 · 소리, 총알 길은 서버 'shot' 으로 ──
function fireOnce(ang) {
  const g = S.tool; if (!isGun(g) || !srvOn() || me.dead) return false;
  if (aim.reloading > clock) return false; // 장전 중엔 헛불꽃 없이(리뷰 9번)
  if (inSafeC(me.x, me.z)) { if (clock - (aim.safeT || -9) > 1.5) { aim.safeT = clock; toast('안전 구역에서는 쏠 수 없어요'); } return false; }
  if ((S.mag[g] | 0) <= 0) { if (!aim.askedReload) { aim.askedReload = true; toast('탄창이 비었어요 — 장전해요', GUN_INFO[g].ammo); reload(); } return false; }
  me.face = ang; netSend({ t: 'shoot', ang: +ang.toFixed(3) }); muzzle(me.obj, g); bang(g, 1); aim.shots = (aim.shots || 0) + 1;
  return true;
}
function gunTick(dt) {
  aim.cd -= dt;
  const g = S.tool;
  if (isGun(g) && aim.has && !me.dead) me.face = aim.ang; // 총을 들면 조준 쪽을 봄
  if (aim.firing && isGun(g) && aim.cd <= 0 && srvOn()) { if (fireOnce(aim.ang)) aim.cd = 1 / GUN_INFO[g].rate; else aim.cd = 0.3; }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt; if (f.t <= 0) { scene.remove(f.o); if (f.own) { f.o.geometry.dispose(); f.o.material.dispose(); } else if (f.fade) f.o.material.dispose(); fx.splice(i, 1); } else if (f.fade) f.o.material.opacity = f.t / f.t0; } // 다 쓴 그림 조각은 버림(리뷰 8번 · 메모리)
  if ((gunT -= dt) <= 0) { gunT = 0.2; refreshGunHud(); }
}
let gunT = 0;

// ── 손에 든 총(몸에 붙임 · 앞쪽) + 겨누는 팔 ──
function gunMeshFor(src, g) {
  const o = src.clone(true), b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const long = sz.x >= sz.z ? 'x' : 'z', k = GUN_INFO[g].len / Math.max(sz.x, sz.z);
  const inner = new THREE.Group(); inner.add(o); o.position.set(-c.x, -c.y, -c.z); inner.scale.setScalar(k);
  if (long === 'x') inner.rotation.y = -Math.PI / 2; // 긴 쪽을 앞(+z)으로
  const grp = new THREE.Group(); grp.add(inner); grp.position.set(0.1, 0.62, 0.32 + GUN_INFO[g].len * 0.25); grp.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return grp;
}
function ensureGuns(obj) {
  const u = obj.userData; if (u.guns) return u.guns;
  u.guns = {}; for (const g of GUNS) { u.guns[g] = gunMeshFor(srcs[g], g); u.guns[g].visible = false; u.body.add(u.guns[g]); }
  return u.guns;
}
function gunPose(obj, tool) {
  const gs = ensureGuns(obj), on = isGun(tool);
  for (const g of GUNS) gs[g].visible = tool === g;
  if (!on) return;
  const p = obj.userData; p.armR.rotation.set(-1.5, 0, 0.05); p.armL.rotation.set(-1.3, -0.55, 0); // 두 팔로 받쳐 겨눔
}
// 총구 위치(월드)
const MZ = new THREE.Vector3();
function muzzlePos(obj, g) { const gun = ensureGuns(obj)[g]; obj.updateMatrixWorld(true); return MZ.set(0, 0, GUN_INFO[g].len * 0.55).applyMatrix4(gun.matrixWorld); }

// ── 효과: 총구 불꽃 · 총알 길 · 닿은 곳 ──
const fx = [];
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffd85a }), PUFF_G = new THREE.SphereGeometry(0.09, 8, 6), FLASH_G = new THREE.SphereGeometry(0.11, 8, 6);
function muzzle(obj, g) { const m = new THREE.Mesh(FLASH_G, FLASH); m.position.copy(muzzlePos(obj, g)); m.scale.set(1, 1, 1.8); scene.add(m); fx.push({ o: m, t: 0.06 }); }
function tracer(x0, y, z0, x1, z1) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z1)]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 1 })); scene.add(l); fx.push({ o: l, t: 0.12, t0: 0.12, fade: true, own: true });
}
function puff(x, y, z, hit) { const m = new THREE.Mesh(PUFF_G, new THREE.MeshBasicMaterial({ color: hit ? 0xd8322a : 0xd9d2c0, transparent: true, opacity: 0.9 })); m.position.set(x, y, z); scene.add(m); fx.push({ o: m, t: 0.18, t0: 0.18, fade: true }); }

// ── 소리(Web Audio 로 만듦 · 소리 파일 없음) ──
let AC = null, NOISE = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); const n = AC.sampleRate * 0.3; NOISE = AC.createBuffer(1, n, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2; } catch { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume(); return AC;
}
const wake = () => { if (!AC || AC.state !== 'running') audio(); }; // 아이폰 사파리는 touchend · click 에서만 소리를 풀어 줄 때가 있음(리뷰 10번 · 실기기 미확인)
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, wake, { passive: true });
function bang(g, vol) {
  const a = audio(); if (!a || vol < 0.03) return;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  s.buffer = NOISE; f.type = 'lowpass'; f.frequency.value = GUN_INFO[g].snd; v.gain.value = 0.35 * vol;
  s.connect(f).connect(v).connect(a.destination); s.start(); s.stop(a.currentTime + (g === '산탄총' ? 0.28 : 0.16));
}
function ding() { const a = audio(); if (!a) return; const o = a.createOscillator(), v = a.createGain(); o.frequency.value = 1400; v.gain.value = 0.08; o.connect(v).connect(a.destination); o.start(); o.stop(a.currentTime + 0.05); }

// ── 서버 말: shot · mag · reloading ──
function onNetGun(m) {
  if (m.t === 'shot') {
    if (m.tid) turretShot(m); // 포탑이 쏨(8단계)
    const mine = m.id === net.id, o = mine ? null : net.others.get(m.id), obj = mine ? me.obj : o && o.obj;
    if (obj && GUN_INFO[m.g]) { if (!mine) { muzzle(obj, m.g); bang(m.g, Math.max(0, 1 - Math.hypot(o.x - me.x, o.z - me.z) / 40)); } }
    const y = groundY(m.ox, m.oz) + 0.68;
    for (const [x, z, who] of m.ends) { tracer(m.ox, y, m.oz, x, z); if (who !== 0) puff(x, y, z, who > 0); }
    if (mine && m.ends.some((e) => e[2] > 0)) { hitMark.classList.remove('on'); void hitMark.offsetWidth; hitMark.classList.add('on'); ding(); }
    if (!m.tid) lastShot = m; // 포탑 총알은 시험용 기록에 안 남김
  } else if (m.t === 'mag') { S.mag[m.g] = m.n; aim.askedReload = false; if (m.empty) { toast('탄창이 비었어요 — 장전해요', GUN_INFO[m.g] && GUN_INFO[m.g].ammo); reload(); } refreshGunHud(); }
  else if (m.t === 'reloading') { aim.reloading = clock + m.ms / 1000; aim.askedReload = false; refreshGunHud(); }
}
let lastShot = null;
