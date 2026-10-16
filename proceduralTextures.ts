import * as THREE from 'three';

// Utility to create high-performance procedural CanvasTextures
export class ProceduralTextureFactory {
  private static maxAnisotropy: number = 4;

  public static setMaxAnisotropy(val: number) {
    this.maxAnisotropy = Math.max(1, val);
  }

  // Dirty cracked hospital floor tiles
  public static createFloorTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base speckled grey/greenish linoleum
    ctx.fillStyle = '#222926';
    ctx.fillRect(0, 0, size, size);

    // Subtle tile grid (4x4 tiles in 512px)
    const tileSize = size / 4;
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        // Tile variance
        const lum = 30 + Math.floor(Math.random() * 12);
        ctx.fillStyle = `rgb(${lum - 3}, ${lum + 4}, ${lum})`;
        ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);

        // Subtle speckled dirt
        for (let i = 0; i < 40; i++) {
          const px = x * tileSize + Math.random() * tileSize;
          const py = y * tileSize + Math.random() * tileSize;
          const alpha = 0.05 + Math.random() * 0.15;
          ctx.fillStyle = `rgba(10, 15, 12, ${alpha})`;
          ctx.fillRect(px, py, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
      }
    }

    // Dark grime around joints
    ctx.strokeStyle = '#0e1210';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tileSize, 0);
      ctx.lineTo(i * tileSize, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * tileSize);
      ctx.lineTo(size, i * tileSize);
      ctx.stroke();
    }

    // Cracks on random tiles
    ctx.strokeStyle = 'rgba(10, 12, 10, 0.7)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c < 3; c++) {
      let cx = 40 + Math.random() * (size - 80);
      let cy = 40 + Math.random() * (size - 80);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let step = 0; step < 6; step++) {
        cx += (Math.random() - 0.5) * 35;
        cy += (Math.random() - 0.5) * 35;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = this.maxAnisotropy;
    return texture;
  }

  // Peeling paint hospital wall (mint green base with dirty plaster underneath)
  public static createWallTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base decaying plaster
    ctx.fillStyle = '#404a44';
    ctx.fillRect(0, 0, size, size);

    // Lower half wainscot hospital green
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#2f3b35');
    grad.addColorStop(0.5, '#28332d');
    grad.addColorStop(0.51, '#1b231f');
    grad.addColorStop(1, '#151c18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Grunge & water drips
    for (let i = 0; i < 60; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      const w = 4 + Math.random() * 25;
      const h = 20 + Math.random() * 80;
      ctx.fillStyle = `rgba(12, 18, 14, ${0.1 + Math.random() * 0.25})`;
      ctx.fillRect(rx, ry, w, h);
    }

    // Mold patches
    for (let m = 0; m < 5; m++) {
      const mx = Math.random() * size;
      const my = Math.random() * size;
      const rad = 25 + Math.random() * 45;
      const mGrad = ctx.createRadialGradient(mx, my, 5, mx, my, rad);
      mGrad.addColorStop(0, 'rgba(8, 14, 10, 0.7)');
      mGrad.addColorStop(0.6, 'rgba(18, 26, 20, 0.4)');
      mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(mx, my, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Peeling paint cracks
    ctx.strokeStyle = 'rgba(200, 200, 190, 0.15)';
    ctx.lineWidth = 1;
    for (let p = 0; p < 8; p++) {
      let px = Math.random() * size;
      let py = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 0; s < 4; s++) {
        px += (Math.random() - 0.5) * 20;
        py += (Math.random() - 0.5) * 20;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = this.maxAnisotropy;
    return texture;
  }

  // Hospital ceiling acoustic tiles
  public static createCeilingTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e2421';
    ctx.fillRect(0, 0, size, size);

    // Acoustic tile grid 2x2
    const s = size / 2;
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = '#28302b';
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);

        // Acoustic pinholes
        ctx.fillStyle = '#141816';
        for (let i = 0; i < 40; i++) {
          ctx.fillRect(x * s + 8 + Math.random() * (s - 16), y * s + 8 + Math.random() * (s - 16), 2, 2);
        }
      }
    }

    // Metal T-bar grid lines
    ctx.strokeStyle = '#111413';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(s, size);
    ctx.moveTo(0, s);
    ctx.lineTo(size, s);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = this.maxAnisotropy;
    return texture;
  }

  // Hospital heavy door texture
  public static createDoorTexture(label: string = 'ROOM 13'): THREE.CanvasTexture {
    const width = 256;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Hospital steel green-gray door
    ctx.fillStyle = '#2a3530';
    ctx.fillRect(0, 0, width, height);

    // Border bevel
    ctx.strokeStyle = '#1b231f';
    ctx.lineWidth = 12;
    ctx.strokeRect(0, 0, width, height);

    // Upper window frame
    ctx.fillStyle = '#101412';
    ctx.fillRect(40, 50, width - 80, 150);
    ctx.strokeStyle = '#3e4d46';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 50, width - 80, 150);

    // Wire mesh inside window
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 45; x < width - 45; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.lineTo(x + 50, 200);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 50, 50);
      ctx.lineTo(x, 200);
      ctx.stroke();
    }

    // Door brass/steel kick plate at bottom
    ctx.fillStyle = '#3a443e';
    ctx.fillRect(15, height - 90, width - 30, 75);
    ctx.strokeStyle = '#191f1c';
    ctx.strokeRect(15, height - 90, width - 30, 75);

    // Panic push bar
    ctx.fillStyle = '#1e2422';
    ctx.fillRect(20, 260, width - 40, 28);
    ctx.fillStyle = '#8f3333';
    ctx.fillRect(35, 264, width - 70, 20);

    // Room sign plate
    ctx.fillStyle = '#131816';
    ctx.fillRect(45, 215, width - 90, 32);
    ctx.strokeStyle = '#5a6861';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 215, width - 90, 32);

    ctx.fillStyle = '#d1dfd8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, 231);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.maxAnisotropy;
    return texture;
  }

  // Wall sign texture (e.g. "WARD 13 - BIOHAZARD")
  public static createSignTexture(text: string, subtext: string = 'AUTHORIZED PERSONNEL ONLY'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Yellow/black warning border
    ctx.fillStyle = '#9e7f1e';
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = '#111412';
    ctx.fillRect(16, 16, 480, 224);

    // Red warning header bar
    ctx.fillStyle = '#8f2020';
    ctx.fillRect(24, 24, 464, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER / RESTRICTED', 256, 49);

    // Title text
    ctx.fillStyle = '#e8d44d';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(text, 256, 125);

    // Subtext
    ctx.fillStyle = '#a6b0a8';
    ctx.font = '16px monospace';
    ctx.fillText(subtext, 256, 185);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.maxAnisotropy;
    return texture;
  }

  // Blood splat decal
  public static createBloodDecal(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, size, size);

    // Dark dried blood
    ctx.fillStyle = 'rgba(75, 10, 10, 0.85)';
    ctx.beginPath();
    ctx.arc(128, 128, 45, 0, Math.PI * 2);
    ctx.fill();

    // Drips & splatters
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 70;
      const r = 3 + Math.random() * 12;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(angle) * dist, 128 + Math.sin(angle) * dist, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Downward drip
    ctx.strokeStyle = 'rgba(75, 10, 10, 0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(128, 150);
    ctx.lineTo(132, 235);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
