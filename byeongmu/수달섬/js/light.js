// 수달섬 — 밤 불빛(작업지시서 2 C · 2026-11-18). 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀.
// 불빛마다 「빛 번짐 그림」(더하기 섞기 스프라이트)을 두고, 진짜 조명(PointLight)은 내 둘레에서 가까운 것부터 몇 개만 켠다(저사양 4 · 고사양 8 — 내 등불 포함).
// 불빛: 모닥불(광장 · 항구 · 야영지) · 가로등 · 자판기 · 집 창문 · 텐트 등불 · 포탑 빨간 불 · 총 불꽃(잠깐).
const GLOW_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.55)'); gr.addColorStop(0.55, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glows = new Set();
// real: 진짜 조명으로 켤 때의 { i: 세기, d: 닿는 거리, fire: 일렁임, prio: 먼저 켤 정도 }
function addGlow(x, y, z, color, size, real = null, opacity = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, fog: false })); // 안개색이 더해져 푸른 얼룩이 되지 않게 — 멀면 lightTick 이 흐리게(리뷰 9)
  s.position.set(x, y, z); s.scale.setScalar(size); s.renderOrder = 3; scene.add(s);
  const g = { s, x, y, z, color: new THREE.Color(color), size, real, life: 0, op: opacity }; glows.add(g); return g;
}
function removeGlow(g) { if (!g || !glows.has(g)) return; scene.remove(g.s); g.s.material.dispose(); glows.delete(g); lightT = 0; }
// 내 등불(늘 켬) + 나눠 쓰는 조명 7개(고사양 7 · 저사양 3 만 보임)
const myLamp = new THREE.PointLight(0xffd29a, 2.2, 7, 1.6); scene.add(myLamp);
const lightPool = []; for (let i = 0; i < 7; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.7); scene.add(l); lightPool.push(l); }
let lightN = 7, lightT = 0;
function setLightBudget(total) { lightN = Math.max(0, Math.min(7, total - 1)); lightPool.forEach((l, i) => { l.visible = i < lightN; }); lightT = 0; } // total: 내 등불 포함
// 가로등(나무 기둥 + 빛나는 등)
const LAMP_POST = new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8).translate(0, 1.3, 0), LAMP_HEAD = new THREE.SphereGeometry(0.2, 14, 10);
const lampPostMat = new THREE.MeshLambertMaterial({ color: 0x4a3423 }), lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff1cc, emissive: 0xffd88a, emissiveIntensity: 1.6 });
function makeLamp(x, z) {
  const y = Math.max(0, height(x, z)), p = new THREE.Mesh(LAMP_POST, lampPostMat), h = new THREE.Mesh(LAMP_HEAD, lampHeadMat);
  p.position.set(x, y, z); h.position.set(x, y + 2.7, z); p.castShadow = true; scene.add(p, h); circles.push({ x, z, r: 0.16 });
  return addGlow(x, y + 2.7, z, 0xffd9a0, 1.9, { i: 5, d: 11 });
}
// 길을 따라 가로등 자리: 선분 [ax, az, bx, bz] 위 t 자리에서 옆으로 side 칸
const alongPath = (sg, t, side) => { const dx = sg[2] - sg[0], dz = sg[3] - sg[1], l = Math.hypot(dx, dz) || 1; return [sg[0] + dx * t - dz / l * side, sg[1] + dz * t + dx / l * side]; };
function buildLights() {
  for (const [n, x, z] of PROPS) if (n === '모닥불') addGlow(x, Math.max(0, height(x, z)) + 0.8, z, 0xff8a3a, 2.4, { i: 6, d: 10, fire: 1, prio: 2 });
  const spots = [[PLAZA.x + 6.5, PLAZA.z + 6.5], [PLAZA.x - 6.5, PLAZA.z + 6.5], [PLAZA.x + 6.5, PLAZA.z - 6.5], [PLAZA.x - 6.5, PLAZA.z - 6.5], [CAMP.x + 4, CAMP.z + 5], [FARM.x - 3, FARM.z + 6]];
  for (const i of [0, 1, 4, 5, 8, 11, 12]) for (const t of [0.3, 0.7]) spots.push(alongPath(PATHS[i], t, 2.1)); // 항구에서 나가는 길 · 광장 둘레 길
  for (const b of BRIDGES) spots.push([b.x - b.half - 0.6, b.z + 2.0], [b.x + b.half + 0.6, b.z - 2.0]);
  for (const [x, z] of spots) if (free(x, z, 0.3) && height(x, z) > -0.05) makeLamp(x, z);
  for (const g of vendObjs) { const a = g.rotation.y; addGlow(g.position.x + Math.sin(a) * 0.45, g.position.y + 1.1, g.position.z + Math.cos(a) * 0.45, g.userData.glow || 0xffffff, 1.2, { i: 1.4, d: 4.5 }, 0.4); }
}
// 남의 · 내 집 불빛: 큰 집 단계는 창문, 텐트는 입구 등불
function houseGlow(at, tier, box) {
  return tier === 0 ? addGlow(at.x + 0.75, Math.max(0, height(at.x, at.z)) + 0.9, box.z1 + 0.25, 0xffc070, 1.2, { i: 2.2, d: 5 }) : addGlow(at.x, Math.max(0, height(at.x, at.z)) + HOUSES[tier].h * 0.32, box.z1 + 0.15, 0xffc070, 1.6, { i: 2.8, d: 6 });
}
// 총 불꽃: 잠깐 주변이 밝아짐(조명 하나를 먼저 씀)
function flashAt(x, z, y = 1.0) { if (document.hidden || Math.hypot(x - me.x, z - me.z) > 40) return; // 숨은 창 · 먼 총소리는 건너뜀(리뷰 11)
  const g = addGlow(x, y, z, 0xffd27a, 2.2, { i: 12, d: 8, prio: 50 }, 0.85); g.life = 0.08; lightT = 0; }
const LV = new THREE.Vector3();
function lightTick(dt) {
  const p = me.obj.position; myLamp.position.set(p.x, p.y + 1.8, p.z);
  blobTick();
  for (const g of [...glows]) {
    { const d = Math.hypot(g.x - camera.position.x, g.z - camera.position.z); g.s.material.opacity = g.op * (1 - sstep(40, 100, d)); g.s.visible = d < 100; }
    if (g.life) { g.life -= dt; if (g.life <= 0) { removeGlow(g); continue; } }
    if (g.real && g.real.fire) { const f = 0.85 + 0.15 * Math.sin(clock * 11 + g.x) * Math.sin(clock * 7.3 + g.z); g.s.scale.setScalar(g.size * f); g.f = f; }
  }
  if ((lightT -= dt) > 0) { for (let i = 0; i < lightN; i++) { const l = lightPool[i], g = l.userData.g; if (g && g.real.fire) l.intensity = g.real.i * (g.f || 1); } return; }
  lightT = 0.25;
  const cand = []; for (const g of glows) if (g.real) { const d = Math.hypot(g.x - p.x, g.z - p.z); if (d < 30) cand.push([d - (g.real.prio || 0), g]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < lightPool.length; i++) {
    const l = lightPool[i], c = i < lightN ? cand[i] : null;
    if (!c) { l.intensity = 0; l.userData.g = null; continue; }
    const g = c[1]; l.position.set(g.x, g.y, g.z); l.color.copy(g.color); l.intensity = g.real.i; l.distance = g.real.d; l.userData.g = g;
  }
}
// 저사양: 진짜 그림자 대신 수달 밑 둥근 가짜 그림자
const BLOB_G = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2), BLOB_M = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
let blobsOn = false;
function setBlobs(on) { blobsOn = on; }
function blobOf(obj) { let b = obj.userData.blobShadow; if (!b) { b = obj.userData.blobShadow = new THREE.Mesh(BLOB_G, BLOB_M); b.position.y = 0.03; b.renderOrder = 1; obj.add(b); } return b; }
function blobTick() { blobOf(me.obj).visible = blobsOn; for (const o of net.others.values()) blobOf(o.obj).visible = blobsOn; }
