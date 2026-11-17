// 수달섬 — 시작 모듈: three.js 와 부품을 window 에 올리고, 나머지 파일(보통 스크립트)을 차례로 불러온다
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
Object.assign(window, { THREE, GLTFLoader, mergeGeometries, EffectComposer, RenderPass, ShaderPass, OutputPass, HorizontalTiltShiftShader, VerticalTiltShiftShader });
const FILES = ["render","island","nature","props","look","otter","input","loop","life","fish","house","trap","net","fight","gun","update","map","main"];
for (const f of FILES) {
  await new Promise((ok, no) => { const s = document.createElement('script'); s.src = `js/${f}.js?v=${window.GAME_BUILD}`; s.onload = ok; s.onerror = () => no(new Error(f + '.js 를 못 받음')); document.body.appendChild(s); });
}
