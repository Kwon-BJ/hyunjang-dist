// 수달섬 — 함정(밤샘 8단계): 기관총 포탑 · 가시덫. 놓기 · 탄약 넣기 · 부수기 요청만 보내고, 조준 · 발사 · 피해는 서버가 한다.
// 포탑 = 통 + 소총(코드로 조립 · CC0 모델) · 가시덫 = 덫 모델. 가시덫은 놓은 사람에게만 뚜렷하고 남에게는 흐릿하게.
const TRAP_ITEMS = ['포탑', '가시덫', '모닥불']; // 모닥불: D단계 — 집 둘레에 놓는 내 모닥불
Object.assign(ITEMS, { 포탑: { buy: 4000, tool: true }, 가시덫: { buy: 300, tool: true } }); // 서버 config 와 같게
const BULB_G = new THREE.SphereGeometry(0.07, 10, 8), BULB_M = new THREE.MeshBasicMaterial({ color: 0xff3030 }); // 포탑 빨간 불(모두 같이 씀 · 리뷰 10)
const traps = new Map(); // id → { ...서버 값, obj, gun }
function makeTrapObj(t) {
  const mine = t.owner === net.name;
  if (t.kind === 'fire') { const o = placeModel(srcs['모닥불'], t.x, t.z, 0, 0.75, ''), circle = { x: t.x, z: t.z, r: 0.4 }; circles.push(circle); return { obj: o, circle, glow: addGlow(t.x, Math.max(0, height(t.x, t.z)) + 0.8, t.z, 0xff8a3a, 2.2, { i: 5, d: 9, fire: 1 }) }; }
  if (t.kind === 'turret') {
    const base = placeModel(srcs['통'], t.x, t.z, 0, 0.95, '');
    // 연사포탑은 기관총 · 산탄포탑은 산탄총 모형(doll.js) · 기본 포탑은 소총
    const gun = (srcs[{ 연사포탑: '기관총', 산탄포탑: '산탄총' }[t.item]] || srcs['소총']).clone(true), b = new THREE.Box3().setFromObject(gun), sz = b.getSize(new THREE.Vector3()), k = 0.9 / Math.max(sz.x, sz.z);
    const inner = new THREE.Group(); inner.add(gun); gun.position.set(-(b.min.x + sz.x / 2), -b.min.y, -(b.min.z + sz.z / 2)); inner.scale.setScalar(k); if (sz.x > sz.z) inner.rotation.y = -Math.PI / 2;
    const pivot = new THREE.Group(); pivot.add(inner); pivot.position.set(t.x, Math.max(0, height(t.x, t.z)) + 0.95, t.z); scene.add(pivot);
    pivot.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    const circle = { x: t.x, z: t.z, r: 0.5 }; circles.push(circle);
    const bulb = new THREE.Mesh(BULB_G, BULB_M); bulb.position.set(0, 0.32, 0); pivot.add(bulb); // 포탑 빨간 불(C단계)
    // 연사 · 산탄 포탑은 총 색으로 구별(작업지시서 4 C · craft.js)
    if (typeof gradeLook === 'function') gradeLook(pivot, t.item);
    return { obj: base, gun: pivot, circle, glow: addGlow(t.x, pivot.position.y + 0.32, t.z, 0xff2a2a, 0.8, null, 0.9) };
  }
  // 내 제작대(작업지시서 4 C): 작업대 모형 · 막힘 원
  if (t.kind === 'bench') { const o = placeModel(srcs['작업대'] || srcs['상자'], t.x, t.z, (t.id * 37) % 360, 1.0, ''), circle = { x: t.x, z: t.z, r: 0.6 }; circles.push(circle); return { obj: o, circle }; }
  // 폭발덫은 제 모형(둥근 지뢰 · doll.js) · 나머지 덫은 가시덫 모형
  const o = placeModel(srcs[t.item] || srcs['가시덫'], t.x, t.z, (t.id * 53) % 360, 0.28, '');
  // 철가시덫 · 올가미덫 · 폭발덫은 색으로 구별
  if (typeof gradeLook === 'function') gradeLook(o, t.item);
  o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = !mine; m.material.opacity = mine ? 1 : 0.22; m.castShadow = mine; } }); // 남에게는 흐릿하게
  return { obj: o };
}
function addTrap(t) {
  const old = traps.get(t.id); if (old) { Object.assign(old, t); return; }
  traps.set(t.id, { ...t, ...makeTrapObj(t) });
}
function removeTrap(id) {
  const t = traps.get(id); if (!t) return; scene.remove(t.obj); if (t.gun) scene.remove(t.gun); if (t.glow) removeGlow(t.glow);
  if (t.circle) { const i = circles.indexOf(t.circle); if (i >= 0) circles.splice(i, 1); }
  t.obj.traverse((m) => { if (m.isMesh && t.kind === 'spike') m.material.dispose(); }); traps.delete(id);
}
function clearTraps() { for (const id of [...traps.keys()]) removeTrap(id); }
// ── 대상: 놓기(함정을 손에 들고 · 내 집 둘레) · 탄약 넣기(내 포탑) · 부수기(남의 포탑 · 덫) ──
const PLACE_AT = { x: 0, z: 0 };
function trapTargets(see) {
  if (!srvOn()) return;
  if (TRAP_ITEMS.includes(S.tool) && HOUSE_AT) {
    const x = me.x + Math.sin(me.face) * 1.3, z = me.z + Math.cos(me.face) * 1.3;
    const sf = SAFE || SAFE_DEF; if (Math.hypot(x - HOUSE_AT.x, z - HOUSE_AT.z) < 6 && Math.hypot(x - sf.x, z - sf.z) >= sf.r + 25) { PLACE_AT.x = x; PLACE_AT.z = z; see('place', PLACE_AT, x, z, 1.5, 1.0); } // 함정을 들었으면 꽃 · 풀보다 놓기가 먼저(2026-11-18 시험에서 드러남)
  }
  for (const t of traps.values()) {
    const mine = t.owner === net.name;
    if (mine && t.kind === 'turret') see('tload', t, t.x, t.z, 1.6, 0.2);
    else if (!mine && !inSafeC(me.x, me.z)) see('trap', t, t.x, t.z, t.kind === 'turret' ? 1.6 : 1.1, 0.4); // 남의 가시덫도 바로 앞(1.1칸)이면 부수기(요청 3)
  }
}
const trapLabel = (t) => (t.type === 'place' ? `${nameOf(S.tool)} 놓기` : t.type === 'tload' ? `탄약 넣기 (${t.rec.ammo})` : t.type === 'trap' ? (t.rec.kind === 'turret' ? '포탑 부수기' : t.rec.kind === 'fire' ? '모닥불 부수기' : '덫 부수기') : null);
function trapAction(t) {
  if (t.type === 'place') { netSend({ t: 'place', x: +t.x.toFixed(2), z: +t.z.toFixed(2) }); return true; }
  if (t.type === 'tload') { netSend({ t: 'tload', id: t.rec.id }); return true; }
  if (t.type === 'trap') { me.actT = me.actDur = 0.45; net.ac++; actCool = toolIs('도끼') ? 0.7 : 0.6; me.actSwing = meleeSwing(); netSend({ t: 'thit', id: t.rec.id }); return true; }
  return false;
}
// ── 서버 말 ──
function onNetTrap(m) {
  if (m.t === 'trap') addTrap(m.tr);
  else if (m.t === 'trapgone') { const t = traps.get(m.id); if (t && !m.back) { puffAt(t.x, t.z); toast(t.owner === net.name ? `내 ${t.item}이 부서졌어요`.replace('가시덫이', '가시덫이') : `${t.item}을 부쉈어요`); } removeTrap(m.id); }
  else if (m.t === 'spiked') { const t = traps.get(m.id); if (t && m.who === net.id) toast('가시덫을 밟았어요!'); }
}
function puffAt(x, z) { for (let i = 0; i < 4; i++) puffDust(x + (Math.random() - 0.5), z + (Math.random() - 0.5), 1.6); }
// 포탑이 쏠 때: 총구를 겨눈 쪽으로 · 불꽃 · 소리(gun.js 'shot' 에서 부름)
function turretShot(m) {
  const t = traps.get(m.tid) || guardObjs.get(m.tid); if (!t || !t.gun) return; // 경비 포탑도
  const e = m.ends[0]; t.gun.rotation.y = Math.atan2(e[0] - t.x, e[1] - t.z); t.ammo = m.ammo ?? t.ammo;
  const f = new THREE.Mesh(FLASH_G, FLASH); f.position.set(t.x + Math.sin(t.gun.rotation.y) * 0.55, t.gun.position.y + 0.12, t.z + Math.cos(t.gun.rotation.y) * 0.55); scene.add(f); fx.push({ o: f, t: 0.06 }); flashAt(f.position.x, f.position.z, f.position.y);
  bang('소총', Math.max(0, 1 - Math.hypot(t.x - me.x, t.z - me.z) / 40));
}
