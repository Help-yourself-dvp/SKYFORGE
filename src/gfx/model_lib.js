import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLB_MODELS } from './models.js';

// ModelLib: decodes the embedded Kenney Nature Kit GLBs once at boot and
// hands out fresh clones. All models stay inside the bundle — no runtime
// network, no external files, works in the single-file offline preview.
//
// userData contract on returned groups:
//   kind: 'glbModel', modelName: <name>, scale: <number>
export class ModelLib {
  constructor() {
    this._templates = new Map();
    this._loader = new GLTFLoader();
    this.ready = false;
    this.failed = 0;
  }

  // Decode + parse all embedded models. Called once during Game.init().
  async init() {
    const jobs = [];
    for (const [name, spec] of Object.entries(GLB_MODELS)) {
      jobs.push(this._parseOne(name, spec));
    }
    await Promise.all(jobs);
    this.ready = true;
  }

  _parseOne(name, spec) {
    return new Promise((resolve) => {
      try {
        const bin = atob(spec.b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ab = bytes.buffer;
        this._loader.parse(ab, '', (gltf) => {
          const scene = gltf.scene || gltf.scenes[0];
          scene.userData.kind = 'glbModel';
          scene.userData.modelName = name;
          scene.userData.scale = spec.scale;
          // Normalize: the source GLBs sit at the origin (feet ~0); bake the
          // gameplay scale into the template so clones are ready to place.
          scene.scale.setScalar(spec.scale || 1);
          scene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          this._templates.set(name, scene);
          resolve();
        }, (err) => {
          console.warn(`[models] ${name} parse failed:`, err?.message || err);
          this.failed += 1;
          resolve();
        });
      } catch (e) {
        console.warn(`[models] ${name} decode failed:`, e?.message || e);
        this.failed += 1;
        resolve();
      }
    });
  }

  has(name) {
    return this._templates.has(name);
  }

  // Returns a fresh clone (geometry/materials shared, transforms copied).
  get(name) {
    const tpl = this._templates.get(name);
    if (!tpl) return null;
    const clone = tpl.clone(true);
    clone.userData.kind = 'glbModel';
    clone.userData.modelName = name;
    return clone;
  }

  // Pick a model name from a set by a 0..1 random value.
  pick(rng01, names) {
    const avail = names.filter((n) => this._templates.has(n));
    if (!avail.length) return null;
    return avail[Math.floor(rng01 * avail.length) % avail.length];
  }
}
