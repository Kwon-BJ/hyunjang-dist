// 브라우저 화면: 서버가 보낸 결과를 그리고, 입력만 서버로 보낸다.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let W = Sim.W, H = Sim.H;      // 경기마다 맵 크기가 다름 → startGame 에서 바꿈

  // ---------------- 리소스 ----------------
  const IMG = {};
  const imgList = ['Hedgehog', 'BazookaShell', 'Bomb', 'Expl50', 'Crosshair', 'Finger', 'SmokeTrace', 'WindBar', 'WindL', 'WindR', 'Clouds', 'Power', 'slider', 'sliderInverted',
    'BlueWater', 'Statue', 'Nature_LandTex', 'Nature_Border', 'Nature_Sky', 'Nature_horizont',
    'BigDigits', 'BigDigitsRed', 'BigDigitsGray', 'Frame', 'flag_hedgewars', 'SDWater', 'RopeHook', 'RopeNode', 'Parachute', 'Hammer', 'Teleport', 'amTeleport'];
  const HUDFONT = 'HWLatin, HWKr, sans-serif';
  const imgReady = Promise.all(imgList.map(n => new Promise(res => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = 'assets/gfx/' + n + '.png'; IMG[n] = im;
  })));

  // 소리: WebAudio. 사파리(아이폰) 대비 mp3 사본 사용
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null, sfxGain = null, musicEl = null, soundOn = true;
  const canOgg = !!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"');
  const EXT = canOgg ? '.ogg' : '.mp3';
  const SND = {};
  const sndFiles = { explosion: 'explosion', powerup: 'throwpowerup', release: 'throwrelease', grenadeimpact: 'grenadeimpact',
    splash: 'splash', bump: 'bump', switch: 'switchhog', fire: 'v_Fire', cover: 'v_Takecover', yessir: 'v_Yessir',
    gun: 'gun', minigun: 'minigun', shotgunfire: 'shotgunfire', shotgunreload: 'shotgunreload', sniperreload: 'sniperreload', ow1: 'v_Ow1', ow2: 'v_Ow2', ow3: 'v_Ow3', ooff1: 'v_Ooff1', ooff2: 'v_Ooff2', byebye: 'v_Byebye', victory: 'v_Victory',
    sd: 'suddendeath', hurry: 'v_Hurry', pickhammer: 'pickhammer', denied: 'denied', warp: 'warp', ufo: 'ufo', jetpackboost: 'jetpackboost', blowtorch: 'blowtorch', ropeshot: 'ropeshot', ropeattach: 'ropeattach', roperelease: 'roperelease', parachute: 'parachute', countdown1: 'countdown1', countdown2: 'countdown2', countdown3: 'countdown3', countdown4: 'countdown4', jump1: 'v_Jump1', jump2: 'v_Jump2', jump3: 'v_Jump3', missed: 'v_Missed', enemydown: 'v_Enemydown' };
  function unlockAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    if (!AC) return;
    actx = new AC(); sfxGain = actx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(actx.destination);
    for (const [k, f] of Object.entries(sndFiles)) {
      fetch('assets/snd/' + f + EXT).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => actx.decodeAudioData(b, ok, no)))
        .then(buf => { SND[k] = buf; }).catch(() => {});
    }
  }
  function play(k, vol) {
    if (!soundOn || !actx || !SND[k]) return;
    const s = actx.createBufferSource(); s.buffer = SND[k];
    if (vol != null) { const g = actx.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxGain); } else s.connect(sfxGain);
    s.start();
  }
  let currentMusic = null;
  function music(name) {
    if (currentMusic === name && musicEl && !musicEl.paused) return;
    currentMusic = name;
    if (!musicEl) { musicEl = new Audio(); musicEl.loop = true; musicEl.volume = 0.35; }
    musicEl.src = 'assets/music/' + name + '.mp3';   // 음악은 mp3 하나로 통일 (홈페이지 용량 절반)
    if (soundOn) musicEl.play().catch(() => {});
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, () => {
    unlockAudio(); if (musicEl && soundOn && musicEl.paused && currentMusic) musicEl.play().catch(() => {});
  }, { passive: true }));

  // ---------------- 화면 전환 ----------------
  function show(id) { for (const s of document.querySelectorAll('.screen:not(.modal)')) s.classList.toggle('on', s.id === id); document.body.classList.toggle('ingame', id === 'game'); }
  // ---------------- 지도·테마 자료 (고른 것만 늦게 불러옴) ----------------
  const MAPKO = { small: '작은 섬', medium: '보통', large: '큰 땅', cavern: '동굴', wacky: '엉뚱한 섬들',
    small_tunnels: '좁은 굴 (작게)', medium_tunnels: '좁은 굴 (보통)', large_tunnels: '좁은 굴 (크게)',
    small_islands: '섬 미로 (작게)', medium_islands: '섬 미로 (보통)', large_islands: '섬 미로 (크게)' };
  const memo = new Map();
  const once = (k, f) => { if (!memo.has(k)) memo.set(k, f().catch(e => { memo.delete(k); throw e; })); return memo.get(k); };
  const getJSON = (u) => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  const loadImg = (u) => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
  const loadCatalog = () => once('cat', () => getJSON('maps/catalog.json'));
  const loadTemplates = () => once('tpl', async () => ({ map: await getJSON('maps/map_templates.json'), maze: await getJSON('maps/maze_templates.json') }));
  function loadTheme(name) {
    return once('th:' + name, async () => {
      const base = 'assets/themes/' + name + '/', j = await getJSON(base + 'theme.json'), f = j.files, img = {};
      await Promise.all(Object.keys(f).filter(k => f[k]).map(async k => { img[k] = await loadImg(base + f[k] + '.png'); }));
      const objImgs = await Promise.all(j.objects.map(o => loadImg(base + o.name + '.png')));
      let avg = [120, 90, 50];
      if (img.land) { const p = getPixels(img.land); let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < p.d.length; i += 16) if (p.d[i + 3] > 128) { r += p.d[i]; g += p.d[i + 1]; b += p.d[i + 2]; n++; } if (n) avg = [r / n, g / n, b / n]; }
      return { name, j, img, objImgs, avg };
    });
  }
  const loadImageMap = (name) => once('im:' + name, async () => ({ land: await getJSON('assets/maps/' + name + '/land.json'), png: await loadImg('assets/maps/' + name + '/map.png') }));
  const S = { ws: null, me: 0, room: null, lobby: null, game: null, retry: 0, auth: null, user: null, authed: false, queue: [], rooms: [], sel: null };
  // 로그인 토큰: 탭마다(sessionStorage) 우선, 없으면 이 브라우저 공통(localStorage)
  const store = {
    get(k) { k = 'pogyeok:' + k; try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { k = 'pogyeok:' + k; try { sessionStorage.setItem(k, v); localStorage.setItem(k, v); } catch (e) {} },
    del(k) { k = 'pogyeok:' + k; try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {} },
  };
  S.auth = store.get('hwauth');
  try { S.room = sessionStorage.getItem('pogyeok:hwroom'); } catch (e) {}
  // 방 링크(?room=코드, 예전 /r/코드)로 들어오면 로그인 뒤 바로 그 방으로
  const m0 = (new URLSearchParams(location.search).get('room') || (location.pathname.match(/\/r\/([A-Za-z0-9]{4})/) || [])[1] || '').match(/^[A-Za-z0-9]{4}$/);
  S.linkRoom = m0 ? m0[0].toUpperCase() : null;

  function send(o) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
  function sendAuthed(o) { if (S.authed) send(o); else S.queue.push(o); }
  // 주소 쪽지 server.json: { "url": "https://….trycloudflare.com", "updatedAt": "…" }: 홈페이지에 올린 화면이 읽음
  async function serverUrl() {
    try {
      const r = await fetch('server.json?t=' + Date.now(), { cache: 'no-store' });
      if (r.ok) { const j = await r.json(); if (j && /^https?:\/\//.test(j.url || '')) return j.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws'; return null; }
      if (r.status === 404 && !S.remote) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';   // 서버가 직접 준 화면
    } catch (e) {}
    return null;
  }
  S.remote = !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(location.host) && !/trycloudflare\.com$/.test(location.hostname);
  let closedTimer = null, closedTick = null, closedAt = 0;
  function showClosed(on) {
    $('closed').style.display = on ? 'flex' : 'none';
    document.body.classList.toggle('closedOn', !!on);          // 닫힘 화면이 떠 있음 (새 스킨 배경에서 뒤 메뉴를 숨길 때 씀)
    clearInterval(closedTick);
    if (on) {
      $('conn').style.display = 'none'; clearTimeout(closedTimer); closedTimer = setTimeout(connect, 30000);   // 30초마다 다시 확인
      closedAt = Date.now() + 30000;
      const tick = () => { $('closedLeft').textContent = Math.max(0, Math.ceil((closedAt - Date.now()) / 1000)); };
      tick(); closedTick = setInterval(tick, 500);
    }
  }
  async function connect() {
    if (S.ws && S.ws.readyState <= 1) return;
    if (S.connecting) return; S.connecting = true;
    const wsUrl = await serverUrl();
    S.connecting = false;
    if (!wsUrl) {
      // 9B: 점검 재시작·서버 갱신을 기다리는 중이면 닫힘 화면으로 빠지지 않고 계속 다시 확인
      if (S.verWait) { clearTimeout(S.verTimer); S.verTimer = setTimeout(connect, 5000); return; }
      if (S.restarting && Date.now() - S.restarting < 180000) { setTimeout(connect, 2000); return; }
      S.opened = false; return showClosed(true);
    }
    const ws = new WebSocket(wsUrl);
    S.ws = ws; S.authed = false;
    ws.onopen = () => {
      S.opened = true; showClosed(false);
      $('conn').style.display = 'none'; S.retry = 0;
      S.gotVer = false;
      if (S.auth) send({ t: 'resume', token: S.auth });
      else { S.pendingLogin && send(S.pendingLogin); S.pendingLogin = null; }
    };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null; S.authed = false;
      // 9B: 화면이 서버보다 새것(서버 갱신 중) → 5초마다 다시 확인 / 점검 재시작 중 → 2초마다 최대 3분
      if (S.verWait) { clearTimeout(S.verTimer); S.verTimer = setTimeout(connect, 5000); return; }
      if (S.restarting && Date.now() - S.restarting < 180000) { $('conn').textContent = '점검: 서버를 다시 켜는 중입니다. 잠시 뒤 자동으로 연결됩니다…'; $('conn').style.display = 'block'; setTimeout(connect, 2000); return; }
      // 한 번도 못 열었거나 여러 번 실패 → 서버가 닫힌 것으로 보고 30초마다 쪽지부터 다시 확인 (터널 주소가 바뀌었을 수 있음)
      if (!S.opened || S.retry >= 4) { S.opened = false; S.retry = 0; return showClosed(true); }
      if (S.auth) { $('conn').style.display = 'block'; setTimeout(connect, Math.min(5000, 800 + S.retry++ * 700)); }
      else setTimeout(connect, 1500);
    };
  }
  // ---------------- 버전 비교 (9B) ----------------
  // 내 버전: 홈페이지에 올린 화면은 index.html 의 <meta name="hw-version">, 서버가 직접 준 화면은 version.json
  const metaVer = document.querySelector('meta[name="hw-version"]');
  S.myVer = null;
  const myVerReady = (metaVer ? Promise.resolve(metaVer.content) : fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => j ? j.n + '.' + j.h : null).catch(() => null))
    .then(v => { if (v) { const [n, h] = String(v).split('.'); S.myVer = { n: +n || 0, h: h || '' }; } return S.myVer; });
  async function onVersion(m) {
    S.gotVer = true;
    const mine = await myVerReady;
    if (!mine || (mine.n === m.n && mine.h === m.h)) { if (S.verWait) { S.verWait = false; $('verBar').classList.remove('on'); } S.verOld = false; return; }
    if (m.n < mine.n) {   // 화면이 서버보다 새것 → 서버가 아직 옛 코드(갱신 중). 연결을 끊고 5초마다 다시 확인
      S.verWait = true; S.verOld = false;
      $('verText').textContent = '서버를 갱신하는 중입니다. 잠시 뒤 자동으로 연결됩니다.';
      $('btnVerReload').style.display = 'none'; $('verBar').classList.add('on');
      if (S.ws) S.ws.close();
      return;
    }
    // 화면이 옛것 → 새로고침 안내 (경기 중이면 판이 끝난 뒤)
    S.verWait = false; S.verOld = true; showVerLater();
  }
  function showVerLater() {
    if (!S.verOld || S.verWait) return;
    if (S.game && document.body.classList.contains('ingame')) return;      // 경기 중에는 띄우지 않음
    $('verText').textContent = '새 버전이 나왔습니다. 새로고침해 주세요.';
    $('btnVerReload').style.display = ''; $('verBar').classList.add('on');
  }
  $('btnVerReload').onclick = () => location.reload();
  // ---------------- 점검 예고 띠 (9B) ----------------
  let maintTick = null;
  function maintText() {
    if (S.restarting) return '점검 중: 서버를 다시 켜는 중입니다. 잠시 뒤 자동으로 연결됩니다.';
    const a = S.maintAt; if (!a) return '';
    const now = Date.now(), mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + '분 ' + String(t % 60).padStart(2, '0') + '초'; };
    return now < a.endsAt ? `${mmss(a.endsAt - now)} 뒤 점검. 진행 중인 판은 끝까지 할 수 있습니다. 새 경기는 시작할 수 없습니다.`
      : `점검 시간: 진행 중인 판이 끝나면 서버를 다시 켭니다 (늦어도 ${mmss(a.extraAt - now)} 뒤)`;
  }
  function onMaint(m) {
    clearInterval(maintTick);
    const bar = $('maintBar');
    S.maintOn = !m.off; aiContButtons();
    if (m.off) { bar.classList.remove('on'); return; }
    if (m.restarting) { S.restarting = Date.now(); bar.textContent = maintText(); bar.classList.add('on'); return; }
    S.maintAt = { endsAt: Date.now() + m.left, extraAt: Date.now() + m.extra };
    const draw = () => { bar.textContent = maintText(); };
    draw(); bar.classList.add('on'); maintTick = setInterval(draw, 500);
  }
  function renderAdminMaint(st) {
    const el = $('adminMaint'); if (!el || !st) return;
    const mm = (ms) => Math.ceil(ms / 60000);
    el.textContent = !st.on ? `점검 예고: 없음 · 진행 중인 판 ${st.games}개 · 서버 버전 ${st.ver ? st.ver.n : '?'}`
      : `점검 예고: ${st.phase === 'notice' ? (st.left > 0 ? mm(st.left) + '분 남음' : '예고 시간 지남, 판 끝나길 기다리는 중') : st.phase === 'ready' ? '판이 모두 끝남, 재시작 대기' : '재시작 중'} · 진행 중인 판 ${st.games}개`;
  }
  function setRoom(code) { S.room = code; try { if (code) sessionStorage.setItem('pogyeok:hwroom', code); else sessionStorage.removeItem('pogyeok:hwroom'); } catch (e) {} }

  // ---------------- 계급 모자 (원본 Graphics/Hats, 배정표 rank_hats.json) ----------------
  // 원본 uGearsRender: 모자는 고슴도치 그림 중심에서 5px 위, 32x32 첫 칸, 보는 방향에 맞춰 뒤집음
  const HATS = [];          // 계급 번호 → Image (훈련병은 null = 맨머리)
  const RANK_NAMES = [];
  const hatsReady = fetch('rank_hats.json').then(r => r.json()).then(list => Promise.all(list.map((r, i) => new Promise(res => {
    RANK_NAMES[i] = r.rank;
    if (r.hat === 'NoHat') { HATS[i] = null; return res(); }
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = 'assets/hats/' + r.hat + '.png'; HATS[i] = im;
  })))).catch(() => {});
  const faceCache = {};
  // 모자 쓴 고슴도치 얼굴 (원본 그림을 그대로 겹쳐 32x32로 자름, 확대는 정수배 픽셀)
  function faceURL(level) {
    if (faceCache[level]) return faceCache[level];
    return (faceCache[level] = Promise.all([hatsReady, imgReady]).then(() => {
      const c = document.createElement('canvas'); c.width = 32; c.height = 32;
      const x = c.getContext('2d');
      x.drawImage(IMG.Hedgehog, 0, 0, 32, 32, 0, 3, 32, 32);
      const hat = HATS[level];
      if (hat && hat.width) x.drawImage(hat, 0, 0, 32, 32, 0, 3 - 5, 32, 32);
      return c.toDataURL();
    }));
  }
  function faceImg(level, size) {
    const im = document.createElement('img'); im.width = im.height = size || 28; im.alt = '';
    faceURL(level || 0).then(u => { im.src = u; });
    return im;
  }
  // 모자 쓴 얼굴 + 계급 이름 + 닉네임 (띄어 씀)
  function rankBadge(level, rankName, nick, size, noRank) {
    const s = document.createElement('span'); s.className = 'rbadge';
    s.append(faceImg(level, size));
    if (!noRank) { const t = document.createElement('span'); t.className = 'rname'; t.textContent = rankName; s.append(t); }
    if (nick != null) { const n = document.createElement('span'); n.className = 'rnick'; n.textContent = nick; s.append(n); }
    return s;
  }
  const RANK_MIN = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000, 5200, 6600, 8500, 11000, 14000, 18000, 23000, 29000, 36000];

  connect();
  $('btnRetryNow').onclick = () => { clearTimeout(closedTimer); $('btnRetryNow').textContent = '확인 중…'; connect(); setTimeout(() => { $('btnRetryNow').textContent = '지금 다시 확인'; }, 1500); };

  // ---- 로그인·가입 ----
  function authView(which) {
    $('authWrap').style.display = which === 'main' ? 'none' : 'flex';
    $('authLogin').style.display = which === 'login' ? 'block' : 'none';
    $('authSignup').style.display = which === 'signup' ? 'block' : 'none';
    $('authWrap').classList.toggle('su', which === 'signup');   // 가입 화면: PC에서 로고를 작게
    $('authHead').textContent = which === 'signup' ? '회원가입' : '로그인';
    $('homeMain').style.display = which === 'main' ? 'flex' : 'none';
    $('authErr').textContent = '';
    if (which === 'signup') S.signupShownAt = Date.now();          // 화면을 연 뒤 3초 안의 가입은 서버가 거절 (자동 가입 막기)
  }
  authView(S.auth ? 'main' : 'login');
  // 이용 규칙·가입 받기 상태 (서버가 접속하자마자 보냄, 운영자가 고치면 다시 보냄)
  function onSite(m) {
    S.site = m;
    const ol = $('suTerms'); ol.innerHTML = '';
    for (const t of m.terms || []) { const li = document.createElement('li'); li.textContent = t; ol.append(li); }
    $('suClosed').style.display = m.signupOpen ? 'none' : 'block';
    $('btnSignup').disabled = !m.signupOpen;
    renderAdminSite();
  }
  function authSend(o) {
    $('authErr').textContent = '확인 중…';
    if (S.ws && S.ws.readyState === 1) send(o); else { S.pendingLogin = o; connect(); }
  }
  $('btnLogin').onclick = () => authSend({ t: 'login', id: $('lgId').value, pw: $('lgPw').value });
  $('lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); });
  $('btnSignup').onclick = () => {
    if ($('suPw').value !== $('suPw2').value) { $('authErr').textContent = '비밀번호 확인이 다릅니다.'; return; }
    if (!$('suAgree').checked) { $('authErr').textContent = '이용 규칙에 동의해 주세요.'; return; }
    authSend({ t: 'signup', id: $('suId').value, pw: $('suPw').value, nick: $('suNick').value, agree: true, hp: $('suWeb').value, elapsed: Date.now() - (S.signupShownAt || Date.now()) });
  };
  $('toSignup').onclick = (e) => { e.preventDefault(); authView('signup'); };
  $('toLogin').onclick = (e) => { e.preventDefault(); authView('login'); };
  $('btnLogout').onclick = () => { send({ t: 'logout' }); S.auth = null; store.del('hwauth'); setRoom(null); S.user = null; S.authed = false; authView('login'); };
  function renderMe() {
    const u = S.user; if (!u) return;
    const b = $('meBox'); b.innerHTML = '';
    b.append(faceImg(u.rank, 36));
    const t = document.createElement('div'); t.className = 'meText';
    const l1 = document.createElement('span'); l1.innerHTML = '<span class="rnick"></span> <span class="rname"></span>';
    l1.children[0].textContent = u.nick; l1.children[1].textContent = u.rankName;
    const l2 = document.createElement('span'); l2.className = 'small';
    l2.textContent = `경험치 ${u.exp.toLocaleString()}` + (u.general ? ` · 장성 순위 ${u.general.place}위` : u.next != null ? ` · ${u.nextName}까지 ${Math.max(0, u.next - u.exp).toLocaleString()}` : '') + (u.demoteIn != null ? ` · 강등까지 ${u.demoteIn}` : '');
    const bar = document.createElement('div'); bar.className = 'xpbar'; bar.innerHTML = '<div></div>';
    const lo = u.lo != null ? u.lo : 0; bar.firstChild.style.width = (u.next != null ? Math.max(0, Math.min(100, (u.exp - lo) / (u.next - lo) * 100)) : 100) + '%';
    if (u.aiBest) l1.append(aiTag(u.aiBest));
    t.append(l1, l2, bar); b.append(t);
    $('btnAdmin').style.display = u.admin ? '' : 'none';
  }

  // ---- 로비: 방 목록 ----
  function renderRooms() {
    const rows = $('roomRows'); rows.innerHTML = '';
    const list = S.rooms.slice().sort((a, b) => (a.state === 'lobby' ? 0 : 1) - (b.state === 'lobby' ? 0 : 1));
    $('roomEmpty').style.display = list.length ? 'none' : 'flex';
    $('homeMain').classList.toggle('noRooms', !list.length);
    $('roomCount').textContent = list.length ? `방 ${list.length}개` : '';
    if (S.sel && !list.some(r => r.code === S.sel)) S.sel = null;
    for (const r of list) {
      const tr = document.createElement('tr'); tr.className = 'r' + (r.code === S.sel ? ' sel' : '') + (r.state !== 'lobby' || r.count >= r.max ? ' dim' : '');
      tr.dataset.code = r.code;
      const st = document.createElement('td'); st.className = 'state'; const ic = document.createElement('img'); ic.className = 'st';
      ic.src = r.state === 'lobby' ? 'assets/ui/iconTime.png' : 'assets/ui/iconDamage.png'; ic.title = r.state === 'lobby' ? '대기 중' : '경기 중';
      st.append(ic, document.createTextNode(r.state === 'lobby' ? ' 대기' : ' 경기 중'));
      const mt = document.createElement('span'); mt.className = 'modeTxt'; mt.textContent = ' · ' + (r.mode === 'team' ? '팀전' : '개인전'); st.append(mt);
      const ti = document.createElement('td'); ti.className = 'title'; ti.textContent = r.title;
      const ho = document.createElement('td'); ho.className = 'host'; if (r.host) { ho.append(rankBadge(r.host.rank, r.host.rankName, r.host.nick, 24, true)); if (r.host.aiBest) ho.append(aiTag(r.host.aiBest)); }
      const mo = document.createElement('td'); mo.className = 'mode'; mo.textContent = r.mode === 'team' ? '팀전' : '개인전';
      const cn = document.createElement('td'); cn.className = 'cnt'; cn.textContent = `${r.count}/${r.max}`;
      tr.append(st, ti, ho, mo, cn);
      tr.onclick = () => { S.sel = r.code; tryJoin(r); };
      rows.append(tr);
    }
  }
  function tryJoin(r) {
    if (!r) { $('homeErr').textContent = '목록에서 들어갈 방을 고르세요.'; return; }
    if (r.state !== 'lobby') { $('homeErr').textContent = `"${r.title}" 방은 경기 중이라 들어갈 수 없습니다. 끝나면 들어오세요.`; renderRooms(); return; }
    if (r.count >= r.max) { $('homeErr').textContent = `"${r.title}" 방은 꽉 찼습니다 (${r.count}/${r.max}명).`; renderRooms(); return; }
    $('homeErr').textContent = '';
    sendAuthed({ t: 'hello', room: r.code });
  }
  $('btnJoin').onclick = () => tryJoin(S.rooms.find(r => r.code === S.sel));
  $('btnCreate').onclick = () => { $('createErr').textContent = ''; $('ctTitle').value = ''; $('ctTitle').placeholder = (S.user ? S.user.nick : '') + '의 방'; $('createDlg').classList.add('on'); };
  $('btnCreate2').onclick = () => $('btnCreate').click();
  $('btnCreateCancel').onclick = () => $('createDlg').classList.remove('on');
  function fillMax(sel, team, cur) {
    sel.innerHTML = '';
    for (let n = team ? 4 : 2; n <= 8; n += team ? 2 : 1) { const o = document.createElement('option'); o.value = n; o.textContent = team ? `${n}명 (${n / 2}대${n / 2})` : n + '명'; sel.append(o); }
    sel.value = String(cur && [...sel.options].some(o => o.value == cur) ? cur : 4);
  }
  fillMax($('ctMax'), false, 4);
  $('newMode').onchange = () => fillMax($('ctMax'), $('newMode').value === 'team', +$('ctMax').value);
  $('btnCreateOk').onclick = () => {
    const t = $('ctTitle').value.trim();
    if (t && (t.length < 2 || /[<>]/.test(t))) { $('createErr').textContent = '방 제목은 2~20자입니다 (< > 사용 불가).'; return; }
    S.creating = true;
    sendAuthed({ t: 'hello', create: true, title: t, mode: $('newMode').value, max: +$('ctMax').value });
  };
  $('ctTitle').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnCreateOk').click(); });

  // ---- 대기실 ----
  $('btnStart').onclick = () => send({ t: 'start' });
  $('btnLeave').onclick = () => { send({ t: 'leave' }); setRoom(null); S.lobby = null; show('home'); send({ t: 'me' }); music('main_theme'); };
  $('btnQuit').onclick = () => {
    if (!confirmQuit()) return;
    send({ t: 'leave' }); setRoom(null); S.game = null; S.lobby = null; show('home'); send({ t: 'me' });
  };
  function confirmQuit() { const b = $('btnQuit'); if (b.dataset.arm) { delete b.dataset.arm; b.textContent = '나가기'; return true; }
    b.dataset.arm = 1; b.textContent = '나가면 -30! 정말?'; setTimeout(() => { delete b.dataset.arm; b.textContent = '나가기'; }, 3000); return false; }
  $('hogs').onchange = () => send({ t: 'settings', hogs: +$('hogs').value });
  $('windMode').onchange = () => send({ t: 'windmode', mode: $('windMode').value });
  $('turnSel').onchange = () => send({ t: 'turntime', ms: +$('turnSel').value });
  $('lobbyMode').onchange = () => send({ t: 'mode', mode: $('lobbyMode').value });
  $('lobbyMax').onchange = () => send({ t: 'maxp', n: +$('lobbyMax').value });
  $('btnSideA').onclick = () => send({ t: 'side', side: 0 });
  $('btnSideB').onclick = () => send({ t: 'side', side: 1 });
  $('btnCopy').onclick = () => {
    const url = location.origin + location.pathname.replace(/\/r\/[A-Za-z0-9]{4}\/?$/, '/') + '?room=' + S.room;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { $('btnCopy').textContent = '복사했습니다!'; },
      () => { $('btnCopy').textContent = url; });
    setTimeout(() => { $('btnCopy').textContent = '방 링크 복사'; }, 2500);
  };
  for (const a of document.querySelectorAll('.lnkCredits')) a.onclick = (e) => { e.preventDefault(); $('credits').classList.add('on'); };
  // 게임 가이드: 대기실 조작 안내(keysHelp) 글을 그대로 씀
  $('btnGuide').onclick = () => { $('guideKeys').textContent = $('keysHelp').textContent; $('guideDlg').classList.add('on'); };
  $('btnCloseGuide').onclick = () => $('guideDlg').classList.remove('on');
  $('btnCloseCredits').onclick = () => $('credits').classList.remove('on');
  $('btnSound').onclick = () => {
    soundOn = !soundOn; $('btnSound').textContent = soundOn ? '소리 켬' : '소리 끔';
    if (musicEl) { if (soundOn) musicEl.play().catch(() => {}); else musicEl.pause(); }
  };

  // ---- 내 정보 / 비밀번호 바꾸기 ----
  $('btnMyInfo').onclick = () => { send({ t: 'me' }); S.showMe = true; };
  $('btnCloseMe').onclick = () => {
    if (S.user && S.user.mustChange) { $('pwMsg').textContent = '임시 비밀번호입니다. 먼저 새 비밀번호로 바꿔 주세요.'; return; }
    $('myinfo').classList.remove('on');
  };
  $('btnChPw').onclick = () => {
    const cur = $('pwCur').value, pw = $('pwNew').value;
    if (pw.length < 6) { $('pwMsg').textContent = '새 비밀번호는 6자 이상입니다.'; return; }
    if (pw !== $('pwNew2').value) { $('pwMsg').textContent = '새 비밀번호 확인이 다릅니다.'; return; }
    $('pwMsg').textContent = '확인 중…';
    send({ t: 'chpw', cur, pw });
  };
  function openPwChange(forced) {
    $('pwNotice').textContent = forced ? '운영자가 초기화한 임시 비밀번호로 로그인했습니다. 새 비밀번호로 바꿔 주세요.' : '';
    for (const id of ['pwCur', 'pwNew', 'pwNew2']) $(id).value = '';
    $('pwMsg').textContent = '';
    renderMyInfo(S.user);
    $('pwCur').focus();
  }
  function renderMyInfo(u) {
    const b = $('myBody'); b.innerHTML = '';
    const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;gap:12px';
    head.append(faceImg(u.rank, 64));
    const nm = document.createElement('div'); nm.innerHTML = '<div class="rnick" style="font-size:18px"></div><div class="rname" style="font-size:14px"></div>';
    nm.children[0].textContent = u.nick; nm.children[1].textContent = u.rankName;
    head.append(nm); b.append(head);
    const lo = u.lo != null ? u.lo : 0, pct = u.next != null ? Math.round((u.exp - lo) / (u.next - lo) * 100) : 100;
    const tb = document.createElement('table'); tb.className = 'info';
    for (const [k, v] of [['계급', u.rankName], ['누적 경험치', u.exp.toLocaleString()],
      ['다음 계급', u.next != null ? `${u.nextName} (${u.next.toLocaleString()}), ${Math.max(0, u.next - u.exp).toLocaleString()} 남음` : '장성 (순위로 정함)'],
      ...(u.demoteIn != null ? [['강등 보호', `강등까지 ${u.demoteIn} (계급 기준보다 60 아래로 내려가면 한 단계 내려감)`]] : []),
      ...(u.general ? [['장성 순위', `${u.general.place}위 / 정원 ${u.general.seats}명` + (u.general.place > 1 ? ` · 앞사람과 ${u.general.gap.toLocaleString()} 차이` : ' · 맨 앞')]] : []),
      ['전적', `${u.games}판 · ${u.wins}승 ${u.losses}패 ${u.draws}무`],
      ['AI 대전', u.aiBest ? `최고 ${u.aiBest}단계 (깬 단계 ${Object.keys(u.aiClears || {}).length}개)` : '아직 없음']]) {
      const tr = tb.insertRow(); tr.insertCell().textContent = k; const c = tr.insertCell(); c.textContent = v; c.style.color = '#fff';
    }
    b.append(tb);
    const bar = document.createElement('div'); bar.className = 'xpbar'; bar.style.width = '100%'; bar.innerHTML = '<div></div>';
    bar.firstChild.style.width = Math.max(0, Math.min(100, pct)) + '%'; b.append(bar);
    // 장성 명단 (순위표 전체는 묶음 3)
    const gb = document.createElement('button'); gb.className = 'sec'; gb.textContent = '장성 명단 보기'; gb.style.marginTop = '8px';
    const gl = document.createElement('div'); gl.id = 'genList';
    gb.onclick = () => send({ t: 'generals' });
    b.append(gb, gl);
    $('myinfo').classList.add('on');
  }
  // ---- AI 대전 단계 목록 (깬 단계 = 메달, 열린 단계, 잠긴 단계 = 자물쇠) ----
  const AI_BANDS = [[1, 5, '적 2마리 · 바람 무시 · 바주카만'], [6, 10, '적 3마리 · 바람 계산 · 수류탄'], [11, 15, '적 4마리 · 쏘고 숨음 · 미로·동굴'], [16, 20, '적 5마리(두 팀) · 약한 고슴도치부터 노림']];
  function renderAI() {
    const u = S.user || { aiBest: 0, aiClears: {} }, g = $('aiStages'); g.innerHTML = '';
    for (let st = 1; st <= 20; st++) {
      const b = document.createElement('button'), clear = !!(u.aiClears && u.aiClears[st]), open = st <= (u.aiBest || 0) + 1;
      b.className = clear ? 'clear' : open ? 'open' : 'locked'; b.disabled = !open;
      const im = document.createElement('img'); im.src = clear ? 'assets/ui/StatsMedal1.png' : open ? 'assets/ui/unlock.png' : 'assets/ui/lock.png'; im.alt = '';
      const sm = document.createElement('span'); sm.className = 'sm'; sm.textContent = clear ? '깸' : open ? '+' + st * 5 : '잠김';
      b.append(im, String(st), sm);
      b.title = st + '단계';
      const band = AI_BANDS.find(x => st >= x[0] && st <= x[1]);
      b.onmouseenter = b.onfocus = () => { $('aiStageDesc').textContent = `${st}단계: ${band[2]}${clear ? ', 이미 깸(경험치 없음)' : ', 처음 깨면 +' + st * 5}`; };
      b.onclick = () => { $('aiErr').textContent = ''; S.aiPickStage = st; send({ t: 'aicands', stage: st }); };
      g.append(b);
    }
    $('aiInfo').textContent = `1단계부터 깨면 다음 단계가 열립니다. 처음 깬 단계만 경험치(단계 × 5). 져도·나가도 깎이지 않습니다. 지금 최고 ${u.aiBest || 0}단계.`;
  }
  $('btnAI').onclick = () => { renderAI(); $('aiStageDesc').textContent = ''; $('aiDlg').classList.add('on'); };
  $('btnAI2').onclick = () => $('btnAI').click();
  $('btnAiClose').onclick = () => { $('aiDlg').classList.remove('on'); $('aiMaps').style.display = 'none'; $('aiStages').style.display = ''; };
  $('btnAiAny').onclick = () => { $('aiDlg').classList.remove('on'); $('aiMaps').style.display = 'none'; $('aiStages').style.display = ''; send({ t: 'ai', stage: S.aiPickStage }); };
  $('btnAiBack').onclick = () => { $('aiMaps').style.display = 'none'; $('aiStages').style.display = ''; };
  function onAiCands(m) {
    if (m.stage !== S.aiPickStage) return;
    $('aiStages').style.display = 'none'; $('aiMaps').style.display = '';
    $('aiMapsHead').textContent = `${m.stage}단계: 맵을 고르거나 "아무거나"로 시작합니다.`;
    const g = $('aiMapGrid'); g.innerHTML = '';
    m.cands.forEach((c, i) => {
      const b = thumbButton(MAPKO_SHORT(c), false, false, () => { $('aiDlg').classList.remove('on'); $('aiMaps').style.display = 'none'; $('aiStages').style.display = ''; send({ t: 'ai', stage: m.stage, pick: i }); });
      const ph = document.createElement('canvas'); ph.width = 128; ph.height = 64; b.prepend(ph); g.append(b);
      landThumb(c, c.hogs).then(cv => ph.replaceWith(cv)).catch(() => {});
    });
  }
  // AI 대전 이어 하기 (1-나): 결과창에서 바로 다음 판. 20단계를 깨면 "처음부터 다시"(1단계)
  $('btnAiNext').onclick = () => { if (S.maintOn) return; const m = S.aiResult; $('result').classList.remove('on'); send({ t: 'ai', stage: m.win && m.stage >= m.max ? 1 : m.stage + 1 }); };
  $('btnAiRetry').onclick = () => { if (S.maintOn) return; $('result').classList.remove('on'); send({ t: 'ai', stage: S.aiResult.stage }); };
  const aiTag = (n) => { const t = document.createElement('span'); t.className = 'aiTag'; t.textContent = 'AI 최고 ' + n + '단계'; return t; };
  // ---- 운영자 ----
  $('btnAdmin').onclick = () => { send({ t: 'admin', op: 'list' }); $('admin').classList.add('on'); };
  $('btnCloseAdmin').onclick = () => $('admin').classList.remove('on');
  $('btnBackupNow').onclick = () => { $('adminBackup').textContent = '백업 중…'; send({ t: 'admin', op: 'backup' }); };
  $('btnMaint5').onclick = () => send({ t: 'admin', op: 'maint', min: 5 });
  $('btnMaint10').onclick = () => send({ t: 'admin', op: 'maint', min: 10 });
  $('btnMaintOff').onclick = () => send({ t: 'admin', op: 'maintoff' });
  function renderBackup(b) {
    const el = $('adminBackup'); if (!el || !b) return;
    const t = (s) => s ? new Date(s).toLocaleString('ko-KR') : '-';
    el.style.color = b.ok === false ? '#ff8080' : '#9dff9d';
    el.textContent = b.ok === false ? `[경고] 외부 백업 실패: ${b.lastError} (위치 ${b.dir || '없음'}, 마지막 성공 ${t(b.lastOk)})`
      : `외부 백업 정상: 마지막 ${t(b.lastOk)} · 위치 ${b.dir}`;
  }
  function renderAdmin(list) {
    const b = $('adminList'); b.innerHTML = '';
    const tb = document.createElement('table'); tb.className = 'info';
    const hr = tb.insertRow(); hr.className = 'head'; ['아이디', '닉네임', '계급', '경험치', '판', '가입', '마지막 접속', '상태', ''].forEach(h => { hr.insertCell().textContent = h; });
    const day = (iso) => iso ? new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '-';
    for (const u of list) {
      const tr = tb.insertRow();
      [u.id, u.nick, u.rankName, u.exp, u.games || 0, day(u.createdAt), day(u.lastSeen), u.suspended ? '정지' : (u.admin ? '운영자' : '정상')].forEach(v => { tr.insertCell().textContent = v; });
      const c = tr.insertCell();
      const r = document.createElement('button'); r.className = 'mini'; r.innerHTML = '<img src="assets/ui/edit.png" alt="" style="height:14px">비번 초기화';
      r.onclick = () => send({ t: 'admin', op: 'reset', id: u.id });
      const s = document.createElement('button'); s.className = 'mini';
      s.innerHTML = `<img src="assets/ui/${u.suspended ? 'unlock' : 'lock'}.png" alt="" style="height:12px">${u.suspended ? '정지 해제' : '정지'}`;
      s.onclick = () => send({ t: 'admin', op: u.suspended ? 'unsuspend' : 'suspend', id: u.id });
      c.append(r, s);
      if (!u.admin) {   // 계정 삭제: 두 번 눌러야 지워짐 (실수 방지)
        const d = document.createElement('button'); d.className = 'mini'; d.textContent = '삭제';
        d.onclick = () => { if (d.dataset.arm) send({ t: 'admin', op: 'delete', id: u.id }); else { d.dataset.arm = 1; d.textContent = '정말 삭제?'; d.style.color = '#ff9090'; setTimeout(() => { delete d.dataset.arm; d.textContent = '삭제'; d.style.color = ''; }, 4000); } };
        c.append(d);
      }
    }
    b.append(tb);
  }
  // 가입 받기·이용 규칙·오래된 빈 계정 (0-8)
  S.adminInfo = null;
  function renderAdminSite() {
    const a = S.adminInfo, el = $('adminSite'); if (!el || !a) return;
    const site = a.site || {};
    el.textContent = `가입: ${site.signupOpen ? '받는 중' : '닫음'} · 계정 ${a.count}/${a.max}${a.count >= a.max ? ' (상한, 가입 닫힘)' : ''} · 30일 지난 빈 계정 ${(a.stale || []).length}개`;
    $('btnSignupToggle').textContent = site.signupOpen ? '가입 받기 끄기' : '가입 받기 켜기';
    $('btnStale').disabled = !(a.stale || []).length;
  }
  $('btnSignupToggle').onclick = () => { if (S.adminInfo) send({ t: 'admin', op: 'site', signupOpen: !S.adminInfo.site.signupOpen }); };
  $('btnTermsEdit').onclick = () => { const t = (S.adminInfo && S.adminInfo.site.terms) || []; ['term1', 'term2', 'term3'].forEach((id, i) => { $(id).value = t[i] || ''; }); $('termsEdit').style.display = 'block'; };
  $('btnTermsCancel').onclick = () => { $('termsEdit').style.display = 'none'; };
  $('btnTermsSave').onclick = () => send({ t: 'admin', op: 'site', terms: ['term1', 'term2', 'term3'].map(id => $(id).value) });
  $('btnStale').onclick = () => {
    const b = $('btnStale'), ids = (S.adminInfo && S.adminInfo.stale) || [];
    if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = `${ids.length}개 정말 지우기?`; setTimeout(() => { delete b.dataset.arm; b.textContent = '30일 지난 빈 계정 지우기'; }, 4000); return; }
    send({ t: 'admin', op: 'purge', ids });
  };

  // ---------------- 서버 메시지 ----------------
  function onMsg(m) {
    if (m.t === 'ver') return onVersion(m);
    if (m.t === 'maint') return onMaint(m);
    if (m.t === 'site') return onSite(m);
    if (m.t === 'aicands') return onAiCands(m);
    if (m.t === 'generals') {
      const el = $('genList'); if (!el) return; el.innerHTML = '';
      if (!m.list.length) { el.className = 'small'; el.textContent = '아직 장성 후보(누적 경험치 21,000 이상, 14일 안에 사람과 경기)가 없습니다.'; return; }
      const tb = document.createElement('table'); tb.className = 'info';
      const hr = tb.insertRow(); hr.className = 'head'; ['순위', '계급', '닉네임', '경험치'].forEach(h => { hr.insertCell().textContent = h; });
      for (const g of m.list) { const tr = tb.insertRow(); [g.place + '위', g.name, g.nick, g.exp.toLocaleString()].forEach(v => { tr.insertCell().textContent = v; }); }
      el.append(tb); return;
    }
    if (m.t === 'auth') {
      S.authed = true; S.user = m.user;
      if (m.token) { S.auth = m.token; store.set('hwauth', m.token); }
      authView('main'); renderMe();
      if (m.user.notices && m.user.notices.length) { $('homeErr').textContent = m.user.notices.map(n => n.msg).join('  ·  '); $('homeErr').style.color = '#ffe066'; send({ t: 'seennotices' }); }
      if (S.restarting) {   // 점검 재시작 뒤 다시 붙음: 방·경기는 서버에서 없어졌으므로 로비로
        S.restarting = 0; $('conn').textContent = '서버와 연결이 끊겼습니다. 다시 연결하는 중…';
        setRoom(null); S.lobby = null; S.game = null; show('home'); flash('점검이 끝났습니다. 다시 연결되었습니다.', '#9dff9d');
      }
      if (!S.lobby && !S.game) show('home');
      if (m.user.mustChange) openPwChange(true);
      const q = S.queue; S.queue = []; for (const o of q) send(o);
      if (!q.some(o => o.t === 'hello')) {
        if (S.room) send({ t: 'hello', room: S.room });
        else if (S.linkRoom) { send({ t: 'hello', room: S.linkRoom }); S.linkRoom = null; history.replaceState(null, '', location.pathname.replace(/\/r\/[A-Za-z0-9]{4}\/?$/, '/')); }
      }
      return;
    }
    if (m.t === 'autherr') {
      $('authErr').textContent = m.msg;
      if (m.expired || !S.authed) {
        if (m.expired) { S.auth = null; store.del('hwauth'); setRoom(null); S.authed = false; S.game = null; S.lobby = null; show('home'); authView('login'); $('authErr').textContent = m.msg; }
        $('conn').style.display = 'none';
      }
      return;
    }
    if (m.t === 'loggedout') return;
    if (m.t === 'adminwarn') { $('homeErr').textContent = '[운영자 경고] ' + m.msg; $('adminMsg').textContent = '[경고] ' + m.msg; return; }
    if (m.t === 'rooms') { S.rooms = m.list; renderRooms(); return; }
    if (m.t === 'chpw') {
      $('pwMsg').textContent = m.ok ? '비밀번호를 바꿨습니다. 다른 기기는 다시 로그인해야 합니다.' : m.msg;
      $('pwMsg').style.color = m.ok ? '#9dff9d' : '';
      if (m.ok) { S.user = m.user; $('pwNotice').textContent = ''; for (const id of ['pwCur', 'pwNew', 'pwNew2']) $(id).value = ''; }
      return;
    }
    if (m.t === 'me') { S.user = m.user; renderMe(); if (S.showMe) { S.showMe = false; renderMyInfo(m.user); } return; }
    if (m.t === 'admin') {
      if (m.error) { $('adminMsg').textContent = m.error; return; }
      if (m.op === 'list' || m.op === 'backup') { renderAdmin(m.list); renderBackup(m.backup); if (m.maint) renderAdminMaint(m.maint); if (m.site) { S.adminInfo = { site: m.site, count: m.count, max: m.max, stale: m.stale }; renderAdminSite(); } }
      else if (m.op === 'site') { $('adminMsg').textContent = m.terms ? '이용 규칙을 고쳤습니다.' : '저장했습니다.'; $('termsEdit').style.display = 'none'; send({ t: 'admin', op: 'list' }); }
      else if (m.op === 'delete' || m.op === 'purge') { $('adminMsg').textContent = m.op === 'delete' ? `${m.id} 계정을 지웠습니다.` : `빈 계정 ${(m.deleted || []).length}개를 지웠습니다.`; send({ t: 'admin', op: 'list' }); }
      else if (m.op === 'maint' || m.op === 'maintoff') { renderAdminMaint(m.maint); $('adminMsg').textContent = m.op === 'maint' ? '점검 예고를 시작했습니다. 진행 중인 판이 모두 끝나면 서버가 스스로 다시 켜집니다.' : '점검 예고를 취소했습니다.'; }
      else {
        $('adminMsg').textContent = m.op === 'reset' ? `${m.id} 임시 비밀번호: ${m.temp}  (본인에게 전달 후 바꾸게 하세요)` : `${m.id}: ${m.op === 'suspend' ? '정지됨' : '정지 해제됨'}`;
        send({ t: 'admin', op: 'list' });
      }
      return;
    }
    if (m.t === 'error') {
      if (S.creating) { S.creating = false; $('createErr').textContent = m.msg; }
      $('homeErr').textContent = m.msg; $('lobbyErr').textContent = m.msg;
      if (!S.lobby) setRoom(null);
      return;
    }
    if (m.t === 'joined') { S.me = m.you; setRoom(m.room); $('homeErr').textContent = ''; S.creating = false; $('createDlg').classList.remove('on'); return; }
    if (m.t === 'left') { setRoom(null); S.lobby = null; if (S.game) { S.game = null; } show('home'); showVerLater(); return; }
    if (m.t === 'lobby') { S.lobby = m; renderLobby(); if (m.phase === 'lobby') showVerLater(); return; }
    if (m.t === 'game') { S.loadingGame = []; startGame(m).catch(e => { console.error(e); flash('지도를 불러오지 못했습니다: ' + e.message, '#ff8080'); }).finally(() => { const q = S.loadingGame || []; S.loadingGame = null; for (const x of q) onMsg(x); }); return; }
    if (S.loadingGame) { S.loadingGame.push(m); return; }
    if (m.t === 'result') { showResult(m); return; }
    if (!S.game) return;
    if (m.t === 's') onSnap(m);
    else if (m.t === 'ev') for (const e of m.e) onEvent(e);
  }
  function renderLobby() {
    const L = S.lobby;
    $('roomTitle').textContent = L.title || '방';
    const team = L.mode === 'team';
    const per = L.players.length >= 7 ? 2 : L.players.length >= 5 ? 3 : null;
    $('lobbyModeText').textContent = (team ? `팀전 (${L.max / 2}대${L.max / 2})` : '개인전') + ` · ${L.players.length}/${L.max}명` + (per ? ` · 인원이 많아 1인당 고슴도치 ${per}마리, 턴 30초` : '');
    $('plist').innerHTML = '';
    for (const p of L.players) {
      const li = document.createElement('li');
      if (!p.connected) li.className = 'off';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = p.color;
      const who = rankBadge(p.rank, p.rankName, p.nick, 30); who.style.flex = '1';
      li.append(dot, who);
      if (p.aiBest) who.append(aiTag(p.aiBest));
      if (team) { const s = document.createElement('span'); s.className = 'tag'; s.style.borderColor = p.color; s.style.color = '#fff'; s.textContent = 'AB'[p.side] + '팀'; li.append(s); }
      if (p.id === L.host) { const s = document.createElement('img'); s.src = 'assets/ui/roomadmin.png'; s.title = '방장'; s.width = 16; li.append(s); const t = document.createElement('span'); t.className = 'small'; t.textContent = '방장'; li.append(t); }
      if (p.id === S.me) { const s = document.createElement('span'); s.className = 'small'; s.textContent = '(나)'; li.append(s); }
      if (!p.connected) { const s = document.createElement('span'); s.className = 'small'; s.textContent = '연결 끊김'; li.append(s); }
      $('plist').appendChild(li);
    }
    const isHost = L.host === S.me;
    renderMapPick(L, isHost);
    $('hogs').value = L.hogs; $('hogs').disabled = !isHost;
    $('windMode').value = L.windMode || 'gradual'; $('windMode').disabled = !isHost;
    $('turnSel').value = String(L.turnSel || 0); $('turnSel').disabled = !isHost;
    $('lobbyMode').value = L.mode; $('lobbyMode').disabled = !isHost;
    if ($('lobbyMax').dataset.team !== String(team)) { fillMax($('lobbyMax'), team, L.max); $('lobbyMax').dataset.team = String(team); }
    $('lobbyMax').value = L.max; $('lobbyMax').disabled = !isHost;
    $('hogs').disabled = !isHost || !!per;
    $('sideRow').style.display = team ? 'flex' : 'none';
    const conn = L.players.filter(p => p.connected);
    let why = '';
    if (conn.length < 2) why = '2명 이상 모이면 시작';
    else if (team && (conn.length < 4 || conn.length % 2)) why = '팀전은 4·6·8명(2대2~4대4)일 때 시작';
    else if (team && conn.filter(p => p.side === 0).length * 2 !== conn.length) why = '두 팀 인원을 같게 나눠 주세요';
    $('btnStart').disabled = !isHost || !!why;
    $('btnStart').lastChild.textContent = isHost ? (why || '경기 시작') : '방장이 시작합니다';
    $('lobbyErr').textContent = '';
    if (L.phase === 'lobby') {
      if (S.game) { S.game = null; $('overlay').classList.remove('on'); }
      show('lobby'); music('main_theme');
    }
  }
  // ---- 지도 고르기 (방장만 바꿈, 모두 미리보기) ----
  function opt(sel, list) {
    const key = JSON.stringify(list); if (sel.dataset.k === key) return; sel.dataset.k = key; sel.innerHTML = '';
    for (const [v, t, dis] of list) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (dis) o.disabled = true; sel.append(o); }
  }
  // ---- 지도 고르기 그림 (1-나 11번): 후보 = 서버가 정한 종류·seed·테마 → 같은 생성 코드로 그려 보여 줌 (본 그림 = 실제 맵) ----
  const thumbCache = new Map();
  async function landThumb(spec, hogs) {
    const key = [spec.kind, spec.sub, spec.seed, spec.th, hogs, spec.noObj ? 1 : 0, spec.flat ? 1 : 0].join('|');
    if (thumbCache.has(key)) return thumbCache.get(key);
    const p = (async () => {
      const tpl = await loadTemplates(), th = await loadTheme(spec.th);
      const L = MapGen.build({ kind: spec.kind, sub: spec.sub, seed: spec.seed, hogs, flat: spec.flat }, { templates: tpl, theme: th.j, placed: spec.noObj ? [] : undefined });
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d');
      x.fillStyle = 'rgb(' + th.j.sky.join(',') + ')'; x.fillRect(0, 0, 128, 64);
      const sc = Math.min(128 / L.W, 64 / L.H), w = Math.max(1, Math.floor(L.W * sc)), hh = Math.max(1, Math.floor(L.H * sc));
      const img = x.createImageData(w, hh), d = img.data, a = th.avg, wt = th.j.waterTop, sky = th.j.sky;
      for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w; xx++) { const v = L[Math.floor(yy / sc) * L.W + Math.floor(xx / sc)], col = v === 2 ? [230, 200, 40] : v ? a : Math.floor(yy / sc) >= L.waterY ? wt : sky, o = (yy * w + xx) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
      x.putImageData(img, Math.floor((128 - w) / 2), Math.floor((64 - hh) / 2));
      return c;
    })();
    thumbCache.set(key, p); if (thumbCache.size > 80) thumbCache.delete(thumbCache.keys().next().value);
    return p;
  }
  function thumbButton(label, sel, dis, onclick) {
    const b = document.createElement('button'); b.className = 'mpThumb' + (sel ? ' primary' : ''); b.disabled = !!dis; b.onclick = onclick;
    const cap = document.createElement('span'); cap.textContent = label; b.append(cap); return b;
  }
  const SIZEKO = { small: '작은 땅', medium: '중간 땅', large: '큰 땅', cavern: '동굴', wacky: '떠 있는 섬들' };
  const MAPKO_SHORT = (c) => c.kind === 'maze' ? '미로' + (c.sub ? ' · ' + (MAPKO[c.sub] || c.sub) : '') : (SIZEKO[c.sub] || MAPKO[c.sub] || c.sub || '무작위') + (c.flat ? ' · 평평' : '');
  S.mpTab = null;
  async function renderMapCands(L, isHost) {
    const mp = L.map, grid = $('mpGrid'); if (!grid) return;
    const diff = mp.diff && mp.diff !== 'custom' ? mp.diff : (L.cands && L.cands[0] ? L.cands[0].diff : 'easy');
    const tab = S.mpTab || (mp.kind === 'image' ? 'image' : L.candTab || 'random');
    for (const b of document.querySelectorAll('#mpDiff button')) { b.classList.toggle('primary', b.dataset.d === diff && tab !== 'image'); b.disabled = !isHost; }
    for (const b of document.querySelectorAll('#mpTab button')) { b.classList.toggle('primary', b.dataset.t === tab); b.disabled = !isHost && b.dataset.t !== 'image'; }
    $('btnMoreCands').style.display = tab === 'image' ? 'none' : ''; $('btnMoreCands').disabled = !isHost;
    const key = JSON.stringify([tab, L.cands, mp.kind, mp.seed, mp.name, isHost]); if (grid.dataset.k === key) return; grid.dataset.k = key; grid.innerHTML = '';
    if (tab === 'image') {
      const cat = await loadCatalog(); if (S.lobby !== L) return;
      for (const n of Object.keys(cat.maps).sort()) {
        const b = thumbButton(n, mp.kind === 'image' && mp.name === n, !isHost || cat.maps[n].maxHogs < mp.hogs, () => send({ t: 'map', kind: 'image', sub: n, theme: '' }));
        const im = document.createElement('img'); im.loading = 'lazy'; im.alt = n; im.src = 'assets/maps/' + n + '/preview.png'; b.prepend(im); grid.append(b);
      }
      return;
    }
    (L.cands || []).forEach((c, i) => {
      const b = thumbButton(MAPKO_SHORT(c), mp.kind === c.kind && mp.seed === c.seed, !isHost, () => send({ t: 'mappick', i }));
      const ph = document.createElement('canvas'); ph.width = 128; ph.height = 64; b.prepend(ph); grid.append(b);
      landThumb(c, c.hogs).then(cv => { ph.replaceWith(cv); }).catch(() => {});
    });
  }
  for (const b of document.querySelectorAll('#mpDiff button')) b.onclick = () => { const tab = S.mpTab === 'maze' ? 'maze' : 'random'; S.mpTab = tab; send({ t: 'mapcands', diff: b.dataset.d, tab, pickFirst: true }); };
  for (const b of document.querySelectorAll('#mpTab button')) b.onclick = () => {
    S.mpTab = b.dataset.t;
    if (b.dataset.t === 'image') { if (S.lobby) renderMapCands(S.lobby, S.lobby.host === S.me); return; }
    const d = document.querySelector('#mpDiff button.primary'); send({ t: 'mapcands', diff: d ? d.dataset.d : 'easy', tab: b.dataset.t, pickFirst: true });
  };
  $('btnMoreCands').onclick = () => { const d = document.querySelector('#mpDiff button.primary'); send({ t: 'mapcands', diff: d ? d.dataset.d : 'easy', tab: S.mpTab === 'maze' ? 'maze' : 'random' }); };
  async function renderMapPick(L, isHost) {
    renderMapCands(L, isHost).catch(e => console.warn('[hw] 후보', e));
    const mp = L.map; if (!mp) { $('mapRow').style.display = $('mapPrevRow').style.display = 'none'; return; }
    const cat = await loadCatalog();
    if (S.lobby !== L) return;
    const themes = Object.keys(cat.themes).filter(t => !cat.themes[t].hidden).sort();
    const diff = mp.diff || 'custom';
    $('mapDiff').value = diff;
    for (const el of document.querySelectorAll('#mapRow .mapCustom')) el.style.display = diff === 'custom' ? '' : 'none';
    $('mapKind').value = mp.kind;
    if (mp.kind === 'image') opt($('mapSub'), [['', '무작위 맵']].concat(Object.keys(cat.maps).sort().map(n => [n, n + ' (' + cat.maps[n].maxHogs + ')', cat.maps[n].maxHogs < mp.hogs])));
    else opt($('mapSub'), [['', '무작위 종류']].concat((mp.kind === 'maze' ? LandGen.MAZE_TYPES : LandGen.OUTLINE_TYPES).map(t => [t, MAPKO[t] || t])));
    $('mapSub').value = mp.sub || '';
    opt($('mapTheme'), mp.kind === 'image' ? [['', '맵에 딸린 테마']] : [['', '무작위 테마']].concat(themes.map(t => [t, t])));
    $('mapTheme').value = mp.kind === 'image' ? '' : (mp.theme || '');
    for (const id of ['mapDiff', 'mapKind', 'mapSub', 'mapTheme', 'btnReroll']) $(id).disabled = !isHost;
    $('mapTheme').disabled = !isHost || mp.kind === 'image';
    drawMapPreview(mp).catch(e => console.warn('[hw] 미리보기', e));
  }
  ['mapDiff', 'mapKind', 'mapSub'].forEach(id => { $(id).onchange = () => send({ t: 'map', diff: $('mapDiff').value, kind: $('mapKind').value, sub: id === 'mapKind' ? '' : $('mapSub').value, theme: $('mapTheme').value }); });
  // 테마를 바꾸면 그 테마로 후보 6장을 새로 뽑음 (이미지 맵은 맵에 딸린 테마)
  $('mapTheme').onchange = () => { const d = document.querySelector('#mpDiff button.primary'); send({ t: 'mapcands', diff: d ? d.dataset.d : 'easy', tab: S.mpTab === 'maze' ? 'maze' : 'random', theme: $('mapTheme').value, pickFirst: true }); };
  $('btnReroll').onclick = () => send({ t: 'reroll' });
  const prevCache = new Map();
  async function drawMapPreview(mp) {
    const key = [mp.kind, mp.sub, mp.seed, mp.hogs, mp.th, mp.name, mp.noObj ? 1 : 0, mp.flat ? 1 : 0].join('|');
    if (S.prevKey === key) return; S.prevKey = key;
    const c = $('mapPrev'), x = c.getContext('2d');
    const kindKo = mp.kind === 'image' ? '이미지 맵' : mp.kind === 'maze' ? '미로' : '무작위 생성';
    $('mapDesc').textContent = '불러오는 중…';
    const th = await loadTheme(mp.th);            // 고른 테마를 미리 받아 둠 (경기 시작이 빨라짐)
    if (S.prevKey !== key) return;
    let desc;
    x.fillStyle = 'rgb(' + th.j.sky.join(',') + ')'; x.fillRect(0, 0, c.width, c.height);
    if (mp.kind === 'image') {
      const im = await loadImg('assets/maps/' + mp.name + '/preview.png');
      loadImageMap(mp.name).catch(() => {});
      if (S.prevKey !== key) return;
      if (im) { const sc = Math.min(c.width / im.width, c.height / im.height); x.drawImage(im, (c.width - im.width * sc) / 2, (c.height - im.height * sc) / 2, im.width * sc, im.height * sc); }
      desc = mp.name;
    } else {
      let L = prevCache.get(key);
      if (!L) {
        const tpl = await loadTemplates();
        L = MapGen.build({ kind: mp.kind, sub: mp.sub, seed: mp.seed, hogs: mp.hogs, flat: mp.flat }, { templates: tpl, theme: th.j, placed: mp.noObj ? [] : undefined });
        prevCache.clear(); prevCache.set(key, L);
      }
      if (S.prevKey !== key) return;
      const sc = Math.min(c.width / L.W, c.height / L.H), w = Math.max(1, Math.floor(L.W * sc)), hh = Math.max(1, Math.floor(L.H * sc));
      const img = x.createImageData(w, hh), d = img.data, sky = th.j.sky, wt = th.j.waterTop, a = th.avg;
      for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w; xx++) {
        const sx = Math.floor(xx / sc), sy = Math.floor(yy / sc), v = L[sy * L.W + sx], o = (yy * w + xx) * 4;
        const col = v === 2 ? [230, 200, 40] : v ? a : sy >= L.waterY ? wt : sky;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      x.putImageData(img, Math.floor((c.width - w) / 2), Math.floor((c.height - hh) / 2));
      desc = (MAPKO[L.typeName] || L.typeName) + (mp.sub ? '' : ' (무작위로 뽑힘)');
    }
    const DIFFKO = { easy: '쉬움', normal: '보통', hard: '어려움' };
    $('mapDesc').textContent = (DIFFKO[mp.diff] ? `[${DIFFKO[mp.diff]}] ` : '') + `${kindKo}: ${desc} · 테마 ${mp.th}${mp.kind !== 'image' && !mp.theme ? ' (무작위)' : ''} · 고슴도치 ${mp.hogs}마리`;
  }
  // 판 결과 (서버가 계산한 값만 보여줌): 순위 아이콘은 원본 StatsMedal
  function showResult(m) {
    const b = $('resBody'); b.innerHTML = '';
    $('btnAiNext').style.display = 'none'; $('btnAiRetry').style.display = 'none'; $('aiContNote').style.display = 'none'; $('btnCloseResult').textContent = '확인';
    if (m.mode === 'ai') return showAIResult(m);
    const mine = m.rows.find(r => r.pid === S.me);
    $('resHead').textContent = m.maint ? '점검으로 종료됨: 무승부, 경험치 변동 없음' : m.draw ? '무승부: 경험치 변동 없음' : mine ? (mine.outcome === 'win' ? '승리!' : mine.outcome === 'quit' ? '기권 처리' : '패배') : '경기 종료';
    $('resHead').style.color = mine && mine.outcome === 'win' ? '#ffcc00' : '#fff';
    const tb = document.createElement('table'); tb.className = 'info res';
    const hr = tb.insertRow(); hr.className = 'head'; ['순위', '참가자', '이번 판', '누적', '다음 계급까지'].forEach(h => { hr.insertCell().textContent = h; });
    for (const r of m.rows) {
      const tr = tb.insertRow(); if (r.pid === S.me) tr.className = 'meRow';
      const pc = tr.insertCell();
      const medal = m.mode === 'team' ? (r.outcome === 'win' ? 1 : 0) : (r.outcome === 'quit' || r.outcome === 'draw' ? 0 : r.place);
      if (medal >= 1 && medal <= 4) { const im = document.createElement('img'); im.src = 'assets/ui/StatsMedal' + medal + '.png'; im.width = 22; im.style.verticalAlign = 'middle'; pc.append(im, ' '); }
      pc.append(r.outcome === 'quit' ? '기권' : r.outcome === 'draw' ? '무' : (m.mode === 'team' ? 'AB'[r.clan] + '팀 ' + (r.outcome === 'win' ? '승' : '패') : r.place + '위'));
      const c = tr.insertCell(); const rb = r.rankAfter || { level: 0, name: '훈련병' };
      c.append(rankBadge(rb.level, rb.name, r.nick, 28));
      const d = tr.insertCell(); d.textContent = (r.delta > 0 ? '+' : '') + r.delta; d.style.color = r.delta > 0 ? '#9dff9d' : r.delta < 0 ? '#ff8080' : '#fff';
      tr.insertCell().textContent = r.after.toLocaleString();
      tr.insertCell().textContent = (rb.next != null ? `${Math.max(0, rb.next - r.after).toLocaleString()} (${rb.nextName})` : '장성') + (rb.demoteIn != null ? ` · 강등까지 ${rb.demoteIn}` : '');
    }
    b.append(tb);
    const notes = [];
    for (const r of m.rows) {
      if (!r.rankBefore || !r.rankAfter || r.rankBefore.level === r.rankAfter.level) continue;
      notes.push(`${r.nick}: ${r.rankBefore.name} → ${r.rankAfter.name} ${r.rankAfter.level > r.rankBefore.level ? '진급!' : '강등'}`);
    }
    for (const sn of m.seat || []) notes.push('장성 순위: ' + sn);
    $('resNotes').textContent = notes.join('  ·  ');
    $('result').classList.add('on');
    if (mine) send({ t: 'me' });
  }
  $('btnCloseResult').onclick = () => $('result').classList.remove('on');
  // AI 대전 결과: 이기면 "다음 단계", 지면 "다시 도전". 경험치는 처음 깬 단계만
  // 점검 예고 중에는 이어 하기를 막음 (서버도 새 판을 막음)
  function aiContButtons() {
    const on = !!S.maintOn;
    for (const id of ['btnAiNext', 'btnAiRetry']) $(id).disabled = on;
    $('aiContNote').style.display = on && S.aiResult && $('result').classList.contains('on') ? '' : 'none';
    $('aiContNote').textContent = '점검 예고 중이라 새 판을 시작할 수 없습니다. 점검 뒤에 이어 하세요.';
  }
  function showAIResult(m) {
    S.aiResult = m;
    $('resHead').textContent = m.maint ? `점검으로 종료됨: ${m.stage}단계 기록 변동 없음` : m.win ? `${m.stage}단계 클리어!` : `${m.stage}단계 패배`;
    $('resHead').style.color = m.win ? '#ffcc00' : '#fff';
    const tb = document.createElement('table'); tb.className = 'info res';
    const hr = tb.insertRow(); hr.className = 'head'; ['', '편', '남은 고슴도치', '준 피해'].forEach(x => { hr.insertCell().textContent = x; });
    for (const r of m.rows) {
      const tr = tb.insertRow(); if (r.pid === S.me) tr.className = 'meRow';
      const c0 = tr.insertCell(); const won = m.win ? !r.ai : r.ai;
      if (won) { const im = document.createElement('img'); im.src = 'assets/ui/StatsMedal1.png'; im.width = 22; im.style.verticalAlign = 'middle'; c0.append(im); }
      const c1 = tr.insertCell(); const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = r.color; dot.style.display = 'inline-block'; dot.style.marginRight = '6px';
      c1.append(dot, r.nick + (r.ai ? '' : ' (나)'));
      tr.insertCell().textContent = r.left + '마리';
      tr.insertCell().textContent = r.dealt;
    }
    $('resBody').append(tb);
    let note;
    if (m.win && m.first) note = `처음 깼습니다! 경험치 +${m.delta} (${(m.before || 0).toLocaleString()} → ${(m.after || 0).toLocaleString()})` + (m.rankBefore && m.rankAfter && m.rankBefore.level !== m.rankAfter.level ? ` · ${m.rankBefore.name} → ${m.rankAfter.name} 진급!` : '');
    else if (m.win) note = '이미 깬 단계라 경험치는 없습니다.';
    else note = '경험치 변동 없음. 다시 도전해 보세요.';
    if (m.win && m.stage < m.max) note += ` 다음은 ${m.stage + 1}단계입니다.`;
    if (m.win && m.stage >= m.max) { $('resHead').textContent = `축하합니다! ${m.max}단계까지 모두 깼습니다!`; note += ' 처음부터 다시 도전할 수 있습니다.'; }
    $('resNotes').textContent = note;
    const last = m.win && m.stage >= m.max;
    $('btnAiNext').style.display = m.win && !m.maint ? '' : 'none';
    $('btnAiNext').lastChild.textContent = last ? '처음부터 다시' : `${m.stage + 1}단계 계속하기`;
    $('btnAiRetry').style.display = !m.maint && !last ? '' : 'none';
    $('btnAiRetry').lastChild.textContent = m.win ? '같은 단계 다시' : '다시 도전';
    $('btnCloseResult').textContent = '그만하기';
    aiContButtons();
    $('result').classList.add('on');
    send({ t: 'me' });
  }

  // ---------------- 경기 ----------------
  const cv = $('cv'), ctx = cv.getContext('2d');
  let DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR);
  }
  window.addEventListener('resize', resize); resize();

  async function startGame(m) {
    await imgReady;
    const mp = m.map || { kind: 'random', sub: '', theme: 'Nature', hogs: 8, placed: [] };
    $('msg').textContent = '지도를 불러오는 중…';
    const [th, tpl, im] = await Promise.all([loadTheme(mp.theme), mp.kind === 'image' ? null : loadTemplates(), mp.kind === 'image' ? loadImageMap(mp.name) : null]);
    const land = MapGen.build({ kind: mp.kind, sub: mp.sub, seed: m.seed, hogs: mp.hogs, flat: mp.flat },
      { templates: tpl, theme: th.j, image: im && im.land, placed: mp.placed, keepBase: true });
    const G = {
      seed: m.seed, teams: m.teams, mode: m.mode, waterY: 0, sd: !!m.sd, upcoming: [], hogs: {}, snaps: [], parts: [], floats: [], graves: m.graves.slice(),
      land, map: mp, T: th, mapPng: im && im.png, canvas: document.createElement('canvas'),
      cam: { x: 0, y: 0, z: 1, manual: 0 }, cur: 0, lastTurnAt: 0, myTeam: m.teams.find(t => t.pid === S.me),
      deadIds: new Set(),
    };
    W = G.land.W; H = G.land.H; G.water0 = G.land.waterY; G.waterY = G.water0; G.cam.x = W / 2; G.cam.y = H / 2;
    for (const t of m.teams) for (const h of t.hogs) G.hogs[h.id] = { id: h.id, name: h.name, team: t, hp: h.hp || 100 };
    G.ai = m.ai || null;
    buildLand(G);
    for (const b of m.booms) carveCanvas(G, b[0], b[1], b[2]);
    raiseWater(G, m.waterY == null ? G.water0 : m.waterY);
    checkLand(G, m.land);
    G.cam.z = clampZ(savedZoom() || defaultZoom());
    S.game = G;
    $('overlay').classList.remove('on');
    $('msg').textContent = '';
    show('game');
    if (document.activeElement) document.activeElement.blur();
    const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    $('touch').classList.toggle('on', touch); document.body.classList.toggle('touch', touch);
    buildTimerButtons();
    music(G.sd ? (th.j.sdMusic || 'sdmusic') : (th.j.music || 'Nature'));
  }
  function defaultZoom() { return Math.max(0.45, Math.min(1.6, innerHeight / 720)); }

  function buildLand(G) {
    const c = G.canvas; c.width = W; c.height = H;
    const x2 = c.getContext('2d');
    if (G.map.kind === 'image') {
      if (G.mapPng) x2.drawImage(G.mapPng, 0, 0);
      drawBorderStripes(G, x2);
      return;
    }
    const T = G.T.img;
    const tex = getPixels(T.land || IMG.Nature_LandTex), bor = getPixels(T.border || IMG.Nature_Border);
    const img = x2.createImageData(W, H), d = img.data, mk = G.land.base || G.land;
    for (let y = 0; y < H; y++) {
      const ty = (y % tex.h) * tex.w;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mk[i]) continue;
        const s = (ty + (x % tex.w)) * 4, o = i * 4;
        d[o] = tex.d[s]; d[o + 1] = tex.d[s + 1]; d[o + 2] = tex.d[s + 2]; d[o + 3] = 255;
      }
    }
    // 테두리(풀): 땅 윗면에 Border.png 를 덧그림
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < H; y++) {
        if (!mk[y * W + x] || mk[(y - 1) * W + x]) continue;
        for (let r = 0; r < bor.h; r++) {
          const yy = y - 10 + r; if (yy < 0 || yy >= H) continue;
          const o = (yy * W + x) * 4, s = (r * bor.w + (x % bor.w)) * 4, a = bor.d[s + 3] / 255;
          if (a === 0) continue;
          if (!mk[yy * W + x] && r > 12) continue;
          d[o] = d[o] * (1 - a) + bor.d[s] * a; d[o + 1] = d[o + 1] * (1 - a) + bor.d[s + 1] * a;
          d[o + 2] = d[o + 2] * (1 - a) + bor.d[s + 2] * a; d[o + 3] = Math.max(d[o + 3], bor.d[s + 3]);
        }
      }
    }
    x2.putImageData(img, 0, 0);
    // 장식: 원본처럼 이미 칠해진 땅 뒤쪽으로 (BlitImageAndGenerateCollisionInfo 는 빈 곳에만 칠함)
    x2.save(); x2.globalCompositeOperation = 'destination-over';
    for (const [i, x, y] of G.land.objects) { const o = G.T.objImgs[i]; if (o) x2.drawImage(o, x, y); }
    x2.restore();
    drawBorderStripes(G, x2);
    G.land.base = null;
  }
  // 부서지지 않는 테두리: 검정·노랑 줄무늬 (원본 uLand.pas)
  function drawBorderStripes(G, x2) {
    if (!G.land.border) return;
    const B = MapGen.BORDER, wy = G.land.waterY;
    for (let y = 0; y < wy; y++) for (const x0 of [0, W - B]) for (let x = x0; x < x0 + B; x++) {
      x2.fillStyle = (y + x) % 32 < 16 ? '#000' : '#ff0'; x2.fillRect(x, y, 1, 1);
    }
    for (let y = 0; y < B; y++) for (let x = 0; x < W; x += 1) { x2.fillStyle = (y + x) % 32 < 16 ? '#000' : '#ff0'; x2.fillRect(x, y, 1, 1); }
  }
  function getPixels(im) {
    const c = document.createElement('canvas'); c.width = im.width || 1; c.height = im.height || 1;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    return { w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data };
  }
  function carveCanvas(G, x, y, r) {
    Sim.carve(G.land, x, y, r);
    const x2 = G.canvas.getContext('2d');
    x2.save();
    x2.globalCompositeOperation = 'source-atop';
    x2.fillStyle = 'rgba(40,20,8,0.75)';
    x2.beginPath(); x2.arc(x, y, r + 3, 0, Math.PI * 2); x2.fill();
    x2.globalCompositeOperation = 'destination-out';
    x2.beginPath(); x2.arc(x, y, r + 0.5, 0, Math.PI * 2); x2.fill();
    x2.restore();
    G.mmDirty = true;
  }

  function carveRectCanvas(G, sh) {
    const [, x, y, dx, dy, len, hw] = sh, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, px = uy, py = -ux;
    Sim.carveRect(G.land, x, y, dx, dy, len, hw);
    const x2 = G.canvas.getContext('2d'), poly = (e) => { x2.beginPath(); x2.moveTo(x + px * (hw + e) - ux * e, y + py * (hw + e) - uy * e); x2.lineTo(x + px * (hw + e) + ux * (len + e), y + py * (hw + e) + uy * (len + e)); x2.lineTo(x - px * (hw + e) + ux * (len + e), y - py * (hw + e) + uy * (len + e)); x2.lineTo(x - px * (hw + e) - ux * e, y - py * (hw + e) - uy * e); x2.closePath(); x2.fill(); };
    x2.save(); x2.globalCompositeOperation = 'source-atop'; x2.fillStyle = 'rgba(40,20,8,0.75)'; poly(2.5);
    x2.globalCompositeOperation = 'destination-out'; poly(0.5); x2.restore();
    G.mmDirty = true;
  }
  function onSnap(m) {
    const G = S.game;
    m.at = performance.now();
    G.snaps.push(m);
    if (G.snaps.length > 30) G.snaps.shift();
    for (const h of m.h) { const o = G.hogs[h[0]]; if (o) o.hp = h[3]; }
    G.last = m;
    if (m.wy != null && m.wy < G.waterY) raiseWater(G, m.wy);
  }
  // 서든데스 물 상승: 새로 잠긴 줄의 땅을 지움 (서버 doStepWaterUp 과 같은 처리)
  function raiseWater(G, wy) {
    const from = Math.min(G.waterY, G.water0), to = Math.max(0, Math.round(wy));
    if (to < from) {
      G.land.fill(0, to * W, Math.min(H, from) * W);
      G.canvas.getContext('2d').clearRect(0, to, W, from - to);
    }
    G.waterY = wy; G.mmDirty = true;
  }
  function onEvent(e) {
    const G = S.game, k = e[0];
    if (k === 'boom') {
      carveCanvas(G, e[1], e[2], e[3]);
      checkLand(G, e[4]);
      G.parts.push({ kind: 'expl', x: e[1], y: e[2], r: e[3], t: performance.now() });
      play('explosion');
      shake(G, e[3]);
    } else if (k === 'dmg') {
      const h = G.hogs[e[1]], p = hogPos(G, e[1]);
      const cause = e[3] || 'boom';
      const ft = cause === 'fall' ? '낙하 -' + e[2] : cause === 'sd' ? '서든데스 -' + e[2] : cause === 'poison' ? '중독 -' + e[2] : '-' + e[2];
      const fc = cause === 'fall' ? '#ffb040' : cause === 'sd' ? '#d090ff' : cause === 'poison' ? '#70ff70' : '#ff4040';
      if (h && p) G.floats.push({ x: p.x, y: p.y - 30, text: ft, color: fc, t: performance.now() });
      if (h && p && h.team.pid === S.me) G.hurt = { t: performance.now(), x: p.x, y: p.y };
      if (Math.random() < 0.6) play(['ow1', 'ow2', 'ow3', 'ooff1', 'ooff2'][Math.floor(Math.random() * 5)], 0.8);
    } else if (k === 'turn') {
      const t = G.teams.find(t => t.id === e[1]);
      G.cur = e[2]; G.lastTurnAt = performance.now(); G.cam.manual = 0; G.upcoming = e[4] || [];
      flash((t.pid === S.me ? '내 차례!' : t.name + ' 차례') + '  ·  ' + windText(e[3]), t.color);
      if (t.pid === S.me) play('yessir');
      releaseAllKeys();
    } else if (k === 'fire') {
      play('release'); play(e[1] === 'bazooka' ? 'fire' : 'cover', 0.9); G.cam.manual = 0;
    } else if (k === 'snd') {
      play(e[1]);
    } else if (k === 'splash') {
      play('splash');
    } else if (k === 'die') {
      G.deadIds.add(e[1]);
      if (e[4]) { play('splash'); play('byebye'); }
      else { G.graves.push([e[2], e[3]]); play('byebye'); }
    } else if (k === 'ammo') {
      const t = G.teams.find(t => t.id === e[1]); if (t) { t.ammo = e[2]; renderAmmo(G); }
    } else if (k === 'bullet') {
      // 총알 자국(원본 SpawnBulletTrail 처럼 흰 선) + 지나간 땅은 굴 (서버와 같은 계산)
      G.parts.push({ kind: 'trail', x0: e[2], y0: e[3], x1: e[4], y1: e[5], t: performance.now(), mg: e[1] === 'minigun' });
      G.lastShot = { cur: G.last ? G.last.cur : 0, t: performance.now() }; if (e[1] === 'minigun') G.mgFire = performance.now();
      if (e[1] === 'sniper' && isMyTurn(G)) addCaption('쏜 뒤에는 못 움직입니다', '#ffffff', 'ammostate', 1600);   // 14번: 저격총 (원본 NoMoveAfter)
      for (const tu of e[6] || []) { let x = tu[0], y = tu[1]; for (let i = 0; i < tu[4]; i++) { x += tu[2]; y += tu[3]; carveCanvas(G, x, y, 1); } }
      if (e[7] != null) checkLand(G, e[7]);
    } else if (k === 'dig') {                 // 곡괭이·토치 (서버와 같은 계산: Sim.carve / Sim.carveRect)
      for (const sh of e[1]) { if (sh[0] === 'c') carveCanvas(G, sh[1], sh[2], sh[3]); else carveRectCanvas(G, sh); }
      checkLand(G, e[2]);
    } else if (k === 'deny') {
      const t = G.teams.find(t => t.id === e[1]); if (t && t.pid === S.me) addCaption('그곳으로는 갈 수 없습니다', '#ffffff', 'ammostate', 1600);
    } else if (k === 'hole') {
      carveCanvas(G, e[1], e[2], e[3]); checkLand(G, e[4]);
      G.parts.push({ kind: 'puff', x: e[1], y: e[2], r: e[3], t: performance.now() });
      if (!e[5]) shake(G, 6);
    } else if (k === 'turnsum') {
      const nm = (id) => { const t = G.teams.find(t => t.id === id); return t ? t.name : ''; };
      const parts = e[1].map(([f, to, n, cz]) => cz === 'fall' && f < 0 ? `${nm(to)} 낙하 ${n}` : f < 0 ? `${nm(to)} ${n} 피해` : f === to ? `${nm(to)} 자기 편 피해 ${n}` : `${nm(f)} → ${nm(to)} ${n}`);
      if (parts.length) addCaption('이번 턴: ' + parts.join(' · '), '#ffffff', 'message', 4000);
    } else if (k === 'sdwarn') {
      flash(e[1] === 1 ? '이번이 서든데스 전 마지막 라운드!' : e[1] + '라운드 뒤 서든데스!', '#ffcc00');
    } else if (k === 'sd') {
      G.sd = true; G.sdFlash = performance.now();
      flash('서든데스!', '#ff6060');
      addCaption('매 턴 체력이 5씩 줄고 물이 차오릅니다', '#ffffff', 'message2', 3000);
      play('sd'); music('sdmusic');
    } else if (k === 'forfeit') {
      const t = G.teams.find(t => t.id === e[1]); if (t) { t.forfeit = true; flash(t.name + ' 기권', '#ccc'); }
    } else if (k === 'over') {
      const t = G.teams.find(t => t.id === e[1]);
      addCaption(!t ? '무승부' : (e[2] || t.name) + ' 승리!', t ? t.color : '#ffffff', 'gameState', 7000);   // 원본: 승리 안내도 캡션
      play('victory');
      releaseAllKeys();
    }
  }
  function checkLand(G, n) {
    if (n == null) return;
    let c = 0; for (let i = 0; i < G.land.length; i++) c += G.land[i];
    G.landOk = c === n;
    if (!G.landOk) console.warn('[hw] 지형 불일치', c, n); else console.log('[hw] 지형 일치', c);
  }
  function shake(G, r) { G.shakeUntil = performance.now() + 250; G.shakeAmt = r / 10; }
  let flashTimer = 0;
  // 화면 가운데 짧은 안내 (타이머 바꿈 등)
  const CAP_GROUPS = ['gameState', 'ammoinfo', 'volume', 'message', 'message2', 'ammostate', 'maint'];
  function addCaption(text, color, group, ms) {
    const G = S.game; if (!G) return;
    G.caps = G.caps || {};
    const w = boxTex(text, color || '#ffffff', 24).w;
    G.caps[group] = { text, color: color || '#ffffff', until: performance.now() + (ms || (group === 'gameState' ? 2200 : 1400 + w * 3)) };
  }
  function caption(text, ms) { addCaption(text, '#ffffff', 'ammostate', ms); }
  function flash(text, color) {
    if (S.game) return addCaption(text, color || '#ffffff', 'gameState');
    const el = $('msg'); el.textContent = text; el.style.color = color || '#fff';
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { el.textContent = ''; }, 2200);
  }
  // ---- 원본 글상자 (uRenderUtils): 흰 테두리 2px(모서리 한 칸 깎임) + 거의 검정(#000010) 속 + 글자색. 글자가 어두우면 흰 속·검은 테두리 ----
  function roundRect(c, x, y, w, h, border, fill, b) {
    b = b || 2; const hb = b / 2;
    c.fillStyle = border; c.fillRect(x, y + hb, w, h - b); c.fillRect(x + hb, y, w - b, h);
    if (fill) { c.fillStyle = fill; c.fillRect(x + b, y + hb, w - 2 * b, h - b); c.fillRect(x + hb, y + b, w - b, h - 2 * b); }
  }
  function tooDark(col) { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(col || ''); if (!m) return false; return [m[1], m[2], m[3]].every(v => parseInt(v, 16) < 64); }
  const boxCache = new Map();
  // RenderStringTex: 글 한 줄을 글상자 그림으로 (px = 글자 크기: 원본 fnt16 12px, fntBig 24px)
  function boxTex(text, color, px) {
    const key = text + '|' + color + '|' + px; let t = boxCache.get(key); if (t) return t;
    if (boxCache.size > 400) boxCache.clear();
    const sc = Math.max(1, Math.ceil(window.devicePixelRatio || 1)), f = 'bold ' + px + 'px ' + HUDFONT;
    const m = document.createElement('canvas').getContext('2d'); m.font = f;
    const B = 2, P = 2, tw = Math.ceil(m.measureText(text).width), th = Math.round(px * 1.22), w = tw + B * 2 + P * 2, h = th + B * 2;
    const c = document.createElement('canvas'); c.width = w * sc; c.height = h * sc;
    const x = c.getContext('2d'); x.scale(sc, sc);
    const dark = tooDark(color);
    roundRect(x, 0, 0, w, h, dark ? '#000010' : '#ffffff', dark ? '#ffffff' : '#000010');
    x.font = f; x.textBaseline = 'middle'; x.fillStyle = color; x.fillText(text, B + P, h / 2 + 1);
    t = { c, w, h }; boxCache.set(key, t); return t;
  }
  function drawBox(t, x, y) { ctx.drawImage(t.c, Math.round(x), Math.round(y), t.w, t.h); }
  function drawCaptions(G, now, cw, y, small) {
    const caps = G.caps || {}, px = small ? 18 : 24;
    // 점검 예고·서버 갱신·연결 끊김은 계속 보이는 안내 (원본 방식 캡션, 타이머 아래)
    if (S.maintOn) caps.maint = { text: maintText(), color: '#ffffff', until: now + 600 };
    else if (S.verWait) caps.maint = { text: '서버를 갱신하는 중입니다. 잠시 뒤 자동으로 연결됩니다.', color: '#ffffff', until: now + 600 };
    else if (S.verOld && !document.body.classList.contains('ingame')) delete caps.maint;
    if (!(S.ws && S.ws.readyState === 1)) caps.gameState = { text: '서버와 연결이 끊겼습니다. 다시 연결하는 중…', color: '#ffffff', until: now + 600 };
    for (const g of CAP_GROUPS) {
      const c = caps[g]; if (!c) continue;
      if (c.until < now) { delete caps[g]; continue; }
      const t = boxTex(c.text, c.color, px);
      drawBox(t, cw / 2 - t.w / 2, y); y += t.h + 2;
    }
  }
  function hogPos(G, id) {
    const s = G.last; if (!s) return null;
    const h = s.h.find(h => h[0] === id); return h ? { x: h[1], y: h[2] } : null;
  }

  // 스냅샷 보간
  function sample(G, now) {
    const sn = G.snaps; if (!sn.length) return null;
    const rt = now - 70;
    let a = sn[0], b = sn[sn.length - 1];
    for (let i = sn.length - 1; i > 0; i--) if (sn[i - 1].at <= rt) { a = sn[i - 1]; b = sn[i]; break; }
    const f = b.at === a.at ? 1 : Math.max(0, Math.min(1, (rt - a.at) / (b.at - a.at)));
    const hogs = [];
    for (const hb of b.h) {
      const ha = a.h.find(h => h[0] === hb[0]) || hb;
      hogs.push({ id: hb[0], x: ha[1] + (hb[1] - ha[1]) * f, y: ha[2] + (hb[2] - ha[2]) * f, hp: hb[3], facing: hb[4], flags: hb[5] });
    }
    const projs = [];
    for (let i = 0; i < b.p.length; i++) {
      const pb = b.p[i], pa = a.p[i] && a.p[i][0] === pb[0] ? a.p[i] : pb;
      projs.push({ kind: pb[0], x: pa[1] + (pb[1] - pa[1]) * f, y: pa[2] + (pb[2] - pa[2]) * f, dx: pb[3], dy: pb[4], timer: pb[5] });
    }
    return { hogs, projs, s: b, rp: b.rp || 0 };
  }

  // ---------------- 그리기 ----------------
  function frame() {
    requestAnimationFrame(frame);
    const G = S.game; if (!G) return;
    const now = performance.now();
    const view = sample(G, now);
    const vw = cv.width, vh = cv.height;
    // 카메라
    const z = G.cam.z * DPR;
    if (view && G.cam.goto && G.cam.manual > now) {          // '내 고슴도치로' 단추: 그 고슴도치로 이동 (몇 초 뒤 다시 차례 따라가기)
      const c = view.hogs.find(h => h.id === G.cam.goto); if (c) { G.cam.x += (c.x - G.cam.x) * 0.15; G.cam.y += (c.y - G.cam.y) * 0.15; }
    } else if (view && G.cam.manual < now) {
      G.cam.goto = 0;
      let tx = null, ty = null;
      if (view.projs.length) { tx = view.projs[0].x; ty = view.projs[0].y; }
      else { const c = view.hogs.find(h => h.id === view.s.cur); if (c) { tx = c.x; ty = c.y; } }
      if (tx != null) { G.cam.x += (tx - G.cam.x) * 0.08; G.cam.y += (ty - G.cam.y) * 0.08; }
    }
    const halfW = vw / z / 2, halfH = vh / z / 2;
    G.cam.x = Math.max(Math.min(halfW, W / 2), Math.min(Math.max(W - halfW, W / 2), G.cam.x));
    G.cam.y = Math.max(Math.min(halfH, H / 2) - 300, Math.min(G.water0 + 60 - halfH, G.cam.y));
    if (G.sd && !G.sdMusic) { G.sdMusic = true; music((G.T && G.T.j.sdMusic) || 'sdmusic'); }
    let sx = 0, sy = 0;
    if (G.shakeUntil > now) { sx = (Math.random() - 0.5) * G.shakeAmt; sy = (Math.random() - 0.5) * G.shakeAmt; }
    const ox = vw / 2 - (G.cam.x + sx) * z, oy = vh / 2 - (G.cam.y + sy) * z;

    // 하늘 (theme.cfg sky = 19,18,82)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const TJ = G.T ? G.T.j : null, TI = G.T ? G.T.img : {};
    ctx.fillStyle = TJ ? 'rgb(' + TJ.sky.join(',') + ')' : 'rgb(19,18,82)'; ctx.fillRect(0, 0, vw, vh);
    // 하늘 그림: 화면을 항상 덮도록(cover) 그리고, 카메라에 따라 조금만 움직임(원근감)
    const sky = TI.sky || (G.T ? null : IMG.Nature_Sky);
    if (sky && sky.width) {
      const sc = Math.max(vw * 1.15 / sky.width, vh * 1.15 / sky.height);
      const sw = sky.width * sc, shh = sky.height * sc;
      const fx = G.cam.x / W, fy = Math.max(0, Math.min(1, G.cam.y / G.water0));
      ctx.drawImage(sky, -(sw - vw) * fx, -(shh - vh) * fy, sw, shh);
    }
    const hz = TI.horizont || (G.T ? null : IMG.Nature_horizont);
    if (hz && hz.width) {
      const hzw = hz.width * z, hzh = hz.height * z, base = oy + G.water0 * z - hzh;
      const off = ((ox * 0.6) % hzw + hzw) % hzw;
      for (let x = off - hzw; x < vw; x += hzw) ctx.drawImage(hz, x, base, hzw + 1, hzh);
    }
    drawClouds(G, view, now, z, ox, oy);
    if (G.sd) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, vw, vh); }
    G.xf = { z, ox, oy };
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = z < 1;
    ctx.drawImage(G.canvas, 0, 0);
    // 무덤
    for (const g of G.graves) if (IMG.Statue.width) ctx.drawImage(IMG.Statue, g[0] - 16, g[1] - 23, 32, 32);
    if (view) {
      drawRope(G, view);
      drawHogs(G, view, now);
      drawTeleCursor(G, view, now);
      drawProjs(G, view, now);
    }
    drawParts(G, now);
    drawWater(G, now, z, ox, oy, vw, vh);
    if (G.sdFlash && now - G.sdFlash < 1500) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(255,255,255,' + (1 - (now - G.sdFlash) / 1500) + ')'; ctx.fillRect(0, 0, vw, vh);
    }
    if (view) { drawHud(G, view, now, vw, vh); updateHud(G, view.s, now); }
  }
  requestAnimationFrame(frame);

  // 손에 든 무기 그림 (원본 Graphics/Hedgehog/am*.png, 크기는 원본 표 Width·Height 의 두 배 = 그림 1:1): 1-나 13번
  const HAND = {}; for (const n of ['amBazooka', 'amGrenade', 'amShotgun', 'amShotgun_w', 'amDEagle', 'amDEagle_w', 'amSniperRifle', 'amMinigun', 'amSkip', 'amRope', 'amBTorch_i', 'amBTorch_w', 'amJetpack', 'Idle']) { const im = new Image(); im.src = 'assets/gfx/hand/' + n + '.png'; HAND[n] = im; }
  const HAND_OF = { bazooka: 'amBazooka', grenade: 'amGrenade', shotgun: 'amShotgun', deagle: 'amDEagle', skip: 'amSkip', rope: 'amRope', blowtorch: 'amBTorch_i' };   // 곡괭이·순간이동은 손 그림 대신 원본처럼 몸 그림이 바뀜, 제트팩은 머리 위 무기 그림   // 낙하산은 원본에 손 그림이 없음 (대신 머리 위에 무기 그림, ShowSelIcon)
  const AMMOS = new Image(); AMMOS.src = 'assets/ui/ammo/Ammos_base.png';
  // 원본 DrawSpriteRotated: (x,y) 가운데, 왼쪽을 보면 좌우 뒤집기, 조준 각도(도) 만큼 돌림
  function drawRot(im, x, y, sign, deg, sx, sy, sw, shh) {
    if (!im || !im.width) return;
    sw = sw || im.width; shh = shh || im.height;
    ctx.save(); ctx.translate(x, y); if (sign < 0) ctx.scale(-1, 1); ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(im, sx || 0, sy || 0, sw, shh, -sw / 2, -shh / 2, sw, shh); ctx.restore();
  }
  function drawHogs(G, view, now) {
    const s = view.s;
    const labelBoxes = [];
    for (const h of view.hogs) {
      const info = G.hogs[h.id]; if (!info || G.deadIds.has(h.id)) continue;
      const walking = h.flags & 2, moving = h.flags & 1, jumping = h.flags & 4, roping = h.flags & 8, chuting = h.flags & 16, ropeAir = h.flags & 32;
      const isCur = h.id === s.cur && (s.st === 'turn' || s.st === 'retreat');
      const armed = isCur && s.st === 'turn' && !moving && !walking && !jumping && !(view.rp && view.rp[0] === 0);     // 무기를 든 자세 (쏘고 난 뒤 도망 시간·로프를 쏘는 중에는 안 듦)
      const sign = h.facing < 0 ? -1 : 1, ox = Math.round(h.x), oy = Math.round(h.y), sx = ox + 1, sy = oy - 3;
      const aangle = s.a * 180 / Sim.MAX_ANGLE - 90, hx = ox + 8 * sign, hy = oy - 2;
      // 무기 (몸 뒤에 먼저): 원본 순서
      if (armed && s.wp !== 'minigun') {
        const shotAt = G.lastShot && G.lastShot.cur === s.cur ? now - G.lastShot.t : 1e9;
        if (s.wp === 'sniper') drawRot(HAND.amSniperRifle, hx, hy, sign, aangle, 0, s.sl || shotAt < 300 ? 32 : 0, 128, 32);
        else if (s.wp === 'shotgun') drawRot(shotAt < 300 && !s.gb ? HAND.amShotgun_w : HAND.amShotgun, hx, hy, sign, aangle);
        else if (s.wp === 'deagle') drawRot(s.sl ? HAND.amDEagle_w : HAND.amDEagle, hx, hy, sign, aangle);
        else if (HAND_OF[s.wp]) drawRot(HAND[HAND_OF[s.wp]], hx, hy, sign, aangle);
      }
      let pos = 0, step = 0, idle = false, rot = null, hide = false;
      const tk = isCur && s.tk ? s.tk : null;
      // 곡괭이 쓰는 중: 원본은 고슴도치 대신 Hammer 그림(고슴도치가 올라탄 곡괭이)을 끝 위치 (x-16, y-50) 에 흔들며 그림
      if (tk && tk[0] === 'pick') { hide = true; if (IMG.Hammer.width) ctx.drawImage(IMG.Hammer, tk[1] - 16, tk[2] - 50 + ((Math.floor(now / 32) & 1) * 2), IMG.Hammer.width, 64); }
      // 순간이동: 고르고 있으면 몸 대신 Teleport 0번 칸, 옮겨 가는 중이면 떠난 자리 칸 Pos, 도착한 자리 칸 11-Pos
      if (tk && tk[0] === 'tele' && IMG.Teleport.width) {
        hide = true;
        drawRot(IMG.Teleport, tk[1] + 1, tk[2] - 3, tk[4] || 1, 0, 0, Math.min(15, tk[3]) * 32, 64, 32);
        drawRot(IMG.Teleport, Math.round(h.x) + 1, Math.round(h.y) - 3, sign, 0, 0, Math.max(0, 11 - tk[3]) * 32, 64, 32);
      } else if (armed && s.wp === 'teleport' && IMG.Teleport.width) { hide = true; drawRot(IMG.Teleport, sx, sy, sign, 0, 0, 0, 64, 32); }
      // 토치 쓰는 중: 손 그림 amBTorch_w 를 조준 방향으로, 몸은 4줄(3번) 걷기 칸
      const torching = tk && tk[0] === 'torch';
      if (torching && HAND.amBTorch_w.width) drawRot(HAND.amBTorch_w, hx, hy, sign, aangle);
      // 제트팩: 몸 뒤에 Jetpack 0번 칸, 위·좌·우로 밀면 불꽃 칸
      const jetting = tk && tk[0] === 'jet';
      if (jetting && HAND.amJetpack.width) {
        const J = HAND.amJetpack, jx = Math.round(h.x), jy = Math.round(h.y);
        ctx.drawImage(J, 0, 0, 64, 64, jx - 32, jy - 32, 64, 64);
        if (tk[2] & 1) ctx.drawImage(J, 0, 64, 64, 64, jx - 32, jy - 28, 64, 64);
        if (tk[2] & 2) ctx.drawImage(J, 0, 128, 64, 64, jx - 28, jy - 28, 64, 64);
        if (tk[2] & 4) ctx.drawImage(J, 0, 192, 64, 64, jx - 36, jy - 28, 64, 64);
      }
      // 로프에 매달림: 원본 DrawHedgehog(ox, oy, 방향, 1, 0, 줄 각도) = Hedgehog.png 1줄 0칸을 줄 방향으로 돌림
      if (roping && view.rp && view.rp[0] === 1) {
        const ax = view.rp[1], ay = view.rp[2], dir = h.x < ax ? 1 : -1;
        rot = { dir, deg: Math.atan2(h.y - ay, h.x - ax) * 180 / Math.PI + (dir > 0 ? 0 : 180) }; pos = 1; step = 0;
      }
      if (rot) {}
      else if (torching) { pos = 3; step = Math.floor(now / 70) % 8 >> 1; }
      else if (jetting) { pos = 0; step = 0; }
      else if (armed && s.wp === 'pickhammer') { pos = 1; step = 2; }      // 원본: 곡괭이를 고르면 DrawHedgehog(1, 2)
      else if (chuting) idle = true;                      // 낙하산: 기본 자세 0번 칸 + 위에 낙하산
      else if (jumping || ropeAir) { pos = 1; step = 1; }
      else if (walking) { pos = 0; step = Math.floor(now / 70) % 8 >> 1; }
      else if (moving) { pos = 2; step = 1; }
      else if (armed) { pos = 0; step = s.wp === 'minigun' && s.gb ? 5 : 4; }
      else idle = true;
      const ifr = chuting ? 0 : (Math.floor(now / 128) + h.id * 7) % 19;
      if (chuting && IMG.Parachute.width) ctx.drawImage(IMG.Parachute, Math.round(h.x) - 24, Math.round(h.y) - 48, 48, 48);   // 원본 DrawSprite(sprParachute, x - 24, y - 48)
      if (!hide) {
      ctx.save(); ctx.translate(sx, sy);
      if (rot) { ctx.rotate(rot.deg * Math.PI / 180); if (rot.dir < 0) ctx.scale(-1, 1); }
      else if (sign < 0) ctx.scale(-1, 1);
      if (idle && HAND.Idle.width) ctx.drawImage(HAND.Idle, Math.floor(ifr / 16) * 32, (ifr % 16) * 32, 32, 32, -16, -16, 32, 32);
      else ctx.drawImage(IMG.Hedgehog, step * 32, pos * 32, 32, 32, -16, -16, 32, 32);
      const hat = HATS[info.team.rank || 0];
      const hatDy = idle ? (ifr === 2 || ifr === 7 || ifr === 12 ? 1 : ifr === 16 ? -1 : 0) : 0;   // 원본: 기본 자세 칸에 따라 모자를 1px 올리고 내림
      if (hat && hat.width) ctx.drawImage(hat, 0, 0, 32, 32, -16, -16 - 5 + hatDy, 32, 32);
      ctx.restore();
      }
      // 제트팩 연료 (원본 sidFuel 글, 고슴도치 위 40px)
      if (jetting) { const t = boxTex('연료 ' + tk[1] + '%', '#ffffff', 11); ctx.drawImage(t.c, Math.round(h.x - t.w / 2), Math.round(h.y - 40 - 28 * tagScale() - t.h), t.w, t.h); }
      // 미니건 (몸 앞): 원본 DrawSpritePivotedF(sprMinigun, sx + 20*sign, sy + 4, 칸, sign, -18, -2, 각도)
      if (armed && s.wp === 'minigun' && HAND.amMinigun.width) {
        const fr = s.gb ? (G.mgFire ? 2 + (Math.floor(now / 50) & 1) : Math.floor(now / 100) & 1) : 0;
        ctx.save(); ctx.translate(sx + 20 * sign, sy + 4); if (sign < 0) ctx.scale(-1, 1);
        ctx.translate(-18, -2); ctx.rotate(aangle * Math.PI / 180); ctx.translate(18, 2);
        ctx.drawImage(HAND.amMinigun, 0, fr * 32, 64, 32, -32, -16, 64, 32); ctx.restore();
      }
      // 조준 십자선 + 파워
      // 낙하산을 고르면 머리 위에 그 무기 그림 (원본 DrawSelectedWeapon, ShowSelIcon)
      if (armed && (s.wp === 'parachute' || s.wp === 'jetpack') && AMMOS.width) {
        const A = Weapons.AMMO[s.wp], f = A.icon - 1, bx = sx - 14, by = sy - 50;
        roundRect(ctx, bx, by, 28, 28, '#ffffff', '#000010'); ctx.drawImage(AMMOS, Math.floor(f / 16) * 32, (f % 16) * 32, 32, 32, bx + 2, by + 2, 24, 24);
      }
      const aimOk = !['parachute', 'pickhammer', 'teleport', 'jetpack'].includes(s.wp) && !tk && (!(h.flags & 1) || (s.wp === 'rope' && !roping && !chuting && !(view.rp && view.rp[0] === 0)));
      if (isCur && aimOk && s.st === 'turn') {
        const v = Sim.aimVector(s.a, h.facing);
        if (s.pw > 0 && IMG.Power.width) {
          for (let i = Math.floor(s.pw * 24 / Sim.MAX_POWER); i >= 0; i--)
            ctx.drawImage(IMG.Power, Math.floor(i / 16) * 32, (i % 16) * 32, 32, 32, h.x + v.x * (24 + i * 2) - 16, h.y + v.y * (24 + i * 2) - 16, 32, 32);
        }
        ctx.drawImage(IMG.Crosshair, h.x + v.x * 80 - 10, h.y + v.y * 80 - 10, 20, 20);   // 원본: 조준선 80px
        const wn = windLevel(s.w);
        if (wn) { const len = Math.max(6, Math.round(wn * 3)), cx = h.x + v.x * 80, cy = h.y + v.y * 80 - 18;
          if (s.w > 0 && IMG.WindR.width) ctx.drawImage(IMG.WindR, 0, 0, len, 13, cx - len / 2, cy, len, 9);
          else if (IMG.WindL.width) ctx.drawImage(IMG.WindL, 73 - len, 0, len, 13, cx - len / 2, cy, len, 9); }
      }
      // 이름표·체력 (팀 색)
      const col = info.team.color;
      // 휴대폰 가로 화면에서는 이름표·체력 글씨를 1.6배로 (사용자 요청)
      const ts = tagScale();
      ctx.font = 'bold ' + Math.round(11 * ts) + 'px ' + HUDFONT; ctx.textAlign = 'center';
      const hpText = String(h.hp), hpY = h.y - 16 - 12 * ts - (chuting ? 34 : 0);   // 낙하산 중에는 낙하산 위로
      // 이름표가 다른 고슴도치 이름표와 겹치면 글자를 줄이지 않고 위로 비켜 그림 (0-3)
      let nameY = hpY - 14 * ts; const nw = ctx.measureText(info.name).width + 8 * ts;
      for (let k = 0; k < 6 && labelBoxes.some(b => Math.abs(b.x - h.x) < (b.w + nw) / 2 && Math.abs(b.y - nameY) < 14 * ts); k++) nameY -= 14 * ts;
      labelBoxes.push({ x: h.x, y: nameY, w: nw }, { x: h.x, y: hpY, w: ctx.measureText(hpText).width + 8 * ts });
      tag(info.name, h.x, nameY, col, ts); tag(hpText, h.x, hpY, col, ts);
      if (isCur && now - G.lastTurnAt < 4000 && s.st === 'turn') {
        const bob = Math.sin(now / 120) * 4;
        ctx.drawImage(IMG.Finger, 0, 0, 32, 48, h.x - 12, nameY - 9 * ts - 38 + bob, 24, 36);
      }
    }
  }
  // 로프: 원본 DrawRope (cRopeNodeStep 4px 마다 RopeNode, 첫 고정점에 RopeHook 을 줄 방향으로)
  function drawRope(G, view) {
    const rp = view.rp; if (!rp) return;
    const h = view.hogs.find(x => x.id === view.s.cur); if (!h) return;
    const pts = [];
    for (let i = 4; i + 1 < rp.length; i += 2) pts.push([rp[i], rp[i + 1]]);
    pts.push([rp[1], rp[2]], [h.x, h.y]);
    let done = 0, next = 4;
    if (IMG.RopeNode.width) for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1); if (!L) continue;
      while (next - done <= L) { const f = (next - done) / L; ctx.drawImage(IMG.RopeNode, x1 + (x2 - x1) * f - 8, y1 + (y2 - y1) * f - 8, 16, 16); next += 4; }
      done += L;
    }
    if (IMG.RopeHook.width) {                                    // 고리 그림은 끝이 왼쪽을 향함 → 줄이 날아간 방향으로 돌림
      ctx.save(); ctx.translate(pts[0][0], pts[0][1]); ctx.rotate(rp[3] / 100 + Math.PI);
      ctx.drawImage(IMG.RopeHook, -16, -16, 32, 32); ctx.restore();
    }
  }
  function drawTeleCursor(G, view, now) {
    const s = view.s; if (!(s.wp === 'teleport' && s.st === 'turn' && isMyTurn(G) && G.mouse && IMG.amTeleport.width && !(s.tk))) return;
    const fr = Math.floor(now / 200) & 1;
    ctx.drawImage(IMG.amTeleport, 0, fr * 32, 64, 32, G.mouse.x - 32, G.mouse.y - 16, 64, 32);
  }
  function tagScale() { return document.body.classList.contains('touch') && innerHeight < 500 ? 1.6 : 1; }
  function tag(text, x, y, col, s) {
    const t = boxTex(text, col, Math.round(12 * (s || 1)));
    ctx.drawImage(t.c, x - t.w / 2, y - t.h / 2, t.w, t.h);
  }
  function drawProjs(G, view, now) {
    for (const p of view.projs) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.kind === 0) {
        ctx.rotate(Math.atan2(p.dy, p.dx));
        ctx.drawImage(IMG.BazookaShell, -12, -12, 24, 24);
        if (!G.lastTrace || now - G.lastTrace > 40) { G.lastTrace = now; G.parts.push({ kind: 'smoke', x: p.x, y: p.y, t: now }); }
      } else {
        ctx.rotate(now / 100 * Math.sign(p.dx || 1));
        ctx.drawImage(IMG.Bomb, 0, 0, 8, 8, -6, -6, 12, 12);
        ctx.restore(); ctx.save();
        ctx.font = 'bold 12px ' + HUDFONT; ctx.textAlign = 'center';
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        const sec = String(Math.ceil(p.timer / 1000));
        ctx.strokeText(sec, p.x, p.y - 12); ctx.fillText(sec, p.x, p.y - 12);
      }
      ctx.restore();
    }
  }
  function drawParts(G, now) {
    G.parts = G.parts.filter(p => {
      const age = now - p.t;
      if (p.kind === 'expl') {
        const f = Math.floor(age / 50); if (f >= 6) return false;
        const sz = p.r * 2.2;
        ctx.drawImage(IMG.Expl50, 0, f * 64, 64, 64, p.x - sz / 2, p.y - sz / 2, sz, sz);
        return true;
      }
      if (p.kind === 'trail') {   // 총알 자국 (원본 vgtLineTrail: 흰 선이 빠르게 옅어짐)
        const life = p.mg ? 150 : 350; if (age > life) return false;
        ctx.globalAlpha = 1 - age / life; ctx.strokeStyle = p.mg ? '#ffe9a0' : '#ffffff'; ctx.lineWidth = p.mg ? 1 : 1.5;
        ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(p.x1, p.y1); ctx.stroke(); ctx.globalAlpha = 1;
        return true;
      }
      if (p.kind === 'puff') {    // 샷건·미니건 구멍: 작은 연기
        const f = Math.floor(age / 70); if (f >= 8) return false;
        const sz = Math.max(14, p.r * 1.4); ctx.globalAlpha = 0.85; ctx.drawImage(IMG.SmokeTrace, 0, f * 32, 32, 32, p.x - sz / 2, p.y - sz / 2, sz, sz); ctx.globalAlpha = 1;
        return true;
      }
      if (p.kind === 'smoke') {
        const f = Math.floor(age / 80); if (f >= 8) return false;
        ctx.globalAlpha = 0.8; ctx.drawImage(IMG.SmokeTrace, 0, f * 32, 32, 32, p.x - 10, p.y - 10, 20, 20); ctx.globalAlpha = 1;
        return true;
      }
      return false;
    });
    const fs = tagScale();
    G.floats = G.floats.filter(f => {
      const age = now - f.t; if (age > 1800) return false;
      ctx.globalAlpha = Math.min(1, (1800 - age) / 500);
      const t = boxTex(f.text, f.color, Math.round(12 * fs));
      ctx.drawImage(t.c, f.x - t.w / 2, f.y - age / 40 - t.h / 2, t.w, t.h);
      ctx.globalAlpha = 1; return true;
    });
  }
  function drawClouds(G, view, now, z, ox, oy) {
    const im = IMG.Clouds; if (!im || !im.width || !view) return;
    if (!G.clouds) { G.clouds = []; for (let i = 0; i < 9; i++) G.clouds.push({ x: Math.random() * (W + 800) - 400, f: i % 4, dX: 0.8 + Math.random() * 0.4, sc: 0.6 + Math.random() * 0.5, tm: Math.random() * 4096 }); G.cloudT = now; }
    const dt = Math.min(100, now - G.cloudT); G.cloudT = now;
    const wind = (view.s.w || 0) * Sim.MAX_WIND;
    ctx.setTransform(z, 0, 0, z, ox * 0.9, oy);
    ctx.globalAlpha = 0.85;
    for (const cl of G.clouds) {
      cl.x += wind * 750 * cl.dX * cl.sc * dt;
      if (cl.x < -500) cl.x += W + 1000; else if (cl.x > W + 500) cl.x -= W + 1000;
      const s = (now + cl.tm) % 4096, bob = (s < 2048 ? -1 : 1) * 8 * cl.sc * Math.sin((s % 2048) / 2048 * Math.PI);
      const w = 256 * cl.sc, hh = 128 * cl.sc;
      ctx.drawImage(im, 0, cl.f * 128, 256, 128, cl.x - w / 2, -60 - hh + (cl.f * 13) + bob, w, hh);
    }
    ctx.globalAlpha = 1;
  }
  // 0-5: 내 고슴도치가 다치면 화면 가장자리가 잠깐 붉어지고, 화면 밖이면 그쪽 방향 화살표. 턴 끝 요약. 서든데스 안내.
  function drawAlerts(G, now, cw, ch, small) {
    if (G.hurt && now - G.hurt.t < 600 && G.xf) {
      const a = 1 - (now - G.hurt.t) / 600;
      ctx.fillStyle = 'rgba(255,0,0,' + (0.3 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, cw, ch);       // 원본 ScreenFade 처럼 화면 전체를 한 색으로 잠깐
    }
    if (G.hurt && now - G.hurt.t < 1800 && G.xf) {
      const px = (G.xf.ox + G.hurt.x * G.xf.z) / DPR, py = (G.xf.oy + G.hurt.y * G.xf.z) / DPR;
      if (px < 0 || px > cw || py < 0 || py > ch) {                                               // 화면 밖: 그쪽 가장자리에 글상자
        const mine = G.teams.find(t => t.pid === S.me), t = boxTex((px < 0 ? '◀ ' : '') + '내 고슴도치 피해' + (px > cw ? ' ▶' : '') + (py < 0 ? ' ▲' : py > ch ? ' ▼' : ''), mine ? mine.color : '#ffffff', small ? 12 : 14);
        drawBox(t, Math.max(4, Math.min(cw - t.w - 4, px - t.w / 2)), Math.max(60, Math.min(ch - t.h - 70, py - t.h / 2)));
      }
    }
  }
  function drawWater(G, now, z, ox, oy, vw, vh) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const wy = oy + G.waterY * z;
    if (wy < vh) {
      const gr = ctx.createLinearGradient(0, wy, 0, vh);
      const tj = G.T && G.T.j, rgba = (c, a) => 'rgba(' + c.join(',') + ',' + a + ')';
      if (G.sd) { gr.addColorStop(0, rgba(tj ? tj.sdWaterTop : [182, 144, 201], 0.88)); gr.addColorStop(1, rgba(tj ? tj.sdWaterBottom : [150, 112, 169], 0.92)); }
      else { gr.addColorStop(0, rgba(tj ? tj.waterTop : [84, 92, 157], 0.85)); gr.addColorStop(1, rgba(tj ? tj.waterBottom : [52, 163, 202], 0.9)); }
      ctx.fillStyle = gr; ctx.fillRect(0, wy, vw, vh - wy);
      const ti = (G.T && G.T.img) || {};
      const bw = G.sd ? (ti.sdWater || (IMG.SDWater.width ? IMG.SDWater : IMG.BlueWater)) : (ti.water || IMG.BlueWater);
      if (bw.width) {
        const tw = bw.width * z, th = bw.height * z, off = ((ox + now / 30 * z) % tw + tw) % tw;
        for (let x = off - tw; x < vw; x += tw) ctx.drawImage(bw, x, wy - th * 0.6, tw + 1, th);
      }
    }
  }

  // HUD: 원본 배치: 타이머(BigDigits+Frame), 팀 줄(이름표·깃발·체력바)은 화면 아래 가운데
  const faceImgs = {};
  function faceImage(level) {
    if (!faceImgs[level]) { const im = new Image(); faceImgs[level] = im; faceURL(level).then(u => { im.src = u; }); }
    return faceImgs[level];
  }
  function outlined(text, x, y, color) {
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function drawHud(G, view, now, vw, vh) {
    const s = view.s, cw = vw / DPR, ch = vh / DPR;
    const small = ch < 480;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawAlerts(G, now, cw, ch, small);
    const playing = s.st === 'turn' || s.st === 'retreat';
    const cur = G.hogs[s.cur];
    // 타이머
    let ty = Math.max(6, 0);
    if (playing) {
      const sec = String(Math.max(0, Math.ceil(s.tl / 1000)));
      const low = s.st === 'turn' && s.tl <= 10000;                     // 10초 이하: 빨갛게, 크게 (1-나)
      const dig = s.st === 'retreat' || low ? IMG.BigDigitsRed : IMG.BigDigits;
      const sz = Math.round((small ? 26 : 32) * (low ? 1.35 : 1)), w = 4 + sec.length * sz + 4, x0 = Math.round(cw / 2 - w / 2);
      if (IMG.Frame.width) { ctx.drawImage(IMG.Frame, 0, 0, 4, 32, x0, ty, 4 * sz / 32, sz); ctx.drawImage(IMG.Frame, 0, 32, 4, 32, x0 + w - 4 * sz / 32, ty, 4 * sz / 32, sz); }
      for (let i = 0; i < sec.length; i++) if (dig.width) ctx.drawImage(dig, 0, (+sec[i]) * 32, 32, 32, x0 + 4 * sz / 32 + i * sz, ty, sz, sz);
      if (G.sd) { ctx.font = 'bold 13px ' + HUDFONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; outlined('서든데스', x0 + w + 6, ty + sz / 2, '#ff7070'); }   // 0-5: 서든데스 중 계속 표시
      ty += sz + 2;
    }
    // 현재 차례: 모자 얼굴 + 닉네임 글상자 (원본 RenderStringTex, 팀 색)
    const bpx = small ? 12 : 13;
    let line = null, col = '#ffffff', lvl = 0;
    if (cur && playing) { line = cur.name + (s.st === 'retreat' ? ' (후퇴!)' : ''); col = cur.team.color; lvl = cur.team.rank || 0; }
    else if (s.st === 'wait') line = '연결 끊긴 플레이어를 기다리는 중…';
    if (line) {
      const t = boxTex(line, col, bpx), fw = cur && playing ? 20 : 0, x = Math.round(cw / 2 - (t.w + fw) / 2);
      if (fw) { const fi = faceImage(lvl); if (fi.complete && fi.width) ctx.drawImage(fi, x, ty + (t.h - 18) / 2, 18, 18); }
      drawBox(t, x + fw, ty); ty += t.h + 2;
    }
    // 타이머 옆 작은 글상자: 서든데스 / 도망 시간(쏜 뒤 3초, 원본 규칙) / 여러 발 무기의 남은 발
    { const side = []; if (G.sd && playing) side.push(boxTex('서든데스', '#ff6060', bpx - 1));
      if (s.st === 'retreat') side.push(boxTex('도망 시간', '#ffffff', bpx - 1));
      else if (s.st === 'turn' && s.sl) { const A = Weapons.AMMO[s.wp]; if (A) side.push(boxTex(`남은 발 ${s.sl}/${A.shots}`, '#ffffff', bpx - 1)); }
      let sxp = cw / 2 + (small ? 52 : 62); for (const t of side) { drawBox(t, sxp, 6); sxp += t.w + 3; } }
    // 다음 차례 순서: 팀 이름 글상자를 줄지어
    if (playing && G.upcoming && G.upcoming.length) {
      const boxes = [boxTex('다음', '#ffffff', bpx - 2)].concat(G.upcoming.map(id => G.teams.find(t => t.id === id)).filter(Boolean).map(t => boxTex(t.name, t.color, bpx - 2)));
      const tw = boxes.reduce((a, b) => a + b.w + 3, -3); let x = Math.round(cw / 2 - tw / 2);
      for (const b of boxes) { drawBox(b, x, ty); x += b.w + 3; }
      ty += boxes[0].h + 2;
    }
    // 탈락한 사람: 관전 안내
    const mineT = G.teams.find(t => t.pid === S.me);
    if (mineT && s.st !== 'over' && !mineT.forfeit && mineT.hogs.every(h => G.deadIds.has(h.id))) {
      const t = boxTex('관전 중: 지금 나가도 감점 없음', '#ffcc00', bpx); drawBox(t, cw / 2 - t.w / 2, ty); ty += t.h + 2;
    }
    // 안내 글 (원본 캡션): 타이머·차례 줄 아래부터 쌓음 (타이머를 가리지 않음)
    drawCaptions(G, now, cw, ty + 2, small);
    drawMinimap(G, view, now, cw, ch, small);
    drawOffscreen(G, view, now, cw, ch, small);
    // 팀 줄 (원본 RenderTeamsHealth): 이름 글상자 · 깃발 · 체력 막대(makeHealthBarTexture: 흰 테두리 글상자 안에 팀 색), 마리마다 칸막이(slider)
    const teams = G.teams.filter(t => !t.forfeit);
    const totals = teams.map(t => ({ t, hp: t.hogs.reduce((a2, h) => a2 + (G.deadIds.has(h.id) ? 0 : (G.hogs[h.id].hp || 0)), 0), hogsHp: t.hogs.map(h => G.deadIds.has(h.id) ? 0 : (G.hogs[h.id].hp || 0)) }));
    const maxHp = Math.max(100, ...G.teams.map(t => t.hogs.reduce((a, h) => a + (h.hp || 100), 0)));
    const cols = totals.length > 4 ? 2 : 1, rowsN = Math.ceil(totals.length / cols);
    const barH = cols > 1 ? 15 : (small ? 17 : 19), rowH = barH + 2, barW = cols > 1 ? (small ? 70 : 100) : (small ? 110 : 140);
    const colW = cols > 1 ? (small ? 250 : 320) : 0, npx = cols > 1 ? 10 : (small ? 11 : 12);
    const blink = (now % 1000) < 500;
    totals.forEach(({ t, hp, hogsHp }, i) => {
      const col = cols > 1 ? Math.floor(i / rowsN) : 0, row = cols > 1 ? i % rowsN : i;
      const cx = Math.round(cw / 2 + (col - (cols - 1) / 2) * colW);
      const y = Math.round(ch - 3 - (rowsN - row) * rowH);
      if (hp <= 0) return;
      const nt = boxTex(t.name, t.color, npx); drawBox(nt, cx - nt.w - 16, y + (barH - nt.h) / 2);
      const fh = Math.min(15, barH - 2), fwid = Math.round(fh * 22 / 15);
      if (IMG.flag_hedgewars.width) ctx.drawImage(IMG.flag_hedgewars, cx - Math.round(fwid / 2), y + Math.round((barH - fh) / 2), fwid, fh);
      const isCurTeam = cur && cur.team.id === t.id && playing, bw = Math.max(1, Math.round(barW * hp / maxHp));
      roundRect(ctx, cx + 14, y, bw + 5, barH, '#ffffff', '#000010');                                   // 바깥: 흰 테두리 글상자
      roundRect(ctx, cx + 16, y + 2, bw + 1, barH - 4, isCurTeam && blink ? '#ffffff' : t.color, isCurTeam && blink ? '#ffffff' : t.color);   // 안: 팀 색 (현재 팀은 깜빡임 = 원본 highlight)
      let acc = 0;                                                                                         // 마리 사이 칸막이 (원본 sprSlider)
      const sl = tooDark(t.color) ? IMG.slider : IMG.sliderInverted;
      for (const v of hogsHp) { acc += v; if (v > 0 && acc < hp && sl && sl.width) ctx.drawImage(sl, cx + 15 + Math.round(acc * bw / hp), y + 1, 3, barH - 2); }
    });
    ctx.textBaseline = 'alphabetic';
  }
  // ---- 미니맵 (2-가-1): 원본에 없는 요소라 경기 화면 규칙대로 원본 글상자(흰 2px 테두리, #000010 바탕)에 담음 ----
  function mmOpen() { try { return localStorage.getItem('hw_mm') !== '0'; } catch (e) { return true; } }
  function mmLayout(cw, ch, small) {
    const w = Math.round(small ? Math.min(150, cw * 0.2) : Math.min(240, cw * 0.2)), h = Math.max(24, Math.round(w * H / W));
    return small ? { x: 8, y: 62, w, h } : { x: cw - w - 10, y: 46, w, h };
  }
  function drawMinimap(G, view, now, cw, ch, small) {
    const L = mmLayout(cw, ch, small), open = mmOpen();
    placeMmButtons(G, L, open, small);
    if (!open) { G.mmRect = null; return; }
    G.mmRect = L;
    if (!G.mm || G.mm.width !== L.w * DPR) { G.mm = document.createElement('canvas'); G.mm.width = L.w * DPR; G.mm.height = L.h * DPR; G.mmDirty = true; }
    if (G.mmDirty && (!G.mmAt || now - G.mmAt > 150)) {
      const c = G.mm.getContext('2d'); c.clearRect(0, 0, G.mm.width, G.mm.height); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium';
      c.drawImage(G.canvas, 0, 0, W, H, 0, 0, G.mm.width, G.mm.height);
      G.mmDirty = false; G.mmAt = now;
    }
    const k = L.w / W;
    roundRect(ctx, L.x - 3, L.y - 3, L.w + 6, L.h + 6, '#ffffff', '#000010');
    ctx.save(); ctx.beginPath(); ctx.rect(L.x, L.y, L.w, L.h); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.drawImage(G.mm, L.x, L.y, L.w, L.h);
    const wy = L.y + Math.min(H, G.waterY) * k;                               // 물 (서든데스로 오르는 것 포함)
    ctx.fillStyle = 'rgba(70,110,210,0.85)'; ctx.fillRect(L.x, wy, L.w, L.y + L.h - wy);
    if (G.xf) {                                                              // 지금 화면이 비추는 범위
      const z = G.xf.z, vx0 = -G.xf.ox / z, vy0 = -G.xf.oy / z, vx1 = (cv.width - G.xf.ox) / z, vy1 = (cv.height - G.xf.oy) / z;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(Math.round(L.x + vx0 * k) + 0.5, Math.round(L.y + vy0 * k) + 0.5, Math.round((vx1 - vx0) * k), Math.round((vy1 - vy0) * k));
    }
    for (const p of view.projs) { ctx.fillStyle = '#ffffff'; ctx.fillRect(L.x + p.x * k - 1, L.y + p.y * k - 1, 2, 2); }
    const r = small ? 2.2 : 2.8, blink = (now % 600) < 300;
    for (const h of view.hogs) {
      const info = G.hogs[h.id]; if (!info || G.deadIds.has(h.id)) continue;
      const x = L.x + h.x * k, y = L.y + h.y * k, isCur = h.id === view.s.cur, mine = info.team.pid === S.me;
      if (isCur && blink) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = info.team.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = mine ? 1.6 : 0.8; ctx.strokeStyle = mine ? '#ffffff' : '#000010'; ctx.stroke();
    }
    ctx.restore();
  }
  // 미니맵 접기·펴기, 내 고슴도치로 단추 (HTML 단추, 경기 화면 글상자 모양 .hwr)
  function placeMmButtons(G, L, open, small) {
    const key = [L.x, L.y, L.w, L.h, open, small].join(',');
    if (G.mmBtnKey === key) return; G.mmBtnKey = key;
    const t = $('mmToggle'), me = $('btnMyHog');
    t.textContent = open ? '지도 접기' : '지도'; t.classList.add('on'); me.classList.add('on');
    const y = open ? L.y + L.h + 8 : L.y;
    if (small) { t.style.left = L.x + 'px'; t.style.right = ''; me.style.left = (L.x + (open ? 0 : 52)) + 'px'; me.style.right = ''; me.style.top = (open ? y + 30 : y) + 'px'; }
    else { t.style.right = '10px'; t.style.left = ''; me.style.right = (open ? 96 : 62) + 'px'; me.style.left = ''; me.style.top = y + 'px'; }
    t.style.top = y + 'px';
  }
  function myHogId(G) {
    const s = G.last; if (!s) return 0;
    const cur = G.hogs[s.cur]; if (cur && cur.team.pid === S.me) return s.cur;
    const t = myTeam(G); if (!t) return 0;
    const h = t.hogs.find(h => !G.deadIds.has(h.id) && s.h.some(x => x[0] === h.id)); return h ? h.id : 0;
  }
  // 화면 밖 고슴도치: 그쪽 가장자리에 팀 색 화살표 글상자 (원본 글상자 방식)
  function drawOffscreen(G, view, now, cw, ch, small) {
    if (!G.xf) return;
    const touch = document.body.classList.contains('touch');
    const boxes = [], px = small ? 11 : 12, top = small ? 56 : 64, bot = ch - (touch ? 140 : small ? 64 : 58);   // 휴대폰: 아래 양쪽 터치 단추를 피함
    const list = view.hogs.slice().sort((a, b) => (b.id === view.s.cur) - (a.id === view.s.cur));
    for (const h of list) {
      const info = G.hogs[h.id]; if (!info || G.deadIds.has(h.id)) continue;
      const x = (G.xf.ox + h.x * G.xf.z) / DPR, y = (G.xf.oy + h.y * G.xf.z) / DPR;
      if (x >= 0 && x <= cw && y >= 0 && y <= ch) continue;
      const arrow = x < 0 ? '◀' : x > cw ? '▶' : y < 0 ? '▲' : '▼';
      const t = boxTex(arrow, info.team.color, px);
      const side = touch ? 140 : 4;
      const bx = y > ch || y < 0 ? Math.max(side, Math.min(cw - t.w - side, x - t.w / 2)) : Math.max(4, Math.min(cw - t.w - 4, x - t.w / 2)), by = Math.max(top, Math.min(bot - t.h, y - t.h / 2));
      let byy = by; const m = G.mmRect, mb = m && { x: m.x - 6, y: m.y - 6, r: m.x + m.w + 6, b: m.y + m.h + (small ? 76 : 40) };
      if (mb && bx + t.w > mb.x && bx < mb.r && byy + t.h > mb.y && byy < mb.b) byy = mb.b + 4;          // 미니맵·지도 단추와 겹치지 않게
      if (boxes.some(b => Math.abs(b[0] - bx) < t.w && Math.abs(b[1] - byy) < t.h)) continue;
      boxes.push([bx, byy]); drawBox(t, bx, byy);
    }
  }
  let lastHud = '';
  function updateHud(G, s, now) {
    const playing = s.st === 'turn' || s.st === 'retreat';
    const ch0 = s.h && s.h.find(x => x[0] === s.cur), fl = ch0 ? ch0[5] : 0;
    const tmode = s.rp && s.rp[0] === 1 && (fl & 8) ? 'rope' : (fl & 32) ? 'air' : (fl & 16) ? 'chute' : s.tk ? s.tk[0] : '';
    const hudKey = [s.cur, s.st, s.wp, s.gt, s.sl, s.gb, tmode].join('|');
    if (hudKey !== lastHud) {
      lastHud = hudKey;
      const mine = isMyTurn(G);
      const A = Weapons.AMMO[s.wp] || Weapons.AMMO.bazooka, n = ammoCount(G.teams.find(t => t.hogs.some(hh => hh.id === s.cur)), s.wp);
      $('wCurIcon').style.backgroundPosition = iconPos(A.icon, 32); $('wCurCnt').textContent = n < 0 ? '' : String(n);
      $('wCur').disabled = !mine || s.st !== 'turn'; $('wCur').title = A.name + ': 무기 고르기 (Tab · 오른쪽 클릭 · F1~F3)';
      $('wShots').textContent = '';   // 남은 발·도망 시간은 캔버스 글상자로 (14번)
      if (G.lastWp && G.lastWp !== s.wp && s.cur === G.lastWpCur) addCaption(A.name, '#ffffff', 'ammoinfo');
      if (s.wp === 'teleport' && mine && s.st === 'turn' && G.lastWp !== s.wp) addCaption('지도에서 갈 곳을 누르세요', '#ffffff', 'ammostate', 2500);       // 원본: 고른 무기 이름 (capgrpAmmoinfo)
      G.lastWp = s.wp; G.lastWpCur = s.cur;
      if ($('ammoMenu').classList.contains('on')) renderAmmo(G);
      if (!mine || s.st !== 'turn') { $('ammoMenu').classList.remove('on'); $('amDesc').classList.remove('on'); }
      // 타이머가 있는 무기(지금은 수류탄): 지금 몇 초인지 항상 보임, 고른 순간 가운데에 1초
      const timed = !!(Weapons.AMMO[s.wp] && Weapons.AMMO[s.wp].timer);
      $('wTimer').style.display = timed ? 'block' : 'none'; $('wTimer').textContent = '타이머 ' + s.gt + '초'; $('wTimer').disabled = !mine || s.st !== 'turn';
      if (!timed || !mine || s.st !== 'turn') $('gtimers').classList.remove('on');
      for (const b of document.querySelectorAll('.gt')) { b.classList.toggle('sel', +b.dataset.s === s.gt); b.disabled = !mine || s.st !== 'turn'; }
      $('tTimer').style.display = timed ? 'block' : 'none';
      $('tTimerLbl').textContent = s.gt + '초';
      if (timed && G.lastGt != null && G.lastGt !== s.gt && G.lastGtCur === s.cur) caption(`${A.name} ${s.gt}초`, 1000);
      G.lastGt = s.gt; G.lastGtCur = s.cur;
      $('touch').classList.toggle('idle', !(mine && playing));
      const AL = Weapons.AMMO[s.wp] || {};
      const lrL = tmode === 'rope' ? '흔들기' : tmode === 'jet' || tmode === 'pick' ? '옆으로' : '';
      const udL = tmode === 'rope' ? '길이' : tmode === 'torch' ? '방향' : '';
      touchLabel('tL', lrL); touchLabel('tR', lrL);
      touchLabel('tU', tmode === 'jet' ? '위로' : udL); touchLabel('tD', udL);
      touchLabel('tFire', tmode === 'rope' ? '놓기' : tmode === 'air' && s.wp === 'rope' ? '다시 쏘기' : tmode === 'chute' ? '접기' : tmode === 'jet' ? '끄기' : tmode === 'pick' || tmode === 'torch' ? '멈춤' : tmode === 'tele' ? '' :
        s.wp === 'rope' ? '로프' : s.wp === 'parachute' ? '펼치기' : s.wp === 'jetpack' ? '켜기' : s.wp === 'teleport' ? '' : '발사');
      touchLabel('tJump', (tmode === 'rope' || tmode === 'chute' || tmode === 'air' || tmode === 'jet') && AL.altUse ? '떨구기' : '점프');
    }
    $('power').style.display = s.pw > 0 ? 'block' : 'none';
    if (s.pw > 0) $('power').firstChild.style.width = (s.pw / Sim.MAX_POWER * 100) + '%';
    G.windShown = G.windShown == null ? s.w : G.windShown + (s.w - G.windShown) * 0.08;
    if (Math.abs(G.windShown - s.w) < 0.004) G.windShown = s.w;
    drawWind(Math.round(G.windShown * 1000) / 1000);
  }
  // 바람 (0-6): "바람" 글자 + 큰 방향 화살표 + 세기(1~10칸, 약함·보통·강함) + 원본 바람 막대
  function touchLabel(id, text) {
    const el = $(id); if (!el) return;
    let l = el.querySelector('.lbl'); if (!l) { l = document.createElement('span'); l.className = 'lbl'; el.append(l); }
    l.textContent = text; l.style.display = text ? '' : 'none';
  }
  function windLevel(w) { return Math.round(Math.abs(w || 0) * 10); }
  function windText(w) { const n = windLevel(w); if (!n) return '바람 없음'; return '바람 ' + (w < 0 ? '←' : '→') + ' ' + (n <= 3 ? '약함' : n <= 6 ? '보통' : '강함'); }
  let lastWind = null;
  function drawWind(w) {
    if (w === lastWind) return; lastWind = w;
    const c = $('wind'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const n = windLevel(w);
    const label = n ? `바람 ${w < 0 ? '◀' : '▶'} ${n} ${n <= 3 ? '약함' : n <= 6 ? '보통' : '강함'}` : '바람 없음';
    const t = boxTex(label, '#ffffff', 12);
    x.drawImage(t.c, Math.round(80 - t.w / 2), 0, t.w, t.h);
    if (IMG.WindBar.width) x.drawImage(IMG.WindBar, 4, 22, 151, 17);
    const len = Math.round(Math.abs(w) * 73);
    if (len > 0) {
      if (w > 0) x.drawImage(IMG.WindR, 0, 0, len, 13, 80, 24, len, 13);
      else x.drawImage(IMG.WindL, 80 - len, 0, len, 13, 80 - len, 24, len, 13);
    }
  }
  function buildTimerButtons() {
    const box = $('gtimers'); box.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button'); b.className = 'gt'; b.dataset.s = i; b.textContent = i + '초';
      b.onclick = () => { send({ t: 'gtimer', s: i }); box.classList.remove('on'); }; box.appendChild(b);   // 고르면 바로 닫힘
    }
  }
  // ---- 무기 메뉴 (원본 AmmoMenu: Ammos_base.png 아이콘판, 줄 = 슬롯 F1~F3, 남은 수) ----
  const iconPos = (n, px) => { const f = n - 1; return `${-Math.floor(f / 16) * px}px ${-(f % 16) * px}px`; };
  function myTeam(G) { return G && G.teams.find(t => t.pid === S.me); }
  function ammoCount(t, w) { const v = t && t.ammo ? t.ammo[w] : Weapons.AMMO[w].count; return v == null ? Weapons.AMMO[w].count : v; }
  function renderAmmo(G) {
    const grid = $('amGrid'); if (!grid || !G) return;
    const t = myTeam(G), s = G.last || {}, mine = isMyTurn(G) && s.st === 'turn' && !s.sl && !s.gb;
    grid.innerHTML = '';
    const slots = {};
    for (const w of Weapons.ORDER) (slots[Weapons.AMMO[w].slot] = slots[Weapons.AMMO[w].slot] || []).push(w);
    const keys = Object.keys(slots).sort((a, b) => a - b), ncol = 1 + Math.max(...keys.map(k => slots[k].length));
    grid.style.gridTemplateColumns = `repeat(${ncol}, var(--am))`;
    const foot = document.createElement('div'); foot.className = 'amFoot'; foot.style.gridColumn = `1 / span ${ncol}`;
    const fname = document.createElement('span'), fcnt = document.createElement('span'); foot.append(fname, fcnt);
    const showFoot = (w) => { const A = Weapons.AMMO[w], n = ammoCount(t, w); fname.textContent = A.name; fcnt.textContent = n < 0 ? '' : 'x' + n;
      $('amDesc').textContent = A.name + ': ' + A.desc; $('amDesc').classList.add('on'); };
    for (const sl of keys) {
      const key = document.createElement('div'); key.className = 'amKey'; key.textContent = 'F' + (+sl + 1); grid.append(key);
      for (let i = 0; i < ncol - 1; i++) {
        const w = slots[sl][i];
        if (!w) { const e = document.createElement('div'); e.className = 'amEmpty'; grid.append(e); continue; }
        const A = Weapons.AMMO[w], n = ammoCount(t, w), b = document.createElement('button');
        b.className = 'amCell' + (s.wp === w ? ' sel' : ''); b.dataset.w = w; b.title = A.name;
        const ic = document.createElement('i'); ic.style.backgroundImage = `url(assets/ui/ammo/${n === 0 ? 'Ammos_bw_base' : 'Ammos_base'}.png)`; ic.style.backgroundPosition = iconPos(A.icon, 32);
        b.append(ic); b.disabled = !mine || n === 0;
        b.onmouseenter = () => showFoot(w); b.onfocus = () => showFoot(w);
        let lp = 0; b.onpointerdown = () => { lp = setTimeout(() => showFoot(w), 350); }; b.onpointerup = b.onpointerleave = () => clearTimeout(lp);
        b.onclick = () => { send({ t: 'weapon', w }); $('ammoMenu').classList.remove('on'); $('amDesc').classList.remove('on'); };
        grid.append(b);
      }
    }
    grid.append(foot);
    if (s.wp && Weapons.AMMO[s.wp]) { const A = Weapons.AMMO[s.wp], n = ammoCount(t, s.wp); fname.textContent = A.name; fcnt.textContent = n < 0 ? '' : 'x' + n; }
  }
  function toggleAmmo(on) {
    const G = S.game; if (!G) return;
    const el = $('ammoMenu'), v = on == null ? !el.classList.contains('on') : on;
    if (v) renderAmmo(G);
    el.classList.toggle('on', v);
    if (!v) $('amDesc').classList.remove('on');
  }
  $('wCur').onclick = () => toggleAmmo();
  // F1~F3: 그 줄의 무기를 고름, 같은 키를 다시 누르면 그 줄 안에서 다음 무기 (원본 슬롯 키)
  function slotKey(sl) {
    const G = S.game; if (!G || !G.last) return;
    const list = Weapons.ORDER.filter(w => Weapons.AMMO[w].slot === sl && ammoCount(myTeam(G), w) !== 0); if (!list.length) return;
    const i = list.indexOf(G.last.wp);
    send({ t: 'weapon', w: list[(i + 1) % list.length] });
  }

  // ---------------- 입력 ----------------
  function isMyTurn(G) { const s = G && G.last; if (!s || !s.cur) return false; const h = G.hogs[s.cur]; return h && h.team.pid === S.me; }
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  function setKey(k, v) { if (keys[k] === v) return; keys[k] = v; if (S.game) send(Object.assign({ t: 'keys' }, keys)); }
  function releaseAllKeys() { for (const k in keys) keys[k] = false; for (const b of document.querySelectorAll('.tb.on')) b.classList.remove('on'); }
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'fire' };
  window.addEventListener('keydown', (e) => {
    if (!S.game || document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
    if (KEYMAP[e.key]) { e.preventDefault(); if (!e.repeat) setKey(KEYMAP[e.key], true); return; }
    if (e.repeat) return;
    if (e.key === 'Enter') { e.preventDefault(); send({ t: 'jump', k: 'long' }); }
    else if (e.key === 'Backspace') { e.preventDefault(); send({ t: 'jump', k: 'high' }); }
    else if (e.key === 'Tab') { e.preventDefault(); toggleAmmo(); }
    else if (/^F([1-9]|10)$/.test(e.key)) { e.preventDefault(); slotKey(+e.key.slice(1) - 1); }
    else if (e.key === 'Escape') toggleAmmo(false);
    else if (e.key === 'h' || e.key === 'H' || e.key === 'Home') goMyHog();
    else if (e.key === 'm' || e.key === 'M') $('mmToggle').click();
    else if (e.key >= '1' && e.key <= '5') send({ t: 'gtimer', s: +e.key });
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.key]) { e.preventDefault(); setKey(KEYMAP[e.key], false); } });
  window.addEventListener('blur', () => { for (const k in keys) setKey(k, false); });
  // 터치 버튼
  function holdBtn(id, k) {
    const el = $(id);
    const on = (e) => { e.preventDefault(); el.classList.add('on'); setKey(k, true); };
    const off = (e) => { e.preventDefault(); el.classList.remove('on'); setKey(k, false); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  }
  holdBtn('tL', 'left'); holdBtn('tR', 'right'); holdBtn('tU', 'up'); holdBtn('tD', 'down'); holdBtn('tFire', 'fire');
  $('tJump').addEventListener('pointerdown', (e) => { e.preventDefault(); send({ t: 'jump', k: 'long' }); });
  $('tHJump').addEventListener('pointerdown', (e) => { e.preventDefault(); send({ t: 'jump', k: 'high' }); });
  function tapBtn(id, fn) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('on'); fn(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('on'));
  }
  tapBtn('tSwitch', () => toggleAmmo());
  $('mmToggle').onclick = () => { try { localStorage.setItem('hw_mm', mmOpen() ? '0' : '1'); } catch (e) {} if (S.game) S.game.mmBtnKey = ''; };
  function goMyHog() { const G = S.game; if (!G) return; const id = myHogId(G); if (id) { G.cam.goto = id; G.cam.manual = performance.now() + 4000; } }
  $('btnMyHog').onclick = goMyHog;
  cv.addEventListener('contextmenu', (e) => { if (S.game) { e.preventDefault(); toggleAmmo(); } });   // 오른쪽 클릭 = 무기 메뉴 (원본)
  tapBtn('tTimer', () => $('gtimers').classList.toggle('on'));          // 휴대폰: 누르면 1~5초 선택 창
  $('wTimer').onclick = () => $('gtimers').classList.toggle('on');
  for (const id of ['tJump', 'tHJump']) {
    const el = $(id);
    el.addEventListener('pointerdown', () => el.classList.add('on'));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('on'));
  }
  // 화면 끌기(이동) / 휠·두 손가락(확대)
  const pts = new Map(); let pinch0 = 0, z0 = 1;
  let mmPtr = null, tapStart = null;
  const toWorld = (G, cx, cy) => G.xf ? { x: (cx * DPR - G.xf.ox) / G.xf.z, y: (cy * DPR - G.xf.oy) / G.xf.z } : null;
  cv.addEventListener('pointermove', (e) => { if (S.game && e.pointerType === 'mouse') S.game.mouse = toWorld(S.game, e.clientX, e.clientY); });
  cv.addEventListener('pointerleave', () => { if (S.game) S.game.mouse = null; });
  cv.addEventListener('pointerup', (e) => {
    const G = S.game, t0 = tapStart; tapStart = null;
    if (!G || !t0 || t0.id !== e.pointerId || e.button > 0) return;
    if (Math.hypot(e.clientX - t0.x, e.clientY - t0.y) > 8 || performance.now() - t0.t > 600) return;
    const s = G.last; if (!s || s.wp !== 'teleport' || s.st !== 'turn' || !isMyTurn(G)) return;
    const p = toWorld(G, e.clientX, e.clientY); if (p) send({ t: 'target', x: Math.round(p.x), y: Math.round(p.y) });
  });
  function mmJump(G, cx, cy) { const r = G.mmRect; if (!r) return; G.cam.x = (cx - r.x) / r.w * W; G.cam.y = (cy - r.y) / r.h * H; G.cam.goto = 0; G.cam.manual = performance.now() + 4000; }
  cv.addEventListener('pointerdown', (e) => {
    const G = S.game, r = G && G.mmRect;
    if (r && e.clientX >= r.x - 3 && e.clientX <= r.x + r.w + 3 && e.clientY >= r.y - 3 && e.clientY <= r.y + r.h + 3) { mmPtr = e.pointerId; cv.setPointerCapture(e.pointerId); mmJump(G, e.clientX, e.clientY); return; }
    tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = S.game ? S.game.cam.z : 1; } });
  cv.addEventListener('pointermove', (e) => {
    if (mmPtr === e.pointerId && S.game) { mmJump(S.game, e.clientX, e.clientY); return; }
    const G = S.game, p = pts.get(e.pointerId); if (!G || !p) return;
    if (pts.size === 1) {
      G.cam.x -= (e.clientX - p.x) / G.cam.z; G.cam.y -= (e.clientY - p.y) / G.cam.z; G.cam.manual = performance.now() + 4000;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; G.cam.z = clampZ(z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0); rememberZoom(G.cam.z); G.cam.manual = performance.now() + 4000; }
  });
  const up = (e) => { if (mmPtr === e.pointerId) mmPtr = null; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (S.game) { S.game.cam.z = clampZ(S.game.cam.z * (e.deltaY < 0 ? 1.1 : 0.9)); rememberZoom(S.game.cam.z); } }, { passive: false });
  // 확대 범위: 맵 전체가 보이는 정도 ~ 고슴도치가 크게 보이는 정도(2.5배). 마지막 값을 기억
  function clampZ(z) { const zmin = Math.min(0.6, Math.min(innerWidth / (W || 2560), innerHeight / (H || 1280))); return Math.max(zmin, Math.min(2.5, z)); }
  function savedZoom() { try { return +localStorage.getItem('hw_zoom') || 0; } catch (e) { return 0; } }
  let zoomSave = 0;
  function rememberZoom(z) { clearTimeout(zoomSave); zoomSave = setTimeout(() => { try { localStorage.setItem('hw_zoom', String(Math.round(z * 1000) / 1000)); } catch (e) {} }, 400); }

  // 테스트용 접근점 (자동 점검 스크립트에서 사용)
  window.__hw = { S, send, setKey };
})();
