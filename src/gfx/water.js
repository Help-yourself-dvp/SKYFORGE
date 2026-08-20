import * as THREE from 'three';
import { WATER_FRAG, WATER_VERT } from './shaders.js';

export class Water {
  constructor(scene, pond) {
    this.pond = pond;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector2(0.4, 0.2) },
        uDeep: { value: new THREE.Color(0x1e4452) },
        uShallow: { value: new THREE.Color(0x4f9a8c) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
        uSunColor: { value: new THREE.Color(0xffe2b0) },
        uCam: { value: new THREE.Vector3() },
        uCenter: { value: new THREE.Vector3(pond.x, pond.level, pond.z) },
        uRadius: { value: pond.radius },
        uNight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.CircleGeometry(pond.radius * 1.05, 48);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(pond.x, pond.level, pond.z);
    this.mesh.userData.kind = 'water';
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    this.stream = this._stream(scene, pond);
    this.fall = this._fall(scene, pond);
  }

  _stream(scene, pond) {
    const g = new THREE.PlaneGeometry(2.2, 14, 6, 18);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getY(i);
      pos.setZ(i, Math.sin(z * 0.4) * 0.35);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.mat);
    m.position.set(pond.x - 6.5, pond.level + 0.35, pond.z - 8);
    m.rotation.y = 0.5;
    m.userData.kind = 'water';
    scene.add(m);
    return m;
  }

  _fall(scene, pond) {
    const g = new THREE.PlaneGeometry(1.6, 10, 4, 16);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        color: 0x7ec4c8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.15,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    m.position.set(pond.x + 7.5, pond.level - 3.2, pond.z + 6.8);
    m.rotation.y = 0.7;
    m.userData.kind = 'waterfall';
    scene.add(m);
    this.fallMat = m.material;
    return m;
  }

  update(dt, wind, sunDir, cam, sunColor, night) {
    this.mat.uniforms.uTime.value += dt;
    this.mat.uniforms.uWind.value.set(wind.x, wind.z);
    if (sunDir) this.mat.uniforms.uSunDir.value.copy(sunDir);
    if (cam) this.mat.uniforms.uCam.value.copy(cam);
    if (sunColor) this.mat.uniforms.uSunColor.value.copy(sunColor);
    if (night != null) this.mat.uniforms.uNight.value = night;
    if (this.fallMat) this.fallMat.opacity = 0.38 + Math.sin(this.mat.uniforms.uTime.value * 3.2) * 0.06;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
