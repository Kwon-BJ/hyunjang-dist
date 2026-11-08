/* 경마장 화면(2026-11-08 부장님 「말 타고 사람이 경주 · 현실감 · 여러 명 실시간 · 로그인 없이 · 운영자가 열 때만 · 단승 · 복승 · 판마다 배당」)
   시안 보관/시안/01-경마중계.png — ① 걸기(출전표 · 걸기 판) ② 중계(옆에서 따라가는 카메라 · 순위표 · 미니 지도 · 남은 거리 · 자막) ③ 결과(사진 판정 · 확정 순위 · 배당 · 내 결과 · TOP 5)
   서버(서버/src/index.js · DerbyHall)가 착순을 먼저 정하고 0.25초마다 자리(fr)와 일(ev)을 보냄 → 모두 같은 경주를 그림. 결승선은 서버가 정한 시각(fin)에 정확히 넘게 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id), el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const Q = new URLSearchParams(location.search);
  const WS = Q.get('ws') || 'wss://derby-race.byeongmu-munpa.workers.dev'; // 로컬 시험: ?ws=ws://127.0.0.1:8788
  const LEN = 1600, KF = 0.25, N = 8;
  const COL = ['#f4f4f4', '#1b1b1b', '#d6303a', '#2a63d6', '#f2c514', '#2a9a4a', '#f07b1d', '#ef6fae']; // 번호 색 = 승부복 색(1 흰 · 2 검정 · 3 빨강 · 4 파랑 · 5 노랑 · 6 초록 · 7 주황 · 8 분홍)
  const STY = ['선행', '선입', '추입'];
  const money = (n) => Math.floor(n || 0).toLocaleString('ko-KR');
  const no = (h) => { const i = el('i', 'no n' + (h + 1), String(h + 1)); return i; };
  const toastT = { t: 0 }; const toast = (m, ms) => { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT.t); toastT.t = setTimeout(() => { t.hidden = true; }, ms || 2500); };
  // 브라우저마다 열쇠(로그인 없음) · 닉네임
  let pid = ''; try { pid = localStorage.getItem('derby_pid') || ''; } catch (e) {}
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(pid)) { const a = new Uint8Array(18); crypto.getRandomValues(a); pid = btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); try { localStorage.setItem('derby_pid', pid); } catch (e) {} }
  let nick = ''; try { nick = localStorage.getItem('derby_nick') || ''; } catch (e) {}

  let ws = null, S = { ph: 'idle' }, retry = 0, opPass = '', plan = null, startAt = 0, drawnKey = '', tab = 'w', pick = [], amt = 0, calls = [], callShown = new Set(), lastLead = -1;

  /* ── 말 그림 ── img/horse.webp(질주 동작 n칸 가로) + horse.json { n, fw, fh, silk: 마젠타를 바꿀지 } · 없으면 임시 모양 */
  const SP = { ok: false, img: null, n: 1, fw: 0, fh: 0, col: [] };
  fetch('img/horse.json?v=1').then((r) => (r.ok ? r.json() : null)).then((j) => { if (!j) return; const im = new Image(); im.onload = () => { Object.assign(SP, j, { img: im, ok: true }); SP.col = COL.map((c) => recolor(im, c)); }; im.src = 'img/horse.webp?v=' + (j.v || 1); }).catch(() => {});
  function recolor(im, hex) { // 마젠타(승부복) 칸만 그 말 색으로 — 밝기(주름 · 그림자)는 그대로
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data, R = parseInt(hex.slice(1, 3), 16), G = parseInt(hex.slice(3, 5), 16), B = parseInt(hex.slice(5, 7), 16), lum0 = (R * 0.3 + G * 0.59 + B * 0.11) / 255;
    for (let i = 0; i < p.length; i += 4) { const r = p[i], gg = p[i + 1], b = p[i + 2]; if (p[i + 3] < 10) continue; const mx = Math.max(r, b), mn = gg; if (mx > 70 && r > gg * 1.45 && b > gg * 1.45 && Math.abs(r - b) < 90) { const l = (r + b) / 2 / 255, k = (l / 0.85) * (lum0 < 0.25 ? 2.2 : 1); p[i] = Math.min(255, R * k + (lum0 < 0.25 ? 18 * l : 0)); p[i + 1] = Math.min(255, G * k + (lum0 < 0.25 ? 18 * l : 0)); p[i + 2] = Math.min(255, B * k + (lum0 < 0.25 ? 18 * l : 0)); void mn; } }
    g.putImageData(d, 0, 0); return c;
  }
  const far = new Image(); far.src = 'img/bg-far.webp?v=1';

  /* ── 경주 자리 ── 서버 자리(fr · 0.25초) 사이를 잇고, 결승선은 fin 시각에 정확히 */
  const posAt = (h, t) => { const F = plan.fr; if (!F || !F.length) return 0; const u = Math.max(0, t / KF), k = Math.min(F.length - 1, Math.floor(u)), n = Math.min(F.length - 1, k + 1), f = u - k; let x = (F[k][h] + (F[n][h] - F[k][h]) * f) / 1000; const T = plan.fin[h]; if (T) x = t < T ? Math.min(x, 0.999 - Math.max(0, T - t) * 0.0015) : Math.max(x, 1 + (t - T) * 0.008); return x; };
  const stateAt = (h, t) => { let s = ''; for (const e of plan.ev || []) { if (e[1] > t) break; const d = e[0] === 'b' ? e[4] : e[3] || 0; if (t > e[1] + (d || 0)) continue; if (e[2] === h || (e[0] === 'b' && e[3] === h)) s = e[0]; } return s; };

  /* ── 그리기 ── */
  const cv = $('cv'); let g = cv.getContext('2d'), W = 0, H = 0, camX = 0, dust = [], OFF = false;
  const fit = () => { if (OFF) return; const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.round(r.width * dpr); H = Math.round(r.height * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } };
  function withTarget(c, fn) { const s = [g, W, H, camX, OFF]; g = c.getContext('2d'); W = c.width; H = c.height; OFF = true; try { fn(); } finally { [g, W, H, camX, OFF] = s; } } // 사진 판정처럼 다른 캔버스에 한 장 그릴 때
  const VIEW = 46; // 화면 너비 = 46m
  const laneY = (d) => H * (0.585 + d * 0.05), laneS = (d) => 0.6 + d * 0.055; // 깊이(0 안쪽 · 먼 쪽 ~ 7 바깥쪽 · 가까운 쪽)
  function scene(t, mode) { // mode: 'gate' 출발 전 · 'run' · 'end' · 'photo'(결승선을 화면 55% 에)
    fit(); const ppm = W / VIEW;
    const xs = [...Array(N).keys()].map((h) => (mode === 'gate' ? -h * 0.9 / LEN : posAt(h, t)) * LEN); // 출발 전엔 게이트처럼 비스듬히
    const lead = Math.max(...xs), target = mode === 'gate' ? -VIEW * 0.25 : mode === 'photo' ? LEN - VIEW * 0.55 : lead - VIEW * 0.62; // 결승 뒤에도 선두를 따라감(결과 때 빈 주로만 보였음)
    camX = mode === 'run' ? camX + (target - camX) * 0.12 : target; // 선두를 화면 62% 쯤에
    // 하늘 · 관중석(먼 층 · 천천히) — 좌우로 뒤집어 이어 붙임
    const fh = H * 0.6; g.fillStyle = '#6aa6e8'; g.fillRect(0, 0, W, fh);
    if (far.complete && far.naturalWidth) { const fw = (far.naturalWidth / far.naturalHeight) * fh, off = ((camX * ppm * 0.07) % (fw * 2) + fw * 2) % (fw * 2); for (let k = -1; k < Math.ceil(W / fw) + 2; k++) { const x = k * fw - off; g.save(); if (k % 2) { g.translate(x + fw, 0); g.scale(-1, 1); g.drawImage(far, 0, 0, fw, fh); } else g.drawImage(far, x, 0, fw, fh); g.restore(); } }
    // 잔디 주로 — 깎은 줄무늬가 카메라와 같이 흐름
    const ty = H * 0.53; const gr = g.createLinearGradient(0, ty, 0, H); gr.addColorStop(0, '#3f8a33'); gr.addColorStop(1, '#2d6e25'); g.fillStyle = gr; g.fillRect(0, ty, W, H - ty);
    const sw = 8 * ppm, so = ((camX * ppm) % (sw * 2) + sw * 2) % (sw * 2); g.fillStyle = 'rgba(255,255,255,.05)'; for (let x = -so; x < W + sw; x += sw * 2) { g.beginPath(); g.moveTo(x, ty); g.lineTo(x + sw, ty); g.lineTo(x + sw * 1.35, H); g.lineTo(x + sw * 0.35, H); g.fill(); }
    // 안쪽 흰 울타리(먼 쪽) · 거리 기둥 · 결승선
    const ry = H * 0.545, post = 2.5 * ppm, po = ((camX * ppm) % post + post) % post;
    g.fillStyle = '#eef2f5'; for (let x = -po; x < W + post; x += post) g.fillRect(x, ry - H * 0.03, Math.max(2, W * 0.002), H * 0.03);
    g.fillRect(0, ry - H * 0.034, W, Math.max(2, H * 0.007)); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, ry, W, H * 0.004);
    for (const left of [1000, 800, 600, 400, 200]) { const x = (LEN - left - camX) * ppm; if (x < -50 || x > W + 50) continue; const ph = H * 0.13; g.fillStyle = '#c8202b'; g.fillRect(x - W * 0.012, ry - ph, W * 0.024, ph); g.fillStyle = '#fff'; g.fillRect(x - W * 0.01, ry - ph + ph * 0.06, W * 0.02, ph * 0.5); g.fillStyle = '#c8202b'; g.font = `900 ${Math.round(W * 0.012)}px sans-serif`; g.textAlign = 'center'; g.save(); g.translate(x, ry - ph * 0.7); g.fillText(String(left), 0, W * 0.004); g.restore(); }
    { const x = (LEN - camX) * ppm; if (x > -80 && x < W + 80) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - 2, ry, 4, H - ry); g.fillStyle = '#fff'; g.fillRect(x - W * 0.004, ry - H * 0.2, W * 0.008, H * 0.2); g.fillStyle = '#c8202b'; g.beginPath(); g.arc(x, ry - H * 0.2, W * 0.018, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `900 ${Math.round(W * 0.012)}px sans-serif`; g.textAlign = 'center'; g.fillText('결승', x, ry - H * 0.2 + W * 0.004); } }
    // 말 — 먼 쪽(안쪽 레인)부터
    const order = [...Array(N).keys()].sort((a, b) => a - b);
    for (const h of order) {
      const d = h, s = laneS(d), y = laneY(d), x = (xs[h] - camX) * ppm, st = mode === 'run' ? stateAt(h, t) : '';
      if (x < -W * 0.2 || x > W * 1.2) continue;
      const hh = H * 0.3 * s, run = mode === 'run' && xs[h] < LEN + 4, ph = (xs[h] / 7.2) % 1; // 7.2m 에 한 걸음
      if (run && Math.random() < 0.6) dust.push({ x: xs[h] - 1.6, y, s, a: 1, vx: -(2 + Math.random() * 3), vy: -(0.5 + Math.random()) });
      horse(h, x, y, hh, run ? ph : 0, st);
    }
    // 흙 튀김
    if (OFF) return xs; // 사진 판정에는 먼지 없이
    g.fillStyle = '#8a6a3a'; dust = dust.filter((p) => (p.a -= 0.035) > 0); for (const p of dust) { p.x += p.vx * 0.016; p.y += p.vy; g.globalAlpha = p.a * 0.55; g.beginPath(); g.arc((p.x - camX) * ppm, p.y - (1 - p.a) * H * 0.03, H * 0.006 * p.s * (1.5 - p.a), 0, 7); g.fill(); } g.globalAlpha = 1;
    if (dust.length > 400) dust.splice(0, dust.length - 400);
    return xs;
  }
  function horse(h, x, y, hh, ph, st) {
    const tilt = st === 'u' ? -0.25 : st === 'b' ? Math.sin(performance.now() / 60) * 0.06 : 0;
    g.save(); g.translate(x, y); g.rotate(tilt);
    if (SP.ok && SP.n === 1 && ph) g.translate(0, -Math.abs(Math.sin(ph * Math.PI * 2)) * hh * 0.05); // 동작 그림이 한 장일 땐 위아래로만 들썩
    if (SP.ok) { const k = Math.floor(ph * SP.n) % SP.n, w = hh * (SP.fw / SP.fh); g.drawImage(SP.col[h] || SP.img, k * SP.fw, 0, SP.fw, SP.fh, -w * 0.62, -hh, w, hh); }
    else { // 임시 모양(말 그림이 올 때까지)
      const L = hh * 1.2; g.fillStyle = '#6b3d1f'; g.beginPath(); g.ellipse(-L * 0.1, -hh * 0.5, L * 0.38, hh * 0.18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(L * 0.28, -hh * 0.68, L * 0.14, hh * 0.08, -0.6, 0, 7); g.fill();
      g.strokeStyle = '#4a2a14'; g.lineWidth = hh * 0.05; const a = Math.sin(ph * Math.PI * 2) * 0.5; for (const [lx, sg] of [[-0.35, 1], [-0.25, -1], [0.15, 1], [0.22, -1]]) { g.beginPath(); g.moveTo(L * lx, -hh * 0.42); g.lineTo(L * lx + Math.sin(a * sg) * hh * 0.25, -hh * 0.02); g.stroke(); }
      g.fillStyle = COL[h]; g.beginPath(); g.ellipse(0, -hh * 0.82, hh * 0.1, hh * 0.13, 0.4, 0, 7); g.fill(); }
    // 번호(안장 천 자리)
    // 번호(흰 안장 천 한가운데 — 그림판 칸의 가로 53% · 세로 42%: 그림을 -62% 에서 그리므로 몸 기준 x = -0.085 × 칸 너비)
    const cw = SP.ok ? hh * (SP.fw / SP.fh) : hh * 1.8, ccx = -0.085 * cw, ccy = -0.58 * hh, bw = hh * 0.19, bh = hh * 0.16;
    g.fillStyle = COL[h]; g.fillRect(ccx - bw / 2, ccy - bh / 2, bw, bh); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, hh * 0.008); g.strokeRect(ccx - bw / 2, ccy - bh / 2, bw, bh);
    g.fillStyle = h === 0 || h === 4 || h === 7 ? '#111' : '#fff'; g.font = `900 ${Math.round(bh * 0.85)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(h + 1), ccx, ccy + bh * 0.04); g.textBaseline = 'alphabetic';
    g.restore();
  }

  /* ── 중계 그래픽 ── 순위표 · 미니 지도 · 남은 거리 · 자막 */
  const mapPt = (f) => { const a = Math.PI * 0.5 - f * Math.PI * 2 * 0.62 - 0.4; return [60 + 52 * Math.cos(a), 25 + 17 * Math.sin(a)]; };
  function overlay(xs, mode) {
    const run = mode === 'run' || mode === 'end'; $('liveTag').hidden = !run; $('lrank').hidden = !run; $('lbar').hidden = !run; if (!run) return;
    const L = [...Array(N).keys()].sort((a, b) => xs[b] - xs[a]), key = L.join();
    if ($('lrank').dataset.k !== key) { $('lrank').dataset.k = key; $('lrank').replaceChildren(...L.map((h, i) => { const li = el('li'); li.append(el('i', null, String(i + 1)), no(h), el('span', null, (S.card && S.card.horse[h]) || '')); return li; })); }
    const left = Math.max(0, Math.round(LEN - Math.min(LEN, xs[L[0]]))); $('distT').textContent = left + 'm'; $('distG').style.setProperty('--p', (100 - left / LEN * 100).toFixed(1) + '%');
    const dots = $('mapDots'); if (dots.childElementCount !== N) dots.replaceChildren(...[...Array(N)].map((_, h) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', '3'); c.setAttribute('fill', COL[h]); return c; }));
    [...dots.children].forEach((c, h) => { const [x, y] = mapPt(Math.min(1, xs[h] / LEN)); c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); });
    if (mode === 'run') { if (L[0] !== lastLead && xs[L[0]] > 80) { if (lastLead >= 0 && xs[L[0]] < LEN) say((L[0] + 1) + '번 ' + nm(L[0]) + ', 선두로 나섭니다!'); lastLead = L[0]; } }
  }
  const nm = (h) => (S.card && S.card.horse[h]) || h + 1 + '번';
  function say(t) { $('call').textContent = t; }
  function callsAt(t, xs) { // 서버가 보낸 일 + 남은 거리 → 자막
    for (const e of plan.ev || []) { if (e[1] > t) break; const k = e.join(); if (callShown.has(k)) continue; callShown.add(k); if (t - e[1] > 1.5) continue;
      const a = (e[2] + 1) + '번 ' + nm(e[2]); say(e[0] === 'k' ? a + ', 막판 스퍼트!' : e[0] === 't' ? a + ', 힘이 빠지는 모습입니다' : e[0] === 'u' ? a + ', 발을 헛디뎠습니다!' : e[0] === 's' ? a + ', 출발이 늦었습니다!' : e[0] === 'b' ? a + ', ' + (e[3] + 1) + '번과 부딪힙니다!' : a); }
    const lead = Math.max(...xs), left = LEN - lead;
    for (const m of [1000, 600, 400, 200]) { const k = 'd' + m; if (left <= m && !callShown.has(k)) { callShown.add(k); const L = [...Array(N).keys()].sort((a, b) => xs[b] - xs[a]); say(m === 400 ? '마지막 직선! ' + (L[0] + 1) + '번 ' + nm(L[0]) + ' 선두, ' + (L[1] + 1) + '번이 바짝 따라붙습니다!' : m === 200 ? '결승선까지 200m! ' + (L[0] + 1) + '번 ' + nm(L[0]) + ' 앞서 있습니다!' : '잔여 ' + m + 'm, ' + (L[0] + 1) + '번 ' + nm(L[0]) + ' 선두입니다'); } }
    if (plan.fin && t >= plan.fin[plan.ord[0]] && !callShown.has('w')) { callShown.add('w'); say((plan.ord[0] + 1) + '번 ' + nm(plan.ord[0]) + ' 1착으로 들어옵니다!'); }
  }

  function frame() {
    requestAnimationFrame(frame);
    const ph = S.ph; let xs;
    if (ph === 'run' && plan) { const t = (Date.now() - startAt) / 1000; xs = scene(t, 'run'); overlay(xs, 'run'); callsAt(t, xs); }
    else if (ph === 'res' && plan) { xs = scene((plan.fr.length - 1) * KF, 'end'); overlay(xs, 'end'); } // 마지막 장면 시각(999초로 하면 말이 화면 밖 멀리)
    else { xs = scene(0, 'gate'); overlay(xs, 'gate'); }
    clock();
  }

  /* ── 위 띠 · 시계 ── */
  function clock() {
    const c = $('tClock'), ph = S.ph; c.hidden = !(ph === 'bet' || ph === 'res' || ph === 'run');
    if (c.hidden) return; const sec = Math.max(0, Math.ceil(((S.until || 0) - Date.now()) / 1000));
    $('tClockL').textContent = ph === 'bet' ? '걸기 마감까지' : ph === 'run' ? '경주 중' : '다음까지'; $('tClockT').textContent = ph === 'run' ? '● LIVE' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function title() { const ph = S.ph; $('tTitle').textContent = ph === 'idle' ? (S.last ? '제 ' + S.last.rn + '경주 결과 ㆍ 다음 경주를 기다려요' : '다음 경주를 기다려요') : '제 ' + S.rn + '경주 · 잔디 1600m · 출전 8두' + (ph === 'res' ? ' ㆍ 결과' : ''); }

  /* ── 아래 판 ── */
  let held = false; // 입력 칸에 쓰는 중이라 미뤄 둔 다시 그리기
  $('board').addEventListener('focusout', () => setTimeout(() => { if (held && !typing()) { held = false; board(); } }, 400)); // 칸에서 벗어나면 그때 한 번 — 0.4초 뒤(쓰고 바로 「걸기」 누른 게 단추가 바뀌어 사라지지 않게)
  const typing = () => { const a = document.activeElement; return !!a && a.tagName === 'INPUT' && $('board').contains(a); };
  function board() {
    const ph = S.ph, key = [ph, S.rn, S.op, S.me && S.me.m, JSON.stringify(S.me && S.me.bs), JSON.stringify(S.rank), ph === 'bet' ? JSON.stringify(S.pool) : ''].join('|');
    if (key === drawnKey) return;
    // 금액 · 운영자 숫자 칸에 쓰는 동안엔 판을 새로 그리지 않음(누가 걸 때마다 다시 그려 휴대폰 키패드가 내려갔음 · 2026-11-08 부장님) — 단계 · 경주 번호가 바뀌면 바로
    if (typing() && drawnKey.split('|').slice(0, 2).join('|') === [ph, S.rn].join('|')) { held = true; return; }
    held = false; drawnKey = key; const B = $('board'); B.replaceChildren();
    if (ph === 'bet') { B.append(betView()); }
    else if (ph === 'run') { const g2 = el('div', 'betgrid'); g2.append(slipPan('이번 경주에 건 것'), rankPan()); B.append(g2); }
    else if (ph === 'res') B.append(resView());
    else B.append(idleView());
    if (S.op) B.append(opBar());
  }
  function silk(h) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('class', 'silk'); s.innerHTML = `<path d="M10 4 L6 6 L1 13 L5 17 L8 14 L8 29 L24 29 L24 14 L27 17 L31 13 L26 6 L22 4 Q16 9 10 4 Z" fill="${COL[h]}" stroke="#111" stroke-width="1"/>`; return s; }
  function betView() {
    const g2 = el('div', 'betgrid'), od = (S.od && S.od.win) || [], rk = [...Array(N).keys()].sort((a, b) => od[a] - od[b]);
    // 출전표
    const p1 = el('div', 'pan'); const h3 = el('h3', null, '출전표'); h3.append(el('small', null, '(제 ' + S.rn + '경주)')); p1.append(h3);
    const tb = el('table', 'card'), hd = el('tr'); ['번호', '승부복', '말 이름', '기수', '단승 배당', '인기'].forEach((t) => hd.append(el('th', null, t))); tb.append(hd);
    for (let h = 0; h < N; h++) { const tr = el('tr', pick.includes(h) ? 'pick' : ''), td = (c, x) => { const d = el('td', c); if (x instanceof Node) d.append(x); else d.textContent = x; tr.append(d); return d; };
      td('', no(h)); td('', silk(h)); td('nm', nm(h)); td('', (S.card && S.card.jockey[h]) || ''); td('od', (od[h] || '-') + '배'); const pp = td('pop'); const r = rk.indexOf(h) + 1; if (r === 1) pp.append(el('b', null, '👑 1위')); else pp.textContent = r + '위';
      tr.onclick = () => choose(h); tb.append(tr); }
    p1.append(tb); g2.append(p1);
    // 걸기 판
    const p2 = el('div', 'pan bet'), tabs = el('div', 'tabs');
    [['w', '단승', '1등 맞히기'], ['q', '복승', '1·2등 순서무관']].forEach(([k, a, b]) => { const bt = el('button', tab === k ? 'on' : ''); bt.type = 'button'; bt.append(a, el('small', null, b)); bt.onclick = () => { tab = k; pick = pick.slice(0, k === 'w' ? 1 : 2); drawnKey = ''; board(); }; tabs.append(bt); });
    const sel = el('div', 'sel'); sel.append(el('span', null, '선택한 말')); if (!pick.length) sel.append(el('span', null, tab === 'w' ? '출전표에서 1마리를 눌러요' : '출전표에서 2마리를 눌러요')); pick.forEach((h) => sel.append(no(h), el('span', null, nm(h))));
    const am = el('div', 'amt'), mi = el('button', null, '−'), inp = el('input'), pl = el('button', null, '+'); mi.type = pl.type = 'button'; inp.inputMode = 'numeric'; inp.value = money(amt); inp.setAttribute('aria-label', '걸 금액');
    const setA = (v) => { amt = Math.max(0, Math.floor(v)); inp.value = money(amt); ex.replaceChildren(...expectTxt()); };
    mi.onclick = () => setA(amt - 10000); pl.onclick = () => setA(amt + 10000); // ∓ 1만씩 inp.oninput = () => { amt = parseInt(inp.value.replace(/\D/g, ''), 10) || 0; ex.replaceChildren(...expectTxt()); }; inp.onblur = () => { inp.value = money(amt); };
    am.append(mi, inp, pl);
    // 금액 단추(2026-11-08 부장님 「숫자 입력이 힘드니 10만 20만 30만 · 20만 누르면 20만, 거기서 10만 누르면 30만」) — 누를 때마다 더함 · 전부 · 0
    const chips = el('div', 'chips five'); [[100000, '+10만'], [200000, '+20만'], [300000, '+30만'], ['all', '전부'], ['zero', '0']].forEach(([v, t]) => { const b = el('button', v === 'zero' ? 'zero' : null, t); b.type = 'button'; b.onclick = () => setA(v === 'all' ? left() : v === 'zero' ? 0 : Math.min(left(), amt + v)); chips.append(b); });
    const ex = el('div', 'expect'); ex.append(...expectTxt());
    const go = el('button', 'go', '걸기 (베팅)'); go.type = 'button'; go.disabled = !S.me || S.me.m <= 0; go.onclick = placeBet;
    const wal = el('div', 'wallet'); wal.append(el('span', null, '내 코인 잔고'), el('b', null, money(left())));
    p2.append(tabs, sel, am, chips, ex, go, wal, slipList()); if (S.me && S.me.m <= 0) p2.append(el('p', 'slip empty', '코인이 없어요 ㆍ 운영자가 나눠 줄 때까지 오른쪽 관전석에서 구경해요'));
    g2.append(p2); return g2;
  }
  const betSum = () => ((S.me && S.me.bs) || []).reduce((a, b) => a + b.a, 0);
  const left = () => Math.max(0, ((S.me && S.me.m) || 0) - betSum());
  const pk = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const oddOf = (k, h) => (S.od ? (k === 'w' ? S.od.win[h[0]] : S.od.q[pk(h[0], h[1])]) : 0);
  function expectTxt() { const need = tab === 'w' ? 1 : 2, o = pick.length === need ? oddOf(tab, pick) : 0; const a = el('span', null, '예상 지급 코인'), b = el('b', null, o ? money(Math.floor((amt * Math.round(o * 10)) / 10)) + ' (' + o + '배)' : '-'); return [a, b]; }
  function choose(h) { if (S.ph !== 'bet') return; if (tab === 'w') pick = [h]; else { const i = pick.indexOf(h); if (i >= 0) pick.splice(i, 1); else { pick.push(h); if (pick.length > 2) pick.shift(); } } drawnKey = ''; board(); }
  function placeBet() {
    const need = tab === 'w' ? 1 : 2; if (pick.length !== need) return toast(tab === 'w' ? '출전표에서 말 1마리를 골라 주세요' : '출전표에서 말 2마리를 골라 주세요');
    if (amt <= 0) return toast('걸 금액을 적어 주세요'); if (amt > left()) return toast('가진 코인보다 많이 걸 수 없어요');
    const next = ((S.me && S.me.bs) || []).map((x) => ({ k: x.k, h: x.h.slice(), a: x.a })), h = tab === 'q' ? [Math.min(...pick), Math.max(...pick)] : pick.slice(), same = next.find((x) => x.k === tab && x.h.join() === h.join());
    if (same) same.a += amt; else next.push({ k: tab, h, a: amt });
    send({ t: 'bet', bs: next }); pick = []; amt = 0; // 표시는 서버가 받아 준 것(S.me.bs)만 · 금액은 다시 0 부터 쌓기
  }
  function slipList() {
    const box = el('div', 'slip'), bs = (S.me && S.me.bs) || []; if (!bs.length) box.append(el('p', 'empty', '아직 안 걸었어요'));
    bs.forEach((x, i) => { const r = el('div', 'row'); r.append(el('span', null, x.k === 'w' ? '단승' : '복승'), ...x.h.map(no), el('span', null, '×' + (oddOf(x.k, x.h) || '')), el('span', 'a', money(x.a)));
      if (S.ph === 'bet') { const d = el('button', null, '✕'); d.type = 'button'; d.setAttribute('aria-label', '취소'); d.onclick = () => send({ t: 'bet', bs: bs.filter((_, j) => j !== i) }); r.append(d); } box.append(r); });
    return box;
  }
  function slipPan(t) { const p = el('div', 'pan'); p.append(el('h3', null, t)); const s = slipList(); s.style.padding = '10px'; p.append(s); const w = el('div', 'wallet'); w.style.margin = '0 10px 10px'; w.append(el('span', null, '내 코인'), el('b', null, money(S.me && S.me.m))); p.append(w); return p; }
  function rankPan() { const p = el('div', 'pan'); const h = el('h3', null, '코인 순위 TOP 5'); h.append(el('small', null, '(총 코인)')); p.append(h); const ol = el('ol', 'top5'); (S.rank || []).slice(0, 5).forEach((r, i) => { const li = el('li', S.me && r.n === S.me.n ? 'me' : ''); li.append(el('span', null, ['👑', '2', '3', '4', '5'][i]), el('span', null, r.n), el('b', null, money(r.m))); ol.append(li); }); if (!(S.rank || []).length) ol.append(el('li', null, '아직 없어요')); p.append(ol); return p; }
  function resView() {
    const L = S.last || {}, ord = L.ord || [], g2 = el('div', 'resgrid');
    const p1 = el('div', 'pan photo'); const c = el('canvas'); c.width = 800; c.height = 500; p1.append(c, el('span', 'cap', '결승선 사진 판정 (Photo Finish)')); const w = el('div', 'win', '제 ' + L.rn + '경주 ' + (ord[0] + 1) + '번 ' + nm(ord[0]) + ' 우승!'); p1.append(w); g2.append(p1); setTimeout(() => photo(c), 0);
    const col = el('div'); col.style.display = 'grid'; col.style.gap = '8px';
    const p2 = el('div', 'pan'); p2.append(el('h3', null, '확정 순위')); const pl = el('div', 'places'); ord.slice(0, 3).forEach((h, k) => { const r = el('div', 'pl k' + (k + 1)); r.append(el('i', null, k + 1 + '착'), no(h), el('span', null, nm(h))); pl.append(r); }); p2.append(pl);
    const p3 = el('div', 'pan'); p3.append(el('h3', null, '확정 배당')); const py = el('div', 'pays'); const r1 = el('div'); r1.append('단승 ', no(ord[0]), el('b', null, L.win + '배')); const r2 = el('div'); r2.append('복승 ', no(Math.min(ord[0], ord[1])), '-', no(Math.max(ord[0], ord[1])), el('b', null, L.q + '배')); py.append(r1, r2); p3.append(py); col.append(p2, p3); g2.append(col);
    const col2 = el('div'); col2.style.display = 'grid'; col2.style.gap = '8px';
    const p4 = el('div', 'pan'); p4.append(el('h3', null, '내 적중 결과')); const my = el('div', 'my'), M = S.me && S.me.my;
    if (M) { const net = M.got - M.put; my.append(el('div', 'big' + (M.got ? '' : ' lose'), M.got ? '+' + money(net) + ' 코인 적중!' : '아쉽게 빗나갔어요 (−' + money(M.put) + ')')); const a = el('div', 'row'); a.append(el('span', null, '건 코인'), el('b', null, money(M.put))); const b = el('div', 'row'); b.append(el('span', null, '받은 코인'), el('b', null, money(M.got))); my.append(a, b); }
    else my.append(el('p', 'slip empty', '이번 경주는 안 걸었어요'));
    const wl = el('div', 'row'); wl.append(el('span', null, '내 코인'), el('b', null, money(S.me && S.me.m))); my.append(wl); p4.append(my); col2.append(p4, rankPan()); g2.append(col2);
    return g2;
  }
  function photo(c) { // 결승선 사진 판정 — 1착이 결승선에 닿은 순간, 결승선 둘레를 크게(1착 코가 선 위)
    if (!plan || !plan.fin) return; const t = plan.fin[plan.ord[0]], off = document.createElement('canvas'); off.width = 1600; off.height = 900;
    withTarget(off, () => scene(t, 'photo'));
    const fx = 0.55 * 1600, sw = 560, sh = 350, sx = fx - sw * 0.72, sy = 900 * 0.36, x2 = c.getContext('2d');
    x2.drawImage(off, sx, sy, sw, sh, 0, 0, c.width, c.height); x2.fillStyle = 'rgba(255,255,255,.92)'; x2.fillRect(c.width * 0.72 - 1.5, 0, 3, c.height);
  }
  function idleView() {
    const p = el('div', 'pan idle'); p.append(el('h2', null, '다음 경주를 기다리고 있어요'), el('p', null, '운영자가 경주를 열면 정해진 시간(보통 30초 ~ 1분) 동안 걸 수 있어요 ㆍ 이 화면을 켜 두면 저절로 시작돼요'));
    const w = el('div', 'wallet'); w.append(el('span', null, (S.me && S.me.n) + ' 님의 코인'), el('b', null, money(S.me && S.me.m))); p.append(w);
    const g2 = el('div', 'betgrid'); g2.append(p, rankPan()); return g2;
  }
  /* 오른쪽 칸(2026-11-08 부장님 「돈 다 쓴 사람들은 우측에 관전석」 「운영자는 접속한 사람들 얼마씩 들고 있는지」) */
  let sideKey = '';
  function side() {
    const key = JSON.stringify([S.spec, S.ppl, S.me && S.me.n]); if (key === sideKey) return; sideKey = key; const sd = $('side'); sd.replaceChildren();
    const p1 = el('div', 'pan'), h1 = el('h3', null, '관전석'); h1.append(el('small', null, '(코인 0 · ' + (S.spec || []).length + '명)')); p1.append(h1);
    const seats = el('div', 'seats'); (S.spec || []).forEach((n) => { const s = el('div', 'seat' + (S.me && n === S.me.n ? ' me' : '')); s.append(el('i'), el('span', null, n)); s.title = n; seats.append(s); });
    if (!(S.spec || []).length) seats.append(el('p', 'empty', '아직 비어 있어요 ㆍ 코인을 다 쓰면 여기서 구경해요')); p1.append(seats); sd.append(p1);
    if (S.ppl) { // 운영자만
      const p2 = el('div', 'pan'), h2 = el('h3', null, '접속자 코인'); h2.append(el('small', null, '(운영자만 · ' + S.ppl.length + '명)')); p2.append(h2);
      const ol = el('ol', 'ppl'); S.ppl.forEach((x) => { const li = el('li', x.m <= 0 ? 'zero' : ''); li.append(el('b', null, x.n), el('span', null, money(x.m))); if (x.b) li.append(el('small', null, '이번 판 건 코인 ' + money(x.b))); ol.append(li); });
      if (!S.ppl.length) ol.append(el('li', 'empty', '접속한 사람이 없어요'));
      else { const sum = el('li', 'sum'); sum.append(el('b', null, '합계'), el('span', null, money(S.ppl.reduce((a, x) => a + x.m, 0)))); ol.append(sum); }
      p2.append(ol); sd.append(p2);
    }
  }
  function opBar() {
    const b = el('div', 'pan opbar'); b.append(el('b', null, '운영자'));
    if (S.ph === 'idle') { const n = el('input'); n.type = 'number'; n.min = 1; n.max = 20; n.value = 3; n.setAttribute('aria-label', '연속 경주 수');
      // 걸기 시간(2026-11-08 부장님 「1분을 30초로 바꿀 수 있게」) — 10~120초 · 마지막에 쓴 값 기억
      let s0 = 60; try { s0 = +localStorage.getItem('derby_betsec') || 60; } catch (e) {} const sec = el('input'); sec.type = 'number'; sec.min = 10; sec.max = 120; sec.step = 5; sec.value = s0; sec.className = 'bsec'; sec.setAttribute('aria-label', '걸기 시간(초)');
      const go = el('button', null, '경주 시작'); go.type = 'button'; go.onclick = () => { const v = Math.max(10, Math.min(120, Math.round(+sec.value || 60))); try { localStorage.setItem('derby_betsec', v); } catch (e) {} send({ t: 'start', n: +n.value || 1, sec: v }); };
      b.append('연속', n, '경주 ㆍ 걸기', sec, '초', go); }
    else { const s = el('button', 'red', S.ph === 'bet' ? '이번 경주 취소' : '이번 경주 뒤 멈추기'); s.type = 'button'; s.onclick = () => send({ t: 'stop' }); b.append(el('span', null, '남은 연속 경주 ' + (S.seq || 0)), s); }
    // 코인 주기(2026-11-08 부장님 「운영자가 전체 공평하게 10,000원씩」) — 대기 · 걸기 때만 · 접속한 사람 모두에게
    if (S.ph === 'idle' || S.ph === 'bet') {
      const row = el('div', 'opbar'); row.style.cssText = 'border:0;padding:0;width:100%'; const a = el('input'); a.inputMode = 'numeric'; a.value = '10,000'; a.style.width = '90px'; a.setAttribute('aria-label', '줄 코인');
      a.oninput = () => { const v = parseInt(a.value.replace(/\D/g, ''), 10); a.value = isNaN(v) ? '' : v.toLocaleString('ko-KR'); }; const amt2 = () => parseInt(a.value.replace(/\D/g, ''), 10) || 0;
      const add = el('button', null, '모두에게 더하기'), set = el('button', null, '모두 맞추기'); add.type = set.type = 'button';
      add.onclick = () => send({ t: 'give', mode: 'add', a: amt2() }); set.onclick = () => send({ t: 'give', mode: 'set', a: amt2() });
      row.append('코인', a, add, set); b.append(row);
    }
    if (S.ph === 'idle') { const r = el('button', 'red', '코인 순위 초기화'); r.type = 'button'; r.onclick = () => { if (r.dataset.sure) send({ t: 'reset' }); else { r.dataset.sure = '1'; r.textContent = '한 번 더 누르면 모두 0'; setTimeout(() => { if (r.isConnected) { delete r.dataset.sure; r.textContent = '코인 순위 초기화'; } }, 3000); } }; b.append(r); }
    return b;
  }

  /* ── 서버 ── */
  const send = (o) => { if (ws && ws.readyState === 1) try { ws.send(JSON.stringify(o)); } catch (e) {} };
  function onMsg(o) {
    if (o.t === 'st') {
      const was = S.ph, wasRn = S.rn; S = Object.assign({}, o, { until: o.left ? Date.now() + o.left : 0 });
      if ((o.ph === 'run' || o.ph === 'res') && o.fr) { if (!plan || plan.rn !== o.rn) { plan = { rn: o.rn, fr: o.fr, ev: o.ev, fin: o.fin, ord: o.ord, sty: o.sty }; callShown = new Set(); lastLead = -1; } if (o.ph === 'run') startAt = Date.now() - ((o.rl || 0) + 800 - (o.left || 0)); }
      if (o.ph === 'bet' && (was !== 'bet' || wasRn !== o.rn)) { pick = []; banner('제 ' + o.rn + '경주 걸기 시작!', Math.round((o.left || 60000) / 1000) + '초 안에 걸어 주세요', 2200); } // 운영자가 정한 걸기 시간
      if (o.ph === 'run' && was === 'bet') { say('출발했습니다!'); banner('출발!', '', 1000); }
      if (o.ph === 'res' && was === 'run' && S.me && S.me.my && S.me.my.got) toast('적중! +' + money(S.me.my.got - S.me.my.put) + ' 코인', 4000);
      if (o.op && !S._opSaid) S._opSaid = 1;
      title(); board(); side();
    } else if (o.t === 'say') { const L = $('chatLines'), s = el('span'); s.append(el('b', null, '[' + o.n + ']'), ' ' + o.m + '  '); L.prepend(s); while (L.childElementCount > 6) L.lastChild.remove(); }
    else if (o.t === 'on') S.on = o.on;
    else if (o.t === 'err' || o.t === 'msg' || o.t === 'ok') toast(o.m, 3000);
    $('onN').textContent = S.on || 0;
  }
  function banner(a, b, ms) { const x = $('banner'); x.replaceChildren(a); if (b) x.append(el('small', null, b)); x.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => { x.hidden = true; }, ms); }
  function open() {
    const w = new WebSocket(WS + '/ws?pid=' + encodeURIComponent(pid) + '&nick=' + encodeURIComponent(nick)); ws = w;
    w.onopen = () => { retry = 0; if (opPass) send({ t: 'op', pass: opPass }); };
    w.onmessage = (e) => { let o; try { o = JSON.parse(e.data); } catch (x) { return; } onMsg(o); };
    w.onclose = (e) => { if (ws !== w) return; ws = null; if (e.code === 4000) { toast('다른 창에서 들어와서 이 창은 나왔어요', 6000); return; } if (retry < 20) setTimeout(open, Math.min(10000, 1000 * ++retry)); };
  }
  function ask(titleT, tip, val, ok) { const m = el('div', 'modal'), f = el('form'), i = el('input'), b = el('button', 'go', '확인'); i.value = val || ''; i.maxLength = 30; f.append(el('h3', null, titleT), el('p', null, tip), i, b); m.append(f); document.body.append(m); setTimeout(() => i.focus(), 30); f.onsubmit = (e) => { e.preventDefault(); const v = i.value.trim(); if (!v) return; m.remove(); ok(v); }; m.onclick = (e) => { if (e.target === m && nick) m.remove(); }; return i; }
  function needNick(then) { ask('닉네임을 정해 주세요', '로그인 없이 이 닉네임으로 코인 순위에 올라가요 (12자까지)', nick, (v) => { nick = v.slice(0, 12); try { localStorage.setItem('derby_nick', nick); } catch (e) {} if (ws) send({ t: 'nick', n: nick }); then && then(); }).maxLength = 12; }
  $('nickB').onclick = () => needNick();
  $('opB').onclick = () => { const i = ask('운영자', '운영자 비밀번호를 적어 주세요', '', (v) => { opPass = v; send({ t: 'op', pass: v }); }); i.type = 'password'; };
  $('chatF').onsubmit = (e) => { e.preventDefault(); const v = $('chatI').value.trim(); if (!v) return; send({ t: 'say', m: v }); $('chatI').value = ''; };
  Object.defineProperty(window, '__derby', { value: { get S() { return S; }, get plan() { return plan; } } }); // 시험에서 상태 보기
  if (!nick) needNick(open); else open();
  requestAnimationFrame(frame);
})();
