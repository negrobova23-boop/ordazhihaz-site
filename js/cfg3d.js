// Общее для 3D-конструкторов (шкаф, кухня): текстура дерева, материалы и детали-коробки.
import * as THREE from "three";

export const mm = 0.001;
let aniso = 4;
// вызвать после создания renderer: чёткость текстуры под углом
export function setAnisotropy(renderer) { aniso = renderer.capabilities.getMaxAnisotropy(); }

// Текстура дерева рисуется в браузере: годовые кольца с «арками» (как на распиле доски),
// волокна, поры и пятна. Узор бесшовный, поэтому повторяется на больших панелях без стыков.
// Один кадр текстуры = TEX_W × TEX_H мм реального размера.
const TEX_W = 500, TEX_H = 1000;
function woodCanvas(hex, w, h) {
  let seed = 7;
  for (const ch of hex) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = rnd();
  const sm = (t) => t * t * (3 - 2 * t);
  // бесшовный шум: решётка повторяется с периодом px × py
  const noise = (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = P[y0 * 256 + x0], b = P[y0 * 256 + x1], c = P[y1 * 256 + x0], d = P[y1 * 256 + x1];
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, px, py) => (noise(x, y, px, py) * 0.57 + noise(x * 2, y * 2, px * 2, py * 2) * 0.29 + noise(x * 4, y * 4, px * 4, py * 4) * 0.14);
  const n = parseInt(hex.slice(1), 16), R = (n >> 16) / 255, G = ((n >> 8) & 255) / 255, B = (n & 255) / 255;
  const rings = 14 + Math.floor(rnd() * 5), TAU = Math.PI * 2, ph = rnd();
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h), px = img.data;
  for (let j = 0; j < h; j++) {
    const v = j / h;
    for (let i = 0; i < w; i++) {
      const u = i / w;
      // волокна почти прямые, «арки» распила появляются только местами
      const warp = fbm(u * 3, v, 3, 1) * 1.8 + fbm(u * 8, v * 2, 8, 2) * 0.35;
      const zone = Math.pow(Math.max(0, Math.sin(TAU * (u + ph))), 4);
      const arch = (0.5 + 0.5 * Math.sin(TAU * (v + 0.3 * fbm(u * 2, v, 2, 1)))) * zone;
      const t = u * rings + warp + arch * 2.2;
      const f = t - Math.floor(t);
      const late = sm(Math.min(1, Math.max(0, (f - 0.72) / 0.2))) * (1 - sm(Math.min(1, Math.max(0, (f - 0.94) / 0.06))));
      const fiber = noise(u * 256, v * 3, 256, 3) * 0.55 + noise(u * 128, v * 2, 128, 2) * 0.45;
      const streak = noise(u * 16, v, 16, 1);
      const pore = Math.max(0, noise(u * 256, v * 48, 256, 48) - 0.8) * 4;
      const blot = fbm(u * 2, v, 2, 1);
      const lum = 1.08 - 0.2 * late - 0.05 * f - 0.18 * (fiber - 0.5) - 0.1 * (streak - 0.5) - 0.14 * pore + 0.07 * (blot - 0.5);
      const k = (j * w + i) * 4;
      px[k] = Math.min(255, 255 * R * lum);
      px[k + 1] = Math.min(255, 255 * G * Math.pow(lum, 1.15));   // тёмные места чуть теплее и насыщеннее
      px[k + 2] = Math.min(255, 255 * B * Math.pow(lum, 1.35));
      px[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
const texCache = new Map();
function woodTexture(hex) {
  if (texCache.has(hex)) return texCache.get(hex);
  const t = new THREE.CanvasTexture(woodCanvas(hex, 512, 1024));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  texCache.set(hex, t);
  return t;
}
// маленький образец для кружка выбора цвета
const swatchCache = new Map();
export function woodSwatch(hex) {
  if (!swatchCache.has(hex)) swatchCache.set(hex, woodCanvas(hex, 96, 192).toDataURL("image/jpeg", 0.85));
  return swatchCache.get(hex);
}
// Развёртка текстуры по реальным размерам детали: волокна идут вдоль длинной стороны,
// у каждой детали свой участок узора, чтобы соседние панели не были одинаковыми.
function woodUV(geo, w, h, d, x, y, z) {
  const uv = geo.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // px, nx, py, ny, pz, nz
  const ou = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 3.17)) % 1, ov = Math.abs(Math.sin(x * 4.1 + y * 9.7 + z * 31.3)) % 1;
  for (let f = 0; f < 6; f++) {
    const [a, b] = faces[f], rot = a > b * 1.2;
    for (let q = 0; q < 4; q++) {
      const i = f * 4 + q, u = uv.getX(i), v = uv.getY(i);
      if (rot) uv.setXY(i, ou + (v * b) / TEX_W, ov + (u * a) / TEX_H);
      else uv.setXY(i, ou + (u * a) / TEX_W, ov + (v * b) / TEX_H);
    }
  }
  uv.needsUpdate = true;
}

const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
export function mat(c, rough) {
  const o = typeof c === "string" ? { color: c } : c;
  const roughness = o.gloss ? 0.18 : rough == null ? 0.62 : rough;
  if (o.wood) return new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture(o.color), roughness: rough == null ? 0.55 : rough, metalness: 0 });
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color), roughness, metalness: 0 });
}
export function box(parent, w, h, d, x, y, z, material) {
  const g = new THREE.BoxGeometry(w * mm, h * mm, d * mm);
  if (material.map) woodUV(g, w, h, d, x, y, z);
  const m = new THREE.Mesh(g, material);
  m.position.set(x * mm, y * mm, z * mm);
  m.castShadow = true;
  m.receiveShadow = true;
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat));
  parent.add(m);
  return m;
}
