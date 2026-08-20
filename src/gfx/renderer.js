import * as THREE from 'three';
import { QUALITY } from '../config.js';
import { Sky } from './sky.js';
import { Water } from './water.js';
import { PostFX } from './postfx.js';
import { Particles } from './particles.js';

function isCapacitor() {
  try {
    return !!(typeof window !== 'undefined' && window.Capacitor);
  } catch (_) {
    return false;
  }
}

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.android = isCapacitor();
    this.qualityName = this.android ? 'MEDIUM' : 'HIGH';
    this.quality = QUALITY[this.qualityName];
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xa8b8b8, 26, 190);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.android,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x8aa8b2, 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.android ? 1.25 : 1.75);
    this.renderer.setPixelRatio(this.dpr);
    this.sky = new Sky(this.scene);
    this.post = new PostFX(this.renderer, this.scene, this.camera, { skipComposer: this.android });
    this.particles = null;
    this.water = null;
    this._fps = 60;
    this._w = 0;
    this._h = 0;
  }

  initWorld(pond) {
    this.water = new Water(this.scene, pond);
    this.particles = new Particles(this.scene, this.quality.particles);
  }

  setQuality() {
    /* Quality is fixed after boot. Changing shadow map size mid-session
       reallocates GPU memory and freezes Honor WebView. */
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === this._w && h === this._h) return;
    this._w = w;
    this._h = h;
    this.camera.aspect = Math.max(0.1, w / Math.max(1, h));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
  }

  adapt() {
    /* disabled: 480-frame quality switch recreated GPU resources ~8s in */
  }

  render() {
    try {
      this.post.render();
    } catch (e) {
      console.warn('render fail, raw', e);
      this.post.enabled = false;
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.post.dispose();
    this.sky.dispose();
    this.water?.dispose();
    this.particles?.dispose();
    this.renderer.dispose();
  }
}
