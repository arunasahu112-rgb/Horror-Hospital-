import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HospitalMapBuilder, HospitalMapData } from './hospitalMap';
import { horrorAudio } from '../audio/horrorAudio';
import { FlickeringLightData } from './props';

export interface GameStateCallbacks {
  onCollectRecord: (id: string, name: string, count: number, total: number) => void;
  onInteractPrompt: (promptText: string | null) => void;
  onVictory: () => void;
  onBatteryChange: (percent: number) => void;
  onSanityChange: (percent: number) => void;
}

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
  private isFlashlightOn: boolean = true;
  private batteryLevel: number = 100;
  private flashlightLagPos: THREE.Vector3 = new THREE.Vector3();
  private flashlightLagDir: THREE.Vector3 = new THREE.Vector3();

  // Player state
  private playerPos: THREE.Vector3 = new THREE.Vector3();
  private playerVel: THREE.Vector3 = new THREE.Vector3();
  private cameraPitch: number = 0;
  private cameraYaw: number = Math.PI;
  private isSprinting: boolean = false;
  private bobTimer: number = 0;
  private lastStepCycle: number = 0;
  private playerRadius: number = 0.38;

  // Input states
  private keys: Record<string, boolean> = {};
  private joystickVec: { x: number; y: number } = { x: 0, y: 0 };
  private touchLookDelta: { x: number; y: number } = { x: 0, y: 0 };
  private isPointerLocked: boolean = false;

  // Inventory & Objectives
  private collectedRecords: Set<string> = new Set();
  private totalRecords: number = 4;
  private isGameActive: boolean = false;
  private isVictory: boolean = false;

  // Raycasting & Interaction
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private currentInteractable: THREE.Object3D | null = null;
  private lastInteractPrompt: string | null = null;

  // Loop & Clock
  private clock: THREE.Clock = new THREE.Clock();
  private animFrameId: number | null = null;

  // Pre-allocated vectors
  private _forward: THREE.Vector3 = new THREE.Vector3();
  private _right: THREE.Vector3 = new THREE.Vector3();
  private _moveDir: THREE.Vector3 = new THREE.Vector3();
  private _targetPos: THREE.Vector3 = new THREE.Vector3();
  private _tempBox: THREE.Box3 = new THREE.Box3();
  private _playerSphere: THREE.Sphere = new THREE.Sphere();

  constructor(container: HTMLElement, callbacks: GameStateCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040806);
    this.scene.fog = new THREE.FogExp2(0x040806, 0.08);

    // 2. Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.1, 50);

    // 3. Mobile-friendly renderer setup
    const isHeadless =
      navigator.webdriver ||
      /HeadlessChrome/i.test(navigator.userAgent);

    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: 'high-performance',
      stencil: false
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

    // 4. Studio Environment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmrem.dispose();

    // 5. Ambient and Fill Lighting
    const hemiLight = new THREE.HemisphereLight(
      0x192822,
      0x070c0a,
      0.4
    );
    this.scene.add(hemiLight);

    // 6. Build Hospital Map
    const mapBuilder = new HospitalMapBuilder();
    this.mapData = mapBuilder.build();
    this.scene.add(this.mapData.rootGroup);

    // Set starting position
    this.playerPos.copy(this.mapData.startPosition);
    this.camera.position.copy(this.playerPos);

    // 7. Flashlight Setup
    this.setupFlashlight();

    // 8. Event Listeners
    this.setupEventListeners();

    // 9. Initial Resize
    this.onWindowResize();

    // Start loop
    this.clock.start();
    this.tick();
  }

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

  public startGame() {
    this.isGameActive = true;
    horrorAudio.init();
    horrorAudio.resume();
    horrorAudio.playStinger();
  }

  public restartGame() {
    this.collectedRecords.clear();
    this.isVictory = false;
    this.batteryLevel = 100;

    this.playerPos.copy(this.mapData.startPosition);
    this.playerVel.set(0, 0, 0);

    this.cameraPitch = 0;
    this.cameraYaw = Math.PI;
    this.isFlashlightOn = true;

    if (this.flashlight) {
      this.flashlight.intensity = 4.5;
    }

    // Reset collectibles
    this.mapData.collectibles.forEach((c) => {
      c.visible = true;
    });

    this.lastInteractPrompt = null;
    this.currentInteractable = null;

    this.isGameActive = true;

    this.callbacks.onBatteryChange(100);
    this.callbacks.onSanityChange(100);
    this.callbacks.onInteractPrompt(null);

    horrorAudio.setPanicLevel(0.2);
    horrorAudio.playStinger();
  }

  public toggleFlashlight() {
    if (this.batteryLevel <= 0) return;

    this.isFlashlightOn = !this.isFlashlightOn;

    this.flashlight.intensity = this.isFlashlightOn ? 4.5 : 0;

    horrorAudio.playFlashlightClick(this.isFlashlightOn);
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

  public interact() {
    if (!this.isGameActive || this.isVictory) return;
    if (!this.currentInteractable) return;

    // Check collectible
    const collectible = this.currentInteractable.userData;

    if (collectible && collectible.isCollectible) {
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

    // Check exit door
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

  private setupEventListeners() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyF') {
        this.toggleFlashlight();
      }

      if (e.code === 'KeyE') {
        this.interact();
      }

      if (
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        this.isSprinting = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        this.isSprinting = false;
      }
    });

    // Pointer lock for desktop
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
        document.pointerLockElement === this.renderer.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.isGameActive) {
        const mouseSens = 0.0022;

        this.cameraYaw -= e.movementX * mouseSens;
        this.cameraPitch -= e.movementY * mouseSens;

        this.cameraPitch = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, this.cameraPitch)
        );
      }
    });

    // Window resize
    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) {
      return;
    }

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    if (w <= 0 || h <= 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
  };

  private tick = () => {
    this.animFrameId = requestAnimationFrame(this.tick);

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (this.isGameActive && !this.isVictory) {
      this.updatePlayerMovement(dt);
      this.updateFlashlight(dt);
      this.updateFlickeringLights(dt);
      this.updateRaycasting();
      this.updateSanityAndBattery(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

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

    // Mobile joystick input
    if (Math.abs(this.joystickVec.y) > 0.1) {
      moveForward -= this.joystickVec.y;
    }

    if (Math.abs(this.joystickVec.x) > 0.1) {
      moveRight += this.joystickVec.x;
    }

    // Movement speed
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
    this._moveDir.addScaledVector(this._forward, moveForward);
    this._moveDir.addScaledVector(this._right, moveRight);

    const isMoving = this._moveDir.lengthSq() > 0.01;

    if (isMoving) {
      this._moveDir.normalize();
    }

    // Smooth velocity
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

    // Collision detection
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

    // Head bobbing and footsteps
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

      const breathY = Math.sin(this.bobTimer) * 0.008;

      this.camera.position.set(
        this.playerPos.x,
        1.6 + breathY,
        this.playerPos.z
      );
    }

    // Camera rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.cameraYaw;
    this.camera.rotation.x = this.cameraPitch;
  }

  // Collision against walls and furniture
  private checkWallCollision(x: number, z: number): boolean {
    this._playerSphere.center.set(x, 1.0, z);
    this._playerSphere.radius = this.playerRadius;

    for (
      let i = 0;
      i < this.mapData.colliderBoxes.length;
      i++
    ) {
      const box = this.mapData.colliderBoxes[i];

      if (box.intersectsSphere(this._playerSphere)) {
        return true;
      }
    }

    return false;
  }

  private updateFlashlight(dt: number) {
    if (!this.flashlight) return;

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

    // Battery-related flicker
    if (this.isFlashlightOn) {
      if (this.batteryLevel < 25) {
        if (Math.random() < 0.08) {
          this.flashlight.intensity = Math.random() * 2.0;
        } else {
          this.flashlight.intensity = 3.8;
        }
      } else {
        this.flashlight.intensity = 4.5;
      }
    }
  }

  private updateFlickeringLights(dt: number) {
    const time = this.clock.getElapsedTime();

    this.mapData.flickeringLights.forEach((fl) => {
      if (fl.isDefective) {
        const noise =
          Math.sin(time * fl.flickerSpeed + fl.timeOffset) +
          Math.cos(time * 33 + fl.timeOffset * 2);

        const isOff =
          noise > 1.25 || Math.random() < 0.03;

        if (isOff) {
          fl.light.intensity = 0.1;

          (
            fl.glowMesh.material as THREE.MeshStandardMaterial
          ).emissiveIntensity = 0.15;

          if (Math.random() < 0.05) {
            const dist = this.playerPos.distanceTo(
              fl.light.parent?.position || fl.light.position
            );

            if (dist < 10) {
              horrorAudio.playLightSpark();
            }
          }
        } else {
          const intensity =
            fl.baseIntensity * (0.8 + Math.random() * 0.4);

          fl.light.intensity = intensity;

          (
            fl.glowMesh.material as THREE.MeshStandardMaterial
          ).emissiveIntensity = 1.6;
        }
      }
    });

    // Rotate collectible halo rings
    this.mapData.collectibles.forEach((col) => {
      if (col.visible) {
        const halo = col.getObjectByName('halo');

        if (halo) {
          halo.rotation.z += dt * 1.5;
        }
      }
    });
  }

  private updateRaycasting() {
    this.raycaster.setFromCamera(
      new THREE.Vector2(0, 0),
      this.camera
    );

    // Collect interaction candidates
    const interactables: THREE.Object3D[] = [];

    this.mapData.collectibles.forEach((c) => {
      if (c.visible) {
        interactables.push(c);
      }
    });

    // Add exit door
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
        let obj: THREE.Object3D | null = hit.object;

        while (
          obj &&
          !obj.userData?.isCollectible &&
          !obj.userData?.isExitDoor &&
          obj.parent
        ) {
          obj = obj.parent;
        }

        if (obj?.userData?.isCollectible) {
          foundInteractable = obj;

          prompt =
            `Tap / Press E to Collect: ${obj.userData.name}`;
        } else if (obj?.userData?.isExitDoor) {
          foundInteractable = obj;

          const remaining =
            this.totalRecords - this.collectedRecords.size;

          if (remaining > 0) {
            prompt =
              `[LOCKED] Requires all 4 Records (${this.collectedRecords.size}/4 Found)`;
          } else {
            prompt =
              'Tap / Press E to UNLOCK EMERGENCY EXIT & ESCAPE!';
          }
        }
      }
    }

    this.currentInteractable = foundInteractable;

    // Only notify React when the prompt changes.
    if (prompt !== this.lastInteractPrompt) {
      this.lastInteractPrompt = prompt;
      this.callbacks.onInteractPrompt(prompt);
    }
  }

  private updateSanityAndBattery(dt: number) {
    // Flashlight battery discharge
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

    // Distance-based tension
    const distToExit = this.playerPos.distanceTo(
      new THREE.Vector3(0, 1.6, -22)
    );

    const tension = THREE.MathUtils.clamp(
      1.0 - distToExit / 35,
      0.15,
      0.95
    );

    horrorAudio.setPanicLevel(tension);

    this.callbacks.onSanityChange(
      Math.round((1 - tension * 0.5) * 100)
    );
  }

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