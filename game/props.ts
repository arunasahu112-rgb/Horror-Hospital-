import * as THREE from 'three';

export interface FlickeringLightData {
  light: THREE.PointLight;
  glowMesh: THREE.Mesh;
  baseIntensity: number;
  flickerSpeed: number;
  isDefective: boolean;
  timeOffset: number;
}

// Procedural multi-part composite props for Hospital 13
export class HospitalPropsFactory {
  // Reusable materials
  private static metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a544f,
    roughness: 0.25,
    metalness: 0.85,
  });

  private static rustedMetalMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d3632,
    roughness: 0.75,
    metalness: 0.45,
  });

  private static rubberMaterial = new THREE.MeshStandardMaterial({
    color: 0x151816,
    roughness: 0.9,
    metalness: 0.1,
  });

  private static mattressMaterial = new THREE.MeshStandardMaterial({
    color: 0x313d37,
    roughness: 0.8,
    metalness: 0.05,
  });

  private static pillowMaterial = new THREE.MeshStandardMaterial({
    color: 0x828a84,
    roughness: 0.95,
    metalness: 0.0,
  });

  private static blanketMaterial = new THREE.MeshStandardMaterial({
    color: 0x243029,
    roughness: 0.85,
    metalness: 0.05,
  });

  /**
   * Hospital Bed: 8-part composite model
   * Frame, legs, caster wheels, headboard, footboard, mattress, pillow, IV pole
   */
  public static createHospitalBed(): THREE.Group {
    const bed = new THREE.Group();

    // 1. Bed base frame (Primary silhouette)
    const frameGeo = new THREE.BoxGeometry(1.2, 0.08, 2.2);
    const frameMesh = new THREE.Mesh(frameGeo, this.metalMaterial);
    frameMesh.position.y = 0.55;
    bed.add(frameMesh);

    // 2. Four legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
    const legPositions = [
      [-0.55, 0.25, -1.0],
      [0.55, 0.25, -1.0],
      [-0.55, 0.25, 1.0],
      [0.55, 0.25, 1.0],
    ];
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, this.metalMaterial);
      leg.position.set(x, y, z);
      bed.add(leg);

      // Caster wheels (Accent detail)
      const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheel = new THREE.Mesh(wheelGeo, this.rubberMaterial);
      wheel.position.set(x, 0.045, z);
      bed.add(wheel);
    });

    // 3. Headboard (Secondary read)
    const headboardBarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8);
    const headboardTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), this.metalMaterial);
    headboardTop.position.set(0, 0.88, -1.05);
    bed.add(headboardTop);
    for (let i = -0.45; i <= 0.45; i += 0.22) {
      const post = new THREE.Mesh(headboardBarGeo, this.metalMaterial);
      post.position.set(i, 0.6, -1.05);
      bed.add(post);
    }

    // 4. Footboard
    const footboardTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), this.metalMaterial);
    footboardTop.position.set(0, 0.72, 1.05);
    bed.add(footboardTop);
    const footBarGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
    for (let i = -0.4; i <= 0.4; i += 0.25) {
      const post = new THREE.Mesh(footBarGeo, this.metalMaterial);
      post.position.set(i, 0.55, 1.05);
      bed.add(post);
    }

    // 5. Mattress
    const mattressGeo = new THREE.BoxGeometry(1.1, 0.18, 2.05);
    const mattress = new THREE.Mesh(mattressGeo, this.mattressMaterial);
    mattress.position.y = 0.68;
    bed.add(mattress);

    // 6. Pillow
    const pillowGeo = new THREE.BoxGeometry(0.7, 0.1, 0.4);
    const pillow = new THREE.Mesh(pillowGeo, this.pillowMaterial);
    pillow.position.set(0, 0.8, -0.75);
    pillow.rotation.x = 0.12;
    bed.add(pillow);

    // 7. Folded blanket
    const blanketGeo = new THREE.BoxGeometry(1.12, 0.09, 1.1);
    const blanket = new THREE.Mesh(blanketGeo, this.blanketMaterial);
    blanket.position.set(0, 0.77, 0.45);
    bed.add(blanket);

    // 8. IV Drip pole
    const ivPoleGroup = new THREE.Group();
    const ivStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8), this.metalMaterial);
    ivStand.position.y = 0.9;
    ivPoleGroup.add(ivStand);

    const ivCross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), this.metalMaterial);
    ivCross.position.y = 1.78;
    ivPoleGroup.add(ivCross);

    // IV bag (translucent)
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0x90b5a2,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.65,
    });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.05), bagMat);
    bag.position.set(0.1, 1.62, 0);
    ivPoleGroup.add(bag);

    ivPoleGroup.position.set(-0.62, 0, -0.9);
    bed.add(ivPoleGroup);

    return bed;
  }

  /**
   * Abandoned Wheelchair: 7-part composite model
   */
  public static createWheelchair(): THREE.Group {
    const chair = new THREE.Group();

    // 1. Frame
    const frameGeo = new THREE.BoxGeometry(0.65, 0.04, 0.65);
    const frame = new THREE.Mesh(frameGeo, this.metalMaterial);
    frame.position.y = 0.45;
    chair.add(frame);

    // 2. Large Rear Wheels (with rim and axle)
    const wheelRimGeo = new THREE.TorusGeometry(0.35, 0.025, 8, 20);
    const wheelMat = this.metalMaterial;

    const leftWheel = new THREE.Mesh(wheelRimGeo, wheelMat);
    leftWheel.rotation.y = Math.PI / 2;
    leftWheel.position.set(-0.36, 0.35, -0.05);
    chair.add(leftWheel);

    const rightWheel = new THREE.Mesh(wheelRimGeo, wheelMat);
    rightWheel.rotation.y = Math.PI / 2;
    rightWheel.position.set(0.36, 0.35, -0.05);
    chair.add(rightWheel);

    // 3. Small Front Caster Wheels
    const frontCasterGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8);
    frontCasterGeo.rotateZ(Math.PI / 2);
    const leftFront = new THREE.Mesh(frontCasterGeo, this.rubberMaterial);
    leftFront.position.set(-0.3, 0.06, 0.35);
    chair.add(leftFront);

    const rightFront = new THREE.Mesh(frontCasterGeo, this.rubberMaterial);
    rightFront.position.set(0.3, 0.06, 0.35);
    chair.add(rightFront);

    // 4. Seat
    const seatGeo = new THREE.BoxGeometry(0.55, 0.06, 0.55);
    const seat = new THREE.Mesh(seatGeo, this.mattressMaterial);
    seat.position.set(0, 0.48, 0.05);
    chair.add(seat);

    // 5. Backrest
    const backGeo = new THREE.BoxGeometry(0.55, 0.5, 0.05);
    const back = new THREE.Mesh(backGeo, this.mattressMaterial);
    back.position.set(0, 0.74, -0.22);
    back.rotation.x = -0.08;
    chair.add(back);

    // 6. Armrests
    const armGeo = new THREE.BoxGeometry(0.06, 0.03, 0.45);
    const leftArm = new THREE.Mesh(armGeo, this.rubberMaterial);
    leftArm.position.set(-0.31, 0.68, 0.05);
    chair.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, this.rubberMaterial);
    rightArm.position.set(0.31, 0.68, 0.05);
    chair.add(rightArm);

    // 7. Push Handles
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
    handleGeo.rotateX(Math.PI / 2);
    const leftHandle = new THREE.Mesh(handleGeo, this.rubberMaterial);
    leftHandle.position.set(-0.25, 0.98, -0.32);
    chair.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeo, this.rubberMaterial);
    rightHandle.position.set(0.25, 0.98, -0.32);
    chair.add(rightHandle);

    return chair;
  }

  /**
   * Fluorescent Ceiling Light with real PointLight and flicker data
   */
  public static createFluorescentLight(isDefective: boolean = false): {
    group: THREE.Group;
    lightData: FlickeringLightData;
  } {
    const group = new THREE.Group();

    // 1. Metal fixture casing
    const fixtureGeo = new THREE.BoxGeometry(0.4, 0.1, 1.4);
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x222a26,
      roughness: 0.6,
      metalness: 0.5,
    });
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.y = -0.05;
    group.add(fixture);

    // 2. Twin fluorescent tubes (emissive)
    const tubeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8);
    tubeGeo.rotateX(Math.PI / 2);

    const emissiveMat = new THREE.MeshStandardMaterial({
      color: 0x9be8c9,
      emissive: 0x76ccaa,
      emissiveIntensity: isDefective ? 0.8 : 1.6,
      roughness: 0.2,
    });

    const tube1 = new THREE.Mesh(tubeGeo, emissiveMat);
    tube1.position.set(-0.09, -0.1, 0);
    group.add(tube1);

    const tube2 = new THREE.Mesh(tubeGeo, emissiveMat);
    tube2.position.set(0.09, -0.1, 0);
    group.add(tube2);

    // 3. Hanging power cable
    const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6);
    const cableMat = this.rubberMaterial;
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(0.14, 0.15, -0.5);
    group.add(cable);

    // 4. Point light for atmospheric casting (soft greenish hospital tint)
    const light = new THREE.PointLight(0xa5eed6, isDefective ? 1.8 : 3.5, 7.5, 1.8);
    light.position.set(0, -0.25, 0);
    light.castShadow = false; // Keep high FPS on mobile Android
    group.add(light);

    const lightData: FlickeringLightData = {
      light,
      glowMesh: tube1,
      baseIntensity: isDefective ? 1.8 : 3.5,
      flickerSpeed: isDefective ? 15 + Math.random() * 20 : 0.8,
      isDefective,
      timeOffset: Math.random() * 100,
    };

    return { group, lightData };
  }

  /**
   * Interactive Keycard / Medical Record Clipboard
   */
  public static createCollectibleRecord(id: string, name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = `record_${id}`;

    // Clipboard body
    const boardGeo = new THREE.BoxGeometry(0.32, 0.02, 0.44);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x5a4128, // Brown hardboard
      roughness: 0.8,
      metalness: 0.1,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    group.add(board);

    // Paper sheet
    const paperGeo = new THREE.BoxGeometry(0.28, 0.008, 0.38);
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xd9dfd6,
      roughness: 0.9,
    });
    const paper = new THREE.Mesh(paperGeo, paperMat);
    paper.position.y = 0.012;
    group.add(paper);

    // Steel top clip
    const clipGeo = new THREE.BoxGeometry(0.12, 0.025, 0.06);
    const clip = new THREE.Mesh(clipGeo, this.metalMaterial);
    clip.position.set(0, 0.02, -0.18);
    group.add(clip);

    // Glowing access keycard badge
    const keyGeo = new THREE.BoxGeometry(0.1, 0.01, 0.15);
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0x38ef7d,
      emissive: 0x11998e,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const keycard = new THREE.Mesh(keyGeo, keyMat);
    keycard.position.set(0.06, 0.022, 0.06);
    keycard.rotation.y = 0.3;
    group.add(keycard);

    // Floating interaction indicator halo
    const haloGeo = new THREE.RingGeometry(0.18, 0.22, 16);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x48e592,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 0.15;
    halo.name = 'halo';
    group.add(halo);

    group.userData = { isCollectible: true, id, name };
    return group;
  }

  /**
   * Metal Medical Locker / Cabinet
   */
  public static createLocker(): THREE.Group {
    const locker = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.9, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x333d39,
      roughness: 0.65,
      metalness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    locker.add(body);

    // Slits / Louvers
    const ventGeo = new THREE.BoxGeometry(0.4, 0.03, 0.02);
    const ventMat = this.rubberMaterial;
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(0, 1.6 - i * 0.07, 0.31);
      locker.add(vent);
    }

    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8);
    const handle = new THREE.Mesh(handleGeo, this.metalMaterial);
    handle.position.set(0.25, 1.0, 0.32);
    locker.add(handle);

    return locker;
  }
}
