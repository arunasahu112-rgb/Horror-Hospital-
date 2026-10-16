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

  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mapData!: HospitalMapData;

  // Flashlight
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private isFlashlightOn = true;
  private batteryLevel = 100;
  private flashlightLagPos = new THREE.Vector3();
  private flashlightLagDir = new THREE.Vector3();

  // Player
  private playerPos = new THREE.Vector3();
  private playerVel = new THREE.Vector3();
  private cameraPitch = 0;
  private cameraYaw = Math.PI;
  private isSprinting = false;
  private bobTimer = 0;
  private lastStepCycle = 0;
  private playerRadius = 0.38;

  // Input
  private keys: Record<string, boolean> = {};
  private joystickVec = { x: 0, y: 0 };
  private isPointerLocked = false;

  // Objectives
  private collectedRecords = new Set<string>();
  private totalRecords = 4;
  private isGameActive = false;
  private isVictory = false;
  private isGameOver = false;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private currentInteractable: THREE.Object3D | null = null;
  private lastInteractPrompt: string | null = null;

  // Monster AI
  private monster!: THREE.Group;
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

  private monsterMoveSpeed = 1.15;
  private monsterChaseSpeed = 2.6;
  private monsterDetectionRange = 13;
  private monsterHearingRange = 11;

  private monsterRaycaster = new THREE.Raycaster();
  private monsterForward = new THREE.Vector3();
  private monsterToPlayer = new THREE.Vector3();
  private monsterTargetPosition = new THREE.Vector3();
  private monsterCollisionSphere = new THREE.Sphere();

  // Clock
  private clock = new THREE.Clock();
  private animFrameId: number | null = null;

  // Reusable vectors
  private _forward = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _moveDir = new THREE.Vector3();
  private _playerSphere = new THREE.Sphere();

  constructor(
    container: HTMLElement,
    callbacks: GameStateCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040806);
    this.scene.fog = new THREE.FogExp2(0x040806, 0.08);

    // Camera
    const aspect =
      container.clientWidth / Math.max(1, container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(
      72,
      aspect,
      0.1,
      50
    );

    // Mobile-friendly renderer
    const isHeadless =
      navigator.webdriver ||
      /HeadlessChrome/i.test(navigator.userAgent);

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 1.25)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    container.appendChild(this.renderer.domElement);

    // Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();

    this.scene.environment = pmrem.fromScene(
      environment,
      0.04
    ).texture;

    pmrem.dispose();

    // Ambient lighting
    this.scene.add(
      new THREE.HemisphereLight(
        0x192822,
        0x070c0a,
        0.4
      )
    );

    // Build map
    const mapBuilder = new HospitalMapBuilder();
    this.mapData = mapBuilder.build();
    this.scene.add(this.mapData.rootGroup);

    // Starting position
    this.playerPos.copy(this.mapData.startPosition);
    this.camera.position.copy(this.playerPos);

    // Systems
    this.setupFlashlight();
    this.setupMonster();
    this.setupEventListeners();

    this.onWindowResize();

    this.clock.start();
    this.tick();
  }

  // ==========================================
  // FLASHLIGHT
  // ==========================================

  private setupFlashlight() {
    this.flashlight = new THREE.SpotLight(
      0xfffae2,
      4.5,
      22,
      Math.PI / 6.5,
      0.45,
      1.8
    );

    this.flashlightTarget = new THREE.Object3D();

    this.scene.add(this.flashlightTarget);

    this.flashlight.target = this.flashlightTarget;
    this.scene.add(this.flashlight);

    this.flashlightLagPos.copy(this.playerPos);
    this.flashlightLagDir.set(0, 0, -1);
  }

  public toggleFlashlight() {
    if (this.batteryLevel <= 0) return;

    this.isFlashlightOn = !this.isFlashlightOn;

    this.flashlight.intensity = this.isFlashlightOn
      ? 4.5
      : 0;

    horrorAudio.playFlashlightClick(this.isFlashlightOn);
  }

  private updateFlashlight(dt: number) {
    this.flashlightLagPos.lerp(
      this.camera.position,
      Math.min(1, dt * 18)
    );

    this.flashlight.position.copy(this.flashlightLagPos);

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

    this.camera.getWorldDirection(this._forward);

    this.flashlightLagDir.lerp(
      this._forward,
      Math.min(1, dt * 14)
    );

    this.flashlightTarget.position
      .copy(this.flashlight.position)
      .addScaledVector(this.flashlightLagDir, 10);

    if (this.isFlashlightOn && this.batteryLevel > 0) {
      if (this.batteryLevel < 25 && Math.random() < 0.08) {
        this.flashlight.intensity = Math.random() * 2;
      } else {
        this.flashlight.intensity = 4.5;
      }
    } else {
      this.flashlight.intensity = 0;
    }
  }

  // ==========================================
  // MONSTER CREATION
  // ==========================================

  private setupMonster() {
    this.monster = new THREE.Group();
    this.monster.name = 'HospitalMonster';

    const skin = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.95,
    });

    const eyes = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0x660000,
      emissiveIntensity: 1.5,
    });

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.4, 1.2, 8),
      skin
    );

    body.position.y = 1.05;
    this.monster.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 8),
      skin
    );

    head.position.set(0, 1.85, 0);
    this.monster.add(head);

    // Glowing eyes face the monster's forward (-Z) direction
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 6),
        eyes
      );

      eye.position.set(x, 1.9, -0.29);
      this.monster.add(eye);
    }

    // Legs
    for (const x of [-0.17, 0.17]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 0.65, 6),
        skin
      );

      leg.position.set(x, 0.35, 0);
      this.monster.add(leg);
    }

    this.monster.position.copy(
      this.monsterWaypoints[0]
    );

    this.monster.visible = false;
    this.scene.add(this.monster);
  }

  // ==========================================
  // MONSTER VISION
  // ==========================================

  private canMonsterSeePlayer(): boolean {
    this.monsterToPlayer
      .subVectors(this.playerPos, this.monster.position);

    const distance = this.monsterToPlayer.length();

    if (distance > this.monsterDetectionRange || distance < 0.01) {
      return false;
    }

    // The monster faces -Z when its rotation is zero.
    this.monsterForward
      .set(0, 0, -1)
      .applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.monster.rotation.y
      )
      .normalize();

    const direction = this.monsterToPlayer
      .clone()
      .normalize();

    // Peripheral vision
    if (this.monsterForward.dot(direction) < 0.2) {
      return false;
    }

    // Check line of sight against hospital map geometry
    const origin = this.monster.position.clone();
    origin.y = 1.65;

    const target = this.playerPos.clone();
    target.y = 1.4;

    const rayDirection = target.sub(origin).normalize();

    this.monsterRaycaster.set(origin, rayDirection);
    this.monsterRaycaster.far = distance;

    const hits = this.monsterRaycaster.intersectObject(
      this.mapData.rootGroup,
      true
    );

    // A wall/furniture mesh between monster and player blocks vision.
    if (hits.length > 0 && hits[0].distance < distance - 0.45) {
      return false;
    }

    return true;
  }

  // ==========================================
  // MONSTER COLLISION AND MOVEMENT
  // ==========================================

  private monsterHitsWall(x: number, z: number): boolean {
    this.monsterCollisionSphere.center.set(x, 1, z);
    this.monsterCollisionSphere.radius = 0.4;

    for (const box of this.mapData.colliderBoxes) {
      if (box.intersectsSphere(this.monsterCollisionSphere)) {
        return true;
      }
    }

    return false;
  }

  private moveMonsterToward(
    target: THREE.Vector3,
    speed: number,
    dt: number
  ) {
    const dx = target.x - this.monster.position.x;
    const dz = target.z - this.monster.position.z;

    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.12) return;

    const step = Math.min(speed * dt, distance);

    const nx = dx / distance;
    const nz = dz / distance;

    // Face the direction of movement.
    this.monster.rotation.y = Math.atan2(-nx, -nz);

    const nextX = this.monster.position.x + nx * step;
    const nextZ = this.monster.position.z + nz * step;

    // Slide along walls instead of getting stuck immediately.
    if (!this.monsterHitsWall(nextX, nextZ)) {
      this.monster.position.x = nextX;
      this.monster.position.z = nextZ;
    } else {
      if (!this.monsterHitsWall(nextX, this.monster.position.z)) {
        this.monster.position.x = nextX;
      }

      if (!this.monsterHitsWall(this.monster.position.x, nextZ)) {
        this.monster.position.z = nextZ;
      }
    }
  }

  // ==========================================
  // MONSTER AI
  // ==========================================

  private updateMonster(dt: number) {
    if (this.isGameOver || this.isVictory) return;

    this.monster.visible = true;

    const distance = this.monster.position.distanceTo(
      this.playerPos
    );

    // Hear sprinting from nearby corridors.
    if (
      this.isSprinting &&
      distance < this.monsterHearingRange &&
      this.monsterState !== 'chase'
    ) {
      this.monsterState = 'investigate';
      this.monsterInvestigateTimer = 4;

      this.monsterInvestigateTarget.copy(this.playerPos);
    }

    // Seeing the player starts a chase.
    if (this.canMonsterSeePlayer()) {
      this.monsterState = 'chase';
    }

    if (this.monsterState === 'patrol') {
      const waypoint =
        this.monsterWaypoints[this.monsterWaypointIndex];

      this.moveMonsterToward(
        waypoint,
        this.monsterMoveSpeed,
        dt
      );

      if (
        this.monster.position.distanceTo(waypoint) < 0.45
      ) {
        this.monsterWaypointIndex =
          (this.monsterWaypointIndex + 1) %
          this.monsterWaypoints.length;
      }
    } else if (this.monsterState === 'investigate') {
      this.monsterInvestigateTimer -= dt;

      this.moveMonsterToward(
        this.monsterInvestigateTarget,
        this.monsterMoveSpeed * 1.3,
        dt
      );

      if (this.monsterInvestigateTimer <= 0) {
        this.monsterState = 'patrol';
      }
    } else if (this.monsterState === 'chase') {
      this.monsterTargetPosition.copy(this.playerPos);

      this.moveMonsterToward(
        this.monsterTargetPosition,
        this.monsterChaseSpeed,
        dt
      );
    }

    // Catch distance
    const newDistance = this.monster.position.distanceTo(
      this.playerPos
    );

    if (newDistance < 1.15) {
      this.isGameOver = true;
      this.isGameActive = false;

      this.keys = {};
      this.joystickVec.x = 0;
      this.joystickVec.y = 0;

      horrorAudio.playStinger();

      this.callbacks.onGameOver();
    }
  }

  // ==========================================
  // GAME CONTROL
  // ==========================================

  public startGame() {
    if (this.isVictory || this.isGameOver) {
      this.restartGame();
      return;
    }

    this.isGameActive = true;
    this.monster.visible = true;

    horrorAudio.init();
    horrorAudio.resume();
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

    this.playerPos.copy(this.mapData.startPosition);
    this.playerVel.set(0, 0, 0);

    this.cameraPitch = 0;
    this.cameraYaw = Math.PI;

    this.bobTimer = 0;
    this.lastStepCycle = 0;

    this.keys = {};
    this.joystickVec.x = 0;
    this.joystickVec.y = 0;

    this.camera.position.copy(this.playerPos);

    if (this.flashlight) {
      this.flashlight.intensity = 4.5;
    }

    this.mapData.collectibles.forEach((collectible) => {
      collectible.visible = true;
    });

    this.monsterState = 'patrol';
    this.monsterWaypointIndex = 0;
    this.monsterInvestigateTimer = 0;

    this.monster.position.copy(
      this.monsterWaypoints[0]
    );

    this.monster.visible = true;

    this.lastInteractPrompt = null;
    this.currentInteractable = null;

    this.callbacks.onBatteryChange(100);
    this.callbacks.onSanityChange(100);
    this.callbacks.onInteractPrompt(null);

    horrorAudio.init();
    horrorAudio.resume();
    horrorAudio.setPanicLevel(0.2);
    horrorAudio.playStinger();
  }

  public setJoystickInput(x: number, y: number) {
    this.joystickVec.x = x;
    this.joystickVec.y = y;
  }

  public addTouchLook(deltaX: number, deltaY: number) {
    const lookSens = 0.0032;

    this.cameraYaw -= deltaX * lookSens;
    this.cameraPitch -= deltaY * lookSens;

    this.cameraPitch = Math.max(
      -Math.PI / 2.3,
      Math.min(Math.PI / 2.3, this.cameraPitch)
    );
  }

  public setSprint(sprinting: boolean) {
    this.isSprinting = sprinting;
  }

  // ==========================================
  // INTERACTIONS
  // ==========================================

  public interact() {
    if (
      !this.isGameActive ||
      this.isVictory ||
      this.isGameOver
    ) {
      return;
    }

    if (!this.currentInteractable) return;

    const collectible = this.currentInteractable.userData;

    if (collectible?.isCollectible) {
      this.collectedRecords.add(collectible.id);
      this.currentInteractable.visible = false;

      horrorAudio.playPickup();

      this.callbacks.onCollectRecord(
        collectible.id,
        collectible.name,
        this.collectedRecords.size,
        this.totalRecords
      );

      horrorAudio.playStinger();

      horrorAudio.setPanicLevel(
        this.collectedRecords.size * 0.25
      );

      return;
    }

    if (this.currentInteractable.userData.isExitDoor) {
      if (this.collectedRecords.size >= this.totalRecords) {
        this.isVictory = true;
        this.isGameActive = false;

        horrorAudio.playDoorCreak();
        horrorAudio.playPickup();

        this.callbacks.onVictory();
      } else {
        horrorAudio.playLightSpark();
      }
    }
  }

  // ==========================================
  // INPUT EVENTS
  // ==========================================

  private setupEventListeners() {
    window.addEventListener('keydown', (event) => {
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
    });

    window.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;

      if (
        event.code === 'ShiftLeft' ||
        event.code === 'ShiftRight'
      ) {
        this.isSprinting = false;
      }
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (
        this.isGameActive &&
        !this.isPointerLocked &&
        !('ontouchstart' in window)
      ) {
        this.renderer.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked =
        document.pointerLockElement ===
        this.renderer.domElement;
    });

    document.addEventListener('mousemove', (event) => {
      if (this.isPointerLocked && this.isGameActive) {
        const mouseSens = 0.0022;

        this.cameraYaw -= event.movementX * mouseSens;
        this.cameraPitch -= event.movementY * mouseSens;

        this.cameraPitch = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, this.cameraPitch)
        );
      }
    });

    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) {
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  // ==========================================
  // MAIN LOOP
  // ==========================================

  private tick = () => {
    this.animFrameId = requestAnimationFrame(this.tick);

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.isGameActive && !this.isVictory && !this.isGameOver) {
      this.updatePlayerMovement(dt);
      this.updateMonster(dt);
      this.updateFlashlight(dt);
      this.updateFlickeringLights(dt);
      this.updateRaycasting();
      this.updateSanityAndBattery(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ==========================================
  // PLAYER MOVEMENT
  // ==========================================

  private updatePlayerMovement(dt: number) {
    let moveForward = 0;
    let moveRight = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveForward += 1;
    }

    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveForward -= 1;
    }

    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveRight += 1;
    }

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveRight -= 1;
    }

    if (Math.abs(this.joystickVec.y) > 0.1) {
      moveForward -= this.joystickVec.y;
    }

    if (Math.abs(this.joystickVec.x) > 0.1) {
      moveRight += this.joystickVec.x;
    }

    const baseSpeed = this.isSprinting ? 4.8 : 2.8;

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

    const isMoving = this._moveDir.lengthSq() > 0.01;

    if (isMoving) {
      this._moveDir.normalize();
    }

    const targetVelX = this._moveDir.x * baseSpeed;
    const targetVelZ = this._moveDir.z * baseSpeed;

    this.playerVel.x = THREE.MathUtils.damp(
      this.playerVel.x,
      targetVelX,
      12,
      dt
    );

    this.playerVel.z = THREE.MathUtils.damp(
      this.playerVel.z,
      targetVelZ,
      12,
      dt
    );

    const deltaX = this.playerVel.x * dt;
    const deltaZ = this.playerVel.z * dt;

    const proposedX = this.playerPos.x + deltaX;

    if (!this.checkWallCollision(proposedX, this.playerPos.z)) {
      this.playerPos.x = proposedX;
    }

    const proposedZ = this.playerPos.z + deltaZ;

    if (!this.checkWallCollision(this.playerPos.x, proposedZ)) {
      this.playerPos.z = proposedZ;
    }

    if (isMoving && this.playerVel.length() > 0.5) {
      const bobFreq = this.isSprinting ? 14 : 9.5;

      this.bobTimer += dt * bobFreq;

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

      const currentCycle = Math.floor(
        this.bobTimer / Math.PI
      );

      if (currentCycle > this.lastStepCycle) {
        this.lastStepCycle = currentCycle;
        horrorAudio.playFootstep(this.isSprinting);
      }
    } else {
      this.bobTimer += dt * 1.8;

      this.camera.position.set(
        this.playerPos.x,
        1.6 + Math.sin(this.bobTimer) * 0.008,
        this.playerPos.z
      );
    }

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.cameraYaw;
    this.camera.rotation.x = this.cameraPitch;
  }

  private checkWallCollision(
    x: number,
    z: number
  ): boolean {
    this._playerSphere.center.set(x, 1, z);
    this._playerSphere.radius = this.playerRadius;

    for (const box of this.mapData.colliderBoxes) {
      if (box.intersectsSphere(this._playerSphere)) {
        return true;
      }
    }

    return false;
  }

  // ==========================================
  // FLICKERING LIGHTS
  // ==========================================

  private updateFlickeringLights(dt: number) {
    const time = this.clock.getElapsedTime();

    this.mapData.flickeringLights.forEach((lightData) => {
      if (!lightData.isDefective) return;

      const noise =
        Math.sin(
          time * lightData.flickerSpeed +
          lightData.timeOffset
        ) +
        Math.cos(time * 33 + lightData.timeOffset * 2);

      const isOff =
        noise > 1.25 || Math.random() < 0.03;

      const material =
        lightData.glowMesh.material as THREE.MeshStandardMaterial;

      if (isOff) {
        lightData.light.intensity = 0.1;
        material.emissiveIntensity = 0.15;

        if (Math.random() < 0.05) {
          const lightPosition = new THREE.Vector3();

          lightData.light.getWorldPosition(lightPosition);

          if (
            this.playerPos.distanceTo(lightPosition) < 10
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
    });

    this.mapData.collectibles.forEach((collectible) => {
      if (!collectible.visible) return;

      const halo = collectible.getObjectByName('halo');

      if (halo) {
        halo.rotation.z += dt * 1.5;
      }
    });
  }

  // ==========================================
  // INTERACTION RAYCASTING
  // ==========================================

  private updateRaycasting() {
    this.raycaster.setFromCamera(
      new THREE.Vector2(0, 0),
      this.camera
    );

    const interactables: THREE.Object3D[] = [];

    this.mapData.collectibles.forEach((collectible) => {
      if (collectible.visible) {
        interactables.push(collectible);
      }
    });

    if (this.mapData.exitDoor) {
      this.mapData.exitDoor.userData.isExitDoor = true;
      interactables.push(this.mapData.exitDoor);
    }

    const intersects = this.raycaster.intersectObjects(
      interactables,
      true
    );

    let foundInteractable: THREE.Object3D | null = null;
    let prompt: string | null = null;

    if (intersects.length > 0) {
      const hit = intersects[0];

      if (hit.distance < 3.2) {
        let object: THREE.Object3D | null = hit.object;

        while (
          object &&
          !object.userData?.isCollectible &&
          !object.userData?.isExitDoor &&
          object.parent
        ) {
          object = object.parent;
        }

        if (object?.userData?.isCollectible) {
          foundInteractable = object;

          prompt =
            `Tap / Press E to Collect: ${object.userData.name}`;
        } else if (object?.userData?.isExitDoor) {
          foundInteractable = object;

          const remaining =
            this.totalRecords - this.collectedRecords.size;

          prompt =
            remaining > 0
              ? `[LOCKED] Requires all 4 Records (${this.collectedRecords.size}/4 Found)`
              : 'Tap / Press E to UNLOCK EMERGENCY EXIT & ESCAPE!';
        }
      }
    }

    this.currentInteractable = foundInteractable;

    if (prompt !== this.lastInteractPrompt) {
      this.lastInteractPrompt = prompt;
      this.callbacks.onInteractPrompt(prompt);
    }
  }

  // ==========================================
  // BATTERY AND SANITY
  // ==========================================

  private updateSanityAndBattery(dt: number) {
    if (this.isFlashlightOn && this.batteryLevel > 0) {
      this.batteryLevel = Math.max(
        0,
        this.batteryLevel - dt * 0.25
      );

      this.callbacks.onBatteryChange(
        Math.round(this.batteryLevel)
      );

      if (this.batteryLevel <= 0) {
        this.flashlight.intensity = 0;
        horrorAudio.playLightSpark();
      }
    }

    const exitPosition = new THREE.Vector3(0, 1.6, -22);

    const distanceToExit = this.playerPos.distanceTo(
      exitPosition
    );

    const tension = THREE.MathUtils.clamp(
      1 - distanceToExit / 35,
      0.15,
      0.95
    );

    horrorAudio.setPanicLevel(tension);

    this.callbacks.onSanityChange(
      Math.round((1 - tension * 0.5) * 100)
    );
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  public dispose() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    window.removeEventListener(
      'resize',
      this.onWindowResize
    );

    horrorAudio.dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}