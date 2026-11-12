// Конструктор шкафа: 3D-модель по размерам + ориентировочная цена диапазоном + заявка в WhatsApp.
// Ничего не отправляется на сервер: расчёт идёт в браузере, заявка открывается в WhatsApp.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PRICES, DECORS, FILM_COLORS, PAINT_COLORS } from "./shkaf-prices.js";
import { makeKP } from "./shkaf-kp.js";
import { mm, mat, box, woodSwatch, setAnisotropy } from "./cfg3d.js";

const WA = "https://wa.me/77769994032";
const $ = (s, r) => (r || document).querySelector(s);
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
const T = 16;          // толщина ЛДСП, мм
const PLINTH = 80;     // цоколь, мм

const TYPES = {
  swing: { name: "Распашной шкаф", msg: "распашной шкаф" },
  antresol: { name: "Шкаф с антресолью", msg: "распашной шкаф с антресолью" },
};
const FMATS = {
  ldsp: { name: "ЛДСП", list: DECORS },
  film: { name: "МДФ в плёнке", list: FILM_COLORS },
  paint: { name: "МДФ в краске", list: PAINT_COLORS },
};
const MILLS = { modern: "Модерн", shtapik: "Штапик", vyborka: "Выборка", classic: "Классика" };
// Варианты наполнения: что стоит в отделениях слева направо (повторяется по кругу).
// Это быстрый выбор: дальше количество полок, ящиков и штанг меняется в каждом отделении вручную.
const FILLS = {
  A: { name: "Полки и штанга", seq: ["shelves", "rod"], single: "rod" },
  B: { name: "С ящиками", seq: ["drawers", "rod", "shelves"], single: "drawers" },
  C: { name: "Только полки", seq: ["shelves"], single: "shelves" },
};
const MAX = { s: 10, d: 4, r: 2 };   // сколько максимум можно выбрать в одном отделении
const DRAWER = 220;                   // шаг ящика по высоте, мм
const HANG = 850;                     // минимум места под одну штангу (длина одежды), мм

// state.secs — что стоит в каждом отделении: s полки, d ящики, r штанги.
// fill = "custom", когда клиент поменял количество вручную.
const state = { type: "swing", W: 2000, H: 2400, D: 600, A: 500, doors: 4, fill: "A", secs: [],
  body: "white", fmat: "ldsp", mill: "modern", facade: "white", open: false };
const findIn = (list, id) => list.find((d) => d.id === id) || list[0];
const decor = (id) => findIn(DECORS, id);
const facadeColor = () => findIn(FMATS[state.fmat].list, state.facade);

/* ---------- ограничения ---------- */
function limits(key) {
  if (key === "W") return [600, 4000];
  if (key === "H") return [1800, 3000];
  if (key === "D") return [350, 800];
  return [300, Math.max(300, Math.min(800, state.H - 1500))];   // антресоль: основному отделению остаётся не меньше 1500 мм
}
function doorRange() {
  const min = Math.max(2, Math.ceil(state.W / 600));
  const max = Math.max(min, Math.min(8, Math.floor(state.W / 300)));
  return [min, max];
}
function normalize() {
  for (const k of ["W", "H", "D", "A"]) {
    const [lo, hi] = limits(k);
    state[k] = Math.min(hi, Math.max(lo, state[k]));
  }
  const [lo, hi] = doorRange();
  state.doors = Math.min(hi, Math.max(lo, state.doors));
  if (!FMATS[state.fmat].list.some((c) => c.id === state.facade)) state.facade = FMATS[state.fmat].list[0].id;
  // наполнение по отделениям: из быстрого выбора или то, что клиент выставил вручную
  const n = sectionCounts(state).length, span = mainSpan(state);
  const kinds = fillKinds(state.fill === "custom" ? "A" : state.fill, n);
  const old = state.fill === "custom" ? state.secs : [];
  state.secs = kinds.map((kind, k) => fitCounts(old[k] || presetCounts(kind, span), span));
}

/* ---------- отделения: двери крепятся только к боковинам и перегородкам ---------- */
// 2 двери на отделение; если дверей нечётное число, последнее отделение на одну дверь
function sectionCounts(s) {
  const counts = [];
  for (let left = s.doors; left > 0; left -= left >= 2 ? 2 : 1) counts.push(left >= 2 ? 2 : 1);
  return counts;
}
function mainSpan(s) {
  const yTop = s.type === "antresol" ? s.H - s.A - T / 2 : s.H - T;
  return yTop - (PLINTH + T);
}
function fillKinds(fill, n) {
  const f = FILLS[fill];
  return Array.from({ length: n }, (_, k) => (n === 1 ? f.single : f.seq[k % f.seq.length]));
}
// стартовое количество для варианта из быстрого выбора
function presetCounts(kind, span) {
  if (kind === "rod") return { s: 1, d: 0, r: 1 };
  if (kind === "drawers") return { s: Math.max(2, Math.round((span - 10 - 3 * DRAWER) / 380) - 1), d: 3, r: 0 };
  return { s: Math.max(3, Math.min(7, Math.round(span / 380) - 1)), d: 0, r: 0 };
}
// сколько реально помещается по высоте: ящики снизу, штанги сверху (над первой — полка под шапки), полки в остатке
function fitCounts(c, span) {
  const d = Math.max(0, Math.min(c.d, MAX.d, Math.floor((span - 400) / DRAWER)));
  const free = span - 10 - d * DRAWER;
  const r = Math.max(0, Math.min(c.r, MAX.r, Math.floor((free - (c.s > 0 ? 300 : 0)) / HANG)));
  let s;
  if (r) {
    const hat = c.s > 0 ? 1 : 0;
    s = Math.min(c.s, hat + Math.max(0, Math.floor((free - hat * 300 - r * HANG) / 200)));
  } else {
    s = Math.min(c.s, Math.max(0, Math.floor(free / 170) - 1));
  }
  return { s: Math.max(0, Math.min(MAX.s, s)), d, r };
}
function layout(s) {
  const counts = sectionCounts(s), dw = s.W / s.doors, span = mainSpan(s);
  const kinds = fillKinds(s.fill === "custom" ? "A" : s.fill, counts.length);
  let x = -s.W / 2;
  return counts.map((d, k) => {
    const x0 = x, x1 = x + d * dw;
    x = x1;
    const inL = x0 + (k === 0 ? T : T / 2), inR = x1 - (k === counts.length - 1 ? T : T / 2);
    const cnt = (s.secs && s.secs[k]) || fitCounts(presetCounts(kinds[k], span), span);
    return { doors: d, x0, x1, inL, inR, w: inR - inL, cx: (inL + inR) / 2, cnt };
  });
}
// что внутри отделения: высоты полок, штанг, ящиков (мм от пола)
function contents(sec, yBottom, yTop) {
  const out = { shelves: [], rods: [], drawers: [] };
  const { s, d, r } = sec.cnt;
  let lo = yBottom + 10;
  for (let i = 0; i < d; i++) { out.drawers.push(lo + 95); lo += DRAWER; }
  if (d) out.shelves.push(lo - 25);                 // над ящиками всегда полка (в счёт «Полки» не входит)
  let left = s;
  if (r) {
    let top = yTop;
    if (left > 0) { top = yTop - 300; out.shelves.push(top); left--; }   // полка для головных уборов
    const block = Math.min(1050, (top - lo - left * 200) / r);
    for (let i = 0; i < r; i++) out.rods.push(top - i * block - 70);
    const bottom = top - r * block;                                     // ниже одежды — остальные полки
    for (let i = 1; i <= left; i++) out.shelves.push(lo + ((bottom - lo) * i) / left);
  } else {
    for (let i = 1; i <= left; i++) out.shelves.push(lo + ((yTop - lo) * i) / (left + 1));
  }
  return out;
}

/* ---------- расчёт цены ---------- */
export function estimate(s) {
  const P = PRICES;
  const anti = s.type === "antresol";
  const W = s.W, H = s.H, D = s.D, innerW = W - 2 * T;
  const m2 = (a, b) => (a * b) / 1e6;
  const yBottom = PLINTH + T, yTop = anti ? H - s.A - T / 2 : H - T;
  const mainH = yTop - yBottom;
  const secs = layout(s);

  let body = 0, edgeMM = 0;
  body += 2 * m2(H, D) + 2 * m2(innerW, D) + m2(innerW, PLINTH);   // боковины, крыша, дно, цоколь
  edgeMM += 2 * H + 2 * innerW;
  if (anti) { body += m2(innerW, D); edgeMM += innerW; }           // полка под антресолью
  const parts = secs.length - 1;                                   // вертикальные перегородки
  body += parts * m2(mainH, D - 30); edgeMM += parts * mainH;
  if (anti) { body += parts * m2(s.A - T, D - 30); edgeMM += parts * (s.A - T); }
  let nShelves = 0, nRods = 0, nDrawers = 0;
  for (const sec of secs) {
    const c = contents(sec, yBottom, yTop);
    nShelves += c.shelves.length; nRods += c.rods.length; nDrawers += c.drawers.length;
    body += c.shelves.length * m2(sec.w - 2, D - 30); edgeMM += c.shelves.length * sec.w;
    body += c.drawers.length * (m2(sec.w - 6, 160) + 2 * m2(D - 100, 140) + m2(sec.w - 80, 140) + m2(sec.w - 80, D - 160));
    edgeMM += c.drawers.length * 2 * (sec.w + 160);
  }

  const doorW = W / s.doors;
  const mainDoorH = (anti ? H - s.A - 2 : H - 2) - 100;
  const antDoorH = anti ? s.A - 4 : 0;
  const facade = s.doors * (m2(doorW, mainDoorH) + (anti ? m2(doorW, antDoorH) : 0));
  const facadePerim = s.doors * (2 * (doorW + mainDoorH) + (anti ? 2 * (doorW + antDoorH) : 0));

  // ЛДСП целыми листами (лист уже с распилом и присадкой); корпус и фасады одного декора — из общих листов
  const area = {};
  const addArea = (id, a) => { area[id] = (area[id] || 0) + a; };
  addArea(s.body, body);
  let facadeCost = 0;
  if (s.fmat === "ldsp") {
    addArea(s.facade, facade); edgeMM += facadePerim;
  } else {
    facadeCost = facade * P.facade[s.fmat][s.mill === "modern" ? "plain" : "frame"];
  }
  let material = 0;
  for (const [id, a] of Object.entries(area)) {
    const sh = P.sheet[decor(id).tier];
    material += Math.ceil(a / (sh.area * P.use.ldsp)) * sh.price;
  }
  const edging = (edgeMM / 1000) * 1.05 * P.edgePerM;
  const back = Math.ceil(m2(W, H) / (P.back.area * P.use.back)) * P.back.price;

  const hw = P.hardware;
  const hingesPerDoor = mainDoorH > 2000 ? 5 : mainDoorH > 1600 ? 4 : mainDoorH > 900 ? 3 : 2;
  let rodLen = 0;
  for (const sec of secs) rodLen += contents(sec, yBottom, yTop).rods.length * sec.w / 1000;
  let hardware = hw.kit + nRods * hw.rod + rodLen * hw.rodPerM + nDrawers * hw.drawer;
  hardware += s.doors * (hingesPerDoor * hw.hinge + hw.handle);
  if (anti) hardware += s.doors * (2 * hw.hinge + hw.handle);
  const design = (W / 1000) * P.designPerM;

  const base = material + facadeCost + edging + back + hardware + design;
  const r = (x) => Math.round(x / P.roundTo) * P.roundTo;
  const partsOut = { "ЛДСП с распилом и присадкой": material, "Кромка": edging, "Задняя стенка ЛХДФ": back, "Фурнитура DTC и установка ручек": hardware, "Работа конструктора": design };
  if (facadeCost) partsOut["Фасады МДФ"] = facadeCost;
  return { mid: base, low: r(base * P.range.low), high: r(base * P.range.high), parts: partsOut };
}

/* ---------- 3D ---------- */
let renderer, scene, camera, controls, group, anim = { open: 0 }, doorsRef = [], ready = false;
const root = $("#cfg-canvas");

function initThree() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    root.innerHTML = '<p class="muted cfg-nogl">3D недоступно в этом браузере. Расчёт стоимости работает, вы можете отправить заявку.</p>';
    return false;
  }
  setAnisotropy(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;                       // колесо мыши прокручивает страницу, а не приближает камеру
  renderer.domElement.style.touchAction = "pan-y";   // вертикальный свайп прокручивает страницу, горизонтальный вращает шкаф
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2a20, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(2.5, 4.5, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  group = new THREE.Group();
  scene.add(group);
  new ResizeObserver(resize).observe(root);
  resize();
  renderer.setAnimationLoop(tick);
  return true;
}

function resize() {
  const w = root.clientWidth || 600, h = root.clientHeight || 420;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function tick() {
  const target = state.open ? 1 : 0;
  anim.open += (target - anim.open) * 0.12;
  if (Math.abs(target - anim.open) < 0.001) anim.open = target;
  for (const d of doorsRef) d.update(anim.open);
  controls.update();
  renderer.render(scene, camera);
}


// фасад двери с фрезеровкой (только для МДФ)
function doorFace(parent, w, h, cx, front, style) {
  box(parent, w, h, T, cx, 0, 0, front);
  if (state.fmat === "ldsp" || style === "modern") return;
  const zf = T / 2;
  const ins = Math.min(70, w * 0.14, h * 0.14);
  if (style === "shtapik") {
    const b = 12, d = 6;
    box(parent, w - 2 * ins, b, d, cx, h / 2 - ins, zf + d / 2, front);
    box(parent, w - 2 * ins, b, d, cx, -h / 2 + ins, zf + d / 2, front);
    box(parent, b, h - 2 * ins, d, cx - w / 2 + ins, 0, zf + d / 2, front);
    box(parent, b, h - 2 * ins, d, cx + w / 2 - ins, 0, zf + d / 2, front);
  } else if (style === "vyborka") {
    const dark = front.clone();
    dark.color = dark.color.clone().multiplyScalar(0.7);
    const b = 7, d = 1;
    box(parent, w - 2 * ins, b, d, cx, h / 2 - ins, zf + d / 2, dark);
    box(parent, w - 2 * ins, b, d, cx, -h / 2 + ins, zf + d / 2, dark);
    box(parent, b, h - 2 * ins, d, cx - w / 2 + ins, 0, zf + d / 2, dark);
    box(parent, b, h - 2 * ins, d, cx + w / 2 - ins, 0, zf + d / 2, dark);
  } else if (style === "classic") {
    const f = Math.min(85, w * 0.17, h * 0.17), d = 5;
    box(parent, w, f, d, cx, h / 2 - f / 2, zf + d / 2, front);
    box(parent, w, f, d, cx, -h / 2 + f / 2, zf + d / 2, front);
    box(parent, f, h - 2 * f, d, cx - w / 2 + f / 2, 0, zf + d / 2, front);
    box(parent, f, h - 2 * f, d, cx + w / 2 - f / 2, 0, zf + d / 2, front);
    const p = f + Math.min(40, w * 0.08);
    box(parent, w - 2 * p, h - 2 * p, 4, cx, 0, zf + 2, front);
  }
}

// дверь на петлях: hingeX — ребро боковины или перегородки, dir = +1 (дверь уходит влево от петли) или -1 (вправо)
function hingedDoor(hingeX, toRight, y0, y1, dw, front, metal, handleLen) {
  const { D } = state;
  const doorH = y1 - y0, yc = (y0 + y1) / 2;
  const pivot = new THREE.Group();
  pivot.position.set(hingeX * mm, yc * mm, (D / 2 + T / 2) * mm);
  const off = toRight ? dw / 2 : -dw / 2;
  doorFace(pivot, dw - 3, doorH, off, front, state.mill);
  const hx = toRight ? off + dw / 2 - 45 : off - dw / 2 + 45;
  box(pivot, 12, Math.min(handleLen, doorH * 0.3), 14, hx, 0, T / 2 + 10, metal);
  group.add(pivot);
  const dir = toRight ? -1 : 1;
  doorsRef.push({ update: (t) => { pivot.rotation.y = dir * 1.75 * t; } });
}
function doorRow(secs, y0, y1, front, metal, handleLen) {
  const dw = state.W / state.doors;
  secs.forEach((sec, k) => {
    if (sec.doors === 2) {
      hingedDoor(sec.x0, true, y0, y1, dw, front, metal, handleLen);     // левая дверь на левой стенке отделения
      hingedDoor(sec.x1, false, y0, y1, dw, front, metal, handleLen);    // правая дверь на правой стенке отделения
    } else {
      const last = k === secs.length - 1;
      hingedDoor(last ? sec.x1 : sec.x0, !last, y0, y1, dw, front, metal, handleLen);
    }
  });
}

function build() {
  if (!ready) return;
  while (group.children.length) {
    const c = group.children.pop();
    c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  doorsRef = [];
  const { W, H, D } = state;
  const anti = state.type === "antresol";
  const body = mat(decor(state.body));
  const front = mat(facadeColor(), state.fmat === "paint" ? 0.45 : 0.5);
  const metal = mat("#b9bcc0", 0.3);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.35, metalness: 0.4 });   // штанга чёрная
  const innerW = W - 2 * T;
  const yBottom = PLINTH + T;
  const yTop = anti ? H - state.A - T / 2 : H - T;
  const secs = layout(state);

  // корпус
  box(group, T, H, D, -(W / 2 - T / 2), H / 2, 0, body);
  box(group, T, H, D, W / 2 - T / 2, H / 2, 0, body);
  box(group, innerW, T, D, 0, H - T / 2, 0, body);
  box(group, innerW, T, D, 0, PLINTH + T / 2, 0, body);
  box(group, innerW, PLINTH, T, 0, PLINTH / 2, D / 2 - 40, body);
  box(group, innerW, H - PLINTH, 4, 0, (H + PLINTH) / 2, -D / 2 + 2, mat("#d8d4c8", 0.8));
  if (anti) box(group, innerW, T, D, 0, H - state.A, 0, body);

  // перегородки между отделениями (на них крепятся двери)
  for (let k = 1; k < secs.length; k++) {
    const x = secs[k].x0;
    box(group, T, yTop - yBottom, D - 20, x, (yTop + yBottom) / 2, -10, body);
    if (anti) box(group, T, state.A - T, D - 20, x, H - state.A / 2, -10, body);
  }

  // наполнение отделений
  for (const sec of secs) {
    const c = contents(sec, yBottom, yTop);
    for (const y of c.shelves) box(group, sec.w - 2, T, D - 30, sec.cx, y, -15, body);
    for (const y of c.rods) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(8 * mm, 8 * mm, (sec.w - 10) * mm, 16), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(sec.cx * mm, y * mm, 0);
      rod.castShadow = true;
      group.add(rod);
    }
    for (const y of c.drawers) {
      box(group, sec.w - 6, 160, T, sec.cx, y, D / 2 - 60, body);                     // лицевая панель ящика
      box(group, T, 140, D - 160, sec.cx - sec.w / 2 + 40, y - 10, -40, body);
      box(group, T, 140, D - 160, sec.cx + sec.w / 2 - 40, y - 10, -40, body);
      box(group, 140, 12, 14, sec.cx, y + 40, D / 2 - 60 + T / 2 + 8, metal);
    }
  }

  // двери: основное отделение и, если есть, антресоль
  if (anti) {
    doorRow(secs, 100, H - state.A - 2, front, metal, 260);
    doorRow(secs, H - state.A + 2, H - 2, front, metal, 140);
  } else {
    doorRow(secs, 100, H - 2, front, metal, 260);
  }
  fitCamera();
}

let lastFit = 0;
function fitCamera() {
  const size = Math.max(state.W, state.H) * mm;
  const want = size * 1.8;
  controls.target.set(0, state.H * mm * 0.46, 0);
  const dist = camera.position.distanceTo(controls.target);
  if (!lastFit || dist < want * 0.7 || dist > want * 1.6) {
    camera.position.set(want * 0.55, state.H * mm * 0.62 + want * 0.18, want * 0.95);
    lastFit = 1;
  }
  camera.near = 0.1; camera.far = 40;
  camera.updateProjectionMatrix();
}

/* ---------- интерфейс ---------- */
const DIM_FIELDS = [["f-w", "h-w", "W"], ["f-h", "h-h", "H"], ["f-d", "h-d", "D"], ["f-a", "h-a", "A"]];

function swatches(host, list, key) {
  host.innerHTML = "";
  for (const d of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw" + (d.wood ? " wood" : "") + (d.gloss ? " gloss" : "");
    b.style.setProperty("--c", d.color);
    if (d.wood) b.style.backgroundImage = `url(${woodSwatch(d.color)})`;
    b.title = d.name;
    b.setAttribute("aria-label", d.name);
    b.setAttribute("aria-pressed", String(state[key] === d.id));
    b.addEventListener("click", () => { state[key] = d.id; refresh(); });
    host.appendChild(b);
  }
}

function syncDims() {
  $("#row-a").hidden = state.type !== "antresol";
  for (const [id, hintId, key] of DIM_FIELDS) {
    const el = $("#" + id);
    const [lo, hi] = limits(key);
    el.min = lo; el.max = hi;
    $("#" + hintId).textContent = "от " + lo + " до " + hi;
    if (document.activeElement !== el) { el.value = state[key]; el.removeAttribute("aria-invalid"); }
  }
}

// окошки «полки / ящики / штанги» для каждого отделения; в списке только то, что помещается по высоте
const SEC_FIELDS = [["s", "Полки"], ["d", "Ящики"], ["r", "Штанги"]];
function sectionRows() {
  const host = $("#cfg-secs"), span = mainSpan(state), secs = layout(state);
  host.innerHTML = "";
  secs.forEach((sec, k) => {
    const row = document.createElement("div");
    row.className = "sec-row";
    const name = document.createElement("p");
    name.className = "sec-name";
    name.innerHTML = `Отделение ${k + 1} <small>${sec.doors === 2 ? "2 двери" : "1 дверь"}, ширина ${Math.round(sec.w)} мм</small>`;
    row.appendChild(name);
    for (const [f, label] of SEC_FIELDS) {
      const cur = state.secs[k];
      const max = fitCounts({ ...cur, [f]: MAX[f] }, span)[f];
      const l = document.createElement("label");
      l.textContent = label;
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", `${label}, отделение ${k + 1}`);
      for (let v = 0; v <= max; v++) {
        const o = document.createElement("option");
        o.value = v; o.textContent = v;
        if (v === cur[f]) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        state.secs[k] = { ...state.secs[k], [f]: +sel.value };
        state.fill = "custom";
        refresh();
      });
      l.appendChild(sel);
      row.appendChild(l);
    }
    host.appendChild(row);
  });
}
function secText(c, k) {
  return `отделение ${k + 1}: полок ${c.s}, ящиков ${c.d}, штанг ${c.r}` + (c.d ? " + полка над ящиками" : "");
}
function fillText() {
  const per = state.secs.map((c, k) => secText(c, k)).join("; ");
  return (state.fill === "custom" ? "своё" : FILLS[state.fill].name.toLowerCase()) + " (" + per + ")";
}

function pressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
}

function refresh(skipBuild) {
  normalize();
  pressed("[data-type]", "type", state.type);
  pressed("[data-fill]", "fill", state.fill);
  pressed("[data-fmat]", "fmat", state.fmat);
  pressed("[data-mill]", "mill", state.mill);
  $("#mill-row").hidden = state.fmat === "ldsp";
  syncDims();
  const [lo, hi] = doorRange();
  const sel = $("#f-doors");
  sel.innerHTML = "";
  for (let n = lo; n <= hi; n++) {
    const o = document.createElement("option");
    o.value = n; o.textContent = n + (n < 5 ? " двери" : " дверей");
    if (n === state.doors) o.selected = true;
    sel.appendChild(o);
  }
  sectionRows();
  swatches($("#sw-body"), DECORS, "body");
  swatches($("#sw-facade"), FMATS[state.fmat].list, "facade");
  $("#n-body").textContent = decor(state.body).name;
  $("#n-facade").textContent = facadeColor().name;
  $("#cfg-open").textContent = state.open ? "Закрыть двери" : "Открыть двери";
  $("#cfg-open").setAttribute("aria-pressed", String(state.open));
  if (!skipBuild) build();
  price();
}

function facadeText() {
  if (state.fmat === "ldsp") return `ЛДСП, ${facadeColor().name}`;
  return `${FMATS[state.fmat].name}, фрезеровка «${MILLS[state.mill]}», цвет ${facadeColor().name}`;
}

function price() {
  const e = estimate(state);
  $("#cfg-low").textContent = fmt(e.low);
  $("#cfg-high").textContent = fmt(e.high);
  $("#cfg-breakdown").innerHTML = Object.entries(e.parts).map(([k, v]) => `<li><span>${k}</span><b>${fmt(Math.round(v / 100) * 100)}</b></li>`).join("");
  const anti = state.type === "antresol";
  const lines = [
    "Здравствуйте! Хочу рассчитать шкаф (с сайта ordazhihaz.kz, конструктор).",
    `Тип: ${TYPES[state.type].msg}`,
    `Размеры: ширина ${state.W}, высота ${state.H}, глубина ${state.D} мм` + (anti ? `; антресоль ${state.A} мм` : ""),
    `Двери: ${state.doors}${anti ? " + " + state.doors + " на антресоли" : ""}; наполнение: ${fillText()}`,
    `Корпус: ЛДСП, ${decor(state.body).name}`,
    `Фасады: ${facadeText()}`,
    `Ориентировочно на сайте: от ${fmt(e.low)} до ${fmt(e.high)}`,
    "Фото или план пришлю в этот чат.",
  ];
  $("#cfg-send").href = WA + "?text=" + encodeURIComponent(lines.join("\n"));
}

/* ---------- КП для скачивания ---------- */
// снимок 3D-модели с одного и того же ракурса; openT: 0 — двери закрыты, 1 — открыты
function snapshot(openT) {
  if (!ready) return null;
  const pos = camera.position.clone();
  const want = Math.max(state.W, state.H) * mm * 1.8;
  camera.position.set(want * 0.42, state.H * mm * 0.6 + want * 0.12, want * 1.0);
  camera.lookAt(controls.target);
  for (const d of doorsRef) d.update(openT);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  camera.position.copy(pos);
  camera.lookAt(controls.target);
  for (const d of doorsRef) d.update(anim.open);
  return url;
}
async function downloadKP(btn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Готовлю КП…";
  try {
    const e = estimate(state), anti = state.type === "antresol";
    const nd = state.secs.reduce((a, c) => a + c.d, 0), nr = state.secs.reduce((a, c) => a + c.r, 0);
    await makeKP({
      subtitle: "по изготовлению шкафа",
      section: "Шкаф",
      name: `${TYPES[state.type].name} ${state.W}×${state.H}×${state.D} мм` + (anti ? `, антресоль ${state.A} мм` : ""),
      lines: [
        `- Двери: ${state.doors} распашные на петлях` + (anti ? ` + ${state.doors} на антресоли` : ""),
        `- Корпус: ЛДСП 16 мм, ${decor(state.body).name}`,
        `- Фасады: ${facadeText()}`,
        ...state.secs.map((c, k) => "- " + secText(c, k).replace(/^о/, "О")),
        `- Задняя стенка ДВП, цоколь ${PLINTH} мм`,
        `- Фурнитура DTC: петли с доводчиком, полкодержатели` + (nd ? ", скрытые направляющие с доводчиком" : "") + (nr ? ", штанги" : ""),
      ],
      images: [snapshot(0), snapshot(1)],
      low: e.low,
      high: e.high,
      conditions: [
        "Стоимость ориентировочная: рассчитана в конструкторе на сайте ordazhihaz.kz. Точную цену менеджер назовёт после замера и согласования проекта.",
        "Замер — 10 000 ₸, засчитывается в стоимость заказа.",
        "Материалы, цвета и фурнитура подбираются и согласовываются по образцам в нашем офисе. Цвета на изображениях приблизительные.",
        "Условия оплаты: предоплата 70%, остаток 30% перед монтажом.",
        "Доставка и монтаж входят в стоимость.",
        "В стоимость не входят: ручки (их установка включена).",
        "Чтобы получить точное КП, отправьте этот расчёт нам в WhatsApp.",
      ],
      file: `КП_ORDA_ZHIHAZ_шкаф_${state.W}x${state.H}`,
    });
  } catch (err) {
    console.error(err);
    alert("Не удалось сформировать КП. Напишите нам в WhatsApp — пришлём КП.");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function bindDim(id, key) {
  const el = $("#" + id);
  // пока человек набирает число, обновляем модель только когда значение в допустимых пределах
  el.addEventListener("input", () => {
    const v = Math.round(+el.value);
    const [lo, hi] = limits(key);
    if (el.value !== "" && v >= lo && v <= hi) {
      el.removeAttribute("aria-invalid");
      state[key] = v;
      refresh();
    } else {
      el.setAttribute("aria-invalid", "true");
    }
  });
  // при выходе из поля приводим значение к ближайшему допустимому
  el.addEventListener("change", () => {
    const [lo, hi] = limits(key);
    let v = Math.round(+el.value);
    if (!el.value || isNaN(v)) v = state[key];
    state[key] = Math.min(hi, Math.max(lo, v));
    el.value = state[key];
    el.removeAttribute("aria-invalid");
    refresh();
  });
}

function bind() {
  const on = (sel, attr, key) => document.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => { state[key] = b.dataset[attr]; refresh(); }));
  on("[data-type]", "type", "type");
  on("[data-fill]", "fill", "fill");
  on("[data-fmat]", "fmat", "fmat");
  on("[data-mill]", "mill", "mill");
  for (const [id, , key] of DIM_FIELDS) bindDim(id, key);
  $("#f-doors").addEventListener("change", (e) => { state.doors = +e.target.value; refresh(); });
  $("#cfg-open").addEventListener("click", () => { state.open = !state.open; refresh(true); });
  $("#cfg-kp").addEventListener("click", (e) => downloadKP(e.currentTarget));
}

if (!PRICES.confirmed) {
  $("#cfg-test").hidden = false;
  $("#cfg-breakdown-wrap").hidden = false;
}
ready = initThree();
bind();
refresh();
