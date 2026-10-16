import * as THREE from 'three';
import { ProceduralTextureFactory } from '../textures/proceduralTextures';
import { HospitalPropsFactory, FlickeringLightData } from './props';

export interface HospitalMapData {
  rootGroup: THREE.Group;
  colliderBoxes: THREE.Box3[];
  flickeringLights: FlickeringLightData[];
  collectibles: THREE.Group[];
  exitDoor: THREE.Group;
  startPosition: THREE.Vector3;
}

export class HospitalMapBuilder {
  private colliders: THREE.Box3[] = [];
  private flickeringLights: FlickeringLightData[] = [];
  private collectibles: THREE.Group[] = [];
  private exitDoor!: THREE.Group;

  public build(): HospitalMapData {
    const root = new THREE.Group();

    // Prepare procedural textures
    const floorTex = ProceduralTextureFactory.createFloorTexture();
    floorTex.repeat.set(8, 20);

    const wallTex = ProceduralTextureFactory.createWallTexture();
    wallTex.repeat.set(2, 1);

    const ceilingTex = ProceduralTextureFactory.createCeilingTexture();
    ceilingTex.repeat.set(6, 15);

    // Standard materials
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.4,
      metalness: 0.1,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.8,
      metalness: 0.05,
    });

    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTex,
      roughness: 0.9,
      metalness: 0.02,
    });

    // 1. FLOOR & CEILING (Main complex)
    const floorGeo = new THREE.PlaneGeometry(36, 50);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0, 0);
    root.add(floorMesh);

    const ceilingGeo = new THREE.PlaneGeometry(36, 50);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceilingMesh.position.set(0, 3.2, 0);
    root.add(ceilingMesh);

    // Helper to add a wall piece with collision
    const addWall = (x: number, z: number, w: number, d: number, label?: string) => {
      const h = 3.2;
      const wallGeo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(wallGeo, wallMat);
      mesh.position.set(x, h / 2, z);
      root.add(mesh);

      // Add to collision list
      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push(box);

      if (label) {
        // Add door sign or room marker
        const signTex = ProceduralTextureFactory.createDoorTexture(label);
        const signMat = new THREE.MeshBasicMaterial({ map: signTex });
        const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), signMat);
        signPlane.position.set(x, 1.2, z + (d / 2) + 0.01);
        root.add(signPlane);
      }
      return mesh;
    };

    // OUTER PERIMETER BOUNDS
    addWall(0, 24, 36, 0.8);   // South end
    addWall(0, -24, 36, 0.8);  // North end
    addWall(-18, 0, 0.8, 48);  // West perimeter
    addWall(18, 0, 0.8, 48);   // East perimeter

    // MAIN CORRIDOR: X between -2.0 and +2.0 (width 4.0m)
    // Runs from Z = -23 to Z = +23
    // Corridor West Wall with doorway openings for Room 101, Morgue, Room 103
    // Room 101 door at Z = -12, Morgue opening at Z = 0, Room 103 door at Z = 8
    addWall(-2.0, -18.5, 0.4, 9.0);   // Wall segment north of Room 101
    // Gap for Room 101 door: Z = -14 to -10 -> Doorway at Z = -12
    addWall(-2.0, -5.5, 0.4, 7.0);    // Wall segment between 101 and Cross Corridor
    // Cross corridor opening at Z = 0 (Z = -2 to +2 open)
    addWall(-2.0, 4.5, 0.4, 5.0);     // Wall segment between Cross and Room 103
    // Gap for Room 103 door at Z = 8
    addWall(-2.0, 16.5, 0.4, 13.0);   // Wall segment south of Room 103

    // Corridor East Wall with doorway openings for Room 102, Records, Room 104
    addWall(2.0, -18.5, 0.4, 9.0);    // Wall segment north of Room 102
    // Gap for Room 102 door at Z = -12
    addWall(2.0, -5.5, 0.4, 7.0);     // Wall segment between 102 and Cross Corridor
    // Cross corridor opening at Z = 0
    addWall(2.0, 4.5, 0.4, 5.0);      // Wall segment between Cross and Room 104
    // Gap for Room 104 door at Z = 8
    addWall(2.0, 16.5, 0.4, 13.0);    // Wall segment south of Room 104

    // ROOM DIVIDERS & INTERIORS
    // Room 101 (Patient Ward): X = -10 to -2, Z = -16 to -8
    addWall(-7.0, -16.0, 10.0, 0.4);  // Room 101 North wall
    addWall(-7.0, -8.0, 10.0, 0.4);   // Room 101 South wall
    addWall(-12.0, -12.0, 0.4, 8.0);  // Room 101 West outer-ish wall

    // Room 102 (Intensive Care ICU): X = 2 to 10, Z = -16 to -8
    addWall(7.0, -16.0, 10.0, 0.4);   // Room 102 North wall
    addWall(7.0, -8.0, 10.0, 0.4);    // Room 102 South wall
    addWall(12.0, -12.0, 0.4, 8.0);   // Room 102 East divider

    // Room 103 (Operating Theatre): X = -10 to -2, Z = 6 to 14
    addWall(-7.0, 6.0, 10.0, 0.4);    // Room 103 North wall
    addWall(-7.0, 14.0, 10.0, 0.4);   // Room 103 South wall
    addWall(-12.0, 10.0, 0.4, 8.0);   // Room 103 West wall

    // Room 104 (Pharmacy & Archives): X = 2 to 10, Z = 6 to 14
    addWall(7.0, 6.0, 10.0, 0.4);     // Room 104 North wall
    addWall(7.0, 14.0, 10.0, 0.4);    // Room 104 South wall
    addWall(12.0, 10.0, 0.4, 8.0);    // Room 104 East wall

    // Morgue (Deep West Wing): X = -14 to -2, Z = -4 to +4
    addWall(-8.0, -4.0, 12.0, 0.4);   // Morgue North wall
    addWall(-8.0, 4.0, 12.0, 0.4);    // Morgue South wall

    // Emergency Exit Wall / Gate at North End (Z = -22.5)
    this.createExitGate(root, 0, -22.5);

    // ADD PROPS & FURNITURE
    this.populateProps(root);

    // ADD LIGHTING RIG
    this.populateLights(root);

    // ADD COLLECTIBLE RECORDS / KEYS
    this.populateCollectibles(root);

    return {
      rootGroup: root,
      colliderBoxes: this.colliders,
      flickeringLights: this.flickeringLights,
      collectibles: this.collectibles,
      exitDoor: this.exitDoor,
      startPosition: new THREE.Vector3(0, 1.6, 20.0), // Start near south elevator
    };
  }

  private createExitGate(root: THREE.Group, x: number, z: number) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, 0, z);

    // Heavy reinforced frame
    const frameGeo = new THREE.BoxGeometry(3.6, 3.2, 0.4);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a211e,
      roughness: 0.5,
      metalness: 0.8,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.6;
    doorGroup.add(frame);

    // Double Steel Doors with Biohazard / Emergency Decal
    const doorTex = ProceduralTextureFactory.createDoorTexture('EXIT WARD 13');
    const doorMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.4,
      metalness: 0.6,
    });
    const doorLeft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.15), doorMat);
    doorLeft.position.set(-0.75, 1.3, 0.1);
    doorGroup.add(doorLeft);

    const doorRight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.15), doorMat);
    doorRight.position.set(0.75, 1.3, 0.1);
    doorGroup.add(doorRight);

    // High security electronic lock panel
    const lockGeo = new THREE.BoxGeometry(0.3, 0.5, 0.1);
    const lockMat = new THREE.MeshStandardMaterial({
      color: 0x111614,
      roughness: 0.2,
      metalness: 0.9,
    });
    const lockPanel = new THREE.Mesh(lockGeo, lockMat);
    lockPanel.position.set(1.6, 1.4, 0.2);
    doorGroup.add(lockPanel);

    // Status LED on lock panel (Red when locked, turns Green when unlocked)
    const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(1.6, 1.5, 0.26);
    led.name = 'lock_led';
    doorGroup.add(led);

    // Emergency Exit Header Sign
    const signTex = ProceduralTextureFactory.createSignTexture('EMERGENCY EXIT', 'WARD 13 ESCAPE ROUTE');
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), signMat);
    signMesh.position.set(0, 2.7, 0.22);
    doorGroup.add(signMesh);

    root.add(doorGroup);
    this.exitDoor = doorGroup;

    // Add door barrier collider
    const doorCollider = new THREE.Box3().setFromObject(doorGroup);
    this.colliders.push(doorCollider);
  }

  private populateProps(root: THREE.Group) {
    // Helper to add prop with collider
    const placeProp = (prop: THREE.Group, x: number, y: number, z: number, rotY: number = 0, addBox: boolean = true) => {
      prop.position.set(x, y, z);
      prop.rotation.y = rotY;
      root.add(prop);

      if (addBox) {
        const box = new THREE.Box3().setFromObject(prop);
        this.colliders.push(box);
      }
    };

    // 1. Corridor Abandoned Gurneys & Wheelchairs
    const gurney1 = HospitalPropsFactory.createHospitalBed();
    placeProp(gurney1, -0.6, 0, 10.0, 0.25); // Slightly askew in hallway

    const wheelchair1 = HospitalPropsFactory.createWheelchair();
    placeProp(wheelchair1, 0.8, 0, -4.0, -0.6); // Abandoned near intersection

    // 2. Room 101 (Patient Ward)
    const bed101a = HospitalPropsFactory.createHospitalBed();
    placeProp(bed101a, -6.5, 0, -14.0, Math.PI / 2);

    const bed101b = HospitalPropsFactory.createHospitalBed();
    placeProp(bed101b, -6.5, 0, -10.0, Math.PI / 2);

    const locker101 = HospitalPropsFactory.createLocker();
    placeProp(locker101, -11.4, 0, -13.0, Math.PI / 2);

    // 3. Room 102 (ICU)
    const bed102 = HospitalPropsFactory.createHospitalBed();
    placeProp(bed102, 6.5, 0, -12.0, -Math.PI / 2);

    const wheelchair102 = HospitalPropsFactory.createWheelchair();
    placeProp(wheelchair102, 9.5, 0, -9.0, 2.1);

    // 4. Room 103 (Operating Theatre)
    // Tilted operating table
    const opBed = HospitalPropsFactory.createHospitalBed();
    opBed.rotation.z = 0.08;
    placeProp(opBed, -6.5, 0, 10.0, 0.4);

    const locker103 = HospitalPropsFactory.createLocker();
    placeProp(locker103, -11.4, 0, 8.0, Math.PI / 2);

    // 5. Room 104 (Pharmacy / Archives)
    const locker104a = HospitalPropsFactory.createLocker();
    placeProp(locker104a, 11.4, 0, 8.0, -Math.PI / 2);
    const locker104b = HospitalPropsFactory.createLocker();
    placeProp(locker104b, 11.4, 0, 10.0, -Math.PI / 2);

    // 6. Morgue (Deep West Wing)
    const morgueTable = HospitalPropsFactory.createHospitalBed();
    placeProp(morgueTable, -8.0, 0, 0, 0);

    const morgueLocker = HospitalPropsFactory.createLocker();
    placeProp(morgueLocker, -13.2, 0, 2.0, Math.PI / 2);

    // 7. Blood decals on floor and walls
    const bloodDecalTex = ProceduralTextureFactory.createBloodDecal();
    const bloodMat = new THREE.MeshBasicMaterial({
      map: bloodDecalTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const bloodFloor1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), bloodMat);
    bloodFloor1.rotation.x = -Math.PI / 2;
    bloodFloor1.position.set(0.2, 0.015, 3.5);
    root.add(bloodFloor1);

    const bloodFloor2 = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), bloodMat);
    bloodFloor2.rotation.x = -Math.PI / 2;
    bloodFloor2.position.set(-6.2, 0.015, 9.8);
    root.add(bloodFloor2);

    const bloodWall = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), bloodMat);
    bloodWall.position.set(-1.79, 1.6, -11.0);
    bloodWall.rotation.y = Math.PI / 2;
    root.add(bloodWall);
  }

  private populateLights(root: THREE.Group) {
    // Array of fluorescent lights along the corridor and inside rooms
    const lightConfigs = [
      // Corridor lights (from south to north)
      { x: 0, z: 16.0, defective: false },
      { x: 0, z: 8.0, defective: true },    // Flickering near room 103/104
      { x: 0, z: 0.0, defective: false },   // At cross corridor
      { x: 0, z: -8.0, defective: true },   // Flickering near room 101/102
      { x: 0, z: -18.0, defective: false }, // Near exit door
      // Room lights
      { x: -6.5, z: -12.0, defective: true }, // Room 101
      { x: 6.5, z: -12.0, defective: false }, // Room 102
      { x: -6.5, z: 10.0, defective: true },  // Operating theatre (creepy flicker)
      { x: 6.5, z: 10.0, defective: false },  // Pharmacy
      { x: -8.0, z: 0.0, defective: true },   // Morgue
    ];

    lightConfigs.forEach((cfg) => {
      const { group, lightData } = HospitalPropsFactory.createFluorescentLight(cfg.defective);
      group.position.set(cfg.x, 3.15, cfg.z);
      root.add(group);
      this.flickeringLights.push(lightData);
    });
  }

  private populateCollectibles(root: THREE.Group) {
    // 4 Keycard Records scattered in rooms
    const items = [
      { id: 'key_1', name: 'Dr. Vance Log #1', x: -6.5, y: 0.82, z: -14.0 },  // In Room 101 on bed
      { id: 'key_2', name: 'ICU Keycard Beta', x: 6.5, y: 0.82, z: -12.0 },   // In Room 102 on bed
      { id: 'key_3', name: 'Surgical Record 13', x: -6.5, y: 0.82, z: 10.0 }, // In Operating Theatre
      { id: 'key_4', name: 'Morgue Override Key', x: -8.0, y: 0.82, z: 0.0 }, // In Morgue
    ];

    items.forEach((item) => {
      const record = HospitalPropsFactory.createCollectibleRecord(item.id, item.name);
      record.position.set(item.x, item.y, item.z);
      root.add(record);
      this.collectibles.push(record);
    });
  }
}
