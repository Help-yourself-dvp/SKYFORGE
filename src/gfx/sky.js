import * as THREE from 'three';
import { SKY_FRAG, SKY_VERT } from './shaders.js';
import { V3A, V3B, V3C, V3D, V3E } from '../scratch.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uZenith: { value: new THREE.Color(0x6ea8c4) },
        uHorizon: { value: new THREE.Color(0xd8c4a0) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
        uSunColor: { value: new THREE.Color(0xffe2b0) },
        uMoonDir: { value: new THREE.Vector3(-0.4, -0.8, -0.2) },
        uSunSize: { value: 1.4 },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 20), this.mat);
    this.mesh.userData.kind = 'sky';
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xffe4c4, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.camera.left = -22;
    this.sun.shadow.camera.right = 22;
    this.sun.shadow.camera.top = 22;
    this.sun.shadow.camera.bottom = -22;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    if ('intensity' in this.sun.shadow) this.sun.shadow.intensity = 0.42;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xb7d4e2, 0x6a5a44, 1.15);
    scene.add(this.hemi);

    this.fill = new THREE.DirectionalLight(0xc8dce8, 0.48);
    this.fill.castShadow = false;
    scene.add(this.fill);

    this.amb = new THREE.AmbientLight(0xd8c8b0, 0.22);
    scene.add(this.amb);

    this.moon = new THREE.DirectionalLight(0x9bb0d0, 0.08);
    scene.add(this.moon);

    this.clouds = this._clouds();
    scene.add(this.clouds);
  }

  _clouds() {
    const g = new THREE.Group();
    g.userData.kind = 'clouds';
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mats = [
      new THREE.MeshBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.42, depthWrite: false, fog: true }),
      new THREE.MeshBasicMaterial({ color: 0xe8e2d6, transparent: true, opacity: 0.32, depthWrite: false, fog: true }),
    ];
    this._cloudMats = mats;
    this._cloudPuffs = [];
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(geo, mats[i % 2]);
      const a = (i / 18) * Math.PI * 2;
      const r = 46 + (i % 5) * 10;
      c.position.set(Math.cos(a) * r, 28 + (i % 4) * 4.2, Math.sin(a) * r);
      c.scale.set(7 + (i % 3) * 2.4, 2.6 + (i % 2) * 0.6, 5.2 + (i % 4));
      c.castShadow = false;
      c.receiveShadow = false;
      c.userData.kind = 'cloud';
      c.userData.baseY = c.position.y;
      c.userData.phase = i * 0.7;
      g.add(c);
      this._cloudPuffs.push(c);
    }
    return g;
  }

  setShadowSize(n) {
    if (this.sun.shadow.mapSize.x === n) return;
    this.sun.shadow.mapSize.set(n, n);
    // Recreating the shadow RT mid-session freezes Honor WebView. Keep the live map.
  }

  update(dt, day, playerPos, camPos) {
    this.mat.uniforms.uTime.value += dt;
    const t = day.timeOfDay;
    const ang = (t - 0.25) * Math.PI * 2;
    const sunDir = V3A.set(Math.cos(ang), Math.sin(ang), 0.22).normalize();
    const moonDir = V3B.copy(sunDir).multiplyScalar(-1);
    this.mat.uniforms.uSunDir.value.copy(sunDir);
    this.mat.uniforms.uMoonDir.value.copy(moonDir);
    this.mat.uniforms.uZenith.value.copy(day.zenith);
    this.mat.uniforms.uHorizon.value.copy(day.horizon);
    this.mat.uniforms.uSunColor.value.copy(day.sunColor);
    this.mat.uniforms.uNight.value = day.night;

    const focus = playerPos || V3C.set(0, 0, 0);
    this.sun.position.copy(focus).addScaledVector(sunDir, 40);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    this.sun.color.copy(day.sunColor);
    this.sun.intensity = day.sunIntensity;
    this.hemi.intensity = day.hemiIntensity;
    this.hemi.color.setHex(0xb7d4e2).lerp(day.zenith, 0.35);
    this.hemi.groundColor.setHex(0x7a6a52);
    this.fill.position.copy(focus).addScaledVector(sunDir, -24);
    this.fill.position.y = focus.y + 18;
    this.fill.intensity = day.fillIntensity || 0.4;
    this.amb.intensity = 0.18 + (1 - day.night) * 0.1;
    this.moon.position.copy(focus).addScaledVector(moonDir, 30);
    this.moon.intensity = day.night * 0.22;

    if (camPos) this.mesh.position.copy(camPos);

    for (const c of this._cloudPuffs) {
      c.position.x += dt * 0.35;
      if (c.position.x > 90) c.position.x = -90;
      c.position.y = c.userData.baseY + Math.sin(this.mat.uniforms.uTime.value * 0.2 + c.userData.phase) * 0.4;
      if (camPos && playerPos) {
        const between = this._cloudBetween(c.position, camPos, playerPos);
        c.material.opacity = between ? 0.12 : (c.material === this._cloudMats[0] ? 0.4 : 0.3);
      }
    }
  }

  _cloudBetween(cloud, cam, player) {
    V3C.copy(player).sub(cam);
    const lenSq = Math.max(1e-6, V3C.lengthSq());
    V3D.copy(cloud).sub(cam);
    const t = THREE.MathUtils.clamp(V3D.dot(V3C) / lenSq, 0, 1);
    V3E.copy(cam).addScaledVector(V3C, t);
    return V3E.distanceTo(cloud) < 8;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
