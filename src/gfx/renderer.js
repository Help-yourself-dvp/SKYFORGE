import * as THREE from 'three';
import { QUALITY } from '../config.js';
import { Sky } from './sky.js';
import { Water } from './water.js';
import { PostFX } from './postfx.js';
import { Particles } from './particles.js';

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityName = 'HIGH';
    this.quality = QUALITY.HIGH;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8aa4b0, 0.0085);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.12, 420);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x6ea8c4, 1);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.sky = new Sky(this.scene);
    this.post = new PostFX(this.renderer, this.scene, this.camera);
    this.particles = null;
    this.water = null;
    this._fps = 60;
    this._adapt = 0;
  }

  initWorld(pond) {
    this.water = new Water(this.scene, pond);
    this.particles = new Particles(this.scene, this.quality.particles);
  }

  setQuality(name) {
    const q = QUALITY[name] || QUALITY.MEDIUM;
    this.qualityName = QUALITY[name] ? name : 'MEDIUM';
    this.quality = q;
    this.sky.setShadowSize(q.shadow);
    this.post.setBloom(q.bloom);
    if (this.particles) this.particles.quality = q.particles;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = Math.max(0.1, w / Math.max(1, h));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
  }

  adapt(fps) {
    this._fps = this._fps * 0.9 + fps * 0.1;
    this._adapt += 1;
    if (this._adapt < 90) return;
    this._adapt = 0;
    if (this._fps < 40 && this.qualityName === 'HIGH') this.setQuality('MEDIUM');
    else if (this._fps < 32 && this.qualityName === 'MEDIUM') this.setQuality('LOW');
    else if (this._fps > 56 && this.qualityName === 'LOW') this.setQuality('MEDIUM');
    else if (this._fps > 58 && this.qualityName === 'MEDIUM') this.setQuality('HIGH');
  }

  render() {
    this.post.render();
  }

  dispose() {
    this.post.dispose();
    this.sky.dispose();
    this.water?.dispose();
    this.particles?.dispose();
    this.renderer.dispose();
  }
}
