import * as THREE from 'three';
import { HEAD_PIN_Z } from './constants';

function canvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  return { canvas: element, ctx };
}

function textureFrom(element: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function tuneAnisotropy(renderer: THREE.WebGLRenderer, textures: THREE.Texture[]): void {
  const max = renderer.capabilities.getMaxAnisotropy();
  for (const texture of textures) {
    texture.anisotropy = max;
    texture.needsUpdate = true;
  }
}

export function makeLaneTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(512, 2048);
  ctx.fillStyle = '#b87432';
  ctx.fillRect(0, 0, 512, 2048);
  const boards = 39;
  const boardWidth = 512 / boards;
  for (let i = 0; i < boards; i++) {
    const tone = 168 + (i % 4) * 14 - (i % 2) * 18;
    ctx.fillStyle = `rgb(${tone + 48},${Math.floor(tone * 0.52)},${Math.floor(tone * 0.18)})`;
    ctx.fillRect(i * boardWidth, 0, boardWidth + 0.6, 2048);
    ctx.strokeStyle = `rgba(70,32,8,${0.15 + (i % 3) * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y <= 2048; y += 8) {
      const x = i * boardWidth + boardWidth * 0.5 + Math.sin(y * 0.012 + i * 1.7) * boardWidth * 0.22;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,14,4,0.55)';
    ctx.fillRect(i * boardWidth, 0, 1.2, 2048);
  }

  const oil = ctx.createLinearGradient(0, 0, 0, 2048);
  oil.addColorStop(0, 'rgba(120, 170, 190, 0.05)');
  oil.addColorStop(0.18, 'rgba(150, 196, 214, 0.18)');
  oil.addColorStop(0.55, 'rgba(126, 176, 198, 0.2)');
  oil.addColorStop(0.78, 'rgba(90, 54, 24, 0)');
  oil.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = oil;
  ctx.fillRect(70, 0, 372, 1700);

  ctx.fillStyle = '#121214';
  ctx.fillRect(8, 10, 496, 18);
  ctx.fillStyle = '#9d1d28';
  ctx.fillRect(8, 30, 496, 5);

  const arrowY = (4.57 / (HEAD_PIN_Z + 1)) * 2048;
  const arrowXs = [0.5, 0.38, 0.62, 0.26, 0.74, 0.16, 0.84];
  arrowXs.forEach((fx, index) => {
    const x = fx * 512;
    const size = index === 0 ? 16 : 11;
    ctx.fillStyle = 'rgba(28,16,8,0.82)';
    ctx.beginPath();
    ctx.moveTo(x, arrowY + size);
    ctx.lineTo(x - size * 0.48, arrowY);
    ctx.lineTo(x + size * 0.48, arrowY);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(20,12,8,0.55)';
  for (const fx of [0.32, 0.5, 0.68]) {
    ctx.beginPath();
    ctx.arc(fx * 512, 2048 * 0.12, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = textureFrom(element);
  texture.flipY = false;
  return texture;
}

export function makeApproachTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(512, 512);
  ctx.fillStyle = '#8d5a2c';
  ctx.fillRect(0, 0, 512, 512);
  const boards = 39;
  const boardWidth = 512 / boards;
  for (let i = 0; i < boards; i++) {
    const tone = 150 + (i % 5) * 8;
    ctx.fillStyle = `rgb(${tone + 30},${Math.floor(tone * 0.48)},${Math.floor(tone * 0.16)})`;
    ctx.fillRect(i * boardWidth, 0, boardWidth + 0.5, 512);
    ctx.fillStyle = 'rgba(40,18,6,0.4)';
    ctx.fillRect(i * boardWidth, 0, 1, 512);
  }
  ctx.fillStyle = 'rgba(18,10,6,0.75)';
  for (const fx of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    ctx.beginPath();
    ctx.arc(fx * 512, 170, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = textureFrom(element);
  texture.flipY = false;
  return texture;
}

export function makeOilTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(256, 512);
  const gradient = ctx.createLinearGradient(128, 0, 128, 512);
  gradient.addColorStop(0, 'rgba(210,236,255,0.0)');
  gradient.addColorStop(0.2, 'rgba(214,240,255,0.55)');
  gradient.addColorStop(0.7, 'rgba(214,240,255,0.35)');
  gradient.addColorStop(1, 'rgba(214,240,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 8;
  for (const x of [40, 90, 150, 200]) {
    ctx.beginPath();
    ctx.moveTo(x, 30);
    ctx.bezierCurveTo(x + 20, 160, x - 24, 300, x + 8, 480);
    ctx.stroke();
  }
  const texture = textureFrom(element);
  texture.flipY = false;
  return texture;
}

export function makePanelTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(256, 512);
  ctx.fillStyle = '#24180f';
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2c1d12' : '#1a120c';
    ctx.fillRect(0, i * 86, 256, 80);
    ctx.strokeStyle = 'rgba(232,194,122,0.18)';
    ctx.strokeRect(10, i * 86 + 8, 236, 64);
  }
  return textureFrom(element);
}

export function makeHazardTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(256, 32);
  for (let x = -32; x < 256; x += 32) {
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 16, 32);
    ctx.fill();
  }
  ctx.fillStyle = '#161616';
  for (let x = -16; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 16, 32);
    ctx.fill();
  }
  return textureFrom(element);
}

export function makeMonogramTexture(): THREE.CanvasTexture {
  const { canvas: element, ctx } = canvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = '#f0d7a2';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f0d7a2';
  ctx.font = '700 92px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EB', 128, 136);
  const texture = textureFrom(element);
  texture.premultiplyAlpha = true;
  return texture;
}

export function woodMaterial(map: THREE.Texture, rough: number, coat: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map,
    roughness: rough,
    metalness: 0.04,
    clearcoat: coat,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.45,
  });
}
