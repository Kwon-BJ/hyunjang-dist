// 수달섬 — 화면 효과 · 카메라 · 품질 · 한 프레임 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 화면 효과: 미니어처 흐림(위아래) → 색 · 톤 → 색 보정(따뜻하게 · 채도 · 가장자리 어둡게) ─────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const tiltH = new ShaderPass(HorizontalTiltShiftShader), tiltV = new ShaderPass(VerticalTiltShiftShader);
tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
composer.addPass(tiltH); composer.addPass(tiltV);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() { vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, 1.16);
      col *= vec3(1.035, 1.0, 0.95); col = (col - 0.5) * 1.04 + 0.5;
      float lu = dot(col, vec3(0.299, 0.587, 0.114)); col += vec3(-0.025, 0.0, 0.045) * (1.0 - smoothstep(0.05, 0.5, lu)) + vec3(0.03, 0.014, -0.025) * smoothstep(0.55, 1.0, lu);
      vec2 d = vUv - 0.5; col *= mix(0.8, 1.0, smoothstep(0.82, 0.32, length(d * vec2(1.0, 0.92))));
      gl_FragColor = vec4(col, c.a); }`,
});
composer.addPass(grade);

// ───────── 카메라 ─────────
let camH = 7, camD = 8.6;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.aspect = w / h;
  const portrait = h > w; camera.fov = portrait ? 50 : 36; camH = portrait ? 8 : 7; camD = portrait ? 9 : 8.6; // 롱빈터처럼 비스듬히(약 40도) · 세로 화면은 조금 멀리
  camera.updateProjectionMatrix();
  tiltH.uniforms.h.value = 1.7 / w; tiltV.uniforms.v.value = 1.7 / h;
}
addEventListener('resize', resize); resize();
const camAt = new THREE.Vector3(me.x, 0, me.z);
// 확대 3단계(작업지시서 2 A) — 보통에서 세로 휴대폰 수달 키가 화면 높이의 12~14%. 총을 들면 한 단계 멀리(사거리가 화면에 들어오게)
const ZOOM_K = [0.6, 0.76, 1.1], // 잰 값(모자 없음 · 2026-11-18): 세로 390 에서 수달 키 약 16.5% · 13% · 9% (예전 카메라 = 1.0 → 9.8%)
  ZOOM_NAME = ['가까이', '보통', '멀리'];
let zoomLv = 1; try { const z = parseInt(localStorage.getItem('suseom-zoom'), 10); if (z >= 0 && z <= 2) zoomLv = z; } catch { /* */ }
let zoomK = ZOOM_K[zoomLv];
const zoomBtn = document.createElement('button'); zoomBtn.type = 'button'; zoomBtn.id = 'zoomBtn'; zoomBtn.className = 'ui'; document.body.appendChild(zoomBtn);
const zoomWant = () => Math.min(2, zoomLv + (typeof isGun === 'function' && isGun(S.tool) ? 1 : 0));
function paintZoom() { const gun = typeof isGun === 'function' && isGun(S.tool); zoomBtn.textContent = '확대 · ' + ZOOM_NAME[zoomWant()] + (gun && zoomWant() !== zoomLv ? '(총)' : ''); }
function setZoom(l) { zoomLv = ((l % 3) + 3) % 3; try { localStorage.setItem('suseom-zoom', String(zoomLv)); } catch { /* */ } paintZoom(); }
zoomBtn.tabIndex = -1; zoomBtn.onclick = () => { setZoom(zoomLv + 1); zoomBtn.blur(); }; paintZoom();
addEventListener('keydown', (e) => { if (e.code === 'KeyZ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && document.getElementById('win').hidden) setZoom(zoomLv + 1); });
let wheelAcc = 0, wheelAt = 0;
cv.addEventListener('wheel', (e) => { if (e.ctrlKey || !e.deltaY) return; e.preventDefault(); wheelAcc += e.deltaY; const now = performance.now(); if (Math.abs(wheelAcc) < 50 || now - wheelAt < 250) return; setZoom(Math.max(0, Math.min(2, zoomLv + (wheelAcc > 0 ? 1 : -1)))); wheelAcc = 0; wheelAt = now; }, { passive: false }); // 트랙패드 · 관성에 한 번에 끝까지 안 가게

// ───────── 품질 자동 조절 (느린 휴대폰) ─────────
const quality = { level: 2, fps: 0 }; // 2 전부 · 1 흐림 끔 · 풀 반 · 0 그림자 · 효과 끔 · 풀 적게
function setQuality(l) {
  quality.level = l;
  tiltH.enabled = tiltV.enabled = l >= 2;
  grass.count = l >= 2 ? grass.userData.full : l === 1 ? Math.floor(grass.userData.full * 0.5) : Math.floor(grass.userData.full * 0.25);
  sun.castShadow = l >= 1;
}
grass.userData.full = grass.count;
let fpsT = 0, fpsN = 0;

// ───────── 돌리기 ─────────
let clock = 0;
function step(dt) {
  clock += dt;
  let mx = 0, mz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  let mag = Math.hypot(mx, mz), run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (!winEl.hidden || me.dead) mag = 0; // 창이 열려 있거나 쓰러져 있으면 멈춤
  if (me.actSwing === 'shake' && me.actT > 0 && (Math.hypot(mx, mz) || (joy.id !== null && Math.hypot(joy.dx, joy.dy) > 0.15))) me.actT = 0; // 흔들다 움직이면 손을 놓음
  else if (mag) { mx /= mag; mz /= mag; mag = 1; hideHint(); }
  else if (joy.id !== null) { const l = Math.hypot(joy.dx, joy.dy); if (l > 0.15) { mx = joy.dx / l; mz = joy.dy / l; mag = Math.min(1, l); run = l > 0.8; } }
  const target = mag ? (run ? RUN : WALK) * (run ? 1 : Math.max(0.45, mag)) : 0;
  me.speed += (target - me.speed) * Math.min(1, dt * 10);
  me.run = run && mag > 0;
  if (mag) {
    const want = Math.atan2(mx, mz); let d = want - me.face; d = Math.atan2(Math.sin(d), Math.cos(d)); me.face += d * Math.min(1, dt * 12);
    const vx = mx * me.speed * dt, vz = mz * me.speed * dt;
    // 이미 무언가 안에 끼어 있으면(남의 집 · 보관함이 위에 생김, 나무가 다시 자람 등) 막힘 없이 걸어 나오게 — 2026-11-17 「껴서 탈출 못한다」
    const ok = free(me.x, me.z) ? free : (x, z) => Math.hypot(x, z) < islandR(Math.atan2(z, x)) - 2;
    if (ok(me.x + vx, me.z + vz)) { me.x += vx; me.z += vz; }
    else if (ok(me.x + vx, me.z)) me.x += vx;
    else if (ok(me.x, me.z + vz)) me.z += vz;
  }
  me.phase += dt * me.speed * (me.run ? 2.2 : 2.9);
  const amt = Math.min(1, me.speed / WALK);
  me.obj.position.set(me.x, groundY(me.x, me.z) + (me.dead ? 0.22 : 0), me.z); me.obj.rotation.y = me.face;
  life(dt); netTick(dt); newGameTick(dt); if (typeof drawMini === 'function') drawMini(dt);
  animOtter(me.obj, me.phase, amt, me.run, clock, me.actT > 0 ? 1 - me.actT / me.actDur : -1, me.actSwing, me.fit);
  if (typeof gunPose === 'function') gunPose(me.obj, S.tool); // 총을 들었으면 겨누는 팔
  if (typeof fishPose === 'function') fishPose(me.obj, !!fishing.st); // 낚시 중
  const want = new THREE.Vector3(me.x, me.obj.position.y, me.z);
  if (camAt.distanceTo(want) > 8) camAt.copy(want); else camAt.lerp(want, Math.min(1, dt * 6)); // 멀리 옮겨지면(다시 태어남 등) 바로 따라붙음
  { const zw = zoomWant(); zoomK += (ZOOM_K[zw] - zoomK) * Math.min(1, dt * 5); if (zoomBtn.dataset.lv !== String(zw)) { zoomBtn.dataset.lv = zw; paintZoom(); } }
  { const sc = sun.shadow.camera, ext = 20 * Math.max(1, zoomK) + 3; if (Math.abs(sc.right - ext) > 0.05) { sc.left = sc.bottom = -ext; sc.right = sc.top = ext; sc.updateProjectionMatrix(); } } // 멀리(×1.2)에서도 화면 끝까지 그림자
  camera.position.set(camAt.x, camAt.y + camH * zoomK, camAt.z + camD * zoomK); camera.lookAt(camAt.x, camAt.y + 0.6, camAt.z);
  sun.position.set(camAt.x + 16, 24, camAt.z + 10); sun.target.position.copy(camAt);
  U.uTime.value = clock; U.uCam.value.copy(camera.position); U.uPlayer.value.copy(me.obj.position);
}
let last = performance.now();
const testHold = { paused: false, cam: null };
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!testHold.paused) step(dt); // 시험용: 멈춤 · 옆 카메라(시험 사진)
  if (testHold.cam) testHold.cam(camera);
  if (quality.level === 0) renderer.render(scene, camera); else composer.render();
  if (!HQ && quality.level > 0 && clock > 1.5) { // 처음 1.5초 뒤부터 3초씩 재서 느리면 낮춤
    fpsT += dt; fpsN++;
    if (fpsT > 3) { quality.fps = fpsN / fpsT; if (quality.fps < 26) setQuality(quality.level - 1); fpsT = fpsN = 0; }
  }
  requestAnimationFrame(frame);
}
