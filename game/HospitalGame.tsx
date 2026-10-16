import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HospitalMapBuilder, HospitalMapData } from './hospitalMap';
import { horrorAudio } from '../audio/horrorAudio';

export interface GameStateCallbacks {
  onCollectRecord: (
    id: string,
    name: string,
    count: number,
    total: number
  ) => void;

  onInteractPrompt: (promptText: string | null) => void;
  onVictory: () => void;
  onGameOver: () => void;
  onBatteryChange: (percent: number) => void;
  onSanityChange: (percent: number) => void;
}

type MonsterState = 'patrol' | 'investigate' | 'chase';

export class HospitalGame {
  private container: HTMLElement;
  private callbacks: GameStateCallbacks;

  // THREE.JS
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mapData!: HospitalMapData;

  // FLASHLIGHT
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private isFlashlightOn = true;
  private batteryLevel = 100;

  private flashlightLagPos = new THREE.Vector3();
  private flashlightLagDir = new THREE.Vector3();

  // PLAYER
  private playerPos = new THREE.Vector3();
  private playerVel = new THREE.Vector3();

  private cameraPitch = 0;
  private cameraYaw = Math.PI;

  private isSprinting = false;
  private bobTimer = 0;
  private lastStepCycle = 0;
  private playerRadius = 0.38;

  // INPUT
  private keys: Record<string, boolean> = {};

  private joystickVec = {
    x: 0,
    y: 0,
  };

  private isPointerLocked = false;

  // OBJECTIVES
  private collectedRecords = new Set<string>();
  private totalRecords = 4;

  private isGameActive = false;
  private isVictory = false;
  private isGameOver = false;

  // INTERACTION
  private raycaster = new THREE.Raycaster();

  private currentInteractable: THREE.Object3D | null = null;
  private lastInteractPrompt: string | null = null;

  // MONSTER
  private monster!: THREE.Group;

  private monsterBody!: THREE.Mesh;
  private monsterHead!: THREE.Mesh;

  private monsterLeftArm!: THREE.Mesh;
  private monsterRightArm!: THREE.Mesh;

  private monsterLeftLeg!: THREE.Mesh;
  private monsterRightLeg!: THREE.Mesh;

  private monsterState: MonsterState = 'patrol';

  private monsterWaypoints: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, -16),
    new THREE.Vector3(0, 0, -8),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 8),
    new THREE.Vector3(0, 0, 14),
  ];

  private monsterWaypointIndex = 0;

  private monsterInvestigateTimer = 0;
  private monsterInvestigateTarget = new THREE.Vector3();

  private monsterMoveSpeed = 1.35;
  private monsterChaseSpeed = 3.4;

  private monsterDetectionRange = 13;
  private monsterHearingRange = 11;

  private monsterRaycaster = new THREE.Raycaster();

  private monsterForward = new THREE.Vector3();
  private monsterToPlayer = new THREE.Vector3();
  private monsterTargetPosition = new THREE.Vector3();

  private monsterCollisionSphere = new THREE.Sphere();

  // MONSTER ANIMATION
  private monsterAnimationTime = 0;
  private monsterStepTimer = 0;
  private monsterBreathingTimer = 0;
  private monsterGrowlTimer = 0;

  private monsterPreviousPosition = new THREE.Vector3();
  private monsterIsMoving = false;

  private previousMonsterState: MonsterState = 'patrol';

  // SANITY / TENSION
  private panicLevel = 0.2;
  private sanityLevel = 100;

  // CLOCK
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;

  // REUSABLE VECTORS
  private _forward = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _moveDir = new THREE.Vector3();

  private _playerSphere = new THREE.Sphere();

  // =====================================================
  // CONSTRUCTOR
  // =====================================================

  constructor(
    container: HTMLElement,
    callbacks: GameStateCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();

    this.scene.background = new THREE.Color(0x040605);

    this.scene.fog = new THREE.FogExp2(
      0x040605,
      0.075
    );

    const aspect =
      container.clientWidth /
      Math.max(1, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(
      72,
      aspect,
      0.1,
      60
    );

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
      );

    const isHeadless =
      navigator.webdriver ||
      /HeadlessChrome/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: 'high-performance',
      stencil: false,
    });

    this.renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    this.renderer.setPixelRatio(
      isHeadless
        ? 1
        : Math.min(window.devicePixelRatio, 1.25)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    this.renderer.toneMappingExposure = 1.05;

    container.appendChild(this.renderer.domElement);

    // ENVIRONMENT
    const pmrem = new THREE.PMREMGenerator(
      this.renderer
    );

    const environment = new RoomEnvironment();

    this.scene.environment = pmrem.fromScene(
      environment,
      0.04
    ).texture;

    pmrem.dispose();

    // DARK AMBIENT LIGHT
    this.scene.add(
      new THREE.HemisphereLight(
        0x17221b,
        0x050706,
        0.35
      )
    );

    // MAP
    const mapBuilder = new HospitalMapBuilder();

    this.mapData = mapBuilder.build();

    this.scene.add(this.mapData.rootGroup);

    // PLAYER START
    this.playerPos.copy(
      this.mapData.startPosition
    );

    this.camera.position.copy(this.playerPos);

    // SETUP SYSTEMS
    this.setupFlashlight();
    this.setupMonster();
    this.setupEventListeners();

    this.onWindowResize();

    this.clock.start();

    this.tick();
  }

  // =====================================================
  // FLASHLIGHT
  // =====================================================

  private setupFlashlight() {
    this.flashlight = new THREE.SpotLight(
      0xfff5d8,
      4.5,
      22,
      Math.PI / 6.5,
      0.45,
      1.8
    );

    this.flashlightTarget = new THREE.Object3D();

    this.scene.add(this.flashlightTarget);

    this.flashlight.target =
      this.flashlightTarget;

    this.scene.add(this.flashlight);

    this.flashlightLagPos.copy(this.playerPos);

    this.flashlightLagDir.set(0, 0, -1);
  }

  public toggleFlashlight() {
    if (
      this.batteryLevel <= 0 ||
      this.isVictory ||
      this.isGameOver
    ) {
      return;
    }

    this.isFlashlightOn = !this.isFlashlightOn;

    this.flashlight.intensity =
      this.isFlashlightOn ? 4.5 : 0;

    horrorAudio.playFlashlightClick(
      this.isFlashlightOn
    );
  }

  private updateFlashlight(dt: number) {
    this.flashlightLagPos.lerp(
      this.camera.position,
      Math.min(1, dt * 18)
    );

    this.flashlight.position.copy(
      this.flashlightLagPos
    );

    this._right
      .set(
        Math.cos(this.cameraYaw),
        0,
        -Math.sin(this.cameraYaw)
      )
      .normalize();

    this.flashlight.position.addScaledVector(
      this._right,
      0.18
    );

    this.flashlight.position.y -= 0.12;

    this.camera.getWorldDirection(
      this._forward
    );

    this.flashlightLagDir.lerp(
      this._forward,
      Math.min(1, dt * 14)
    );

    this.flashlightTarget.position
      .copy(this.flashlight.position)
      .addScaledVector(
        this.flashlightLagDir,
        10
      );

    if (
      this.isFlashlightOn &&
      this.batteryLevel > 0
    ) {
      if (
        this.batteryLevel < 25 &&
        Math.random() < 0.07
      ) {
        this.flashlight.intensity =
          Math.random() * 2.2;
      } else {
        this.flashlight.intensity = 4.5;
      }
    } else {
      this.flashlight.intensity = 0;
    }
  }

  // =====================================================
  // MONSTER CREATION
  // =====================================================

  private setupMonster() {
    this.monster = new THREE.Group();

    this.monster.name = 'HospitalMonster';

    // DARK SKIN
    const skin = new THREE.MeshStandardMaterial({
      color: 0x101211,
      roughness: 1,
      metalness: 0,
    });

    const headMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x090b0a,
        roughness: 0.95,
      });

    // RED GLOWING EYES
    const eyes = new THREE.MeshStandardMaterial({
      color: 0xff0808,
      emissive: 0xff0000,
      emissiveIntensity: 3,
    });

    // BODY
    this.monsterBody = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.28,
        0.39,
        1.25,
        8
      ),
      skin
    );

    this.monsterBody.position.y = 1.05;

    this.monster.add(this.monsterBody);

    // HEAD
    this.monsterHead = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.34,
        10,
        8
      ),
      headMaterial
    );

    this.monsterHead.position.set(
      0,
      1.85,
      -0.02
    );

    this.monster.add(this.monsterHead);

    // JAW
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.22,
        0.16,
        0.18
      ),
      new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 1,
      })
    );

    jaw.position.set(
      0,
      1.66,
      -0.25
    );

    this.monster.add(jaw);

    // EYES
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.055,
          8,
          8
        ),
        eyes
      );

      eye.position.set(
        x,
        1.9,
        -0.29
      );

      this.monster.add(eye);
    }

    // EYE LIGHT
    const eyeLight = new THREE.PointLight(
      0xff0000,
      0.7,
      2.5
    );

    eyeLight.position.set(
      0,
      1.9,
      -0.35
    );

    this.monster.add(eyeLight);

    // LONG ARMS
    this.monsterLeftArm = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.075,
        0.09,
        0.9,
        6
      ),
      skin
    );

    this.monsterLeftArm.position.set(
      -0.38,
      0.95,
      -0.02
    );

    this.monsterLeftArm.rotation.z = -0.18;

    this.monster.add(
      this.monsterLeftArm
    );

    this.monsterRightArm = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.075,
        0.09,
        0.9,
        6
      ),
      skin
    );

    this.monsterRightArm.position.set(
      0.38,
      0.95,
      -0.02
    );

    this.monsterRightArm.rotation.z = 0.18;

    this.monster.add(
      this.monsterRightArm
    );

    // LEGS
    this.monsterLeftLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.09,
        0.12,
        0.7,
        6
      ),
      skin
    );

    this.monsterLeftLeg.position.set(
      -0.17,
      0.35,
      0
    );

    this.monster.add(
      this.monsterLeftLeg
    );

    this.monsterRightLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.09,
        0.12,
        0.7,
        6
      ),
      skin
    );

    this.monsterRightLeg.position.set(
      0.17,
      0.35,
      0
    );

    this.monster.add(
      this.monsterRightLeg
    );

    // INITIAL POSITION
    this.monster.position.copy(
      this.monsterWaypoints[0]
    );

    this.monsterPreviousPosition.copy(
      this.monster.position
    );

    this.monster.visible = false;

    this.scene.add(this.monster);
  }

  // =====================================================
  // MONSTER VISION
  // =====================================================

  private canMonsterSeePlayer(): boolean {
    this.monsterToPlayer.subVectors(
      this.playerPos,
      this.monster.position
    );

    const distance =
      this.monsterToPlayer.length();

    if (
      distance > this.monsterDetectionRange ||
      distance < 0.01
    ) {
      return false;
    }

    this.monsterForward
      .set(0, 0, -1)
      .applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.monster.rotation.y
      )
      .normalize();

    const direction =
      this.monsterToPlayer.clone().normalize();

    // FIELD OF VIEW
    if (
      this.monsterForward.dot(direction) < 0.05
    ) {
      return false;
    }

    // LINE OF SIGHT
    const origin =
      this.monster.position.clone();

    origin.y = 1.65;

    const target = this.playerPos.clone();

    target.y = 1.4;

    const rayDirection = target
      .sub(origin)
      .normalize();

    this.monsterRaycaster.set(
      origin,
      rayDirection
    );

    this.monsterRaycaster.far = distance;

    const hits =
      this.monsterRaycaster.intersectObject(
        this.mapData.rootGroup,
        true
      );

    if (
      hits.length > 0 &&
      hits[0].distance < distance - 0.45
    ) {
      return false;
    }

    return true;
  }

  // =====================================================
  // MONSTER COLLISION
  // =====================================================

  private monsterHitsWall(
    x: number,
    z: number
  ): boolean {
    this.monsterCollisionSphere.center.set(
      x,
      1,
      z
    );

    this.monsterCollisionSphere.radius = 0.4;

    for (
      const box of this.mapData.colliderBoxes
    ) {
      if (
        box.intersectsSphere(
          this.monsterCollisionSphere
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // =====================================================
  // MONSTER MOVEMENT
  // =====================================================

  private moveMonsterToward(
    target: THREE.Vector3,
    speed: number,
    dt: number
  ) {
    const dx =
      target.x - this.monster.position.x;

    const dz =
      target.z - this.monster.position.z;

    const distance = Math.sqrt(
      dx * dx + dz * dz
    );

    if (distance < 0.12) {
      this.monsterIsMoving = false;
      return;
    }

    this.monsterIsMoving = true;

    const step = Math.min(
      speed * dt,
      distance
    );

    const nx = dx / distance;
    const nz = dz / distance;

    // FACE TARGET
    this.monster.rotation.y =
      Math.atan2(-nx, -nz);

    const nextX =
      this.monster.position.x + nx * step;

    const nextZ =
      this.monster.position.z + nz * step;

    // DIRECT MOVEMENT
    if (
      !this.monsterHitsWall(
        nextX,
        nextZ
      )
    ) {
      this.monster.position.x = nextX;
      this.monster.position.z = nextZ;
      return;
    }

    // WALL SLIDING
    let moved = false;

    if (
      !this.monsterHitsWall(
        nextX,
        this.monster.position.z
      )
    ) {
      this.monster.position.x = nextX;
      moved = true;
    }

    if (
      !this.monsterHitsWall(
        this.monster.position.x,
        nextZ
      )
    ) {
      this.monster.position.z = nextZ;
      moved = true;
    }

    // If blocked, it will try another route next frame.
    if (!moved) {
      this.monsterIsMoving = false;
    }
  }

  // =====================================================
  // MONSTER ANIMATION
  // =====================================================

  private updateMonsterAnimation(
    dt: number
  ) {
    this.monsterAnimationTime += dt;

    const time =
      this.monsterAnimationTime;

    const chasing =
      this.monsterState === 'chase';

    const speed = chasing ? 13 : 6;

    const amplitude = chasing ? 0.55 : 0.25;

    // BODY SWAY
    this.monsterBody.rotation.z =
      Math.sin(time * speed) *
      amplitude *
      0.16;

    // BREATHING / BODY EXPANSION
    const breathing =
      Math.sin(time * 2.4) * 0.035;

    this.monsterBody.scale.set(
      1 + breathing,
      1 + Math.abs(breathing),
      1 + breathing
    );

    // HEAD MOVEMENT
    this.monsterHead.rotation.x =
      Math.sin(time * 2.1) * 0.08;

    this.monsterHead.rotation.z =
      Math.sin(time * 1.6) *
      (chasing ? 0.22 : 0.1);

    // ARMS SWING WHILE MOVING
    if (this.monsterIsMoving) {
      this.monsterLeftArm.rotation.x =
        Math.sin(time * speed) *
        amplitude;

      this.monsterRightArm.rotation.x =
        -Math.sin(time * speed) *
        amplitude;

      this.monsterLeftLeg.rotation.x =
        -Math.sin(time * speed) *
        amplitude *
        0.8;

      this.monsterRightLeg.rotation.x =
        Math.sin(time * speed) *
        amplitude *
        0.8;
    } else {
      // IDLE ANIMATION
      this.monsterLeftArm.rotation.x =
        Math.sin(time * 1.4) * 0.05;

      this.monsterRightArm.rotation.x =
        -Math.sin(time * 1.3) * 0.05;

      this.monsterLeftLeg.rotation.x = 0;
      this.monsterRightLeg.rotation.x = 0;
    }

    // CHASE LEAN
    this.monsterBody.rotation.x =
      chasing ? -0.12 : 0;

    // SMALL STAGGERING MOVEMENT
    if (this.monsterIsMoving) {
      this.monster.position.y =
        Math.abs(
          Math.sin(time * speed)
        ) * (chasing ? 0.06 : 0.025);
    } else {
      this.monster.position.y =
        Math.sin(time * 1.7) * 0.025;
    }
  }

  // =====================================================
  // MONSTER AUDIO
  // =====================================================

  private updateMonsterAudio(
    dt: number,
    distance: number
  ) {
    this.monsterStepTimer += dt;
    this.monsterBreathingTimer += dt;
    this.monsterGrowlTimer += dt;

    const chasing =
      this.monsterState === 'chase';

    // MONSTER FOOTSTEPS
    if (this.monsterIsMoving) {
      const stepInterval =
        chasing ? 0.32 : 0.68;

      if (
        this.monsterStepTimer >= stepInterval
      ) {
        this.monsterStepTimer = 0;

        if (distance < 18) {
          horrorAudio.playMonsterFootstep();
        }
      }
    }

    // DISTANT BREATHING / CLOSE BREATHING
    const breathingInterval =
      distance < 5 ? 1.4 : 3.2;

    if (
      this.monsterBreathingTimer >=
      breathingInterval
    ) {
      this.monsterBreathingTimer = 0;

      if (distance < 18) {
        horrorAudio.playMonsterBreathing();
      }
    }

    // RANDOM GROWLS
    const growlInterval =
      chasing ? 4.5 : 8;

    if (
      this.monsterGrowlTimer >=
        growlInterval &&
      distance < 14
    ) {
      this.monsterGrowlTimer = 0;

      if (Math.random() < 0.65) {
        horrorAudio.playMonsterGrowl();
      }
    }
  }

  // =====================================================
  // MONSTER AI
  // =====================================================

  private updateMonster(dt: number) {
    if (
      this.isGameOver ||
      this.isVictory ||
      !this.isGameActive
    ) {
      return;
    }

    this.monster.visible = true;

    const distance =
      this.monster.position.distanceTo(
        this.playerPos
      );

    // HEAR RUNNING
    if (
      this.isSprinting &&
      distance < this.monsterHearingRange &&
      this.monsterState !== 'chase'
    ) {
      this.monsterState = 'investigate';

      this.monsterInvestigateTimer = 4;

      this.monsterInvestigateTarget.copy(
        this.playerPos
      );
    }

    // SEE PLAYER
    const seesPlayer =
      this.canMonsterSeePlayer();

    if (seesPlayer) {
      this.monsterState = 'chase';
    }

    // STATE CHANGED
    if (
      this.monsterState !==
      this.previousMonsterState
    ) {
      if (
        this.monsterState === 'chase'
      ) {
        horrorAudio.playChaseStart();

        this.panicLevel = 0.9;

        horrorAudio.setPanicLevel(
          this.panicLevel
        );
      }

      if (
        this.previousMonsterState ===
          'chase' &&
        this.monsterState !== 'chase'
      ) {
        horrorAudio.stopChase();
      }

      this.previousMonsterState =
        this.monsterState;
    }

    // PATROL
    if (
      this.monsterState === 'patrol'
    ) {
      const waypoint =
        this.monsterWaypoints[
          this.monsterWaypointIndex
        ];

      this.moveMonsterToward(
        waypoint,
        this.monsterMoveSpeed,
        dt
      );

      if (
        this.monster.position.distanceTo(
          waypoint
        ) < 0.45
      ) {
        this.monsterWaypointIndex =
          (this.monsterWaypointIndex + 1) %
          this.monsterWaypoints.length;
      }
    }

    // INVESTIGATE
    else if (
      this.monsterState === 'investigate'
    ) {
      this.monsterInvestigateTimer -= dt;

      this.moveMonsterToward(
        this.monsterInvestigateTarget,
        this.monsterMoveSpeed * 1.35,
        dt
      );

      if (
        this.monsterInvestigateTimer <= 0
      ) {
        this.monsterState = 'patrol';
      }
    }

    // CHASE
    else if (
      this.monsterState === 'chase'
    ) {
      this.monsterTargetPosition.copy(
        this.playerPos
      );

      this.moveMonsterToward(
        this.monsterTargetPosition,
        this.monsterChaseSpeed,
        dt
      );
    }

    // ANIMATION
    this.updateMonsterAnimation(dt);

    // AUDIO
    const currentDistance =
      this.monster.position.distanceTo(
        this.playerPos
      );

    this.updateMonsterAudio(
      dt,
      currentDistance
    );

    // PANIC INCREASES WHEN MONSTER GETS CLOSER
    if (
      this.monsterState === 'chase'
    ) {
      const danger = THREE.MathUtils.clamp(
        1 - currentDistance / 13,
        0.2,
        1
      );

      this.panicLevel = Math.max(
        this.panicLevel,
        danger
      );

      horrorAudio.setPanicLevel(
        this.panicLevel
      );
    }

    // CAUGHT
    if (currentDistance < 1.15) {
      this.isGameOver = true;
      this.isGameActive = false;

      this.keys = {};

      this.joystickVec.x = 0;
      this.joystickVec.y = 0;

      horrorAudio.stopChase();
      horrorAudio.playGameOver();

      this.callbacks.onGameOver();
    }
  }

  // =====================================================
  // GAME CONTROL
  // =====================================================

  public startGame() {
    if (
      this.isVictory ||
      this.isGameOver
    ) {
      this.restartGame();
      return;
    }

    this.isGameActive = true;

    this.monster.visible = true;

    horrorAudio.init();
    horrorAudio.resume();

    horrorAudio.setPanicLevel(
      this.panicLevel
    );

    horrorAudio.playStinger();
  }

  public restartGame() {
    this.collectedRecords.clear();

    this.isVictory = false;
    this.isGameOver = false;
    this.isGameActive = true;

    this.batteryLevel = 100;

    this.isFlashlightOn = true;
    this.isSprinting = false;

    this.playerPos.copy(
      this.mapData.startPosition
    );

    this.playerVel.set(0, 0, 0);

    this.cameraPitch = 0;
    this.cameraYaw = Math.PI;

    this.bobTimer = 0;
    this.lastStepCycle = 0;

    this.keys = {};

    this.joystickVec.x = 0;
    this.joystickVec.y = 0;

    this.camera.position.copy(
      this.playerPos
    );

    this.flashlight.intensity = 4.5;

    this.mapData.collectibles.forEach(
      (collectible) => {
        collectible.visible = true;
      }
    );

    this.monsterState = 'patrol';

    this.previousMonsterState = 'patrol';

    this.monsterWaypointIndex = 0;

    this.monsterInvestigateTimer = 0;

    this.monster.position.copy(
      this.monsterWaypoints[0]
    );

    this.monsterPreviousPosition.copy(
      this.monster.position
    );

    this.monsterAnimationTime = 0;
    this.monsterStepTimer = 0;
    this.monsterBreathingTimer = 0;
    this.monsterGrowlTimer = 0;

    this.monster.visible = true;

    this.monsterIsMoving = false;

    this.panicLevel = 0.2;
    this.sanityLevel = 100;

    this.lastInteractPrompt = null;

    this.currentInteractable = null;

    this.callbacks.onBatteryChange(100);

    this.callbacks.onSanityChange(100);

    this.callbacks.onInteractPrompt(null);

    horrorAudio.init();
    horrorAudio.resume();
    horrorAudio.stopChase();

    horrorAudio.setPanicLevel(0.2);

    horrorAudio.playStinger();
  }

  // =====================================================
  // MOBILE CONTROLS
  // =====================================================

  public setJoystickInput(
    x: number,
    y: number
  ) {
    this.joystickVec.x = x;
    this.joystickVec.y = y;
  }

  public addTouchLook(
    deltaX: number,
    deltaY: number
  ) {
    const sensitivity = 0.0032;

    this.cameraYaw -=
      deltaX * sensitivity;

    this.cameraPitch -=
      deltaY * sensitivity;

    this.cameraPitch = Math.max(
      -Math.PI / 2.3,
      Math.min(
        Math.PI / 2.3,
        this.cameraPitch
      )
    );
  }

  public setSprint(
    sprinting: boolean
  ) {
    this.isSprinting = sprinting;
  }

  // =====================================================
  // INTERACTIONS
  // =====================================================

  public interact() {
    if (
      !this.isGameActive ||
      this.isVictory ||
      this.isGameOver
    ) {
      return;
    }

    if (!this.currentInteractable) {
      return;
    }

    const data =
      this.currentInteractable.userData;

    // COLLECT RECORD
    if (data?.isCollectible) {
      if (
        this.collectedRecords.has(data.id)
      ) {
        return;
      }

      this.collectedRecords.add(data.id);

      this.currentInteractable.visible = false;

      horrorAudio.playPickup();

      this.callbacks.onCollectRecord(
        data.id,
        data.name,
        this.collectedRecords.size,
        this.totalRecords
      );

      this.panicLevel = Math.min(
        1,
        0.2 +
          this.collectedRecords.size * 0.18
      );

      horrorAudio.setPanicLevel(
        this.panicLevel
      );

      return;
    }

    // EXIT DOOR
    if (data?.isExitDoor) {
      if (
        this.collectedRecords.size >=
        this.totalRecords
      ) {
        this.isVictory = true;
        this.isGameActive = false;

        horrorAudio.stopChase();

        horrorAudio.playDoorCreak();
        horrorAudio.playPickup();

        this.callbacks.onVictory();
      } else {
        horrorAudio.playLightSpark();
      }
    }
  }

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  private setupEventListeners() {
    window.addEventListener(
      'keydown',
      (event) => {
        this.keys[event.code] = true;

        if (event.code === 'KeyF') {
          this.toggleFlashlight();
        }

        if (event.code === 'KeyE') {
          this.interact();
        }

        if (
          event.code === 'ShiftLeft' ||
          event.code === 'ShiftRight'
        ) {
          this.isSprinting = true;
        }
      }
    );

    window.addEventListener(
      'keyup',
      (event) => {
        this.keys[event.code] = false;

        if (
          event.code === 'ShiftLeft' ||
          event.code === 'ShiftRight'
        ) {
          this.isSprinting = false;
        }
      }
    );

    this.renderer.domElement.addEventListener(
      'click',
      () => {
        if (
          this.isGameActive &&
          !this.isPointerLocked &&
          !('ontouchstart' in window)
        ) {
          this.renderer.domElement
            .requestPointerLock?.();
        }
      }
    );

    document.addEventListener(
      'pointerlockchange',
      () => {
        this.isPointerLocked =
          document.pointerLockElement ===
          this.renderer.domElement;
      }
    );

    document.addEventListener(
      'mousemove',
      (event) => {
        if (
          this.isPointerLocked &&
          this.isGameActive
        ) {
          const sensitivity = 0.0022;

          this.cameraYaw -=
            event.movementX * sensitivity;

          this.cameraPitch -=
            event.movementY * sensitivity;

          this.cameraPitch = Math.max(
            -Math.PI / 2.3,
            Math.min(
              Math.PI / 2.3,
              this.cameraPitch
            )
          );
        }
      }
    );

    window.addEventListener(
      'resize',
      this.onWindowResize
    );
  }

  private onWindowResize = () => {
    if (
      !this.container ||
      !this.renderer ||
      !this.camera
    ) {
      return;
    }

    const width =
      this.container.clientWidth;

    const height =
      this.container.clientHeight;

    if (
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    this.camera.aspect =
      width / height;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height
    );
  };

  // =====================================================
  // MAIN LOOP
  // =====================================================

  private tick = () => {
    this.animFrameId =
      requestAnimationFrame(this.tick);

    const rawDt =
      this.clock.getDelta();

    const dt = Math.min(
      rawDt,
      0.05
    );

    if (
      this.isGameActive &&
      !this.isVictory &&
      !this.isGameOver
    ) {
      this.updatePlayerMovement(dt);

      this.updateMonster(dt);

      this.updateFlashlight(dt);

      this.updateFlickeringLights(dt);

      this.updateRaycasting();

      this.updateSanityAndBattery(dt);
    }

    this.renderer.render(
      this.scene,
      this.camera
    );
  };

  // =====================================================
  // PLAYER MOVEMENT
  // =====================================================

  private updatePlayerMovement(
    dt: number
  ) {
    let moveForward = 0;
    let moveRight = 0;

    if (
      this.keys['KeyW'] ||
      this.keys['ArrowUp']
    ) {
      moveForward += 1;
    }

    if (
      this.keys['KeyS'] ||
      this.keys['ArrowDown']
    ) {
      moveForward -= 1;
    }

    if (
      this.keys['KeyD'] ||
      this.keys['ArrowRight']
    ) {
      moveRight += 1;
    }

    if (
      this.keys['KeyA'] ||
      this.keys['ArrowLeft']
    ) {
      moveRight -= 1;
    }

    if (
      Math.abs(this.joystickVec.y) > 0.1
    ) {
      moveForward -=
        this.joystickVec.y;
    }

    if (
      Math.abs(this.joystickVec.x) > 0.1
    ) {
      moveRight +=
        this.joystickVec.x;
    }

    const baseSpeed =
      this.isSprinting ? 4.8 : 2.8;

    this._forward
      .set(
        -Math.sin(this.cameraYaw),
        0,
        -Math.cos(this.cameraYaw)
      )
      .normalize();

    this._right
      .set(
        Math.cos(this.cameraYaw),
        0,
        -Math.sin(this.cameraYaw)
      )
      .normalize();

    this._moveDir.set(0, 0, 0);

    this._moveDir.addScaledVector(
      this._forward,
      moveForward
    );

    this._moveDir.addScaledVector(
      this._right,
      moveRight
    );

    const isMoving =
      this._moveDir.lengthSq() > 0.01;

    if (isMoving) {
      this._moveDir.normalize();
    }

    const targetVelX =
      this._moveDir.x * baseSpeed;

    const targetVelZ =
      this._moveDir.z * baseSpeed;

    this.playerVel.x =
      THREE.MathUtils.damp(
        this.playerVel.x,
        targetVelX,
        12,
        dt
      );

    this.playerVel.z =
      THREE.MathUtils.damp(
        this.playerVel.z,
        targetVelZ,
        12,
        dt
      );

    const deltaX =
      this.playerVel.x * dt;

    const deltaZ =
      this.playerVel.z * dt;

    const proposedX =
      this.playerPos.x + deltaX;

    if (
      !this.checkWallCollision(
        proposedX,
        this.playerPos.z
      )
    ) {
      this.playerPos.x = proposedX;
    }

    const proposedZ =
      this.playerPos.z + deltaZ;

    if (
      !this.checkWallCollision(
        this.playerPos.x,
        proposedZ
      )
    ) {
      this.playerPos.z = proposedZ;
    }

    // WALKING CAMERA BOB
    if (
      isMoving &&
      this.playerVel.length() > 0.5
    ) {
      const bobFrequency =
        this.isSprinting ? 14 : 9.5;

      this.bobTimer +=
        dt * bobFrequency;

      const bobY =
        Math.sin(this.bobTimer) *
        (this.isSprinting ? 0.05 : 0.03);

      const bobX =
        Math.cos(this.bobTimer * 0.5) *
        (this.isSprinting ? 0.03 : 0.018);

      this.camera.position.set(
        this.playerPos.x + bobX,
        1.6 + bobY,
        this.playerPos.z
      );

      const currentCycle =
        Math.floor(
          this.bobTimer / Math.PI
        );

      if (
        currentCycle > this.lastStepCycle
      ) {
        this.lastStepCycle =
          currentCycle;

        horrorAudio.playFootstep(
          this.isSprinting
        );
      }
    } else {
      this.bobTimer += dt * 1.8;

      this.camera.position.set(
        this.playerPos.x,
        1.6 +
          Math.sin(this.bobTimer) * 0.008,
        this.playerPos.z
      );
    }

    this.camera.rotation.order = 'YXZ';

    this.camera.rotation.y =
      this.cameraYaw;

    this.camera.rotation.x =
      this.cameraPitch;
  }

  private checkWallCollision(
    x: number,
    z: number
  ): boolean {
    this._playerSphere.center.set(
      x,
      1,
      z
    );

    this._playerSphere.radius =
      this.playerRadius;

    for (
      const box of this.mapData.colliderBoxes
    ) {
      if (
        box.intersectsSphere(
          this._playerSphere
        )
      ) {
        return true;
      }
    }

    return false;
  }

  // =====================================================
  // FLICKERING LIGHTS
  // =====================================================

  private updateFlickeringLights(
    dt: number
  ) {
    const time =
      this.clock.getElapsedTime();

    this.mapData.flickeringLights.forEach(
      (lightData) => {
        if (!lightData.isDefective) {
          return;
        }

        const noise =
          Math.sin(
            time * lightData.flickerSpeed +
              lightData.timeOffset
          ) +
          Math.cos(
            time * 33 +
              lightData.timeOffset * 2
          );

        const isOff =
          noise > 1.25 ||
          Math.random() < 0.03;

        const material =
          lightData.glowMesh
            .material as THREE.MeshStandardMaterial;

        if (isOff) {
          lightData.light.intensity = 0.1;

          material.emissiveIntensity = 0.15;

          if (Math.random() < 0.05) {
            const lightPosition =
              new THREE.Vector3();

            lightData.light.getWorldPosition(
              lightPosition
            );

            if (
              this.playerPos.distanceTo(
                lightPosition
              ) < 10
            ) {
              horrorAudio.playLightSpark();
            }
          }
        } else {
          lightData.light.intensity =
            lightData.baseIntensity *
            (0.8 + Math.random() * 0.4);

          material.emissiveIntensity = 1.6;
        }
      }
    );

    // RECORD HALO ANIMATION
    this.mapData.collectibles.forEach(
      (collectible) => {
        if (!collectible.visible) {
          return;
        }

        const halo =
          collectible.getObjectByName(
            'halo'
          );

        if (halo) {
          halo.rotation.z += dt * 1.5;
        }
      }
    );
  }

  // =====================================================
  // INTERACTION RAYCASTING
  // =====================================================

  private updateRaycasting() {
    this.raycaster.setFromCamera(
      new THREE.Vector2(0, 0),
      this.camera
    );

    const interactables: THREE.Object3D[] = [];

    this.mapData.collectibles.forEach(
      (collectible) => {
        if (collectible.visible) {
          interactables.push(collectible);
        }
      }
    );

    if (this.mapData.exitDoor) {
      this.mapData.exitDoor.userData.isExitDoor =
        true;

      interactables.push(
        this.mapData.exitDoor
      );
    }

    const intersects =
      this.raycaster.intersectObjects(
        interactables,
        true
      );

    let foundInteractable:
      THREE.Object3D | null = null;

    let prompt: string | null = null;

    if (intersects.length > 0) {
      const hit = intersects[0];

      if (hit.distance < 3.2) {
        let object:
          THREE.Object3D | null =
          hit.object;

        while (
          object &&
          !object.userData?.isCollectible &&
          !object.userData?.isExitDoor &&
          object.parent
        ) {
          object = object.parent;
        }

        if (
          object?.userData?.isCollectible
        ) {
          foundInteractable = object;

          prompt =
            `Tap / Press E to Collect: ${object.userData.name}`;
        } else if (
          object?.userData?.isExitDoor
        ) {
          foundInteractable = object;

          const remaining =
            this.totalRecords -
            this.collectedRecords.size;

          prompt =
            remaining > 0
              ? `[LOCKED] Requires all 4 Records (${this.collectedRecords.size}/4 Found)`
              : 'Tap / Press E to UNLOCK EMERGENCY EXIT & ESCAPE!';
        }
      }
    }

    this.currentInteractable =
      foundInteractable;

    if (
      prompt !== this.lastInteractPrompt
    ) {
      this.lastInteractPrompt = prompt;

      this.callbacks.onInteractPrompt(
        prompt
      );
    }
  }

  // =====================================================
  // BATTERY AND SANITY
  // =====================================================

  private updateSanityAndBattery(
    dt: number
  ) {
    // BATTERY DRAIN
    if (
      this.isFlashlightOn &&
      this.batteryLevel > 0
    ) {
      this.batteryLevel = Math.max(
        0,
        this.batteryLevel - dt * 0.25
      );

      this.callbacks.onBatteryChange(
        Math.round(this.batteryLevel)
      );

      if (this.batteryLevel <= 0) {
        this.flashlight.intensity = 0;

        this.isFlashlightOn = false;

        horrorAudio.playLightSpark();
      }
    }

    // SANITY BASED ON MONSTER DISTANCE
    const monsterDistance =
      this.monster.position.distanceTo(
        this.playerPos
      );

    let danger = 0;

    if (this.monster.visible) {
      danger = THREE.MathUtils.clamp(
        1 - monsterDistance / 14,
        0,
        1
      );
    }

    const targetSanity =
      100 - danger * 65;

    this.sanityLevel =
      THREE.MathUtils.damp(
        this.sanityLevel,
        targetSanity,
        1.8,
        dt
      );

    this.callbacks.onSanityChange(
      Math.round(this.sanityLevel)
    );

    // PANIC
    const targetPanic = Math.max(
      0.2,
      danger
    );

    this.panicLevel =
      THREE.MathUtils.damp(
        this.panicLevel,
        targetPanic,
        1.2,
        dt
      );

    horrorAudio.setPanicLevel(
      this.panicLevel
    );
  }

  // =====================================================
  // CLEANUP
  // =====================================================

  public dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(
        this.animFrameId
      );

      this.animFrameId = null;
    }

    window.removeEventListener(
      'resize',
      this.onWindowResize
    );

    horrorAudio.stopChase();

    horrorAudio.dispose();

    this.renderer.dispose();

    if (
      this.container.contains(
        this.renderer.domElement
      )
    ) {
      this.container.removeChild(
        this.renderer.domElement
      );
    }
  }
}