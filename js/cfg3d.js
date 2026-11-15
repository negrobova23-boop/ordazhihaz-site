// Общее для 3D-конструкторов (шкаф, кухня, комод): текстура дерева, материалы и детали-коробки.
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
// отступ рамки фрезеровки от края фасада (по нему же ставятся ручки, чтобы не попадать на рисунок)
export const millInset = (w, h) => Math.min(60, w * 0.14, h * 0.14);
const shade = (m, k) => { const c = m.clone(); c.color = c.color.clone().multiplyScalar(k); return c; };

// МДФ-фасад w × h толщиной t с фрезеровкой; центр в (cx, cy), середина толщины — z.
// modern — гладкий; vyborka — утопленная филёнка со ступенькой; relief (рифлёнка) — вертикальные желобки;
// classic — рамка с филёнкой.
export function millFace(parent, w, h, t, cx, cy, z, front, style) {
  if (style === "relief" && w >= 60) return reliefFace(parent, w, h, t, cx, cy, z, front);
  if (style === "modern" || w < 120 || h < 120) return box(parent, w, h, t, cx, cy, z, front);
  const zf = z + t / 2;
  if (style === "vyborka") {
    const ins = millInset(w, h), gr = 6, dep = 4;                                   // ширина и глубина паза
    box(parent, w - 2, h - 2, t - dep, cx, cy, z - dep / 2, shade(front, 0.68));      // дно паза
    box(parent, w, ins, t, cx, cy + h / 2 - ins / 2, z, front);                       // рамка
    box(parent, w, ins, t, cx, cy - h / 2 + ins / 2, z, front);
    box(parent, ins, h - 2 * ins, t, cx - w / 2 + ins / 2, cy, z, front);
    box(parent, ins, h - 2 * ins, t, cx + w / 2 - ins / 2, cy, z, front);
    const fw = w - 2 * (ins + gr), fh = h - 2 * (ins + gr), ft = t - 2;              // филёнка на 2 мм ниже рамки
    box(parent, fw, fh, ft, cx, cy, zf - 2 - ft / 2, front);
    return;
  }
  if (style === "shtapik") {                                                          // накладная фигурная рейка по контуру
    const ins = millInset(w, h), b = 14, d = 6, lo = shade(front, 0.88);
    box(parent, w, h, t, cx, cy, z, front);
    const rail = (rw, rh, x, y) => { box(parent, rw, rh, d * 0.5, x, y, zf + d * 0.25, lo); box(parent, rw - (rw > rh ? 0 : 6), rh - (rw > rh ? 6 : 0), d, x, y, zf + d / 2, front); };
    rail(w - 2 * ins, b, cx, cy + h / 2 - ins); rail(w - 2 * ins, b, cx, cy - h / 2 + ins);
    rail(b, h - 2 * ins - b, cx - w / 2 + ins, cy); rail(b, h - 2 * ins - b, cx + w / 2 - ins, cy);
    return;
  }
  // classic: выступающая рамка и филёнка со скосом
  const f = Math.min(85, w * 0.17, h * 0.17), d = 5;
  box(parent, w, h, t, cx, cy, z, front);
  box(parent, w, f, d, cx, cy + h / 2 - f / 2, zf + d / 2, front);
  box(parent, w, f, d, cx, cy - h / 2 + f / 2, zf + d / 2, front);
  box(parent, f, h - 2 * f, d, cx - w / 2 + f / 2, cy, zf + d / 2, front);
  box(parent, f, h - 2 * f, d, cx + w / 2 - f / 2, cy, zf + d / 2, front);
  const p = f + 16;                                                                  // филёнка: тень 6 мм, скос 10 мм
  box(parent, w - 2 * f, h - 2 * f, 1.5, cx, cy, zf + 0.75, shade(front, 0.8));     // тень по внутреннему краю рамки
  box(parent, w - 2 * p + 20, h - 2 * p + 20, 2.5, cx, cy, zf + 1.25, shade(front, 0.9));   // скос филёнки
  box(parent, w - 2 * p, h - 2 * p, 5, cx, cy, zf + 2.5, front);
}

// рифлёнка: лицевая сторона — полукруглые желобки по всей ширине (шаг около 30 мм, глубина до 5 мм).
// Желобки — гладкая поверхность с плавным светом и тенью, как у настоящего фрезерованного МДФ.
function reliefFace(parent, w, h, t, cx, cy, z, front) {
  const n = Math.max(3, Math.round(w / 30)), p = w / n, e = 1, c = p - 2 * e, s = Math.min(5, t * 0.32);
  const R = (c * c / 4 + s * s) / (2 * s), seg = 14, zt = t / 2;
  // профиль лицевой стороны: точки (x, z, нормаль nx, nz), гребни — узкие плоские полоски
  const strips = [];
  for (let k = 0; k < n; k++) {
    const x0 = -w / 2 + k * p, xc = x0 + p / 2, pts = [];
    for (let i = 0; i <= seg; i++) {
      const dx = -c / 2 + (c * i) / seg, sq = Math.sqrt(R * R - dx * dx);
      pts.push([xc + dx, zt - (sq - (R - s)), -dx / R, sq / R]);
    }
    strips.push([[x0, zt, 0, 1], [x0 + e, zt, 0, 1]], pts, [[x0 + p - e, zt, 0, 1], [x0 + p, zt, 0, 1]]);
  }
  const pos = [], nor = [], idx = [];
  for (const st of strips) {
    const b = pos.length / 3;
    for (const [x, zz, nx, nz] of st) {
      pos.push(x * mm, h / 2 * mm, zz * mm, x * mm, -h / 2 * mm, zz * mm);
      nor.push(nx, 0, nz, nx, 0, nz);
    }
    for (let i = 0; i < st.length - 1; i++) { const a = b + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  const holder = new THREE.Group();
  holder.position.set(cx * mm, cy * mm, z * mm);
  parent.add(holder);
  const surf = new THREE.Mesh(g, front);
  surf.castShadow = true; surf.receiveShadow = true;
  holder.add(surf);
  box(holder, w, h, t - s, 0, 0, -s / 2, front);                                // тело фасада за желобками
  // торцы сверху и снизу: виден профиль желобков
  const prof = strips.flat();
  for (const sgn of [1, -1]) {
    // после поворота ось y фигуры становится осью z: сверху — с обратным знаком
    const cap = new THREE.Shape(), k = -sgn * mm;
    cap.moveTo(-w / 2 * mm, (zt - s) * k); cap.lineTo(w / 2 * mm, (zt - s) * k);
    for (let i = prof.length - 1; i >= 0; i--) cap.lineTo(prof[i][0] * mm, prof[i][1] * k);
    const cm = new THREE.Mesh(new THREE.ShapeGeometry(cap), front);
    cm.rotation.x = -sgn * Math.PI / 2; cm.position.y = sgn * h / 2 * mm;
    holder.add(cm);
  }
  return holder;
}

export function box(parent, w, h, d, x, y, z, material) {
  const g = new THREE.BoxGeometry(w * mm, h * mm, d * mm);
  if (material.map && !material.userData.plainUV) woodUV(g, w, h, d, x, y, z);   // мрамор и другие картинки — без развёртки дерева
  const m = new THREE.Mesh(g, material);
  m.position.set(x * mm, y * mm, z * mm);
  m.castShadow = true;
  m.receiveShadow = true;
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat));
  parent.add(m);
  return m;
}
