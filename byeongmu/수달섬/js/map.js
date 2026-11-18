// 수달섬 — 미니맵 (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 미니맵 (북쪽 위 · 섬 전체) — 바탕(땅 · 물 · 길 · 나무 · 건물)은 한 번만 그리고, 상점 · 집 · 사람은 0.2초마다 ─────────
const MAP_R = 70, miniEl = $('mini'), mcv = $('miniCv'), mg = mcv.getContext('2d'), MS = mcv.width;
const mp = (x, z) => [(x + MAP_R) / (2 * MAP_R) * MS, (z + MAP_R) / (2 * MAP_R) * MS];
const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = MS;
function buildMapBase() { // 모델(헛간 등)을 놓은 뒤 main 이 부름
  const g = mapBase.getContext('2d'), im = g.createImageData(MS, MS), d = im.data;
  for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) {
    const x = (i + 0.5) / MS * 2 * MAP_R - MAP_R, z = (j + 0.5) / MS * 2 * MAP_R - MAP_R, h = height(x, z);
    let c;
    if (h < -0.18) c = h < -0.6 ? [72, 160, 204] : [116, 202, 216];
    else if (Math.hypot(x, z) > islandR(Math.atan2(z, x)) - 8) c = [240, 224, 172];
    else if (pathDist(x, z) < 1.6) c = [218, 186, 130];
    else { const k = Math.min(1, Math.max(0, h) / 2.5); c = [128 + 40 * k, 190 + 14 * k, 88 + 30 * k]; }
    d.set([c[0], c[1], c[2], 255], (j * MS + i) * 4);
  }
  g.putImageData(im, 0, 0);
  g.fillStyle = 'rgba(38, 104, 46, .6)'; for (const r of TREES) { const [x, z] = mp(r.x, r.z); g.beginPath(); g.arc(x, z, 2.4, 0, 7); g.fill(); }
  g.fillStyle = '#a84636'; for (const b of boxes) { const [x0, z0] = mp(b.x0, b.z0), [x1, z1] = mp(b.x1, b.z1); g.fillRect(x0, z0, Math.max(2, x1 - x0), Math.max(2, z1 - z0)); }
  g.fillStyle = '#9a6a3a'; { const [x0, z0] = mp(BRIDGE.x - BRIDGE.half, -1.5), [x1, z1] = mp(BRIDGE.x + BRIDGE.half, 1.5); g.fillRect(x0, z0, x1 - x0, z1 - z0); }
  { const [x0, z0] = mp(DOCK.x - DOCK.half, DOCK.z0), [x1, z1] = mp(DOCK.x + DOCK.half, DOCK.z1); g.fillRect(x0, z0, Math.max(2, x1 - x0), z1 - z0); } // 부두
}
const imgOf = {}, iconImg = (id) => imgOf[id] || ((imgOf[id] = new Image()).src = `img/i-${id}.webp`, imgOf[id]);
let miniT = 0;
function mapLabel(text, x, y) { mg.font = '800 15px system-ui, sans-serif'; mg.textAlign = 'center'; mg.lineWidth = 4; mg.strokeStyle = 'rgba(255, 248, 230, .95)'; mg.strokeText(text, x, y); mg.fillStyle = '#4a2e14'; mg.fillText(text, x, y); }
function drawMini(dt) {
  if ((miniT -= dt) > 0) return; miniT = 0.2;
  const big = miniEl.classList.contains('big'), I = big ? 22 : 36; // 작을 땐 아이콘을 크게(화면에선 작아짐)
  mg.clearRect(0, 0, MS, MS); mg.drawImage(mapBase, 0, 0);
  for (const h of net.houses.values()) { const [x, z] = mp(h.x, h.z); mg.fillStyle = '#8a5a3a'; mg.fillRect(x - 4, z - 4, 8, 8); }
  const [sx, sz] = mp(SHOP_AT.x, SHOP_AT.z - 1.6), si = iconImg('조개'); if (si.complete) mg.drawImage(si, sx - I / 2, sz - I / 2, I, I);
  const [hx, hz] = HOUSE_AT ? mp(HOUSE_AT.x, HOUSE_AT.z) : [-99, -99], hi = iconImg(HOUSES[S.tier].model); if (HOUSE_AT && hi.complete) mg.drawImage(hi, hx - I / 2, hz - I / 2, I, I); // 집이 없으면(텐트 치기 전) 안 그림
  if (big) { mapLabel('상점', sx, sz + I / 2 + 15); if (HOUSE_AT) mapLabel('내 집', hx, hz + I / 2 + 15); }
  for (const o of net.others.values()) {
    const [x, z] = mp(o.x, o.z); mg.beginPath(); mg.arc(x, z, big ? 4 : 6, 0, 7); mg.fillStyle = '#' + lookOf(o.name).color.toString(16).padStart(6, '0'); mg.fill(); mg.lineWidth = 2; mg.strokeStyle = '#fff'; mg.stroke();
    if (big) { mg.font = '700 11px system-ui, sans-serif'; mg.fillStyle = '#2a1a0a'; mg.textAlign = 'center'; mg.fillText(o.name, x, z - 7); }
  }
  const [mx, mz] = mp(me.x, me.z), k = big ? 0.8 : 1.4;
  mg.save(); mg.translate(mx, mz); mg.rotate(Math.PI - me.face); mg.scale(k, k);
  mg.beginPath(); mg.moveTo(0, -10); mg.lineTo(7, 7); mg.lineTo(0, 3); mg.lineTo(-7, 7); mg.closePath();
  mg.fillStyle = '#e8453c'; mg.fill(); mg.lineWidth = 2.5; mg.strokeStyle = '#fff'; mg.stroke(); mg.restore();
}
miniEl.addEventListener('click', () => { miniEl.classList.toggle('big'); miniT = 0; });
