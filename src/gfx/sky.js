import * as THREE from 'three';
import { SKY_FRAG, SKY_VERT } from './shaders.js';

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

    this.sun = new THREE.DirectionalLight(0xffe4c4, 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.camera.left = -28;
    this.sun.shadow.camera.right = 28;
    this.sun.shadow.camera.top = 28;
    this.sun.shadow.camera.bottom = -28;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x8fb4c8, 0x3d3428, 0.55);
    scene.add(this.hemi);

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
      new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 1, transparent: true, opacity: 0.72, depthWrite: false }),
      new THREE.MeshStandardMaterial({ color: 0xd5cfc4, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
    ];
    this._cloudMats = mats;
    this._cloudPuffs = [];
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(geo, mats[i % 2]);
      const a = (i / 18) * Math.PI * 2;
      const r = 46 + (i % 5) * 10;
      c.position.set(Math.cos(a) * r, 22 + (i % 4) * 3.5, Math.sin(a) * r);
      c.scale.set(6 + (i % 3) * 2.2, 2.2 + (i % 2), 4.5 + (i % 4));
      c.userData.kind = 'cloud';
      c.userData.baseY = c.position.y;
      c.userData.phase = i * 0.7;
      g.add(c);
      this._cloudPuffs.push(c);
    }
    return g;
  }

  setShadowSize(n) {
    this.sun.shadow.mapSize.set(n, n);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  update(dt, day, playerPos, camPos) {
    this.mat.uniforms.uTime.value += dt;
    const t = day.timeOfDay;
    const ang = (t - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.22);
    sunDir.normalize();
    const moonDir = sunDir.clone().multiplyScalar(-1);
    this.mat.uniforms.uSunDir.value.copy(sunDir);
    this.mat.uniforms.uMoonDir.value.copy(moonDir);
    this.mat.uniforms.uZenith.value.copy(day.zenith);
    this.mat.uniforms.uHorizon.value.copy(day.horizon);
    this.mat.uniforms.uSunColor.value.copy(day.sunColor);
    this.mat.uniforms.uNight.value = day.night;

    const focus = playerPos || new THREE.Vector3();
    this.sun.position.copy(focus).add(sunDir.clone().multiplyScalar(40));
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    this.sun.color.copy(day.sunColor);
    this.sun.intensity = day.sunIntensity;
    this.hemi.intensity = day.hemiIntensity;
    this.hemi.color.copy(day.zenith);
    this.hemi.groundColor.copy(day.ground);
    this.moon.position.copy(focus).add(moonDir.clone().multiplyScalar(30));
    this.moon.intensity = day.night * 0.22;

    if (camPos) this.mesh.position.copy(camPos);

    for (const c of this._cloudPuffs) {
      c.position.x += dt * 0.35;
      if (c.position.x > 90) c.position.x = -90;
      c.position.y = c.userData.baseY + Math.sin(this.mat.uniforms.uTime.value * 0.2 + c.userData.phase) * 0.4;
      if (camPos && playerPos) {
        const between = this._cloudBetween(c.position, camPos, playerPos);
        c.material.opacity = between ? 0.18 : (c.material === this._cloudMats[0] ? 0.72 : 0.55);
      }
    }
  }

  _cloudBetween(cloud, cam, player) {
    const ab = player.clone().sub(cam);
    const t = Math.max(0, Math.min(1, cloud.clone().sub(cam).dot(ab) / ab.lengthSq()));
    const closest = cam.clone().add(ab.multiplyScalar(t));
    return closest.distanceTo(cloud) < 8;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
