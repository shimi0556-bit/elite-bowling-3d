import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Soundscape } from '../audio/audio';
import type { Hud } from '../ui/hud';
import { copy, storageGet, storageSet } from '../ui/i18n';
import { buildAlley, type Alley } from './alley';
import { BallView } from './ball';
import { CameraRig } from './cameraRig';
import { BALL_RADIUS, BALL_START_Z, HEAD_PIN_Z } from './constants';
import { AimGuide, ImpactFx } from './effects';
import { AimInput } from './input';
import { tuneAnisotropy } from './materials';
import { BowlingPhysics, type RackSnapshot } from './physics';
import { PinRack } from './pins';
import { gradeKey, isFrameComplete, needsFreshRack, scoreGame } from './scoring';
import { integrateShot } from './shot';

type Phase = 'boot' | 'help' | 'aim' | 'roll' | 'celebrate' | 'clear' | 'over';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 1.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float vig = smoothstep(0.95, 0.28, length((vUv - 0.5) * vec2(1.15, 1.05)));
      color.rgb = mix(color.rgb * 0.32 * darkness, color.rgb, vig);
      gl_FragColor = color;
    }
  `,
};

export class Game {
  private readonly physics = new BowlingPhysics();
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly alley: Alley;
  private readonly pins = new PinRack();
  private readonly ball = new BallView();
  private readonly fx: ImpactFx;
  private readonly guide: AimGuide;
  private readonly input: AimInput;
  private env: THREE.Texture | null = null;
  private frames: number[][] = blankFrames();
  private frame = 0;
  private phase: Phase = 'boot';
  private phaseBeforeHelp: Phase = 'aim';
  private timer = 0;
  private pending: 'rack' | 'sweep' | 'over' = 'sweep';
  private replaying = false;
  private checkpoint: RackSnapshot | null = null;
  private skin = storageGet('elite-bowling-skin') ?? 'crimson';
  private raf = 0;
  private last = 0;
  private fpsTime = 0;
  private fpsFrames = 0;
  private qualityDropped = false;
  private qualityLevel = 0;
  private pixelRatio: number;
  private alive = true;

  constructor(
    private readonly hud: Hud,
    private readonly audio: Soundscape,
  ) {
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6);
    this.rig = new CameraRig(window.innerWidth / Math.max(1, window.innerHeight));
    this.rig.portrait = window.innerHeight > window.innerWidth;
    this.rig.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas: hud.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x070910, 1);

    this.scene.background = new THREE.Color(0x070910);
    this.scene.fog = new THREE.Fog(0x070910, 24, 52);
    this.alley = buildAlley();
    if (mobile) this.alley.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.alley.root);
    this.scene.add(this.pins.group);
    this.scene.add(this.ball.group);
    this.fx = new ImpactFx();
    this.guide = new AimGuide();
    this.scene.add(this.fx.points);
    this.scene.add(this.fx.flash);
    this.scene.add(this.guide.points);
    this.scene.add(this.guide.ring);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.62;
    room.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    pmrem.dispose();
    tuneAnisotropy(this.renderer, this.alley.textures);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.36, 0.9);
    this.bloom.enabled = !mobile;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(VignetteShader));
    this.composer.addPass(new OutputPass());

    this.input = new AimInput(hud.canvas);
    this.ball.setSkin(this.skin);
    this.hud.setSkin(this.skin);
    this.hud.setMuted(this.audio.muted);
    this.hud.setLang(this.hud.lang);
    this.hud.setHandler((action) => this.onAction(action));
    this.onResize();
  }

  async start(): Promise<void> {
    this.input.attach();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onGlobalKey);
    try {
      await this.physics.init();
    } catch (error) {
      console.error(error);
      this.hud.showError();
      return;
    }
    if (!this.alive) return;
    this.physics.resetRack();
    this.pins.resetDropIn();
    this.physics.address(0);
    this.hud.setScore(scoreGame(this.frames), 0);
    this.hud.setReplayEnabled(false);
    const seen = storageGet('elite-bowling-help') === '1';
    if (seen) {
      this.phase = 'aim';
      this.hud.hideOverlay();
    } else {
      this.phase = 'help';
      this.hud.showHelp();
    }
    this.syncInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frameLoop);
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onGlobalKey);
    this.input.detach();
    this.audio.dispose();
    this.pins.dispose();
    this.ball.dispose();
    this.fx.dispose();
    this.guide.dispose();
    this.alley.dispose();
    this.env?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.physics.destroy();
  }

  private readonly onResize = (): void => {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    this.rig.portrait = height > width;
    this.rig.camera.aspect = width / height;
    this.rig.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
  };

  private readonly onGlobalKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
    const key = event.key.toLowerCase();
    if (key === 'm') this.onAction('mute');
    if (key === 'h') this.onAction(this.phase === 'help' ? 'close-help' : 'help');
    if (key === 'n') this.onAction('new');
    if (key === 'r') this.onAction('replay');
    if (key === 'l') this.onAction('lang');
    if (key === 'escape' && this.phase === 'help') this.onAction('close-help');
  };

  private readonly frameLoop = (now: number): void => {
    if (!this.alive) return;
    const wall = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(wall);
    if (this.qualityDropped) this.renderer.render(this.scene, this.rig.camera);
    else this.composer.render();
    this.watchFps(wall);
    this.raf = requestAnimationFrame(this.frameLoop);
  };

  private update(dt: number): void {
    this.input.update(dt);
    if (this.phase === 'aim') {
      const shot = this.input.takeShot();
      if (shot) this.beginRoll(shot, false);
      else this.physics.address(this.input.ballX);
    }

    this.physics.step(dt);
    this.pins.sync(this.physics, dt);
    if (this.phase !== 'clear') this.ball.sync(this.physics.ballPose);
    const returned = this.ball.update(dt);
    this.alley.update(dt);
    this.fx.update(dt);
    this.guide.update(dt);

    if (this.phase === 'roll') this.updateRoll();
    else if (this.phase === 'celebrate') this.updateCelebrate(dt);
    else if (this.phase === 'clear') this.updateClear(dt, returned);

    if (this.phase === 'aim' || this.phase === 'help') {
      this.guide.setPath(
        integrateShot({
          x: this.input.ballX,
          aim: this.input.aim,
          power: this.input.power > 0.05 ? this.input.power : 0.72,
          hook: this.input.hook,
        }),
        this.phase === 'aim',
      );
    } else {
      this.guide.setPath([], false);
    }

    this.hud.setMeters(this.input.power, this.input.hook);
    this.hud.setReplayEnabled(this.physics.lastShot !== null && (this.phase === 'aim' || this.phase === 'over'));
    this.rig.update(dt, this.ball.group.position, this.input.ballX, this.alley.key);
    if (this.phase === 'roll') this.audio.setRolling(this.physics.ballSpeed());
  }

  private beginRoll(shot: { x: number; aim: number; power: number; hook: number }, replay: boolean): void {
    this.audio.resume();
    this.audio.whoosh();
    this.replaying = replay;
    this.physics.launch(shot);
    this.phase = 'roll';
    this.rig.setMode('follow');
    this.hud.setHint('rollHint');
    this.syncInput();
  }

  private updateRoll(): void {
    for (const hit of this.physics.consumeImpacts()) {
      this.fx.burst(hit.x, hit.y, hit.z, hit.mag);
      this.audio.pin(hit.mag);
      if (hit.ball && hit.mag > 140) this.rig.punch(Math.min(0.05, hit.mag / 5000));
    }
    if (this.physics.hitPin || this.physics.ballPose.z > HEAD_PIN_Z - 6) this.rig.setMode('pins');
    if (this.physics.settled) this.finishRoll();
  }

  private finishRoll(): void {
    this.audio.stopRoll();
    if (this.replaying) {
      this.replaying = false;
      if (this.checkpoint) this.physics.restore(this.checkpoint);
      this.physics.address(this.input.ballX);
      const over = scoreGame(this.frames).gameOver;
      this.phase = over ? 'over' : 'aim';
      this.rig.setMode(over ? 'pins' : 'aim');
      this.hud.setHint(over ? 'overHint' : 'aimHint');
      this.syncInput();
      return;
    }

    let knocked = 0;
    let strike = false;
    let spare = false;
    const wasGutter = this.physics.gutterEarly;
    if (wasGutter && this.physics.preLaunch) {
      this.physics.restore(this.physics.preLaunch);
    } else {
      const before = this.physics.standing.filter(Boolean).length;
      const result = this.physics.consumeKnocked();
      knocked = result.knocked;
      strike = result.cleared && before >= 10;
      spare = result.cleared && before > 0 && before < 10;
    }

    const rolls = this.frames[this.frame] ?? (this.frames[this.frame] = []);
    rolls.push(knocked);
    const over = isFrameComplete(this.frame, rolls) && this.frame === 9;
    if (isFrameComplete(this.frame, rolls) && this.frame < 9) {
      this.frame += 1;
      this.pending = 'rack';
    } else if (over) {
      this.pending = 'over';
    } else if (needsFreshRack(this.frame, rolls)) {
      this.pending = 'rack';
    } else {
      this.pending = 'sweep';
    }

    this.hud.setScore(scoreGame(this.frames), this.frame);
    if (strike) {
      this.audio.strike();
      this.hud.toastMark('strike');
      this.rig.punch(0.08);
    } else if (spare) {
      this.audio.spare();
      this.hud.toastMark('spare');
      this.rig.punch(0.035);
    } else if (wasGutter) {
      this.audio.gutter();
      this.hud.toastMark('gutter');
    }

    if (this.pending === 'over') this.physics.freezeAll();
    else this.physics.freezeStanding();

    this.phase = 'celebrate';
    this.timer = strike ? 1.15 : spare ? 0.85 : 0.6;
    this.syncInput();
  }

  private updateCelebrate(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.pending === 'over') {
      this.phase = 'over';
      this.rig.setMode('pins');
      const view = scoreGame(this.frames);
      const grade = copy[gradeKey(view.total)];
      this.hud.showGameOver(view.total, grade.he, grade.en);
      this.hud.setHint('overHint');
      this.syncInput();
      return;
    }
    if (this.pending === 'rack') {
      this.physics.resetRack();
      this.pins.resetDropIn();
    } else {
      this.pins.dropFallen(this.physics.standing);
      this.physics.sweepFallen();
      this.physics.freezeStanding();
    }
    this.ball.startReturn(new THREE.Vector3(this.input.ballX, BALL_RADIUS + 0.004, BALL_START_Z));
    this.phase = 'clear';
    this.timer = 0.75;
    this.rig.setMode('aim');
    this.hud.setHint('clearHint');
  }

  private updateClear(dt: number, returned: boolean): void {
    this.timer -= dt;
    if (this.timer > 0 && !returned) return;
    this.physics.address(this.input.ballX);
    this.phase = 'aim';
    this.hud.setHint('aimHint');
    this.syncInput();
  }

  private onAction(action: string): void {
    this.audio.resume();
    if (action === 'mute') {
      const muted = this.audio.toggleMute();
      this.hud.setMuted(muted);
      this.audio.click();
      return;
    }
    if (action === 'lang') {
      this.hud.toggleLang();
      this.audio.click();
      return;
    }
    if (action === 'help') {
      if (this.phase === 'roll' || this.phase === 'boot') return;
      this.phaseBeforeHelp = this.phase;
      this.phase = 'help';
      this.syncInput();
      this.hud.showHelp();
      this.audio.click();
      return;
    }
    if (action === 'start' || action === 'close-help') {
      storageSet('elite-bowling-help', '1');
      this.audio.click();
      const back = this.phaseBeforeHelp;
      if (back === 'over' || scoreGame(this.frames).gameOver) {
        this.phase = 'over';
        const view = scoreGame(this.frames);
        const grade = copy[gradeKey(view.total)];
        this.hud.showGameOver(view.total, grade.he, grade.en);
      } else {
        this.phase = back === 'clear' || back === 'celebrate' || back === 'roll' ? back : 'aim';
        this.hud.hideOverlay();
        if (this.phase === 'aim') this.hud.setHint('aimHint');
      }
      this.syncInput();
      return;
    }
    if (action === 'new') {
      this.audio.click();
      this.newGame();
      return;
    }
    if (action === 'replay') {
      this.replay();
      return;
    }
    if (action.startsWith('skin:')) {
      this.skin = action.slice(5);
      this.ball.setSkin(this.skin);
      this.hud.setSkin(this.skin);
      this.audio.click();
    }
  }

  private newGame(): void {
    this.frames = blankFrames();
    this.frame = 0;
    this.replaying = false;
    this.checkpoint = null;
    this.physics.lastShot = null;
    this.physics.preLaunch = null;
    this.physics.resetRack();
    this.pins.resetDropIn();
    this.input.reset();
    this.physics.address(0);
    this.hud.setScore(scoreGame(this.frames), 0);
    this.hud.setReplayEnabled(false);
    this.hud.hideOverlay();
    this.hud.setHint('aimHint');
    this.phase = 'aim';
    this.rig.setMode('aim');
    this.syncInput();
  }

  private replay(): void {
    const shot = this.physics.lastShot;
    const pre = this.physics.preLaunch;
    if (!shot || !pre) return;
    if (this.phase === 'roll' || this.phase === 'celebrate' || this.phase === 'clear') return;
    this.audio.click();
    this.checkpoint = this.physics.capture();
    this.physics.restore(pre);
    this.hud.hideOverlay();
    this.beginRoll(shot, true);
  }

  private syncInput(): void {
    this.input.setEnabled(this.phase === 'aim');
  }

  private watchFps(wall: number): void {
    if (this.qualityLevel >= 2 || this.phase === 'boot') return;
    this.fpsTime += wall;
    this.fpsFrames += 1;
    if (this.fpsTime < 1.2) return;
    const fps = this.fpsFrames / this.fpsTime;
    if (this.qualityLevel === 0 && fps < 50) this.dropQuality(1);
    else if (this.qualityLevel === 1 && fps < 28) this.dropQuality(2);
    this.fpsTime = 0;
    this.fpsFrames = 0;
  }

  private dropQuality(level: number): void {
    this.qualityLevel = level;
    this.qualityDropped = true;
    this.pixelRatio = level >= 2 ? 0.85 : 1;
    this.bloom.enabled = false;
    if (level >= 2) {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.alley.key.shadow.mapSize.set(1024, 1024);
      this.alley.key.shadow.map?.dispose();
      this.alley.key.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.onResize();
  }

  /** Dev-only readout so a playtest can see whether a roll is still live. */
  debugState(): {
    phase: Phase;
    x: number;
    y: number;
    z: number;
    meshZ: number;
    camZ: number;
    speed: number;
    settled: boolean;
    gutter: boolean;
    hitPin: boolean;
  } {
    return {
      phase: this.phase,
      x: this.physics.ballPose.x,
      y: this.physics.ballPose.y,
      z: this.physics.ballPose.z,
      meshZ: this.ball.group.position.z,
      camZ: this.rig.camera.position.z,
      speed: this.physics.ballSpeed(),
      settled: this.physics.settled,
      gutter: this.physics.gutterEarly,
      hitPin: this.physics.hitPin,
    };
  }
}

function blankFrames(): number[][] {
  return Array.from({ length: 10 }, () => []);
}
