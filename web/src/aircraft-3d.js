import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { createAircraftMeshSpec } from './aircraft-3d-spec.js';
import { aircraftModelAsset } from './aircraft-model-assets.js';
import {
  AIRCRAFT_MANUAL_HOLD_MS,
  aircraftControlPhase,
  aircraftFlightMotion,
  aircraftShotFrame,
  interpolateAircraftFrame,
} from './aircraft-shot-director.js';

const disposeTree = (object) => object.traverse((child) => {
  child.geometry?.dispose();
  if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
  else child.material?.dispose();
});

function wingGeometry(span, chord, sweep = .42) {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, -chord * sweep);
  shape.lineTo(-.25, chord / 2);
  shape.lineTo(.25, chord / 2);
  shape.lineTo(span / 2, -chord * sweep);
  shape.lineTo(span / 2, -chord * .72);
  shape.lineTo(.25, -chord / 2);
  shape.lineTo(-.25, -chord / 2);
  shape.lineTo(-span / 2, -chord * .72);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function verticalFinGeometry(length, height) {
  const shape = new THREE.Shape();
  shape.moveTo(-length / 2, 0);
  shape.lineTo(length * .4, 0);
  shape.lineTo(length * .15, height);
  shape.lineTo(-length * .18, height * .82);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

function createEngine(material, radius, length) {
  const group = new THREE.Group();
  const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, length, 24, 1, true), material);
  nacelle.rotation.x = Math.PI / 2;
  group.add(nacelle);
  const intakeMaterial = new THREE.MeshStandardMaterial({ color: 0x07120b, metalness: .85, roughness: .22 });
  const intake = new THREE.Mesh(new THREE.TorusGeometry(radius * .78, radius * .12, 8, 24), intakeMaterial);
  intake.position.z = -length / 2;
  group.add(intake);
  return group;
}

function createPropeller(radius) {
  const group = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.SphereGeometry(radius * .18, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd9ffe5, metalness: .65, roughness: .2 }));
  group.add(hub);
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0x18251c, metalness: .25, roughness: .45 });
  for (let index = 0; index < 4; index += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * .12, radius, .035), bladeMaterial);
    blade.position.y = radius * .42;
    blade.rotation.z = index * Math.PI / 2;
    group.add(blade);
  }
  return group;
}

function createAircraftMesh(profile) {
  const spec = createAircraftMeshSpec(profile);
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe9f5ec, metalness: .42, roughness: .24, clearcoat: .65, clearcoatRoughness: .18 });
  const wingMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb6c9bb, metalness: .5, roughness: .28, side: THREE.DoubleSide });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x24ef73, emissive: 0x063d18, emissiveIntensity: 1.3, metalness: .3, roughness: .3 });
  const radius = profile.family === 'b777' || profile.family === 'a330' || profile.family === 'a350' || profile.family === 'b787' ? .42 : .31;
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.5, spec.fuselageLength - radius * 2), 10, 24), bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  root.add(fuselage);

  const wing = new THREE.Mesh(wingGeometry(spec.wingspan, spec.wingChord, profile.family === 'b787' || profile.family === 'a350' ? .62 : .42), wingMaterial);
  wing.position.set(0, -.02, -.15);
  wing.castShadow = true;
  root.add(wing);

  const tail = new THREE.Mesh(wingGeometry(spec.wingspan * .34, spec.wingChord * .48, .22), wingMaterial);
  tail.position.set(0, .08, spec.fuselageLength * .35);
  root.add(tail);
  const fin = new THREE.Mesh(verticalFinGeometry(spec.fuselageLength * .22, radius * 2.65), accentMaterial);
  fin.position.set(0, radius * .45, spec.fuselageLength * .37);
  root.add(fin);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(radius * .7, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0x153229, metalness: .55, roughness: .1, transmission: .18 }));
  cockpit.scale.set(1, .58, .75);
  cockpit.position.set(0, radius * .34, -spec.fuselageLength * .43);
  root.add(cockpit);

  const engineRadius = radius * (spec.engineLayout === 'propeller' ? .65 : .72);
  const engineLength = radius * (spec.engineLayout === 'rear' ? 1.8 : 2.25);
  const engineX = spec.engineLayout === 'rear' ? radius * 1.28 : spec.wingspan * .24;
  const engineZ = spec.engineLayout === 'rear' ? spec.fuselageLength * .31 : -.08;
  for (const side of [-1, 1]) {
    const engine = createEngine(accentMaterial, engineRadius, engineLength);
    engine.position.set(engineX * side, -.22, engineZ);
    root.add(engine);
    if (spec.engineLayout === 'propeller') {
      const propeller = createPropeller(engineRadius * 2.35);
      propeller.position.set(engineX * side, -.22, engineZ - engineLength * .56);
      propeller.rotation.x = Math.PI / 2;
      root.add(propeller);
    }
  }

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.04, .035, spec.fuselageLength * .58), accentMaterial);
  stripe.position.set(0, radius * .55, .18);
  root.add(stripe);
  root.rotation.x = -.1;
  return root;
}

const fadeNoise = (value) => value * value * (3 - 2 * value);
const hashNoise = (x, z) => {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

function valueNoise(x, z) {
  const x0 = Math.floor(x); const z0 = Math.floor(z);
  const tx = fadeNoise(x - x0); const tz = fadeNoise(z - z0);
  const a = hashNoise(x0, z0); const b = hashNoise(x0 + 1, z0);
  const c = hashNoise(x0, z0 + 1); const d = hashNoise(x0 + 1, z0 + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function ridgedNoise(x, z, octaves = 5) {
  let amplitude = 1; let frequency = 1; let sum = 0; let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const ridge = 1 - Math.abs(valueNoise(x * frequency, z * frequency) * 2 - 1);
    sum += ridge * ridge * amplitude;
    weight += amplitude;
    amplitude *= .52;
    frequency *= 2.08;
  }
  return sum / weight;
}

export function localTerrainHeight(x, z) {
  const warpX = (valueNoise(x * .055 + 13.7, z * .055 - 8.4) - .5) * 7.5;
  const warpZ = (valueNoise(x * .055 - 4.1, z * .055 + 19.2) - .5) * 7.5;
  const mountain = ridgedNoise((x + warpX) * .105, (z + warpZ) * .12, 6);
  const escarpment = ridgedNoise((x - warpZ) * .23, (z + warpX) * .2, 4);
  const valley = valueNoise(x * .075 + 31, z * .075 - 17);
  return -9.4 + mountain * 8.4 + escarpment * 2.25 + valley * .7;
}

function localTerrainColor(x, z, height) {
  const step = .22;
  const dx = localTerrainHeight(x + step, z) - localTerrainHeight(x - step, z);
  const dz = localTerrainHeight(x, z + step) - localTerrainHeight(x, z - step);
  const slope = Math.hypot(dx, dz) / (step * 2);
  const grain = valueNoise(x * .72 + 44, z * .72 - 12);
  const snowLine = -2.45 + (valueNoise(x * .18, z * .18) - .5) * .7;
  if (height > snowLine && (slope < 1.65 || height > -.65)) {
    const shade = .68 + grain * .22;
    return [shade * .94, shade, shade * .96];
  }
  if (slope > 1.05 || height > -3.25) {
    const shade = .2 + grain * .2;
    return [shade * 1.02, shade * .95, shade * .83];
  }
  if (height > -5.4) {
    return [.13 + grain * .08, .18 + grain * .09, .12 + grain * .045];
  }
  return [.035 + grain * .035, .095 + grain * .065, .055 + grain * .035];
}

export function createLocalTerrainMesh() {
  const geometry = new THREE.PlaneGeometry(42, 34, 128, 104);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const height = localTerrainHeight(positions.getX(index), positions.getZ(index));
    positions.setY(index, height);
    color.setRGB(...localTerrainColor(positions.getX(index), positions.getZ(index), height));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, dithering: true });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.name = 'offline-terrain';
  return terrain;
}

export function modelFitScale(size) {
  const largest = Math.max(Number(size?.x) || 0, Number(size?.y) || 0, Number(size?.z) || 0, 1);
  return Math.round(7 / largest * 1e6) / 1e6;
}

export function modelCreditText(asset, state = 'procedural') {
  if (asset && state === 'loading') return `正在加载 ${asset.label} · 当前显示程序化后备模型`;
  if (asset && state !== 'procedural') return `${asset.label} · ${asset.license} · 可拖动查看`;
  return '程序化后备模型 · 可拖动查看';
}

export const DEFAULT_AIRCRAFT_ORIENTATION = Object.freeze({ yaw: -Math.PI / 4, pitch: Math.PI / 4 });

export function aircraftCameraPreset(width) {
  return Number(width) >= 700
    ? { fov: 36, position: [10.4, 5.8, 12.2] }
    : { fov: 29, position: [6.2, 3.4, 7.3] };
}

export function dragAircraftOrientation(orientation, deltaX, deltaY) {
  return {
    yaw: orientation.yaw + deltaX * .012,
    pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, orientation.pitch + deltaY * .008)),
  };
}

function normalizeExternalModel(scene) {
  const root = new THREE.Group();
  root.add(scene);
  scene.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  scene.position.sub(center);
  root.scale.setScalar(modelFitScale(size));
  root.rotation.x = -.04;
  return root;
}

export class Aircraft3DViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.loader = new GLTFLoader();
    this.loadVersion = 0;
    this.camera = new THREE.PerspectiveCamera(29, 1, .1, 100);
    this.camera.position.set(6.2, 3.4, 7.3);
    this.cameraTarget = new THREE.Vector3(0, -.15, 0);
    this.camera.lookAt(this.cameraTarget);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.scene.add(new THREE.HemisphereLight(0xcfffe0, 0x061008, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 5.2); key.position.set(-5, 8, 5); key.castShadow = true; this.scene.add(key);
    const rim = new THREE.PointLight(0x35ff82, 18, 18); rim.position.set(5, 2, -4); this.scene.add(rim);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x35ff82, transparent: true, opacity: .28, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.13, 80), ringMaterial); ring.rotation.x = -Math.PI / 2; ring.position.y = -1.45; this.scene.add(ring);
    const grid = new THREE.GridHelper(10, 20, 0x1f8a45, 0x103a20); grid.position.y = -1.47; grid.material.transparent = true; grid.material.opacity = .2; this.scene.add(grid);
    this.instrumentHelpers = [ring, grid];
    this.localTerrain = createLocalTerrainMesh();
    this.scene.add(this.localTerrain);
    this.terrainMode = 'local3d';
    this.userYaw = DEFAULT_AIRCRAFT_ORIENTATION.yaw;
    this.userPitch = DEFAULT_AIRCRAFT_ORIENTATION.pitch;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shotCycleStart = performance.now();
    this.manualUntil = 0;
    this.resumeStart = null;
    this.resumeFrom = null;
    this.shotChangeHandler = null;
    this.presentationShot = null;
    this.installPointerControls();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.resize(); void this.setAircraft({ family: 'generic', length: 1, span: 1 });
    this.animate = this.animate.bind(this); this.frame = requestAnimationFrame(this.animate);
  }

  installPointerControls() {
    let drag = null;
    this.canvas.addEventListener('pointerdown', (event) => {
      drag = { x: event.clientX, y: event.clientY };
      this.manualUntil = Infinity;
      this.resumeStart = null;
      this.resumeFrom = null;
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const orientation = dragAircraftOrientation(
        { yaw: this.userYaw, pitch: this.userPitch },
        event.clientX - drag.x,
        event.clientY - drag.y,
      );
      this.userYaw = orientation.yaw;
      this.userPitch = orientation.pitch;
      drag = { x: event.clientX, y: event.clientY };
    });
    const finish = () => {
      if (drag) this.manualUntil = performance.now() + AIRCRAFT_MANUAL_HOLD_MS;
      drag = null;
    };
    this.canvas.addEventListener('pointerup', finish); this.canvas.addEventListener('pointercancel', finish);
  }

  startShotCycle(time = performance.now()) {
    this.shotCycleStart = time;
    this.manualUntil = 0;
    this.resumeStart = null;
    this.resumeFrom = null;
    this.presentationShot = null;
  }

  setShotChangeHandler(handler) {
    this.shotChangeHandler = typeof handler === 'function' ? handler : null;
  }

  setTerrainMode(mode) {
    this.terrainMode = ['local3d', 'open3d', 'flat2d'].includes(mode) ? mode : 'local3d';
    this.localTerrain.visible = this.terrainMode === 'local3d';
    this.canvas.dataset.terrainMode = this.terrainMode;
    this.instrumentHelpers.forEach((helper) => { helper.visible = this.terrainMode !== 'local3d' && this.presentationShot !== 'overhead'; });
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth); const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  captureCameraFrame() {
    return {
      fromId: 'manual',
      toId: 'manual',
      mix: 0,
      cameraPosition: this.camera.position.toArray(),
      target: this.cameraTarget.toArray(),
      stageOffset: this.pivot.position.toArray(),
      fov: this.camera.fov,
      pitch: this.userPitch,
      yaw: this.userYaw,
    };
  }

  applyCameraFrame(frame, motion, motionScale = 1) {
    const presentationShot = frame.mix > .55 ? frame.toId : frame.fromId;
    if (presentationShot !== this.presentationShot) {
      this.presentationShot = presentationShot;
      this.instrumentHelpers.forEach((helper) => { helper.visible = this.terrainMode !== 'local3d' && presentationShot !== 'overhead'; });
      this.shotChangeHandler?.(presentationShot);
    }
    this.camera.position.set(...frame.cameraPosition);
    this.camera.fov = frame.fov;
    this.camera.updateProjectionMatrix();
    this.cameraTarget.set(...frame.target);
    this.camera.lookAt(
      this.cameraTarget.x + motion.sway * motionScale * .25,
      this.cameraTarget.y + motion.lift * motionScale * .25,
      this.cameraTarget.z + motion.surge * motionScale * .25,
    );
    this.userPitch = frame.pitch;
    this.userYaw = frame.yaw;
    this.pivot.position.set(
      frame.stageOffset[0] + motion.sway * motionScale,
      frame.stageOffset[1] + motion.lift * motionScale,
      frame.stageOffset[2] + (motion.forward + motion.surge) * motionScale,
    );
    this.pivot.rotation.set(
      frame.pitch + motion.pitch * motionScale,
      frame.yaw,
      motion.roll * motionScale,
    );
  }

  replaceAircraft(aircraft) {
    if (this.aircraft) { this.pivot.remove(this.aircraft); disposeTree(this.aircraft); }
    this.aircraft = aircraft;
    this.pivot.add(this.aircraft);
    this.applyTelemetry();
  }

  async setAircraft(profile, type = '') {
    const loadVersion = ++this.loadVersion;
    this.replaceAircraft(createAircraftMesh(profile));
    this.canvas.dataset.modelSource = 'procedural';
    this.canvas.dataset.modelProvider = 'procedural';
    this.canvas.dataset.modelLicense = '';
    const modelAsset = aircraftModelAsset(type);
    if (!modelAsset) return 'procedural';
    try {
      const gltf = await this.loader.loadAsync(`/api/aircraft/model?type=${encodeURIComponent(type)}`);
      if (loadVersion !== this.loadVersion) {
        disposeTree(gltf.scene);
        return null;
      }
      this.replaceAircraft(normalizeExternalModel(gltf.scene));
      this.canvas.dataset.modelSource = 'external';
      this.canvas.dataset.modelProvider = modelAsset.provider;
      this.canvas.dataset.modelLicense = modelAsset.license;
      return modelAsset.provider;
    } catch {
      return 'procedural';
    }
  }

  setTelemetry(plane = {}) {
    this.telemetry = plane;
    this.applyTelemetry();
  }

  applyTelemetry() {
    if (!this.aircraft) return;
    const plane = this.telemetry || {};
    const verticalRate = Number(plane.verticalRateFpm) || 0;
    this.aircraft.rotation.x = -.1 + Math.max(-.12, Math.min(.12, verticalRate / 18000));
    this.aircraft.rotation.z = Math.max(-.1, Math.min(.1, verticalRate / 24000));
  }

  animate(time) {
    if (!document.hidden) {
      if (this.manualUntil !== Infinity && this.manualUntil > 0 && time >= this.manualUntil && this.resumeStart == null) {
        this.resumeStart = time;
        this.resumeFrom = this.captureCameraFrame();
        this.shotCycleStart = time;
        this.manualUntil = 0;
      }
      const motion = aircraftFlightMotion(time - this.shotCycleStart, this.telemetry);
      const motionScale = this.reducedMotion ? .2 : 1;
      const phase = aircraftControlPhase({ now: time, manualUntil: this.manualUntil, resumeStart: this.resumeStart });
      if (phase.mode === 'manual') {
        this.pivot.position.set(motion.sway * motionScale, motion.lift * motionScale, (motion.forward + motion.surge) * motionScale);
        this.pivot.rotation.set(
          this.userPitch + motion.pitch * motionScale,
          this.userYaw,
          motion.roll * motionScale,
        );
      } else {
        const directed = aircraftShotFrame(time - this.shotCycleStart, { reducedMotion: this.reducedMotion });
        const frame = phase.mode === 'resume' && this.resumeFrom
          ? interpolateAircraftFrame(this.resumeFrom, directed, phase.progress)
          : directed;
        this.applyCameraFrame(frame, motion, motionScale);
        if (phase.mode === 'auto' && this.resumeStart != null) {
          this.resumeStart = null;
          this.resumeFrom = null;
        }
      }
      this.renderer.render(this.scene, this.camera);
    }
    this.frame = requestAnimationFrame(this.animate);
  }
}
