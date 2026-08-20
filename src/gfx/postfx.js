import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = opts.skipComposer ? false : true;
    this.bloomOn = false;
    this.ssao = false;
    this.composer = null;
    this.bloom = null;
    this._w = 0;
    this._h = 0;
    if (this.enabled) this._make();
  }

  _make() {
    try {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.55, 0.88);
      this.bloom.enabled = false;
      this.output = new OutputPass();
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(this.output);
      this._w = size.x;
      this._h = size.y;
    } catch (e) {
      console.warn('postfx unavailable', e);
      this.enabled = false;
      this.composer = null;
    }
  }

  setBloom(on) {
    this.bloomOn = !!on;
    if (this.bloom) this.bloom.enabled = this.bloomOn;
  }

  setSize(w, h) {
    if (!this.composer || !this.enabled) return;
    if (w === this._w && h === this._h) return;
    this._w = w;
    this._h = h;
    try { this.composer.setSize(w, h); } catch (e) { console.warn('postfx resize', e); }
  }

  render() {
    if (this.enabled && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    try { this.composer?.dispose(); } catch (_) { /* */ }
  }
}
