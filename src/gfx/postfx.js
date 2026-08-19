import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.bloomOn = true;
    this.ssao = false;
    this._make();
  }

  _make() {
    try {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer);
      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.55, 0.88);
      this.output = new OutputPass();
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(this.output);
    } catch (e) {
      console.warn('postfx unavailable', e);
      this.enabled = false;
    }
  }

  setBloom(on) {
    this.bloomOn = on;
    this.bloom.enabled = on;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }

  render() {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer.dispose();
  }
}
