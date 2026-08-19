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
    this.scene.fog = new THREE.Fog(0xc5d4c6, 24, 150);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.32;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x9ec4c8, 1);
    const mobile = !!(typeof window !== 'undefined' && (window.Capacitor || window.matchMedia('(pointer: coarse)').matches));
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.75);
    this.renderer.setPixelRatio(this.dpr);
    this.qualityName = mobile ? 'MEDIUM' : 'HIGH';
    this.quality = QUALITY[this.qualityName];
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
    if (this._adapt < 480) return;
    this._adapt = 0;
    if (this._fps < 38 && this.qualityName === 'HIGH') this.setQuality('MEDIUM');
    else if (this._fps < 30 && this.qualityName === 'MEDIUM') this.setQuality('LOW');
  }

  render() {
    try {
      this.post.render();
    } catch (e) {
      console.warn('postfx fail, raw render', e);
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
