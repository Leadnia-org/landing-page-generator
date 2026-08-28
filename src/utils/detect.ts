import type { DetectedRegion, Rgb, ScanImage } from "../types";

/** Les mockups font 1440 px de large : on scanne une version reduite, c'est bien plus rapide et aussi precis en pourcentages. */
const MAX_SCAN_WIDTH = 520;

/** Verts WhatsApp officiels + verts fonces courants sur les boutons generes. */
export const WHATSAPP_GREENS: Rgb[] = [
  { r: 37, g: 211, b: 102 },
  { r: 18, g: 140, b: 126 },
  { r: 7, g: 94, b: 84 },
  { r: 22, g: 133, b: 51 },
  { r: 16, g: 84, b: 33 },
  { r: 10, g: 74, b: 29 },
];

export async function fileToScan(file: File): Promise<ScanImage> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SCAN_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Impossible de lire l'image pour la detection.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function pixelAt(scan: ScanImage, x: number, y: number): Rgb {
  const index = (y * scan.width + x) * 4;
  return { r: scan.data[index], g: scan.data[index + 1], b: scan.data[index + 2] };
}

/**
 * Couleur dominante autour d'un point : si l'utilisateur clique sur le texte
 * blanc du bouton, on veut quand meme la couleur du bouton.
 */
export function sampleDominantColor(scan: ScanImage, xPct: number, yPct: number, radius = 6): Rgb {
  const cx = clampInt(Math.round((xPct / 100) * scan.width), 0, scan.width - 1);
  const cy = clampInt(Math.round((yPct / 100) * scan.height), 0, scan.height - 1);
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let y = Math.max(0, cy - radius); y <= Math.min(scan.height - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(scan.width - 1, cx + radius); x += 1) {
      const pixel = pixelAt(scan, x, y);
      const key = ((pixel.r >> 4) << 8) | ((pixel.g >> 4) << 4) | (pixel.b >> 4);
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += pixel.r;
      bucket.g += pixel.g;
      bucket.b += pixel.b;
      buckets.set(key, bucket);
    }
  }

  let best = { count: 0, r: 0, g: 0, b: 0 };
  buckets.forEach((bucket) => {
    if (bucket.count > best.count) best = bucket;
  });

  if (!best.count) return pixelAt(scan, cx, cy);

  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
}

/**
 * Ajuste une zone au bouton situe sous le curseur : remplissage par diffusion
 * depuis le point clique, puis boite englobante. C'est le filet de securite
 * quand la detection automatique rate.
 */
export function fitRegionAtPoint(
  scan: ScanImage,
  xPct: number,
  yPct: number,
  tolerance = 70
): DetectedRegion | null {
  const target = sampleDominantColor(scan, xPct, yPct);
  const mask = buildMask(scan, [target], tolerance);
  const seed = findSeedPixel(scan, mask, xPct, yPct);
  if (!seed) return null;

  const box = floodBox(mask, scan.width, scan.height, seed.x, seed.y);
  if (!box) return null;

  const region = boxToRegion(box, scan);
  // Debordement : le remplissage a quitte le bouton pour envahir une bande ou le fond.
  if (region.width * region.height > 4500) return null;
  if (region.width < 1 || region.height < 0.3) return null;

  return region;
}

/** Balayage complet de l'image a la recherche de rectangles pleins d'une couleur donnee. */
export function detectButtons(scan: ScanImage, tolerance = 70, targets: Rgb[] = WHATSAPP_GREENS): DetectedRegion[] {
  const mask = buildMask(scan, targets, tolerance);
  const totalPixels = scan.width * scan.height;
  const minPixels = Math.max(24, Math.round(totalPixels * 0.0003));
  const visited = new Uint8Array(totalPixels);
  const regions: DetectedRegion[] = [];

  for (let y = 0; y < scan.height; y += 1) {
    for (let x = 0; x < scan.width; x += 1) {
      const index = y * scan.width + x;
      if (!mask[index] || visited[index]) continue;

      const box = floodBox(mask, scan.width, scan.height, x, y, visited);
      if (!box || box.count < minPixels) continue;

      const region = boxToRegion(box, scan);
      const pixelWidth = box.maxX - box.minX + 1;
      const pixelHeight = box.maxY - box.minY + 1;

      if (region.fill < 0.5) continue;
      if (region.width < 5 || region.width > 97) continue;
      if (region.height < 0.4 || region.height > 25) continue;
      if (pixelWidth / pixelHeight < 1.2) continue;

      regions.push(region);
    }
  }

  return regions.sort((a, b) => a.top - b.top).slice(0, 8);
}

/**
 * Cherche un pixel INTERIEUR a la zone coloree. Un pixel de bord fait par
 * anti-crenelage peut correspondre a la couleur tout en etant isole du bouton :
 * partir de la donnait une zone d'un seul pixel.
 */
function findSeedPixel(
  scan: ScanImage,
  mask: Uint8Array,
  xPct: number,
  yPct: number
): { x: number; y: number } | null {
  const cx = clampInt(Math.round((xPct / 100) * scan.width), 0, scan.width - 1);
  const cy = clampInt(Math.round((yPct / 100) * scan.height), 0, scan.height - 1);
  let fallback: { x: number; y: number } | null = null;

  for (let radius = 0; radius <= 24; radius += 1) {
    for (let y = cy - radius; y <= cy + radius; y += 1) {
      for (let x = cx - radius; x <= cx + radius; x += 1) {
        if (x < 0 || y < 0 || x >= scan.width || y >= scan.height) continue;
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
        if (!mask[y * scan.width + x]) continue;
        if (isInteriorPixel(mask, scan.width, scan.height, x, y)) return { x, y };
        if (!fallback) fallback = { x, y };
      }
    }
  }

  return fallback;
}

function isInteriorPixel(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
  const index = y * width + x;
  return Boolean(
    mask[index - 1] &&
      mask[index + 1] &&
      mask[index - width] &&
      mask[index + width] &&
      mask[index - width - 1] &&
      mask[index - width + 1] &&
      mask[index + width - 1] &&
      mask[index + width + 1]
  );
}

function buildMask(scan: ScanImage, targets: Rgb[], tolerance: number): Uint8Array {
  const mask = new Uint8Array(scan.width * scan.height);

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (scan.data[offset + 3] < 128) continue;
    const pixel = { r: scan.data[offset], g: scan.data[offset + 1], b: scan.data[offset + 2] };
    for (const target of targets) {
      if (colorDistance(pixel, target) <= tolerance) {
        mask[index] = 1;
        break;
      }
    }
  }

  return mask;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  count: number;
}

function floodBox(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited = new Uint8Array(width * height)
): Box | null {
  const startIndex = startY * width + startX;
  if (!mask[startIndex] || visited[startIndex]) return null;

  const stack = new Int32Array(width * height);
  let stackSize = 0;
  stack[stackSize] = startIndex;
  stackSize += 1;
  visited[startIndex] = 1;

  const box: Box = { minX: startX, minY: startY, maxX: startX, maxY: startY, count: 0 };

  const pushNeighbour = (neighbour: number): void => {
    if (visited[neighbour] || !mask[neighbour]) return;
    visited[neighbour] = 1;
    stack[stackSize] = neighbour;
    stackSize += 1;
  };

  while (stackSize > 0) {
    stackSize -= 1;
    const index = stack[stackSize];
    const x = index % width;
    const y = (index - x) / width;

    box.count += 1;
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;

    if (x > 0) pushNeighbour(index - 1);
    if (x < width - 1) pushNeighbour(index + 1);
    if (y > 0) pushNeighbour(index - width);
    if (y < height - 1) pushNeighbour(index + width);
  }

  return box;
}

function boxToRegion(box: Box, scan: ScanImage): DetectedRegion {
  const pixelWidth = box.maxX - box.minX + 1;
  const pixelHeight = box.maxY - box.minY + 1;

  return {
    left: round2((box.minX / scan.width) * 100),
    top: round2((box.minY / scan.height) * 100),
    width: round2((pixelWidth / scan.width) * 100),
    height: round2((pixelHeight / scan.height) * 100),
    fill: box.count / (pixelWidth * pixelHeight),
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
