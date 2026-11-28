// 브라우저 화면: 서버가 보낸 결과를 그리고, 입력만 서버로 보낸다.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let W = Sim.W, H = Sim.H;      // 경기마다 맵 크기가 다름 → startGame 에서 바꿈

  // ---------------- 리소스 ----------------
  const IMG = {};
  const imgList = ['Hedgehog', 'BazookaShell', 'Bomb', 'Expl50', 'Crosshair', 'Finger', 'SmokeTrace', 'WindBar', 'WindL', 'WindR',
    'BlueWater', 'Statue', 'Nature_LandTex', 'Nature_Border', 'Nature_Sky', 'Nature_horizont',
    'BigDigits', 'BigDigitsRed', 'BigDigitsGray', 'Frame', 'flag_hedgewars', 'SDWater'];
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
    ow1: 'v_Ow1', ow2: 'v_Ow2', ow3: 'v_Ow3', ooff1: 'v_Ooff1', ooff2: 'v_Ooff2', byebye: 'v_Byebye', victory: 'v_Victory',
    sd: 'suddendeath', hurry: 'v_Hurry', jump1: 'v_Jump1', jump3: 'v_Jump3', missed: 'v_Missed', enemydown: 'v_Enemydown' };
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
  // 주소 쪽지 server.json: { "url": "https://….trycloudflare.com", "updatedAt": "…" } — 홈페이지에 올린 화면이 읽음
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
    if (!wsUrl) { S.opened = false; return showClosed(true); }
    const ws = new WebSocket(wsUrl);
    S.ws = ws; S.authed = false;
    ws.onopen = () => {
      S.opened = true; showClosed(false);
      $('conn').style.display = 'none'; S.retry = 0;
      if (S.auth) send({ t: 'resume', token: S.auth });
      else { S.pendingLogin && send(S.pendingLogin); S.pendingLogin = null; }
    };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null; S.authed = false;
      // 한 번도 못 열었거나 여러 번 실패 → 서버가 닫힌 것으로 보고 30초마다 쪽지부터 다시 확인 (터널 주소가 바뀌었을 수 있음)
      if (!S.opened || S.retry >= 4) { S.opened = false; S.retry = 0; return showClosed(true); }
      if (S.auth) { $('conn').style.display = 'block'; setTimeout(connect, Math.min(5000, 800 + S.retry++ * 700)); }
      else setTimeout(connect, 1500);
    };
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
  }
  authView(S.auth ? 'main' : 'login');
  function authSend(o) {
    $('authErr').textContent = '확인 중…';
    if (S.ws && S.ws.readyState === 1) send(o); else { S.pendingLogin = o; connect(); }
  }
  $('btnLogin').onclick = () => authSend({ t: 'login', id: $('lgId').value, pw: $('lgPw').value });
  $('lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); });
  $('btnSignup').onclick = () => {
    if ($('suPw').value !== $('suPw2').value) { $('authErr').textContent = '비밀번호 확인이 다릅니다.'; return; }
    authSend({ t: 'signup', id: $('suId').value, pw: $('suPw').value, nick: $('suNick').value, code: $('suCode').value });
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
    l2.textContent = `경험치 ${u.exp.toLocaleString()}` + (u.next != null ? ` · ${u.nextName}까지 ${(u.next - u.exp).toLocaleString()}` : ' · 최고 계급');
    const bar = document.createElement('div'); bar.className = 'xpbar'; bar.innerHTML = '<div></div>';
    const lo = RANK_MIN[u.rank] || 0; bar.firstChild.style.width = (u.next != null ? Math.max(0, Math.min(100, (u.exp - lo) / (u.next - lo) * 100)) : 100) + '%';
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
    const lo = RANK_MIN[u.rank] || 0, pct = u.next != null ? Math.round((u.exp - lo) / (u.next - lo) * 100) : 100;
    const tb = document.createElement('table'); tb.className = 'info';
    for (const [k, v] of [['계급', u.rankName], ['누적 경험치', u.exp.toLocaleString()],
      ['다음 계급', u.next != null ? `${u.nextName} (${u.next.toLocaleString()}) — ${(u.next - u.exp).toLocaleString()} 남음` : '최고 계급'],
      ['전적', `${u.games}판 · ${u.wins}승 ${u.losses}패 ${u.draws}무`],
      ['AI 대전', u.aiBest ? `최고 ${u.aiBest}단계 (깬 단계 ${Object.keys(u.aiClears || {}).length}개)` : '아직 없음']]) {
      const tr = tb.insertRow(); tr.insertCell().textContent = k; const c = tr.insertCell(); c.textContent = v; c.style.color = '#fff';
    }
    b.append(tb);
    const bar = document.createElement('div'); bar.className = 'xpbar'; bar.style.width = '100%'; bar.innerHTML = '<div></div>';
    bar.firstChild.style.width = Math.max(0, Math.min(100, pct)) + '%'; b.append(bar);
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
      b.onmouseenter = b.onfocus = () => { $('aiStageDesc').textContent = `${st}단계: ${band[2]}${clear ? ' — 이미 깸(경험치 없음)' : ' — 처음 깨면 +' + st * 5}`; };
      b.onclick = () => { $('aiErr').textContent = ''; $('aiDlg').classList.remove('on'); send({ t: 'ai', stage: st }); };
      g.append(b);
    }
    $('aiInfo').textContent = `1단계부터 깨면 다음 단계가 열립니다. 처음 깬 단계만 경험치(단계 × 5). 져도·나가도 깎이지 않습니다. 지금 최고 ${u.aiBest || 0}단계.`;
  }
  $('btnAI').onclick = () => { renderAI(); $('aiStageDesc').textContent = ''; $('aiDlg').classList.add('on'); };
  $('btnAI2').onclick = () => $('btnAI').click();
  $('btnAiClose').onclick = () => $('aiDlg').classList.remove('on');
  $('btnAiNext').onclick = () => { $('result').classList.remove('on'); send({ t: 'ai', stage: S.aiResult.stage + 1 }); };
  $('btnAiRetry').onclick = () => { $('result').classList.remove('on'); send({ t: 'ai', stage: S.aiResult.stage }); };
  const aiTag = (n) => { const t = document.createElement('span'); t.className = 'aiTag'; t.textContent = 'AI 최고 ' + n + '단계'; return t; };
  // ---- 운영자 ----
  $('btnAdmin').onclick = () => { send({ t: 'admin', op: 'list' }); $('admin').classList.add('on'); };
  $('btnCloseAdmin').onclick = () => $('admin').classList.remove('on');
  $('btnBackupNow').onclick = () => { $('adminBackup').textContent = '백업 중…'; send({ t: 'admin', op: 'backup' }); };
  function renderBackup(b) {
    const el = $('adminBackup'); if (!el || !b) return;
    const t = (s) => s ? new Date(s).toLocaleString('ko-KR') : '-';
    el.style.color = b.ok === false ? '#ff8080' : '#9dff9d';
    el.textContent = b.ok === false ? `[경고] 외부 백업 실패: ${b.lastError} (위치 ${b.dir || '없음'}, 마지막 성공 ${t(b.lastOk)})`
      : `외부 백업 정상 — 마지막 ${t(b.lastOk)} · 위치 ${b.dir}`;
  }
  function renderAdmin(list) {
    const b = $('adminList'); b.innerHTML = '';
    const tb = document.createElement('table'); tb.className = 'info';
    const hr = tb.insertRow(); hr.className = 'head'; ['아이디', '닉네임', '계급', '경험치', '상태', ''].forEach(h => { hr.insertCell().textContent = h; });
    for (const u of list) {
      const tr = tb.insertRow();
      [u.id, u.nick, u.rankName, u.exp, u.suspended ? '정지' : (u.admin ? '운영자' : '정상')].forEach(v => { tr.insertCell().textContent = v; });
      const c = tr.insertCell();
      const r = document.createElement('button'); r.className = 'mini'; r.innerHTML = '<img src="assets/ui/edit.png" alt="" style="height:14px">비번 초기화';
      r.onclick = () => send({ t: 'admin', op: 'reset', id: u.id });
      const s = document.createElement('button'); s.className = 'mini';
      s.innerHTML = `<img src="assets/ui/${u.suspended ? 'unlock' : 'lock'}.png" alt="" style="height:12px">${u.suspended ? '정지 해제' : '정지'}`;
      s.onclick = () => send({ t: 'admin', op: u.suspended ? 'unsuspend' : 'suspend', id: u.id });
      c.append(r, s);
    }
    b.append(tb);
  }

  // ---------------- 서버 메시지 ----------------
  function onMsg(m) {
    if (m.t === 'auth') {
      S.authed = true; S.user = m.user;
      if (m.token) { S.auth = m.token; store.set('hwauth', m.token); }
      authView('main'); renderMe();
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
      if (m.op === 'list' || m.op === 'backup') { renderAdmin(m.list); renderBackup(m.backup); }
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
    if (m.t === 'left') { setRoom(null); S.lobby = null; if (S.game) { S.game = null; } show('home'); return; }
    if (m.t === 'lobby') { S.lobby = m; renderLobby(); return; }
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
  async function renderMapPick(L, isHost) {
    const mp = L.map; if (!mp) { $('mapRow').style.display = $('mapPrevRow').style.display = 'none'; return; }
    const cat = await loadCatalog();
    if (S.lobby !== L) return;
    const themes = Object.keys(cat.themes).filter(t => !cat.themes[t].hidden).sort();
    $('mapKind').value = mp.kind;
    if (mp.kind === 'image') opt($('mapSub'), [['', '무작위 맵']].concat(Object.keys(cat.maps).sort().map(n => [n, n + ' (' + cat.maps[n].maxHogs + ')', cat.maps[n].maxHogs < mp.hogs])));
    else opt($('mapSub'), [['', '무작위 종류']].concat((mp.kind === 'maze' ? LandGen.MAZE_TYPES : LandGen.OUTLINE_TYPES).map(t => [t, MAPKO[t] || t])));
    $('mapSub').value = mp.sub || '';
    opt($('mapTheme'), mp.kind === 'image' ? [['', '맵에 딸린 테마']] : [['', '무작위 테마']].concat(themes.map(t => [t, t])));
    $('mapTheme').value = mp.kind === 'image' ? '' : (mp.theme || '');
    for (const id of ['mapKind', 'mapSub', 'mapTheme', 'btnReroll']) $(id).disabled = !isHost;
    $('mapTheme').disabled = !isHost || mp.kind === 'image';
    drawMapPreview(mp).catch(e => console.warn('[hw] 미리보기', e));
  }
  ['mapKind', 'mapSub', 'mapTheme'].forEach(id => { $(id).onchange = () => send({ t: 'map', kind: $('mapKind').value, sub: id === 'mapKind' ? '' : $('mapSub').value, theme: $('mapTheme').value }); });
  $('btnReroll').onclick = () => send({ t: 'reroll' });
  const prevCache = new Map();
  async function drawMapPreview(mp) {
    const key = [mp.kind, mp.sub, mp.seed, mp.hogs, mp.th, mp.name].join('|');
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
        L = MapGen.build({ kind: mp.kind, sub: mp.sub, seed: mp.seed, hogs: mp.hogs }, { templates: tpl, theme: th.j });
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
    $('mapDesc').textContent = `${kindKo}: ${desc} · 테마 ${mp.th}${mp.kind !== 'image' && !mp.theme ? ' (무작위)' : ''} · 고슴도치 ${mp.hogs}마리`;
  }
  // 판 결과 (서버가 계산한 값만 보여줌) — 순위 아이콘은 원본 StatsMedal
  function showResult(m) {
    const b = $('resBody'); b.innerHTML = '';
    $('btnAiNext').style.display = 'none'; $('btnAiRetry').style.display = 'none';
    if (m.mode === 'ai') return showAIResult(m);
    const mine = m.rows.find(r => r.pid === S.me);
    $('resHead').textContent = m.draw ? '무승부 — 경험치 변동 없음' : mine ? (mine.outcome === 'win' ? '승리!' : mine.outcome === 'quit' ? '기권 처리' : '패배') : '경기 종료';
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
      tr.insertCell().textContent = rb.next != null ? `${(rb.next - r.after).toLocaleString()} (${rb.nextName})` : '최고 계급';
    }
    b.append(tb);
    const notes = [];
    for (const r of m.rows) {
      if (!r.rankBefore || !r.rankAfter || r.rankBefore.level === r.rankAfter.level) continue;
      notes.push(`${r.nick}: ${r.rankBefore.name} → ${r.rankAfter.name} ${r.rankAfter.level > r.rankBefore.level ? '진급!' : '강등'}`);
    }
    $('resNotes').textContent = notes.join('  ·  ');
    $('result').classList.add('on');
    if (mine) send({ t: 'me' });
  }
  $('btnCloseResult').onclick = () => $('result').classList.remove('on');
  // AI 대전 결과: 이기면 "다음 단계", 지면 "다시 도전". 경험치는 처음 깬 단계만
  function showAIResult(m) {
    S.aiResult = m;
    $('resHead').textContent = m.win ? `${m.stage}단계 클리어!` : `${m.stage}단계 패배`;
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
    if (m.win && m.stage < m.max) note += ` ${m.stage + 1}단계가 열렸습니다.`;
    if (m.win && m.stage >= m.max) note += ' 마지막 단계까지 모두 깼습니다!';
    $('resNotes').textContent = note;
    $('btnAiNext').style.display = m.win && m.stage < m.max ? '' : 'none';
    $('btnAiRetry').style.display = m.win ? 'none' : '';
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
    const land = MapGen.build({ kind: mp.kind, sub: mp.sub, seed: m.seed, hogs: mp.hogs },
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
    G.cam.z = defaultZoom();
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
    G.waterY = wy;
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
      if (h && p) G.floats.push({ x: p.x, y: p.y - 30, text: '-' + e[2], color: h.team.color, t: performance.now() });
      if (Math.random() < 0.6) play(['ow1', 'ow2', 'ow3', 'ooff1', 'ooff2'][Math.floor(Math.random() * 5)], 0.8);
    } else if (k === 'turn') {
      const t = G.teams.find(t => t.id === e[1]);
      G.cur = e[2]; G.lastTurnAt = performance.now(); G.cam.manual = 0; G.upcoming = e[4] || [];
      flash(t.pid === S.me ? '내 차례!' : t.name + ' 차례', t.color);
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
    } else if (k === 'sdwarn') {
      flash(e[1] === 1 ? '이번이 서든데스 전 마지막 라운드!' : e[1] + '라운드 뒤 서든데스!', '#ffcc00');
    } else if (k === 'sd') {
      G.sd = true; G.sdFlash = performance.now();
      flash('서든데스!', '#ff6060');
      play('sd'); music('sdmusic');
    } else if (k === 'forfeit') {
      const t = G.teams.find(t => t.id === e[1]); if (t) { t.forfeit = true; flash(t.name + ' 기권', '#ccc'); }
    } else if (k === 'over') {
      const t = G.teams.find(t => t.id === e[1]);
      $('resTitle').textContent = !t ? '무승부' : (e[2] || t.name) + ' 승리';
      $('resTitle').style.color = t ? t.color : '#fff';
      $('resText').textContent = !t ? '모두 함께 전멸했습니다.' : '순위와 경험치를 계산했습니다.';
      $('overlay').classList.add('on');
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
  function flash(text, color) {
    const el = $('msg'); el.textContent = text; el.style.color = color || '#fff';
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { el.textContent = ''; }, 2200);
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
    return { hogs, projs, s: b };
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
    if (view && G.cam.manual < now) {
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
    if (G.sd) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, vw, vh); }
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = z < 1;
    ctx.drawImage(G.canvas, 0, 0);
    // 무덤
    for (const g of G.graves) if (IMG.Statue.width) ctx.drawImage(IMG.Statue, g[0] - 16, g[1] - 23, 32, 32);
    if (view) {
      drawHogs(G, view, now);
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

  function drawHogs(G, view, now) {
    const s = view.s;
    for (const h of view.hogs) {
      const info = G.hogs[h.id]; if (!info || G.deadIds.has(h.id)) continue;
      const walking = h.flags & 2;
      const fr = walking ? Math.floor(now / 70) % 7 : 0;
      ctx.save(); ctx.translate(Math.round(h.x), Math.round(h.y));
      if (h.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(IMG.Hedgehog, fr * 32, 0, 32, 32, -16, -16 - 3, 32, 32);
      const hat = HATS[info.team.rank || 0];
      if (hat && hat.width) ctx.drawImage(hat, 0, 0, 32, 32, -16, -16 - 3 - 5, 32, 32);
      ctx.restore();
      const isCur = h.id === s.cur && (s.st === 'turn' || s.st === 'retreat');
      // 조준 십자선 + 파워
      if (isCur && !(h.flags & 1) && s.st === 'turn') {
        const v = Sim.aimVector(s.a, h.facing);
        if (s.pw > 0) {
          const n = Math.ceil(s.pw / Sim.MAX_POWER * 16);
          for (let i = 1; i <= n; i++) {
            const k = i / 16; ctx.fillStyle = `hsl(${60 - k * 60},100%,50%)`;
            ctx.beginPath(); ctx.arc(h.x + v.x * (14 + i * 4), h.y + v.y * (14 + i * 4), 1.5 + k * 3.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.drawImage(IMG.Crosshair, h.x + v.x * 50 - 10, h.y + v.y * 50 - 10, 20, 20);
      }
      // 이름표·체력 (팀 색)
      const col = info.team.color;
      ctx.font = 'bold 11px ' + HUDFONT; ctx.textAlign = 'center';
      const hpText = String(h.hp), nameY = h.y - 42, hpY = h.y - 28;
      tag(info.name, h.x, nameY, col); tag(hpText, h.x, hpY, col);
      if (isCur && now - G.lastTurnAt < 4000 && s.st === 'turn') {
        const bob = Math.sin(now / 120) * 4;
        ctx.drawImage(IMG.Finger, 0, 0, 32, 48, h.x - 12, h.y - 86 + bob, 24, 36);
      }
    }
  }
  function tag(text, x, y, col) {
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - w / 2, y - 9, w, 13);
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 + 0.5, y - 8.5, w - 1, 12);
    ctx.fillStyle = col; ctx.fillText(text, x, y + 1);
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
      if (p.kind === 'smoke') {
        const f = Math.floor(age / 80); if (f >= 8) return false;
        ctx.globalAlpha = 0.8; ctx.drawImage(IMG.SmokeTrace, 0, f * 32, 32, 32, p.x - 10, p.y - 10, 20, 20); ctx.globalAlpha = 1;
        return true;
      }
      return false;
    });
    ctx.font = 'bold 16px ' + HUDFONT; ctx.textAlign = 'center';
    G.floats = G.floats.filter(f => {
      const age = now - f.t; if (age > 1800) return false;
      ctx.globalAlpha = Math.min(1, (1800 - age) / 500);
      ctx.fillStyle = f.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y - age / 40); ctx.fillText(f.text, f.x, f.y - age / 40);
      ctx.globalAlpha = 1; return true;
    });
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

  // HUD — 원본 배치: 타이머(BigDigits+Frame), 팀 줄(이름표·깃발·체력바)은 화면 아래 가운데
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
    const playing = s.st === 'turn' || s.st === 'retreat';
    const cur = G.hogs[s.cur];
    // 타이머
    let ty = Math.max(6, 0);
    if (playing) {
      const sec = String(Math.max(0, Math.ceil(s.tl / 1000)));
      const dig = s.st === 'retreat' ? IMG.BigDigitsRed : IMG.BigDigits;
      const sz = small ? 26 : 32, w = 4 + sec.length * sz + 4, x0 = Math.round(cw / 2 - w / 2);
      if (IMG.Frame.width) { ctx.drawImage(IMG.Frame, 0, 0, 4, 32, x0, ty, 4 * sz / 32, sz); ctx.drawImage(IMG.Frame, 0, 32, 4, 32, x0 + w - 4 * sz / 32, ty, 4 * sz / 32, sz); }
      for (let i = 0; i < sec.length; i++) if (dig.width) ctx.drawImage(dig, 0, (+sec[i]) * 32, 32, 32, x0 + 4 * sz / 32 + i * sz, ty, sz, sz);
      ty += sz + 2;
    }
    // 현재 차례: 모자 얼굴 + 닉네임 · 고슴도치 이름 (한 줄)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px ' + HUDFONT;
    let line = null, col = '#fff', lvl = 0;
    if (cur && playing) { line = cur.team.name + ' · ' + cur.name + (s.st === 'retreat' ? ' (후퇴!)' : ''); col = cur.team.color; lvl = cur.team.rank || 0; }
    else if (s.st === 'wait') line = '연결 끊긴 플레이어를 기다리는 중…';
    if (line) {
      const tw = ctx.measureText(line).width, fw = cur && playing ? 20 : 0, x = Math.round(cw / 2 - (tw + fw) / 2);
      if (fw) { const fi = faceImage(lvl); if (fi.complete && fi.width) ctx.drawImage(fi, x, ty, 18, 18); }
      outlined(line, x + fw, ty + 9, col);
      ty += 20;
    }
    // 다음 차례 순서 (작게)
    if (playing && G.upcoming && G.upcoming.length) {
      ctx.font = 'bold 11px ' + HUDFONT;
      const names = G.upcoming.map(id => G.teams.find(t => t.id === id)).filter(Boolean);
      const parts = [['다음: ', '#c8c8ff']].concat(names.flatMap((t, i) => [[t.name, t.color], [i < names.length - 1 ? ' → ' : '', '#c8c8ff']]));
      const tw = parts.reduce((a, p) => a + ctx.measureText(p[0]).width, 0);
      let x = Math.round(cw / 2 - tw / 2);
      for (const [txt, cl] of parts) { if (!txt) continue; outlined(txt, x, ty + 7, cl); x += ctx.measureText(txt).width; }
      ty += 16;
    }
    // 탈락한 사람: 관전 안내
    const mineT = G.teams.find(t => t.pid === S.me);
    if (mineT && s.st !== 'over' && !mineT.forfeit && mineT.hogs.every(h => G.deadIds.has(h.id))) {
      ctx.font = 'bold 12px ' + HUDFONT; ctx.textAlign = 'center';
      outlined('관전 중 — 지금 나가도 감점 없음', Math.round(cw / 2), ty + 8, '#ffcc00');
      ctx.textAlign = 'left';
    }
    // 팀 줄 (아래 가운데, 원본처럼 작게): 이름표 · 깃발 · 체력바 · 체력
    const teams = G.teams.filter(t => !t.forfeit);
    const totals = teams.map(t => ({ t, hp: t.hogs.reduce((a2, h) => a2 + (G.deadIds.has(h.id) ? 0 : (G.hogs[h.id].hp || 0)), 0) }));
    const maxHp = Math.max(100, ...G.teams.map(t => t.hogs.reduce((a, h) => a + (h.hp || 100), 0)));
    const cols = totals.length > 4 ? 2 : 1, rowsN = Math.ceil(totals.length / cols);
    const rowH = cols > 1 ? (small ? 12 : 14) : (small ? 15 : 17), barW = cols > 1 ? (small ? 56 : 90) : (small ? 90 : 120);
    const colW = cols > 1 ? (small ? 230 : 300) : 0;
    ctx.font = 'bold ' + (cols > 1 ? (small ? 10 : 11) : (small ? 11 : 12)) + 'px ' + HUDFONT;
    const blink = (now % 1000) < 500;
    totals.forEach(({ t, hp }, i) => {
      const col = cols > 1 ? Math.floor(i / rowsN) : 0, row = cols > 1 ? i % rowsN : i;
      const cx = Math.round(cw / 2 + (col - (cols - 1) / 2) * colW);
      const y = Math.round(ch - 3 - (rowsN - row) * rowH);
      if (hp <= 0) return;
      // 이름표 (팀 색 글자, 어두운 바탕)
      const nw = ctx.measureText(t.name).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - 14 - nw, y, nw, rowH - 2);
      ctx.strokeStyle = t.color; ctx.lineWidth = 1; ctx.strokeRect(cx - 14 - nw + .5, y + .5, nw - 1, rowH - 3);
      ctx.fillStyle = t.color; ctx.textAlign = 'right'; ctx.fillText(t.name, cx - 18, y + (rowH - 2) / 2 + 1);
      // 깃발
      const fh = Math.min(15, rowH - 2), fwid = Math.round(fh * 22 / 15);
      if (IMG.flag_hedgewars.width) ctx.drawImage(IMG.flag_hedgewars, cx - Math.round(fwid / 2), y + Math.round((rowH - 2 - fh) / 2), fwid, fh);
      // 체력바 (현재 차례 팀은 깜빡임 — 원본 highlight)
      const bw = Math.max(2, Math.round(barW * hp / maxHp));
      const isCurTeam = cur && cur.team.id === t.id && playing;
      ctx.fillStyle = '#000'; ctx.fillRect(cx + 13, y + 1, bw + 2, rowH - 4);
      ctx.fillStyle = isCurTeam && blink ? '#fff' : t.color; ctx.fillRect(cx + 14, y + 2, bw, rowH - 6);
      ctx.textAlign = 'left'; outlined(String(hp), cx + 18 + bw, y + (rowH - 2) / 2 + 1, '#fff');
    });
    ctx.textBaseline = 'alphabetic';
  }
  let lastHud = '';
  function updateHud(G, s, now) {
    const playing = s.st === 'turn' || s.st === 'retreat';
    const hudKey = [s.cur, s.st, s.wp, s.gt].join('|');
    if (hudKey !== lastHud) {
      lastHud = hudKey;
      const mine = isMyTurn(G);
      for (const b of document.querySelectorAll('.wbtn')) { b.classList.toggle('sel', b.dataset.w === s.wp); b.disabled = !mine || s.st !== 'turn'; }
      $('gtimers').style.display = s.wp === 'grenade' ? 'flex' : 'none';
      for (const b of document.querySelectorAll('.gt')) { b.classList.toggle('sel', +b.dataset.s === s.gt); b.disabled = !mine || s.st !== 'turn'; }
      $('tTimer').style.display = s.wp === 'grenade' ? 'block' : 'none';
      $('tTimerLbl').textContent = s.gt + '초';
      $('touch').classList.toggle('idle', !(mine && playing));
    }
    $('power').style.display = s.pw > 0 ? 'block' : 'none';
    if (s.pw > 0) $('power').firstChild.style.width = (s.pw / Sim.MAX_POWER * 100) + '%';
    drawWind(s.w);
  }
  let lastWind = null;
  function drawWind(w) {
    if (w === lastWind) return; lastWind = w;
    const c = $('wind'), x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    if (IMG.WindBar.width) x.drawImage(IMG.WindBar, 4, 2, 151, 17);
    const len = Math.round(Math.abs(w) * 73);
    if (len > 0) {
      if (w > 0) x.drawImage(IMG.WindR, 0, 0, len, 13, 80, 4, len, 13);
      else x.drawImage(IMG.WindL, 80 - len, 0, len, 13, 80 - len, 4, len, 13);
    }
  }
  function buildTimerButtons() {
    const box = $('gtimers'); box.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button'); b.className = 'gt'; b.dataset.s = i; b.textContent = i + '초';
      b.onclick = () => send({ t: 'gtimer', s: i }); box.appendChild(b);
    }
  }
  for (const b of document.querySelectorAll('.wbtn')) b.onclick = () => send({ t: 'weapon', w: b.dataset.w });

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
    else if (e.key === 'Tab') { e.preventDefault(); const s = S.game.last; send({ t: 'weapon', w: s && s.wp === 'bazooka' ? 'grenade' : 'bazooka' }); }
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
  tapBtn('tSwitch', () => { const s = S.game && S.game.last; send({ t: 'weapon', w: s && s.wp === 'bazooka' ? 'grenade' : 'bazooka' }); });
  tapBtn('tTimer', () => { const s = S.game && S.game.last; send({ t: 'gtimer', s: s ? (s.gt % 5) + 1 : 3 }); });
  for (const id of ['tJump', 'tHJump']) {
    const el = $(id);
    el.addEventListener('pointerdown', () => el.classList.add('on'));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('on'));
  }
  // 화면 끌기(이동) / 휠·두 손가락(확대)
  const pts = new Map(); let pinch0 = 0, z0 = 1;
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = S.game ? S.game.cam.z : 1; } });
  cv.addEventListener('pointermove', (e) => {
    const G = S.game, p = pts.get(e.pointerId); if (!G || !p) return;
    if (pts.size === 1) {
      G.cam.x -= (e.clientX - p.x) / G.cam.z; G.cam.y -= (e.clientY - p.y) / G.cam.z; G.cam.manual = performance.now() + 4000;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; G.cam.z = clampZ(z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); if (S.game) S.game.cam.z = clampZ(S.game.cam.z * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
  function clampZ(z) { return Math.max(0.3, Math.min(2.5, z)); }

  // 테스트용 접근점 (자동 점검 스크립트에서 사용)
  window.__hw = { S, send, setKey };
})();
