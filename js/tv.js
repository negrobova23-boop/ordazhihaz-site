// Конструктор ТВ-зоны: клиент вводит ширину стены и высоту потолка, получает готовые решения под этот размер,
// выбирает одно и настраивает: тумба по секциям (до 700 мм: ящики, откидные дверцы, стекло, ниши), пеналы
// (стекло, открытые полки, глухие), антресоль, панель за телевизором (рейки, камень, дерево), подсветка, материалы.
// 3D, цена диапазоном, КП и заявка в WhatsApp. Ничего не отправляется на сервер.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PRICES, DECORS, FILM_COLORS, PAINT_COLORS } from "./shkaf-prices.js";
import { KITCHEN } from "./kuhnya-prices.js";
import { makeKP } from "./shkaf-kp.js";
import { mm, mat, box, millFace, millInset, woodSwatch, setAnisotropy } from "./cfg3d.js";

const WA = "https://wa.me/77769994032";
const $ = (s, r) => (r || document).querySelector(s);
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
const T = 16;            // ЛДСП
const GAP = 3;           // зазор между фасадами
const PLINTH = 80;       // цоколь — МДФ, как фасады
const LEG_H = 120;       // высота лофт-опоры
const WALL_Y = 350;      // низ подвесной тумбы от пола
const SEC_MAX = 700;     // секция тумбы не шире 700 мм
const BRIDGE_H = 450;    // антресоль над телевизором
const handles = (w) => (w > 600 ? 2 : 1);
const handleXs = (w) => (handles(w) === 2 ? [-w / 4, w / 4] : [0]);
const handleOff = (w, h) => Math.max(10, Math.min(20, millInset(w, h) / 2));
// подъёмник-доводчик откидной вниз дверцы: один, на тяжёлую дверцу (шире 600, больше 0,3 м² или со стеклом) — два
const stays = (w, h, glass) => (glass || w > 600 || w * h > 300000 ? 2 : 1);
const hingesFor = (h) => (h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5);

// готовые решения (по фото, которые прислала Ольга)
const SOLS = {
  tumba:    { name: "Только тумба", desc: "тумба без пеналов; панель за телевизором — по желанию", pens: 0, panel: "none", min: 600 },
  vitrina:  { name: "Витрина и тумба", desc: "высокий пенал со стеклом и подсветкой, длинная подвесная тумба, рейки за телевизором", pens: 1, penType: "glass", panel: "slats", min: 2000 },
  stellazh: { name: "Стеллаж и тумба", desc: "открытый стеллаж сбоку, панель под камень за телевизором, подвесная тумба", pens: 1, penType: "open", panel: "stone", min: 2000 },
  antresol: { name: "Две витрины и антресоль", desc: "пеналы с двух сторон (внизу глухие дверцы, вверху стекло), антресоль над телевизором, панель под дерево", pens: 2, penType: "combo", panel: "wood", bridge: true, min: 2600 },
  dve:      { name: "Две витрины", desc: "два пенала со стеклом во всю высоту, панель под камень, тумба между ними", pens: 2, penType: "glass", panel: "stone", min: 2600 },
  loft:     { name: "Лофт", desc: "металлические стеллажи с полками по краям, тумба на лофт-опорах", pens: 2, penType: "loft", panel: "none", min: 2400 },
};
const LOFT_POST = 30;    // профиль лофт-стеллажа 30×30, чёрный
const SECS = { drawer: "ящик", flap: "откидная дверца", glass: "откидная дверца со стеклом", niche: "открытая ниша" };
const MOUNTS = { plinth: "на цоколе", loft: "на металлических лофт-опорах", wall: "подвесная, на стене" };
const PTYPES = { glass: "дверь со стеклом в рамке", combo: "низ — глухая дверь, верх — стекло в рамке", doors: "глухая дверь", open: "открытые полки", loft: "металлический лофт-стеллаж с полками из ЛДСП" };
const PANELS = { none: "без панели", slats: "рейки", stone: "панель под камень", wood: "панель под дерево" };
const STONES = [["calacatta", "Мрамор Калакатта"], ["arabescato", "Мрамор Арабескато"], ["onyx", "Оникс"], ["sahara", "Сахара нуар"], ["carrara", "Мрамор Каррара"], ["granite-grey", "Гранит серый"]];
const FRAMES = { silver: ["серебро", "#c4c7ca"], black: ["чёрный", "#2a2b2e"], brass: ["латунь", "#b8975a"], bronze: ["бронза", "#86664a"] };
const FMATS = {
  ldsp: { name: "ЛДСП", list: DECORS },
  film: { name: "МДФ в плёнке", list: FILM_COLORS },
  paint: { name: "МДФ в краске", list: PAINT_COLORS },
};
const MILLS = { modern: "Модерн", relief: "Рифлёнка", vyborka: "Выборка", classic: "Классика" };
const PANEL_M2 = 45000;  // стеновая панель за ТВ, за м² — цена для клиента, как на странице «Стеновые панели» («от 45 000»)

const state = { wall: 3600, ceil: 2700, sol: "vitrina", tumW: 1800, H: 400, D: 400, mount: "wall", secs: [],
  body: "white", fmat: "film", mill: "modern", facade: "f-white", sides: false, fit: "dtc", grip: "push", frame: "black",
  penSide: "left", penType: "glass", penW: 600, penD: 400, panel: "slats", panelDecor: "white", stone: "calacatta",
  light: true, open: false };
const findIn = (list, id) => list.find((d) => d.id === id) || list[0];
const decor = (id) => findIn(DECORS, id);
const facadeColor = () => findIn(FMATS[state.fmat].list, state.facade);
const sol = () => SOLS[state.sol];

/* ---------- размеры и раскладка ---------- */
const LIMITS = { wall: [600, 6000], ceil: [2400, 3200], H: [250, 600], D: [350, 650], penD: [300, 500] };
function limits(key) {
  if (key === "tumW") return [600, Math.min(2500, state.wall)];
  if (key === "penW") return [400, 1000];
  return LIMITS[key];
}
const secCount = (W) => Math.max(1, Math.ceil((W - 2 * T) / SEC_MAX));
const fits = (id) => state.wall >= SOLS[id].min && state.wall - SOLS[id].pens * state.penW >= 600;
function normalize() {
  for (const k of ["wall", "ceil", "H", "D", "penW", "penD", "tumW"]) {
    const [lo, hi] = limits(k);
    state[k] = Math.min(hi, Math.max(lo, state[k]));
  }
  if (!fits(state.sol)) state.sol = Object.keys(SOLS).filter(fits).pop() || "tumba";
  const n = secCount(layout().tumba.w);
  while (state.secs.length < n) state.secs.push(state.secs[state.secs.length - 1] || "drawer");
  state.secs.length = n;
  if (!FMATS[state.fmat].list.some((c) => c.id === state.facade)) state.facade = FMATS[state.fmat].list[0].id;
}
const baseH = () => (state.mount === "plinth" ? PLINTH : state.mount === "loft" ? LEG_H : WALL_Y);
const penBase = () => (state.mount === "loft" ? LEG_H : PLINTH);
const drawersIn = (H) => (H >= 450 ? 2 : 1);
// где что стоит на стене: x от левого края стены (−wall/2), мм
function layout() {
  const s = state, S = SOLS[s.sol], half = s.wall / 2, pw = s.penW;
  const L = { pens: [], tumba: null, bridge: null, panel: null };
  let x0 = -half, x1 = half;
  if (S.pens === 2) {
    L.pens.push({ x: -half + pw / 2, side: -1 }, { x: half - pw / 2, side: 1 });
    x0 += pw; x1 -= pw;
  } else if (S.pens === 1) {
    const side = s.penSide === "left" ? -1 : 1;
    L.pens.push({ x: side * (half - pw / 2), side });
    if (side < 0) x0 += pw; else x1 -= pw;
  }
  for (const p of L.pens) {
    p.w = pw; p.d = s.penD;
    if (s.penType === "loft") { p.y0 = 0; p.h = Math.min(2000, s.ceil - 400); }   // лофт-стеллаж стоит на своих стойках, не до потолка
    else { p.y0 = penBase(); p.h = s.ceil - p.y0; }
  }
  const tw = S.pens ? x1 - x0 : s.tumW, tx = S.pens ? (x0 + x1) / 2 : 0;
  L.tumba = { x: tx, w: tw, y0: baseH() };
  const top = L.tumba.y0 + s.H;
  if (S.bridge) L.bridge = { x: (x0 + x1) / 2, w: x1 - x0, y0: s.ceil - BRIDGE_H, h: BRIDGE_H, d: Math.min(s.penD, 400) };
  if (s.panel !== "none") {
    const y1 = L.bridge ? L.bridge.y0 : S.pens === 2 ? s.ceil : Math.min(s.ceil - 250, top + 1500);
    const pw2 = S.pens === 2 ? x1 - x0 : Math.min(x1 - x0 - 200, 2400);
    L.panel = { x: (x0 + x1) / 2, w: Math.max(600, pw2), y0: top, h: y1 - top };
  }
  const zone = L.panel ? L.panel : { x: tx, w: Math.min(tw, 2400), y0: top, h: (L.bridge ? L.bridge.y0 : s.ceil - 200) - top };
  const tvW = Math.max(700, Math.min(1650, zone.w * 0.78, (zone.h - 350) / 0.58));
  L.tv = { x: zone.x, w: tvW, h: tvW * 0.58, y: top + 250 + (tvW * 0.58) / 2 };
  return L;
}
// двери пенала снизу вверх; пенал шире 600 мм — по две двери в ряд
function penDoors(p) {
  const t = state.penType;
  if (t === "open" || t === "loft") return [];
  if (t === "combo") { const lo = 800; return [{ y: 0, h: lo, kind: "solid" }, { y: lo, h: p.h - lo, kind: "glass" }]; }
  return [{ y: 0, h: p.h, kind: t === "glass" ? "glass" : "solid" }];
}
const doorsAcross = (w) => (w > 600 ? 2 : 1);
// полки лофт-стеллажа: нижняя над полом 120 мм, верхняя — крышка, между ними с шагом около 400 мм
function loftLevels(h) {
  const n = Math.max(3, Math.round((h - 120) / 400) + 1), out = [];
  for (let i = 0; i < n; i++) out.push(120 + ((h - 120 - 13) * i) / (n - 1));
  return out;
}
const penShelves = (h) => Math.max(1, Math.round((h - 2 * T) / 380) - 1);
const glassy = () => sol().pens && state.penType !== "doors";

/* ---------- цена ---------- */
export function estimate(s) {
  const P = PRICES, K = KITCHEN, F = K.fit[s.fit], m2 = (a, b) => (a * b) / 1e6, Lt = layout();
  const a = { ldsp: {}, back: 0, edge: 0, fac: 0, glass: 0, drawer: 0, hinge: 0, stay: 0, grip: 0, legs: 0, hang: 0, panel: 0, light: 0, rack: 0 };
  const L = (area, id = s.body) => { a.ldsp[id] = (a.ldsp[id] || 0) + area; };
  const front = (w, h) => { if (s.fmat === "ldsp") { L(m2(w, h), s.facade); a.edge += 2 * (w + h); } else a.fac += m2(w, h); };
  const outer = (w, h) => { if (s.sides) front(w, h); else { L(m2(w, h)); a.edge += 2 * (w + h); } };
  // тумба
  const W = Lt.tumba.w, H = s.H, D = s.D, n = secCount(W), sw = (W - 2 * T - (n - 1) * T) / n, ih = H - 2 * T, fw = W / n;
  outer(D, H - T); outer(D, H - T); outer(W, D);
  L(m2(W - 2 * T, D)); a.edge += W;
  L((n - 1) * m2(ih, D - 4)); a.edge += (n - 1) * ih;
  a.back += m2(W, H);
  if (s.mount === "plinth") front(W, PLINTH); else if (s.mount === "loft") a.legs += Math.max(2, Math.ceil(W / 1200) + 1); else a.hang += Math.ceil(W / 1200);
  s.secs.forEach((t) => {
    if (t === "drawer") {
      const k = drawersIn(H), fh = (H - T) / k, bh = Math.max(80, fh - 70);
      for (let i = 0; i < k; i++) {
        front(fw, fh); a.grip += s.grip === "push" ? 1 : handles(fw); a.drawer++;
        L(2 * m2(D - 50, bh) + 2 * m2(sw - 30, bh)); a.back += m2(sw, D - 50); a.edge += 2 * sw;
      }
    } else if (t === "flap" || t === "glass") {
      if (t === "flap") front(fw, H - T); else a.glass += m2(fw, H - T);
      a.hinge += 2; a.stay += stays(fw, H - T, t === "glass"); a.grip += s.grip === "push" ? 1 : handles(fw);
      if (ih >= 350) { L(m2(sw, D - 110)); a.edge += sw; }
    } else if (ih >= 350) { L(m2(sw, D - 40)); a.edge += sw; }
  });
  // пеналы
  for (const p of Lt.pens) {
    const iw = p.w - 2 * T;
    if (s.penType === "loft") {                                                // металлический каркас + полки из ЛДСП корпуса
      const k = loftLevels(p.h).length;
      L(k * m2(p.w, p.d)); a.edge += k * 2 * (p.w + p.d); a.rack++;
      continue;
    }
    outer(p.d, p.h); outer(p.d, p.h);
    L(2 * m2(iw, p.d)); a.edge += 2 * iw;
    L(penShelves(p.h) * m2(iw, p.d - 20)); a.edge += penShelves(p.h) * iw;
    a.back += m2(p.w, p.h);
    if (s.mount === "loft") a.legs += 2; else front(p.w, PLINTH);
    const k = doorsAcross(p.w);
    for (const d of penDoors(p)) {
      if (d.kind === "glass") a.glass += m2(p.w, d.h); else front(p.w, d.h);
      a.hinge += k * hingesFor(d.h); a.grip += k;
    }
    if (s.light && s.penType !== "doors") a.light += 2 * (p.h - 200);          // две вертикальные ленты в пенале
  }
  // антресоль
  if (Lt.bridge) {
    const b = Lt.bridge, k = Math.ceil(b.w / 600);
    outer(b.d, b.h); outer(b.d, b.h); L(2 * m2(b.w, b.d)); a.edge += 2 * b.w; a.back += m2(b.w, b.h);
    front(b.w, b.h); a.hinge += 2 * k; a.grip += k; a.hang++;
  }
  // панель за телевизором и подсветка
  if (Lt.panel) { a.panel += m2(Lt.panel.w, Lt.panel.h); if (s.light) a.light += 2 * Lt.panel.w + 2 * Lt.panel.h; }
  let ldsp = 0;
  for (const [id, area] of Object.entries(a.ldsp)) { const sh = P.sheet[decor(id).tier]; ldsp += Math.ceil(area / (sh.area * P.use.ldsp)) * sh.price; }
  const back = Math.ceil(a.back / (P.back.area * P.use.back)) * P.back.price;
  const edge = (a.edge / 1000) * 1.05 * P.edgePerM;
  const facade = s.fmat === "ldsp" ? 0 : a.fac * P.facade[s.fmat][s.mill === "modern" ? "plain" : "frame"];
  const glass = a.glass * K.glassPerM2;
  const grip = a.grip * (s.grip === "push" ? F.push : K.handle);
  const light = a.light ? (a.light / 1000) * K.light.perM + K.light.psu : 0;
  const hardware = a.drawer * F.drawer + a.hinge * F.hinge + a.stay * K.flapStay + grip + a.legs * K.loftLeg + a.hang * (2 * F.hanger + K.hangRail) + a.rack * K.loftRack + K.kit;
  const design = (s.wall / 1000) * K.designSmall;
  const total = ldsp + back + edge + facade + glass + hardware + design + a.panel * PANEL_M2 + light;
  const r = (x) => Math.round(x / P.roundTo) * P.roundTo;
  return { acc: a, low: r(total * P.range.low), high: r(total * P.range.high) };
}

/* ---------- 3D ---------- */
let renderer, scene, camera, controls, group, wallMesh, ready = false, movers = [];
const anim = { open: 0 };
const root = $("#cfg-canvas");

function initThree() {
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { root.innerHTML = '<p class="muted cfg-nogl">3D недоступно в этом браузере. Расчёт стоимости работает, вы можете отправить заявку.</p>'; return false; }
  setAnisotropy(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.enableZoom = false;
  renderer.domElement.style.touchAction = "pan-y";
  controls.minPolarAngle = 0.5; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minAzimuthAngle = -1.1; controls.maxAzimuthAngle = 1.1;      // не заходить за стену
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a20, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(1.8, 3.5, 4.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 3; floor.receiveShadow = true; scene.add(floor);
  wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.95, emissive: 0x4a4740 }));
  wallMesh.receiveShadow = true; scene.add(wallMesh);
  group = new THREE.Group(); scene.add(group);
  new ResizeObserver(resize).observe(root);
  resize();
  renderer.setAnimationLoop(() => {
    const target = state.open ? 1 : 0;
    anim.open += (target - anim.open) * 0.12;
    if (Math.abs(target - anim.open) < 0.001) anim.open = target;
    for (const m of movers) m(anim.open);
    controls.update(); renderer.render(scene, camera);
  });
  return true;
}
function resize() {
  const w = root.clientWidth || 600, h = root.clientHeight || 420;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (ready) fitCamera(true);
}
function face(g, w, h, cx, cy, z, front) {
  if (state.fmat === "ldsp") box(g, w, h, T, cx, cy, z, front);
  else millFace(g, w, h, T, cx, cy, z, front, state.mill);
}
// стеклянный фасад в алюминиевой рамке 20 мм
function glassFace(g, w, h, cx, cy, z, alu, glassMat) {
  const b = 20;
  box(g, w, b, 20, cx, cy + h / 2 - b / 2, z, alu); box(g, w, b, 20, cx, cy - h / 2 + b / 2, z, alu);
  box(g, b, h - 2 * b, 20, cx - w / 2 + b / 2, cy, z, alu); box(g, b, h - 2 * b, 20, cx + w / 2 - b / 2, cy, z, alu);
  box(g, w - 2 * b + 4, h - 2 * b + 4, 4, cx, cy, z, glassMat);
}
// тёплое свечение: мягкая полоса (для ленты) или рамка вокруг панели
const glowCache = {};
function glowTexture(kind) {
  if (glowCache[kind]) return glowCache[kind];
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  if (kind === "frame") {
    g.shadowColor = "rgba(255,196,110,1)"; g.shadowBlur = 34; g.strokeStyle = "rgba(255,214,150,0.95)"; g.lineWidth = 8;
    for (let i = 0; i < 3; i++) g.strokeRect(40, 40, 176, 176);
  } else {
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(0.5, "rgba(255,210,140,0.9)"); gr.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (glowCache[kind] = t);
}
const glowMat = (kind, opacity) => new THREE.MeshBasicMaterial({ map: glowTexture(kind), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
function plane(w, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w * mm, h * mm), material);
  m.position.set(x * mm, y * mm, z * mm); group.add(m); return m;
}
// фото камня для панели: одна плитка ≈ 1400 мм, соседние зеркалятся
// (картинку браузер берёт из кэша, поэтому новая текстура на каждую сборку — без задержки)
function stoneMaterial(id, w, h) {
  const t = new THREE.TextureLoader().load(`/img/stoleshnicy/${id}.jpg`);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.repeat.set(w / 1400, h / 1400);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 }); m.userData.plainUV = true;
  return m;
}

function build() {
  if (!ready) return;
  while (group.children.length) { const c = group.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  movers = [];
  const s = state, Lt = layout(), H = s.H, D = s.D;
  wallMesh.scale.set(s.wall * mm, s.ceil * mm, 1); wallMesh.position.set(0, (s.ceil / 2) * mm, -0.002);
  const body = mat(decor(s.body)), front = mat(facadeColor(), s.fmat === "paint" ? 0.45 : 0.5);
  const metal = mat("#b9bcc0", 0.3), backMat = mat("#e6e3dc", 0.8), black = mat("#26272a", 0.45), stayBody = mat("#1c1d20", 0.35);
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color(FRAMES[s.frame][1]), roughness: 0.3, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe8f2f2, roughness: 0.02, transparent: true, opacity: 0.16 });
  const outMat = s.sides ? front : body;
  const grip = (g, w, cx, ytop, z) => { if (s.grip === "handles") for (const hx of handleXs(w)) box(g, Math.min(160, w * 0.3), 12, 14, cx + hx, ytop, z, metal); };
  const loftLegs = (cx, w, d) => {
    const xs = w > 1800 ? [-w / 2 + 70, 0, w / 2 - 70] : [-w / 2 + 70, w / 2 - 70];
    for (const lx of xs) {
      for (const lz of [30, d - 30]) box(group, 20, LEG_H, 40, cx + lx, LEG_H / 2, lz, black);
      box(group, 20, 20, d - 20, cx + lx, 10, d / 2, black); box(group, 20, 20, d - 20, cx + lx, LEG_H - 10, d / 2, black);
    }
  };

  // ТУМБА
  const tb = Lt.tumba, W = tb.w, X = tb.x, y0 = tb.y0, n = secCount(W), sw = (W - 2 * T - (n - 1) * T) / n, ih = H - 2 * T, zf = D + T / 2;
  box(group, T, H - T, D, X - W / 2 + T / 2, y0 + (H - T) / 2, D / 2, outMat);
  box(group, T, H - T, D, X + W / 2 - T / 2, y0 + (H - T) / 2, D / 2, outMat);
  box(group, W, T, D, X, y0 + H - T / 2, D / 2, outMat);
  box(group, W - 2 * T, T, D, X, y0 + T / 2, D / 2, body);
  box(group, W - 2 * T, H - 2 * T, 4, X, y0 + H / 2, 2, backMat);
  if (s.mount === "plinth") box(group, W - 2 * T, PLINTH - 10, T, X, (PLINTH - 10) / 2, D - 40, front);
  else if (s.mount === "loft") loftLegs(X, W, D);
  const fw = W / n;
  s.secs.forEach((t, i) => {
    const sx = X - W / 2 + T + i * (sw + T) + sw / 2, fx = X - W / 2 + fw * i + fw / 2;
    if (i > 0) box(group, T, ih, D - 4, sx - sw / 2 - T / 2, y0 + H / 2, D / 2 + 2, body);
    if (ih >= 350 && t !== "drawer") { const sd = t === "niche" ? D - 40 : D - 110; box(group, sw, T, sd, sx, y0 + T + ih / 2, 4 + sd / 2, body); }
    if (t === "drawer") {
      const k = drawersIn(H), fh = (H - T) / k;
      for (let j = 0; j < k; j++) {
        const fy = y0 + fh * j, dg = new THREE.Group();
        face(dg, fw - GAP, fh - GAP, fx, fy + fh / 2, zf, front);
        grip(dg, fw, fx, fy + fh - handleOff(fw, fh), zf + 16);
        const bh = Math.max(60, fh - 70), dep = D - 60, z0 = zf - T / 2 - dep / 2;
        box(dg, T, bh, dep, sx - sw / 2 + T / 2 + 14, fy + 20 + bh / 2, z0, body); box(dg, T, bh, dep, sx + sw / 2 - T / 2 - 14, fy + 20 + bh / 2, z0, body);
        box(dg, sw - 30, bh, T, sx, fy + 20 + bh / 2, z0 - dep / 2, body);
        box(dg, sw - 30, 6, dep, sx, fy + 23, z0, body);
        group.add(dg);
        movers.push((tt) => { dg.position.z = tt * dep * 0.7 * mm; });
      }
    } else if (t === "flap" || t === "glass") {                                 // откидная вниз дверца с подъёмником
      const pv = new THREE.Group(), fh = H - T;
      pv.position.set(fx * mm, y0 * mm, zf * mm);
      if (t === "flap") face(pv, fw - GAP, fh - GAP, 0, fh / 2, 0, front);
      else glassFace(pv, fw - GAP, fh - GAP, 0, fh / 2, T / 2 - 10, alu, glassMat);
      grip(pv, fw, 0, fh - handleOff(fw, fh), T / 2 + 8);
      group.add(pv);
      const k = stays(fw, fh, t === "glass"), arms = [];
      for (const side of k === 2 ? [-1, 1] : [-1]) {
        const ax = sx + side * (sw / 2 - 12), ay = y0 + H - T - 45, az = D - 45;
        box(group, 18, Math.min(120, ih - 60), 28, ax, ay - Math.min(50, (ih - 60) / 2 - 10), az, stayBody);
        box(group, 22, 22, 6, ax, ay, az + 15, metal);
        box(pv, 22, 10, 26, ax - fx, fh * 0.55, -T / 2 - 13, metal);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(8 * mm, 14 * mm, 1), metal);
        arm.castShadow = true; group.add(arm);
        arms.push({ arm, a: new THREE.Vector3(ax * mm, ay * mm, (az + 15) * mm), bx: ax, by: fh * 0.55, bz: -T / 2 - 20 });
      }
      const B = new THREE.Vector3();
      movers.push((tt) => {
        const th = 1.45 * tt, c = Math.cos(th), sn = Math.sin(th);
        pv.rotation.x = th;
        for (const r of arms) {
          B.set(r.bx * mm, (y0 + r.by * c - r.bz * sn) * mm, (zf + r.by * sn + r.bz * c) * mm);
          r.arm.position.copy(r.a).add(B).multiplyScalar(0.5);
          r.arm.scale.set(1, 1, Math.max(0.001, r.a.distanceTo(B)));
          r.arm.lookAt(B);
        }
      });
    }
  });

  // ПЕНАЛЫ (стоят на полу, до потолка)
  for (const p of Lt.pens) {
    const pd = p.d, iw = p.w - 2 * T;
    if (s.penType === "loft") {                                                // лофт-стеллаж: 4 стойки, полки из ЛДСП, кресты по бокам
      const c = LOFT_POST, lv = loftLevels(p.h);
      for (const sx of [-1, 1]) for (const z of [c / 2, pd - c / 2]) box(group, c, p.h, c, p.x + sx * (p.w / 2 - c / 2), p.h / 2, z, black);
      for (const y of lv) {
        box(group, p.w, T, pd, p.x, y + T / 2, pd / 2, body);
        for (const sx of [-1, 1]) box(group, 20, 20, pd - 2 * c, p.x + sx * (p.w / 2 - c / 2), y - 10, pd / 2, black);   // поперечина под полкой
        for (const z of [c / 2, pd - c / 2]) box(group, p.w - 2 * c, 20, 20, p.x, y - 10, z, black);
      }
      for (const sx of [-1, 1]) for (let i = 0; i + 2 < lv.length + 1; i += 2) {   // кресты на боковинах через ярус
        const ya = lv[i], yb = lv[Math.min(i + 2, lv.length - 1)];
        if (yb - ya < 200) continue;
        const dz = pd - 2 * c, dy = yb - ya - 20, len = Math.hypot(dz, dy), ang = Math.atan2(dz, dy);
        for (const g of [ang, -ang]) {
          const bar = box(group, 8, len, 8, p.x + sx * (p.w / 2 - c / 2), (ya + yb) / 2 - 10, pd / 2, black);
          bar.rotation.x = g;
        }
      }
      continue;
    }
    box(group, T, p.h, pd, p.x - p.w / 2 + T / 2, p.y0 + p.h / 2, pd / 2, outMat);
    box(group, T, p.h, pd, p.x + p.w / 2 - T / 2, p.y0 + p.h / 2, pd / 2, outMat);
    box(group, iw, T, pd, p.x, p.y0 + p.h - T / 2, pd / 2, body);
    box(group, iw, T, pd, p.x, p.y0 + T / 2, pd / 2, body);
    box(group, iw, p.h - 2 * T, 4, p.x, p.y0 + p.h / 2, 2, backMat);
    const k = penShelves(p.h);
    for (let j = 1; j <= k; j++) box(group, iw, T, pd - 20, p.x, p.y0 + T + ((p.h - 2 * T) * j) / (k + 1), pd / 2 - 10, body);
    if (s.mount === "loft") loftLegs(p.x, p.w, pd); else box(group, iw, PLINTH - 10, T, p.x, (PLINTH - 10) / 2, pd - 40, front);
    if (s.light && s.penType !== "doors") {                                     // подсветка: ленты по бокам и тёплый свет на задней стенке
      const ly = s.penType === "combo" ? p.y0 + 800 + (p.h - 800) / 2 : p.y0 + p.h / 2, lh = s.penType === "combo" ? p.h - 860 : p.h - 60;
      for (const sx of [-1, 1]) box(group, 6, lh, 10, p.x + sx * (iw / 2 - 4), ly, pd - 30, new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      plane(iw, lh, glowMat("strip", 0.55), p.x, ly, 6);
    }
    const across = doorsAcross(p.w), dw = p.w / across;
    for (const d of penDoors(p)) {
      for (let c = 0; c < across; c++) {
        // одна дверь — петли с внешней стороны пенала; две — распашные от краёв
        const hingeLeft = across === 2 ? c === 0 : p.side < 0;
        const hingeX = across === 2 ? p.x - p.w / 2 + (c === 0 ? 0 : p.w) : p.x + (hingeLeft ? -p.w / 2 : p.w / 2);
        const dir = hingeLeft ? 1 : -1, off = dir * dw / 2;
        const pv = new THREE.Group();
        pv.position.set(hingeX * mm, (p.y0 + d.y + d.h / 2) * mm, (pd + T / 2) * mm);
        if (d.kind === "glass") glassFace(pv, dw - GAP, d.h - GAP, off, 0, T / 2 - 10, alu, glassMat);
        else face(pv, dw - GAP, d.h - GAP, off, 0, 0, front);
        if (s.grip === "handles") {
          const hl = Math.min(160, d.h * 0.3), lim = d.h / 2 - hl / 2 - 40;
          box(pv, 12, hl, 14, off + dir * (dw / 2 - 40), Math.max(-lim, Math.min(lim, 1000 - (p.y0 + d.y + d.h / 2))), T / 2 + 10, metal);
        }
        group.add(pv);
        movers.push((tt) => { pv.rotation.y = -dir * 1.6 * tt; });
      }
    }
  }

  // АНТРЕСОЛЬ над телевизором
  if (Lt.bridge) {
    const b = Lt.bridge, k = Math.ceil(b.w / 600), dw = b.w / k;
    box(group, T, b.h, b.d, b.x - b.w / 2 + T / 2, b.y0 + b.h / 2, b.d / 2, outMat);
    box(group, T, b.h, b.d, b.x + b.w / 2 - T / 2, b.y0 + b.h / 2, b.d / 2, outMat);
    box(group, b.w - 2 * T, T, b.d, b.x, b.y0 + T / 2, b.d / 2, body);
    box(group, b.w - 2 * T, T, b.d, b.x, b.y0 + b.h - T / 2, b.d / 2, body);
    box(group, b.w - 2 * T, b.h - 2 * T, 4, b.x, b.y0 + b.h / 2, 2, backMat);
    for (let c = 0; c < k; c++) {
      const pv = new THREE.Group(), hx = b.x - b.w / 2 + dw * c;
      pv.position.set(hx * mm, (b.y0 + b.h) * mm, (b.d + T / 2) * mm);
      face(pv, dw - GAP, b.h - GAP, dw / 2, -b.h / 2, 0, front);
      grip(pv, dw, dw / 2, -b.h + handleOff(dw, b.h), T / 2 + 8);
      group.add(pv);
      movers.push((tt) => { pv.rotation.x = -1.2 * tt; });                    // открывается вверх
    }
    if (s.light) plane(b.w, 120, glowMat("strip", 0.5), b.x, b.y0 - 60, 4).rotation.z = Math.PI / 2 * 0;
  }

  // ПАНЕЛЬ за телевизором
  if (Lt.panel) {
    const pn = Lt.panel, pz = 9;
    if (s.light) plane(pn.w / 0.69, pn.h / 0.69, glowMat("frame", 0.85), pn.x, pn.y0 + pn.h / 2, 1);
    if (s.panel === "stone") box(group, pn.w, pn.h, 18, pn.x, pn.y0 + pn.h / 2, pz + 9, stoneMaterial(s.stone, pn.w, pn.h));
    else if (s.panel === "wood") box(group, pn.w, pn.h, 18, pn.x, pn.y0 + pn.h / 2, pz + 9, mat(decor(s.panelDecor)));
    else {                                                                       // рейки 20 мм с шагом 35 мм на тёмной подложке
      const pm = mat(decor(s.panelDecor)), bg = mat("#3a3631", 0.8), cnt = Math.floor(pn.w / 35);
      box(group, pn.w, pn.h, 6, pn.x, pn.y0 + pn.h / 2, pz + 3, bg);
      for (let i = 0; i < cnt; i++) box(group, 20, pn.h, 14, pn.x - pn.w / 2 + 17.5 + i * (pn.w / cnt), pn.y0 + pn.h / 2, pz + 13, pm);
    }
  }

  // телевизор — для примера
  const tv = Lt.tv, tvz = Lt.panel ? 50 : 30;
  box(group, tv.w, tv.h, 30, tv.x, tv.y, tvz, black);
  box(group, tv.w - 16, tv.h - 16, 2, tv.x, tv.y, tvz + 16, mat("#0e1013", 0.15));
  for (const m of movers) m(anim.open);
  fitCamera();
}

let fitted = "";
function fitCamera(force) {
  const s = state, key = [s.wall, s.ceil, s.D, s.penD, camera.aspect.toFixed(2)].join();
  if (fitted === key && !force) return;
  fitted = key;
  const d = Math.max(s.D, sol().pens ? s.penD : 0);
  const center = new THREE.Vector3(0, s.ceil * mm * 0.5, d * mm * 0.5);
  const r = 0.5 * Math.hypot(s.wall, s.ceil, d) * mm;
  const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (r * 0.98) / Math.sin(Math.min(vfov, hfov) / 2);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0.28, 0.1, 1).normalize(), dist);
  camera.lookAt(center); camera.updateProjectionMatrix();
}

/* ---------- интерфейс ---------- */
const DIM_FIELDS = [["f-wall", "h-wall", "wall"], ["f-ceil", "h-ceil", "ceil"], ["f-tw", "h-tw", "tumW"], ["f-h", "h-h", "H"], ["f-d", "h-d", "D"], ["f-pw", "h-pw", "penW"], ["f-pd", "h-pd", "penD"]];
function swatches(host, list, key) {
  host.innerHTML = "";
  for (const d of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw" + (d.wood ? " wood" : "") + (d.gloss ? " gloss" : "");
    b.style.setProperty("--c", d.color);
    if (d.wood) b.style.backgroundImage = `url(${woodSwatch(d.color)})`;
    b.title = d.name; b.setAttribute("aria-label", d.name);
    b.setAttribute("aria-pressed", String(state[key] === d.id));
    b.addEventListener("click", () => { state[key] = d.id; refresh(); });
    host.appendChild(b);
  }
}
const pressed = (sel, attr, v) => document.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === v)));
// маленькая схема решения для карточки
function solIcon(id) {
  const S = SOLS[id], r = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${f}"/>`;
  let g = r(0, 0, 100, 60, "var(--cfg-ic-wall, #eee9e1)");
  const pen = (x) => (S.penType === "loft" ? r(x, 16, 2, 44, "#222") + r(x + 14, 16, 2, 44, "#222") + [20, 32, 44, 56].map((y) => r(x, y, 16, 2, "#b89a78")).join("") : S.penType === "open" ? r(x, 4, 16, 56, "#b89a78") + [14, 24, 34, 44].map((y) => r(x + 2, y, 12, 1.5, "#8d7253")).join("") : r(x, 4, 16, 56, "#2b2c2e") + r(x + 2, 6, 12, S.penType === "combo" ? 32 : 52, "#cfd8d8") + (S.penType === "combo" ? r(x + 2, 40, 12, 18, "#e9e6e0") : ""));
  const x0 = S.pens === 2 ? 18 : S.pens === 1 ? 18 : 18, x1 = S.pens === 2 ? 82 : S.pens === 1 ? 98 : 82;
  if (S.pens >= 1) g += pen(1);
  if (S.pens === 2) g += pen(83);
  if (S.panel) g += r(x0 + 6, S.bridge ? 16 : 8, x1 - x0 - 12, S.bridge ? 30 : 36, S.panel === "stone" ? "#cfc8c0" : S.panel === "wood" ? "#c9a77e" : "#dcd6cc");
  if (S.bridge) g += r(x0, 4, x1 - x0, 10, "#e9e6e0");
  g += r((x0 + x1) / 2 - 15, 22, 30, 17, "#111");
  g += r(x0, 46, x1 - x0, 8, "#e9e6e0");
  return `<svg viewBox="0 0 100 60" width="100" height="60" aria-hidden="true">${g}</svg>`;
}
function solCards() {
  const host = $("#sols");
  host.innerHTML = "";
  for (const id of Object.keys(SOLS)) {
    const S = SOLS[id], ok = fits(id), b = document.createElement("button");
    b.type = "button"; b.disabled = !ok;
    b.setAttribute("aria-pressed", String(state.sol === id));
    b.innerHTML = `${solIcon(id)}<b>${S.name}</b><span>${ok ? S.desc : `нужна стена от ${S.min} мм`}</span>`;
    b.addEventListener("click", () => pickSol(id));
    host.appendChild(b);
  }
}
function pickSol(id) {
  const S = SOLS[id];
  state.sol = id;
  if (S.penType) state.penType = S.penType;
  if (S.panel) state.panel = S.panel;
  if (id === "stellazh" || id === "loft") state.body = DECORS.find((d) => d.wood)?.id || state.body;
  if (id === "stellazh") state.penW = 500; else if (S.pens) state.penW = 600;
  if (id === "loft") { state.mount = "loft"; state.penD = 350; state.grip = "handles"; }
  else if (id !== "tumba") state.mount = "wall";
  refresh();
}
function secRows() {
  const host = $("#secs");
  host.innerHTML = "";
  state.secs.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "sec-row";
    const lab = document.createElement("span");
    lab.className = "sub-l"; lab.textContent = `Секция ${i + 1}`;
    const seg = document.createElement("div");
    seg.className = "seg-btns seg-wrap";
    for (const [k, name] of [["drawer", "Ящик"], ["flap", "Откидная"], ["glass", "Стекло"], ["niche", "Ниша"]]) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = name;
      b.setAttribute("aria-pressed", String(t === k));
      b.addEventListener("click", () => { state.secs[i] = k; refresh(); });
      seg.appendChild(b);
    }
    row.append(lab, seg); host.appendChild(row);
  });
  const w = layout().tumba.w;
  $("#n-secs").textContent = `тумба ${Math.round(w)} мм, ${state.secs.length} шт. по ${Math.round(w / state.secs.length)} мм`;
}
function stoneButtons() {
  const host = $("#stones");
  host.innerHTML = "";
  for (const [id, name] of STONES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sw"; b.title = name; b.setAttribute("aria-label", name);
    b.style.backgroundImage = `url(/img/stoleshnicy/${id}.jpg)`; b.style.backgroundSize = "cover";
    b.setAttribute("aria-pressed", String(state.stone === id));
    b.addEventListener("click", () => { state.stone = id; refresh(); });
    host.appendChild(b);
  }
  $("#n-stone").textContent = STONES.find((x) => x[0] === state.stone)[1];
}
function syncDims() {
  for (const [id, hintId, key] of DIM_FIELDS) {
    const el = $("#" + id), [lo, hi] = limits(key);
    el.min = lo; el.max = hi;
    $("#" + hintId).textContent = "от " + lo + " до " + hi;
    if (document.activeElement !== el) { el.value = state[key]; el.removeAttribute("aria-invalid"); }
  }
}
const anyGlass = () => state.secs.includes("glass") || (sol().pens && (state.penType === "glass" || state.penType === "combo"));
function refresh(skipBuild) {
  normalize();
  for (const [sel, attr, v] of [["[data-mount]", "mount", state.mount], ["[data-sides]", "sides", String(state.sides)], ["[data-fmat]", "fmat", state.fmat],
    ["[data-mill]", "mill", state.mill], ["[data-fit]", "fit", state.fit], ["[data-grip]", "grip", state.grip], ["[data-frame]", "frame", state.frame],
    ["[data-pside]", "pside", state.penSide], ["[data-ptype]", "ptype", state.penType], ["[data-panel]", "panel", state.panel], ["[data-light]", "light", String(state.light)]]) pressed(sel, attr, v);
  const S = sol();
  $("#tw-row").hidden = S.pens > 0;
  $("#pen-box").hidden = !S.pens;
  $("#pside-row").hidden = S.pens !== 1;
  $("#mill-row").hidden = state.fmat === "ldsp";
  $("#frame-row").hidden = !anyGlass();
  $("#stone-row").hidden = state.panel !== "stone";
  $("#pdecor-row").hidden = state.panel !== "slats" && state.panel !== "wood";
  $("#cfg-open").textContent = state.open ? "Закрыть" : "Открыть ящики и дверцы";
  syncDims(); solCards(); secRows(); stoneButtons();
  swatches($("#sw-body"), DECORS, "body");
  swatches($("#sw-facade"), FMATS[state.fmat].list, "facade");
  swatches($("#sw-pdecor"), DECORS, "panelDecor");
  $("#n-body").textContent = decor(state.body).name;
  $("#n-facade").textContent = facadeColor().name;
  $("#n-pdecor").textContent = decor(state.panelDecor).name;
  if (!skipBuild) build();
  price();
}
const facadeText = () => (state.fmat === "ldsp" ? `ЛДСП, ${facadeColor().name}` : `${FMATS[state.fmat].name}, фрезеровка «${MILLS[state.mill]}», цвет ${facadeColor().name}`);
const tumbaText = () => `${Math.round(layout().tumba.w)} × ${state.H} × ${state.D} мм, ${MOUNTS[state.mount]}`;
function secsText() {
  const cnt = {};
  for (const t of state.secs) cnt[t] = (cnt[t] || 0) + 1;
  const parts = Object.entries(cnt).map(([t, c]) => `${SECS[t]} — ${t === "drawer" ? c * drawersIn(state.H) : c} шт.`);
  return `${state.secs.length} секц.: ${parts.join(", ")}`;
}
function penText() {
  const S = sol();
  if (!S.pens) return "";
  const where = S.pens === 2 ? "2 пенала по краям" : `пенал ${state.penSide === "left" ? "слева" : "справа"}`;
  const loft = state.penType === "loft";
  return `${where}, ${state.penW} × ${layout().pens[0].h} × ${state.penD} мм, ${loft ? "" : "до потолка, "}${PTYPES[state.penType]}` + (state.light && !loft && state.penType !== "doors" ? ", с подсветкой" : "");
}
function panelText() {
  if (state.panel === "none") return "";
  const p = layout().panel, what = state.panel === "stone" ? `${PANELS.stone} (${STONES.find((x) => x[0] === state.stone)[1]})` : `${PANELS[state.panel]} (${decor(state.panelDecor).name})`;
  return `${what}, ${Math.round(p.w)} × ${Math.round(p.h)} мм` + (state.light ? ", подсветка по контуру" : "");
}
function price() {
  const e = estimate(state), F = KITCHEN.fit[state.fit];
  $("#cfg-low").textContent = fmt(e.low);
  $("#cfg-high").textContent = fmt(e.high);
  const lines = [
    "Здравствуйте! Хочу рассчитать ТВ-зону (с сайта ordazhihaz.kz, конструктор).",
    `Стена: ${state.wall} мм, потолок ${state.ceil} мм. Решение: «${sol().name}»`,
    `Тумба: ${tumbaText()}; ${secsText()}`,
    sol().pens ? `Пеналы: ${penText()}` : "",
    layout().bridge ? "Антресоль над телевизором" : "",
    state.panel !== "none" ? `За телевизором: ${panelText()}` : "",
    `Корпус: ЛДСП, ${decor(state.body).name}`,
    `Фасады: ${facadeText()}` + (state.sides ? "; крышка и видимые боковины — так же" : ""),
    anyGlass() ? `Стекло в алюминиевой рамке, цвет рамки — ${FRAMES[state.frame][0]}` : "",
    `Фурнитура: ${F.name}, ${state.grip === "push" ? "без ручек (открывание нажатием)" : "с ручками"}`,
    `Ориентировочно на сайте: от ${fmt(e.low)} до ${fmt(e.high)}`,
    "Фото стены, где будет ТВ-зона, пришлю в этот чат.",
  ].filter(Boolean);
  $("#cfg-send").href = WA + "?text=" + encodeURIComponent(lines.join("\n"));
}

/* ---------- КП ---------- */
function snapshot(openT) {
  if (!ready) return null;
  fitCamera(true);
  for (const m of movers) m(openT);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  for (const m of movers) m(anim.open);
  return url;
}
async function downloadKP(btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Готовлю КП…";
  try {
    const e = estimate(state), F = KITCHEN.fit[state.fit], Lt = layout();
    await makeKP({
      subtitle: "по изготовлению ТВ-зоны",
      section: "ТВ-зона",
      name: `ТВ-зона «${sol().name}», стена ${state.wall} мм`,
      lines: [
        `- Тумба ${tumbaText()}; ${secsText()}`,
        sol().pens ? `- ${penText()[0].toUpperCase() + penText().slice(1)}` : "",
        Lt.bridge ? `- Антресоль над телевизором ${Math.round(Lt.bridge.w)} × ${BRIDGE_H} мм, дверцы вверх` : "",
        state.panel !== "none" ? `- За телевизором: ${panelText()}` : "",
        `- Корпус: ЛДСП 16 мм, ${decor(state.body).name}; задняя стенка ЛХДФ`,
        `- Фасады: ${facadeText()}` + (state.sides ? "; крышка и видимые боковины — из того же материала" : ""),
        anyGlass() ? `- Стекло в алюминиевой рамке, цвет рамки — ${FRAMES[state.frame][0]}` : "",
        state.mount === "plinth" ? "- Цоколь: МДФ, как фасады" : state.mount === "loft" ? "- Опоры: металлические лофт-рамы, чёрные" : "- Тумба подвесная: монтажная шина и усиленные навесы",
        `- Фурнитура ${F.name}: направляющие и петли с доводчиком` + (state.secs.some((t) => t === "flap" || t === "glass") ? ", подъёмники-доводчики откидных дверец" : "") + (state.grip === "push" ? ", открывание нажатием" : ""),
      ].filter(Boolean),
      low: e.low, high: e.high,
      images: [snapshot(0), snapshot(1)],
      conditions: [
        "Стоимость ориентировочная: рассчитана в конструкторе на сайте ordazhihaz.kz. Точную цену менеджер назовёт после замера и согласования проекта.",
        "Материалы, цвета и фурнитура подбираются и согласовываются по образцам в нашем офисе. Цвета на изображениях приблизительные.",
        "Условия оплаты: предоплата 70%, остаток 30% перед монтажом.",
        "Доставка и монтаж входят в стоимость.",
        state.grip === "push" ? "В стоимость не входит телевизор — он на изображении для примера." : "В стоимость не входят: ручки (их установка включена) и телевизор.",
        "Чтобы получить точное КП, отправьте этот расчёт нам в WhatsApp.",
      ],
      file: `КП_ORDA_ZHIHAZ_ТВ-зона_${state.wall}`,
    });
  } catch (err) {
    console.error(err);
    alert("Не удалось сформировать КП. Напишите нам в WhatsApp — пришлём КП.");
  } finally { btn.disabled = false; btn.textContent = label; }
}

function bindDim(id, key) {
  const el = $("#" + id);
  el.addEventListener("input", () => {
    const v = Math.round(+el.value), [lo, hi] = limits(key);
    if (el.value !== "" && v >= lo && v <= hi) { el.removeAttribute("aria-invalid"); state[key] = v; refresh(); }
    else el.setAttribute("aria-invalid", "true");
  });
  el.addEventListener("change", () => {
    const [lo, hi] = limits(key);
    let v = Math.round(+el.value);
    if (!el.value || isNaN(v)) v = state[key];
    state[key] = Math.min(hi, Math.max(lo, v)); el.value = state[key]; el.removeAttribute("aria-invalid"); refresh();
  });
}
function bind() {
  const on = (sel, attr, key, conv) => document.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => {
    state[key] = conv ? conv(b.dataset[attr]) : b.dataset[attr]; refresh();
  }));
  on("[data-mount]", "mount", "mount");
  on("[data-sides]", "sides", "sides", (v) => v === "true");
  on("[data-fmat]", "fmat", "fmat");
  on("[data-mill]", "mill", "mill");
  on("[data-fit]", "fit", "fit");
  on("[data-grip]", "grip", "grip");
  on("[data-frame]", "frame", "frame");
  on("[data-pside]", "pside", "penSide");
  on("[data-ptype]", "ptype", "penType");
  on("[data-panel]", "panel", "panel");
  on("[data-light]", "light", "light", (v) => v === "true");
  document.querySelectorAll("[data-all]").forEach((b) => b.addEventListener("click", () => { state.secs = state.secs.map(() => b.dataset.all); refresh(); }));
  for (const [id, , key] of DIM_FIELDS) bindDim(id, key);
  $("#cfg-open").addEventListener("click", () => { state.open = !state.open; refresh(true); });
  $("#cfg-kp").addEventListener("click", (e) => downloadKP(e.currentTarget));
}

if (!KITCHEN.confirmed) $("#cfg-test").hidden = false;
ready = initThree();
bind();
refresh();
