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
scene.background = new THREE.Color(0x9fd3ea);
scene.fog = new THREE.Fog(0xcfe6ef, 55, 130);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
scene.add(new THREE.HemisphereLight(0xc4e4ff, 0x8a7a4a, 1.05));
const sun = new THREE.DirectionalLight(0xffe0b0, 2.9);
sun.castShadow = true;
sun.shadow.mapSize.set(touchy ? 1024 : 2048, touchy ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const U = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPlayer: { value: new THREE.Vector3() } }; // 셰이더 공통 값
