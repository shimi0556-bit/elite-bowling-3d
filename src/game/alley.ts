import * as THREE from 'three';
import {
  APPROACH_Z0,
  BACK_Z,
  GUTTER_DROP,
  GUTTER_OUTER,
  HEAD_PIN_Z,
  LANE_HALF,
  LANE_WIDTH,
  PIT_Z,
} from './constants';
import {
  makeApproachTexture,
  makeHazardTexture,
  makeLaneTexture,
  makeOilTexture,
  makePanelTexture,
  woodMaterial,
} from './materials';

export interface Alley {
  root: THREE.Group;
  key: THREE.DirectionalLight;
  textures: THREE.Texture[];
  update(dt: number): void;
  dispose(): void;
}

export function buildAlley(): Alley {
  const root = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const disposables: { geo: THREE.BufferGeometry[]; mat: THREE.Material[] } = { geo: [], mat: [] };

  const trackG = <T extends THREE.BufferGeometry>(geo: T): T => {
    disposables.geo.push(geo);
    return geo;
  };
  const trackM = <T extends THREE.Material>(mat: T): T => {
    disposables.mat.push(mat);
    return mat;
  };
  const trackT = (texture: THREE.Texture): THREE.Texture => {
    textures.push(texture);
    return texture;
  };

  const laneMap = trackT(makeLaneTexture());
  const approachMap = trackT(makeApproachTexture());
  const oilMap = trackT(makeOilTexture());
  const panelMap = trackT(makePanelTexture());
  const hazardMap = trackT(makeHazardTexture());
  hazardMap.wrapS = THREE.RepeatWrapping;
  hazardMap.repeat.set(8, 1);

  const laneMat = trackM(woodMaterial(laneMap, 0.32, 0.72));
  const approachMat = trackM(woodMaterial(approachMap, 0.55, 0.28));
  laneMat.side = THREE.DoubleSide;
  approachMat.side = THREE.DoubleSide;
  const gutterMat = trackM(new THREE.MeshPhysicalMaterial({
    color: 0x1a1c22,
    metalness: 0.86,
    roughness: 0.28,
    clearcoat: 0.4,
    envMapIntensity: 0.8,
  }));
  const wallMat = trackM(new THREE.MeshStandardMaterial({
    map: panelMap,
    color: 0x3a2a1c,
    roughness: 0.78,
    metalness: 0.05,
  }));
  const darkMat = trackM(new THREE.MeshStandardMaterial({
    color: 0x101114,
    roughness: 0.7,
    metalness: 0.2,
  }));
  const metalMat = trackM(new THREE.MeshPhysicalMaterial({
    color: 0x2a2e36,
    metalness: 0.8,
    roughness: 0.32,
    clearcoat: 0.3,
  }));
  const kickMat = trackM(new THREE.MeshPhysicalMaterial({
    color: 0x141414,
    metalness: 0.15,
    roughness: 0.55,
    clearcoat: 0.2,
  }));
  const pitMat = trackM(new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: 0.92 }));
  const bulbMat = trackM(new THREE.MeshStandardMaterial({
    color: 0xfff4dc,
    emissive: 0xffe2b0,
    emissiveIntensity: 4.2,
    roughness: 0.25,
  }));
  const housingMat = trackM(new THREE.MeshStandardMaterial({
    color: 0x121418,
    metalness: 0.6,
    roughness: 0.4,
  }));
  const hazardMat = trackM(new THREE.MeshStandardMaterial({
    map: hazardMap,
    roughness: 0.55,
    metalness: 0.1,
  }));
  const oilMat = trackM(new THREE.MeshBasicMaterial({
    map: oilMap,
    color: 0xd7f1ff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }));

  const lane = new THREE.Mesh(trackG(deckGeo(LANE_WIDTH, 0, HEAD_PIN_Z + 1.02)), laneMat);
  lane.receiveShadow = true;
  root.add(lane);

  const approach = new THREE.Mesh(trackG(deckGeo(LANE_WIDTH + 0.4, APPROACH_Z0, 0)), approachMat);
  approach.receiveShadow = true;
  root.add(approach);

  const oil = new THREE.Mesh(
    trackG(deckGeo(0.78, 0.4, HEAD_PIN_Z * 0.78, 0.012)),
    oilMat,
  );
  root.add(oil);

  const foul = new THREE.Mesh(
    trackG(new THREE.BoxGeometry(LANE_WIDTH - 0.04, 0.006, 0.04)),
    trackM(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.45 })),
  );
  foul.position.set(0, 0.006, 0.03);
  foul.receiveShadow = true;
  root.add(foul);
  const foulRed = new THREE.Mesh(
    trackG(new THREE.BoxGeometry(LANE_WIDTH - 0.04, 0.005, 0.012)),
    trackM(new THREE.MeshStandardMaterial({ color: 0x9d1d28, roughness: 0.4, emissive: 0x3a0a10, emissiveIntensity: 0.4 })),
  );
  foulRed.position.set(0, 0.007, -0.012);
  root.add(foulRed);

  const capGeo = trackG(new THREE.SphereGeometry(0.055, 18, 12));
  const capMat = trackM(new THREE.MeshPhysicalMaterial({
    color: 0x141414,
    metalness: 0.45,
    roughness: 0.32,
    clearcoat: 0.7,
  }));
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.scale.y = 0.55;
    cap.position.set(side * LANE_HALF, 0.03, 0);
    cap.castShadow = true;
    root.add(cap);
  }

  for (const side of [-1, 1]) {
    const gutter = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(GUTTER_OUTER - LANE_HALF, 0.08, BACK_Z - APPROACH_Z0)),
      gutterMat,
    );
    gutter.position.set(side * ((LANE_HALF + GUTTER_OUTER) / 2), -GUTTER_DROP - 0.02, (BACK_Z + APPROACH_Z0) / 2);
    gutter.receiveShadow = true;
    root.add(gutter);

    const wall = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.12, 2.6, BACK_Z - APPROACH_Z0)),
      wallMat,
    );
    wall.position.set(side * 1.35, 1.3, (BACK_Z + APPROACH_Z0) / 2);
    wall.receiveShadow = true;
    root.add(wall);

    const rail = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.08, 0.06, HEAD_PIN_Z + 2)),
      metalMat,
    );
    rail.position.set(side * 1.18, 0.08, (HEAD_PIN_Z + 2) / 2);
    root.add(rail);

    const kick = new THREE.Mesh(
      trackG(new THREE.BoxGeometry(0.14, 0.58, 1.7)),
      kickMat,
    );
    kick.position.set(side * 0.62, 0.29, HEAD_PIN_Z + 0.45);
    kick.castShadow = true;
    kick.receiveShadow = true;
    root.add(kick);
  }

  const pit = new THREE.Mesh(trackG(new THREE.BoxGeometry(2.3, 0.2, BACK_Z - PIT_Z + 0.2)), pitMat);
  pit.position.set(0, -0.48, (PIT_Z + BACK_Z) / 2);
  pit.receiveShadow = true;
  root.add(pit);

  const setter = new THREE.Mesh(trackG(new THREE.BoxGeometry(1.7, 1.15, 0.7)), darkMat);
  setter.position.set(0, 1.35, HEAD_PIN_Z + 1.85);
  root.add(setter);
  const bar = new THREE.Mesh(trackG(new THREE.BoxGeometry(1.72, 0.08, 0.12)), hazardMat);
  bar.position.set(0, 0.72, HEAD_PIN_Z + 1.5);
  root.add(bar);

  const floor = new THREE.Mesh(
    trackG(new THREE.PlaneGeometry(28, 40)),
    trackM(new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 1 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.55, 8);
  root.add(floor);

  const ceiling = new THREE.Mesh(
    trackG(new THREE.PlaneGeometry(8, BACK_Z - APPROACH_Z0)),
    trackM(new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.9 })),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 3.8, (BACK_Z + APPROACH_Z0) / 2);
  root.add(ceiling);

  const housingGeo = trackG(new THREE.BoxGeometry(0.36, 0.08, 1.05));
  const bulbGeo = trackG(new THREE.BoxGeometry(0.16, 0.025, 0.78));
  for (const z of [0.6, 4.4, 8.2, 12, 15.6, HEAD_PIN_Z]) {
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.set(0, 3.45, z);
    root.add(housing);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(0, 3.4, z);
    root.add(bulb);
  }

  const hemi = new THREE.HemisphereLight(0xc5d4ee, 0x3a2614, 0.55);
  root.add(hemi);
  const ambient = new THREE.AmbientLight(0xfff1dd, 0.18);
  root.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e5, 2.6);
  key.position.set(1.4, 7.2, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -2.4;
  key.shadow.camera.right = 2.4;
  key.shadow.camera.top = 2.4;
  key.shadow.camera.bottom = -2.4;
  root.add(key);
  root.add(key.target);

  const pinSpot = new THREE.SpotLight(0xfff1d2, 28, 14, 0.55, 0.45, 1);
  pinSpot.position.set(0, 3.3, HEAD_PIN_Z - 0.4);
  pinSpot.target.position.set(0, 0.2, HEAD_PIN_Z + 0.3);
  root.add(pinSpot);
  root.add(pinSpot.target);

  const approachSpot = new THREE.SpotLight(0xffe6c4, 12, 10, 0.7, 0.5, 1);
  approachSpot.position.set(0, 3.2, -1.2);
  approachSpot.target.position.set(0, 0, 2);
  root.add(approachSpot);
  root.add(approachSpot.target);

  let oilPulse = 0;
  return {
    root,
    key,
    textures,
    update(dt: number) {
      oilPulse += dt;
      oilMat.opacity = 0.16 + Math.sin(oilPulse * 0.6) * 0.04;
    },
    dispose() {
      for (const geo of disposables.geo) geo.dispose();
      for (const mat of disposables.mat) mat.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

function deckGeo(width: number, z0: number, z1: number, y = 0): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -width / 2, y, z0,
    width / 2, y, z0,
    width / 2, y, z1,
    -width / 2, y, z1,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ], 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ], 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  return geo;
}
