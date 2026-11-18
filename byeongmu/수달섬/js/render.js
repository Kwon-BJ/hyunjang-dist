// 수달섬 — 판(그리기 장치 · 장면 · 빛) (2026-11-17 수달섬 index.html 에서 나눔 · 보통 스크립트: 다른 파일과 맨 위 이름을 함께 씀)
// ───────── 판 ─────────
const HQ = new URLSearchParams(location.search).has('hq');
const cv = document.getElementById('cv');
const touchy = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, touchy ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1b36); // 늘 달밤(작업지시서 2 C — 미티는 밤을 좋아함)
scene.fog = new THREE.Fog(0x162443, 34, 110);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 160); // 먼 끝 = 안개 끝(110) 넘어 조금 — 넓은 섬에서 먼 것까지 다 그리지 않게
const hemi = new THREE.HemisphereLight(0x6a86d0, 0x2a2340, 0.62); scene.add(hemi); // 밤하늘빛(푸름) · 땅 반사(보라)
const sun = new THREE.DirectionalLight(0xaec4ff, 1.05); // 달빛(이름은 예전 그대로 sun)
sun.castShadow = true;
sun.shadow.mapSize.set(touchy ? 1024 : 2048, touchy ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const U = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPlayer: { value: new THREE.Vector3() } }; // 셰이더 공통 값
