// Конструктор кухни: 3D-модель по размерам стен + ориентировочная цена диапазоном + КП + заявка в WhatsApp.
// Кухня собирается из модулей по правилам цеха: нижние шкафы с дверями, между мойкой и плитой секция
// на 3 ящика (360 + 180 + 180), под мойкой двери, рядом посудомойка (только фасад), над мойкой шкаф с сушилкой,
// верх — один ярус или ярус + антресоль, пеналы у правого края основной стены.
// Ничего не отправляется на сервер: расчёт идёт в браузере.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PRICES, DECORS, FILM_COLORS, PAINT_COLORS } from "./shkaf-prices.js";
import { KITCHEN } from "./kuhnya-prices.js";
import { makeKP } from "./shkaf-kp.js";
import { mm, mat, box, woodSwatch, setAnisotropy } from "./cfg3d.js";

const WA = "https://wa.me/77769994032";
const $ = (s, r) => (r || document).querySelector(s);
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
const T = 16;            // толщина ЛДСП
const PLINTH = 100;      // цоколь (ножки)
const BASE_H = 720;      // корпус нижнего шкафа
const BASE_D = 560;      // глубина корпуса нижнего шкафа
const TOP_D = 600;       // глубина столешницы
const UP_Y = 1450;       // низ верхних шкафов
const UP_D = 320;        // глубина корпуса верхнего шкафа
const CORNER = 1000;     // угловой нижний модуль на основной стене
const PEN_W = 600;       // ширина пенала
const DRW = 600;         // секция с ящиками между мойкой и плитой
const DRAWERS = [360, 180, 180];   // высоты ящиков снизу вверх
const FRIDGE_H = 1950;   // высота ниши под отдельностоящий холодильник
const OVEN_DRAWER = 360; // ящик внизу пенала под духовку

const FORMS = { line: "Прямая кухня", corner: "Угловая кухня" };
const UPPERS = { one: "верхние шкафы в один ярус", two: "верхние шкафы с антресолью до потолка" };
const FMATS = {
  ldsp: { name: "ЛДСП", list: DECORS },
  film: { name: "МДФ в плёнке", list: FILM_COLORS },
  paint: { name: "МДФ в краске", list: PAINT_COLORS },
};
const MILLS = { modern: "Модерн", shtapik: "Штапик", vyborka: "Выборка", classic: "Классика" };
const PENS = { glass: "пенал со стеклом", oven: "пенал под духовку и микроволновку", fridge: "пенал под встроенный холодильник",
  niche: "ниша под отдельностоящий холодильник со шкафом сверху" };

const VENT_H = 80;      // планка с вентиляционной решёткой над дверью пенала холодильника
const FRIDGE_IN = 1770;  // встроенный холодильник в пенале: высота зоны над цоколем, выше — полка и дверь
// dw — ширина посудомойки (0 — нет), glassW — ширина пенала со стеклом, glass2 — у пенала стеклянная и боковина
const state = { form: "line", A: 3000, B: 2000, H: 2700, upper: "two", sink: "left", dw: 600, light: false,
  pens: { fridge: true, niche: false, oven: false, glass: false }, glassW: 600, glass2: false, gShelf: "ldsp", frame: "silver",
  topColor: "carrara",
  body: "white", fmat: "film", mill: "modern", facade: "f-white", top: "kedr", fit: "dtc", open: false };
// декоры столешницы Кедр (фото декоров — /img/stoleshnicy/, точный код декора уточняет менеджер); цвет рамки стеклянного пенала
const TOP_COLORS = [
  ["carrara", "Мрамор Каррара", "#f4f4ee"], ["calacatta", "Мрамор Калакатта", "#e1dfe1"], ["arabescato", "Мрамор Арабескато", "#cdced0"],
  ["onyx", "Оникс", "#eae4e0"], ["sahara", "Сахара нуар", "#0e0e0f"], ["ice", "Голубой мрамор", "#829195"],
  ["granite-beige", "Гранит бежевый", "#cfc9b7"], ["granite-grey", "Гранит серый", "#7c7b77"],
  ["halifax-white", "Дуб Галифакс белый", "#b9a99a"], ["halifax", "Дуб Галифакс натуральный", "#a3855d"],
  ["halifax-tobacco", "Дуб Галифакс табак", "#876a54"], ["apple", "Яблоня светлая", "#cea689"], ["old-wood", "Старое дерево", "#9a7d66"],
].map(([id, name, color]) => ({ id, name, color, tex: `/img/stoleshnicy/${id}.jpg` }));
const FRAMES = { silver: ["серебро", "#c4c7ca"], black: ["чёрный", "#2a2b2e"], brass: ["латунь", "#b8975a"], bronze: ["бронза", "#86664a"] };
const APRON_H = UP_Y - PLINTH - BASE_H - 38;   // высота фартука: от столешницы до верхних шкафов
const topColor = () => TOP_COLORS.find((c) => c.id === state.topColor) || TOP_COLORS[0];
const penW = (s, kind) => (kind === "glass" ? s.glassW : PEN_W);
const doorCount = (w) => (w >= 650 ? 2 : 1);   // до 600 мм — одна дверь, от 650 — две
const findIn = (list, id) => list.find((d) => d.id === id) || list[0];
const decor = (id) => findIn(DECORS, id);
const facadeColor = () => findIn(FMATS[state.fmat].list, state.facade);

/* ---------- ограничения ---------- */
function limits(key) {
  if (key === "A") return [1800, state.form === "line" ? 6000 : 5000];
  if (key === "B") return [1200, 4000];
  return [2400, 3000];                                    // H — высота потолка
}
function normalize() {
  for (const k of ["A", "B", "H"]) {
    const [lo, hi] = limits(k);
    state[k] = Math.min(hi, Math.max(lo, state[k]));
  }
  if (!FMATS[state.fmat].list.some((c) => c.id === state.facade)) state.facade = FMATS[state.fmat].list[0].id;
}

/* ---------- раскладка модулей ---------- */
function tiers(s) {
  if (s.upper === "none") return { h1: 0, h2: 0 };          // только для сверки расчёта, на странице такой кнопки нет
  if (s.upper === "one") return { h1: 720, h2: 0 };
  const free = s.H - UP_Y;
  return free - 800 >= 250 ? { h1: 800, h2: free - 800 } : { h1: free, h2: 0 };
}
// отрезок делится на равные модули шириной до 800 мм; узкий остаток — узкий шкаф или планка
function split(x0, len, kind, out) {
  if (len < 1) return;
  if (len < 150) { out.push({ kind: "filler", x: x0, w: len }); return; }
  if (len < 300) { out.push({ kind: kind === "doors" ? "narrow" : kind, x: x0, w: len }); return; }
  const n = Math.ceil(len / 800), w = len / n;
  for (let i = 0; i < n; i++) out.push({ kind, x: x0 + i * w, w });
}
// ставит модули подряд слева направо; элемент { free: длина } — свободное место под шкафы с дверями
function sequence(items, kind) {
  const out = [];
  let x = 0;
  for (const it of items) {
    if (it.free != null) { split(x, it.free, kind, out); x += it.free; }
    else { out.push({ ...it, x }); x += it.w; }
  }
  return out;
}
function plan(s) {
  const notes = [], corner = s.form === "corner";
  // пенал со стеклом с двух сторон стоит крайним, чтобы стеклянная боковина была снаружи
  let pens = ["glass", "oven", "fridge", "niche"].filter((p) => s.pens[p]);
  if (s.glass2 && pens.includes("glass")) pens = [...pens.filter((p) => p !== "glass"), "glass"];
  let dw = s.dw, mid = DRW;
  const ovenInPen = () => pens.includes("oven");
  const pensW = () => pens.reduce((x, p) => x + penW(s, p), 0);
  // рабочий стол между мойкой и варочной панелью: секция с ящиками (если духовка под плитой)
  // или шкаф с дверями (если духовка в пенале и нет посудомойки) — мойку и плиту рядом не ставим
  const needMid = () => !corner && (!ovenInPen() || !dw);
  const needA = () => (corner ? CORNER : 0) + 600 + dw + (corner ? 0 : 600 + (needMid() ? mid : 0)) + pensW();
  while (needA() > s.A) {
    if (needMid() && mid > 400) { mid = Math.max(400, mid - (needA() - s.A)); continue; }
    if (dw) { dw = 0; notes.push("посудомоечная машина"); continue; }
    if (pens.length) { notes.push(PENS[pens.shift()]); continue; }
    break;
  }
  const hobKind = ovenInPen() ? "hob" : "hobOven";          // духовка в пенале — под варочной панелью ящики
  const runA = s.A - pensW();
  const sink = { kind: "sink", w: 600 }, dwM = dw ? [{ kind: "dw", w: dw }] : [];
  const runs = [];

  if (!corner) {
    const hob = { kind: hobKind, w: 600 };
    const d = needMid() ? [{ kind: hobKind === "hobOven" ? "drawers" : "doors", w: mid }] : [];
    let F = runA - 600 - dw - 600 - (d.length ? mid : 0);
    let sinkEnd = 0, hobEnd = 0;
    if (F < 300) { (d[0] || sink).w += F; F = 0; }           // маленький остаток — в секцию с ящиками или под мойку
    else {
      sinkEnd = F >= 900 ? Math.max(300, Math.round(F * 0.3)) : 0;
      hobEnd = F - sinkEnd;
      if (hobEnd > 0 && hobEnd < 300) { sinkEnd += hobEnd; hobEnd = 0; }
    }
    const left = [{ free: sinkEnd }, sink, ...dwM, ...d, hob, { free: hobEnd }];
    runs.push({ wall: "A", len: runA, base: sequence(s.sink === "left" ? left : left.reverse(), "doors") });
  } else {
    let F = runA - CORNER - 600 - dw;
    const cornerM = { kind: "corner", w: CORNER };
    if (F > 0 && F < 300) { cornerM.w += F; F = 0; }
    const items = s.sink === "left" ? [cornerM, sink, ...dwM, { free: F }] : [cornerM, { free: F }, ...dwM, sink];
    runs.push({ wall: "A", len: runA, base: sequence(items, "doors") });
    // левая стена: от открытого края к углу — свободное место, плита, секция с ящиками ближе к мойке
    const lenB = s.B - TOP_D, hob = { kind: hobKind, w: 600 };
    const d = hobKind === "hobOven" && lenB >= 600 + 400 ? [{ kind: "drawers", w: Math.min(DRW, lenB - 600) }] : [];
    if (hobKind === "hobOven" && !d.length) notes.push("секция с ящиками на левой стене");
    let FB = lenB - 600 - (d.length ? d[0].w : 0);
    if (FB > 0 && FB < 300) { (d[0] || hob).w += FB; FB = 0; }
    runs.push({ wall: "B", len: lenB, base: sequence([{ free: FB }, hob, ...d], "doors") });
  }
  // верхние шкафы вровень и точно над нижними: над мойкой — сушилка, над плитой — встроенная вытяжка;
  // на левой стене угловой кухни остаток у угла — отдельный верхний шкаф
  for (const r of runs) {
    const ulen = r.wall === "B" ? s.B - UP_D - 16 : r.len;
    r.ulen = ulen;
    r.upper = r.base.map((m) => ({
      kind: m.kind === "sink" ? "dryer" : m.kind === "hob" || m.kind === "hobOven" ? "hood" : m.kind === "filler" ? "filler" : "upper",
      x: m.x, w: m.w,
    }));
    if (ulen > r.len) split(r.len, ulen - r.len, "upper", r.upper);
  }
  let x = runA;
  const talls = pens.map((kind) => { const t = { kind, x, w: penW(s, kind) }; x += t.w; return t; });
  return { runs, talls, notes, dw, t: tiers(s), runA };
}
// у одиночной двери петли со стороны ближнего края линии, ручка — с другой стороны
const hingeLeftFor = (m, len) => m.x + m.w / 2 < len / 2;

/* ---------- подсчёт деталей и цены ---------- */
function newAcc() { return { ldsp: {}, back: 0, edge: 0, fac: 0, glass: 0, glassShelf: 0, hinge: 0, hingeFree: 0, drawer: 0, push: 0, handle: 0, hanger: 0, leg: 0, dryer: 0, light: 0, vent: 0 }; }
const hingesFor = (h) => (h > 2000 ? 5 : h > 1600 ? 4 : h > 900 ? 3 : 2);
function count(s, p) {
  const a = newAcc(), m2 = (x, y) => (x * y) / 1e6;
  const L = (area) => { a.ldsp[s.body] = (a.ldsp[s.body] || 0) + area; };
  const carcass = (w, h, d, sides = 2) => { L(sides * m2(h, d) + 2 * m2(w - 2 * T, d)); a.back += m2(w, h); a.edge += sides * h + 2 * w; };
  const shelves = (n, w, d) => { L(n * m2(w - 2 * T, d - 20)); a.edge += n * w; };
  const front = (w, h) => {
    if (s.fmat === "ldsp") { a.ldsp[s.facade] = (a.ldsp[s.facade] || 0) + m2(w, h); a.edge += 2 * (w + h); }
    else { a.fac += m2(w, h); }
  };
  const drawerBox = (w, d, h) => { L(2 * m2(d - 50, h) + 2 * m2(w - 2 * T - 30, h)); a.back += m2(w - 2 * T, d - 50); a.edge += 2 * w; a.drawer++; };
  const { h1, h2 } = p.t;

  for (const r of p.runs) {
    front(r.len, PLINTH);                                                     // цоколь — МДФ, как фасады
    for (const m of r.base) {
      if (m.kind === "filler") { front(m.w, BASE_H); continue; }
      if (m.kind === "dw") { front(m.w, BASE_H); a.handle++; continue; }      // посудомойка: только фасад
      a.leg += 4;
      carcass(m.w, BASE_H, BASE_D);
      if (m.kind === "corner") { shelves(1, m.w, BASE_D); front(m.w - 400, BASE_H); front(400, BASE_H);   /* глухая часть угла — МДФ, как фасады */ a.hinge += 2; a.handle++; continue; }
      if (m.kind === "drawers" || m.kind === "hob") {
        for (const h of DRAWERS) { drawerBox(m.w, BASE_D, h - 60); front(m.w, h); a.handle++; }
      } else if (m.kind === "hobOven") {                                       // духовка под варочной панелью + ящик
        drawerBox(m.w, BASE_D, 100); front(m.w, 140); a.handle++;
      } else {                                                                 // шкаф с дверями, мойка, узкий шкаф
        const n = doorCount(m.w);
        front(m.w, BASE_H); a.hinge += 2 * n; a.handle += n;
        if (m.kind !== "sink") shelves(1, m.w, BASE_D);
      }
    }
    for (const m of h1 ? r.upper : []) {
      if (m.kind === "filler") { front(m.w, h1); continue; }
      const n = doorCount(m.w);
      carcass(m.w, h1, UP_D);
      if (m.kind === "dryer") { a.dryer++; shelves(1, m.w, UP_D); }            // сушилка и полка над ней
      else if (m.kind === "hood") {                                            // короб воздуховода из ЛДСП корпуса и полки по бокам
        L(3 * m2(h1 - 160, 200)); a.edge += 2 * (h1 - 160);
        L(2 * m2((m.w - 2 * T - 200) / 2, UP_D - 20)); a.edge += m.w - 200;
      }
      else shelves(Math.max(0, Math.floor(h1 / 350)), m.w, UP_D);
      front(m.w, h1); a.hinge += hingesFor(h1) * n; a.hanger += 2;            // нижний ярус открывается за низ фасада
      if (s.light) a.light += m.w;                                             // подсветка под верхними шкафами
      if (h2) { carcass(m.w, h2, UP_D); front(m.w, h2); a.hingeFree += 2 * n; a.push += n; a.hanger += 2; }   // антресоль на нажатие
    }
  }
  const top = UP_Y + h1 + h2, yMain = UP_Y + h1;
  for (const t of p.talls) {
    if (t.kind === "niche") {                                                  // видимая боковина из материала фасадов и шкаф над холодильником
      front(BASE_D, top);
      const h = top - FRIDGE_H;
      if (h >= 250) { carcass(t.w, h, BASE_D); front(t.w, h); a.hingeFree += 2; a.push++; a.hanger += 2; }
      continue;
    }
    a.leg += 4;
    front(t.w, PLINTH);                                                        // цоколь пенала — МДФ, как фасады
    if (t.kind === "glass") {                                                  // стеклянная дверь во всю высоту в алюминиевой рамке
      const glass2 = s.glass2 && t === p.talls[p.talls.length - 1];
      carcass(t.w, top - PLINTH, BASE_D, glass2 ? 1 : 2);
      a.glass += m2(t.w, top - PLINTH) + (glass2 ? m2(BASE_D, top - PLINTH) : 0);   // дверь и боковина в алюминиевой рамке
      if (s.gShelf === "glass") a.glassShelf += 4 * m2(t.w - 40, BASE_D - 40); // стеклянные полки
      else shelves(4, t.w, BASE_D);                                             // полки из ЛДСП корпуса
      a.hinge += hingesFor(top - PLINTH); a.handle++;
      a.light += 2 * (top - PLINTH);                                           // подсветка: вертикальные ленты у передних кромок боковин
      continue;
    }
    carcass(t.w, top - PLINTH, BASE_D);
    if (t.kind === "fridge") {                                                 // фасады на дверях холодильника: 720 и до верха холодильника
      front(t.w, BASE_H); front(t.w, FRIDGE_IN - BASE_H); a.handle += 2;
      shelves(1, t.w, BASE_D);                                                 // полка над холодильником
      const dh = top - PLINTH - FRIDGE_IN - VENT_H;                            // одна дверь над холодильником, антресоль не отделяется
      if (dh > 150) { front(t.w, dh); a.hinge += hingesFor(dh); a.handle++; }
      front(t.w, VENT_H); a.vent += 2;                                         // планка с решёткой сверху и решётка в цоколе — вентиляция холодильника
      continue;
    } else {                                                                   // духовка и СВЧ: ящик 360, полка над СВЧ, дверь до яруса
      drawerBox(t.w, BASE_D, OVEN_DRAWER - 60); front(t.w, OVEN_DRAWER); a.handle++;
      shelves(2, t.w, BASE_D);
      const dh = yMain - (PLINTH + OVEN_DRAWER + 600 + 400);
      if (dh > 150) { front(t.w, dh); a.hinge += hingesFor(dh); a.handle++; }
    }
    if (h2) { front(t.w, h2); a.hingeFree += 2; a.push++; }
  }
  return a;
}

export function estimate(s) {
  const p = plan(s), a = count(s, p), P = PRICES, K = KITCHEN, F = K.fit[s.fit];
  let ldsp = 0;
  for (const [id, area] of Object.entries(a.ldsp)) {
    const sh = P.sheet[decor(id).tier];
    ldsp += Math.ceil(area / (sh.area * P.use.ldsp)) * sh.price;
  }
  const back = Math.ceil(a.back / (P.back.area * P.use.back)) * P.back.price;
  const edge = (a.edge / 1000) * 1.05 * P.edgePerM;
  const facade = s.fmat === "ldsp" ? 0 : a.fac * P.facade[s.fmat][s.mill === "modern" ? "plain" : "frame"];
  const hardware = a.hinge * F.hinge + a.hingeFree * F.hingeFree + a.drawer * F.drawer + a.push * F.push + a.hanger * F.hanger
    + a.handle * K.handle + a.leg * K.leg + a.dryer * K.dryer + a.vent * K.vent + K.kit
    + a.glass * K.glassPerM2 + a.glassShelf * K.glassShelfPerM2 +(a.light ? (a.light / 1000) * K.light.perM + K.light.psu : 0);
  const meters = p.runs.reduce((x, r) => x + r.len, 0) + p.talls.reduce((x, t) => x + t.w, 0) + (s.form === "corner" ? TOP_D : 0);
  const design = (meters / 1000) * K.designPerM;
  const topLen = p.runs.reduce((x, r) => x + r.len, 0);
  let kedr = 0, stone = 0;
  if (s.top === "kedr") kedr = p.runs.reduce((x, r) => x + Math.ceil(r.len / K.top.kedr.plateLen), 0) * K.top.kedr.plate + K.top.kedr.cutouts;
  else stone = (topLen / 1000) * K.top.stone.perM;
  const kitchen = ldsp + back + edge + facade + hardware + design + kedr;   // фартук в стоимость не входит
  const r = (x) => Math.round(x / P.roundTo) * P.roundTo;
  const range = (x) => ({ low: r(x * P.range.low), high: r(x * P.range.high) });
  return { plan: p, acc: a, kitchen: range(kitchen), stone: stone ? range(stone) : null, topLen,
    low: r(kitchen * P.range.low) + (stone ? r(stone * P.range.low) : 0),
    high: r(kitchen * P.range.high) + (stone ? r(stone * P.range.high) : 0) };
}

/* ---------- 3D ---------- */
// свечение подсветки: картинка с плавным переходом от яркого края к прозрачному
// mode "mid": ярко по центру, гаснет к краям (свет от ленты посередине); иначе — ярко сверху, гаснет вниз
const glowTex = {};
function glowTexture(mode) {
  const k = mode === "mid" ? "mid" : "top";
  if (!glowTex[k]) {
    const mid = k === "mid", c = document.createElement("canvas"); c.width = mid ? 256 : 4; c.height = mid ? 4 : 256;
    const g = c.getContext("2d"), gr = mid ? g.createLinearGradient(0, 0, 256, 0) : g.createLinearGradient(0, 0, 0, 256);
    const st = mid ? [[0, 0], [0.32, 0.4], [0.5, 1], [0.68, 0.4], [1, 0]] : [[0, 1], [0.35, 0.45], [1, 0]];
    for (const [o, a] of st) gr.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    glowTex[k] = new THREE.CanvasTexture(c);
  }
  return glowTex[k];
}
// текстуры столешницы — фото декоров; одна плитка текстуры ≈ TOP_TILE мм, соседние плитки зеркалятся без швов
const TOP_TILE = 1400, topTex = new Map();
function topTexture(tc) {
  if (!topTex.has(tc.id)) {
    const t = new THREE.TextureLoader().load(tc.tex);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    topTex.set(tc.id, t);
  }
  return topTex.get(tc.id);
}
// развёртка столешницы: рисунок идёт вдоль линии, масштаб по реальным размерам
function topUV(mesh, len) {
  const uv = mesh.geometry.attributes.uv;
  const faces = [[TOP_D, 40], [TOP_D, 40], [len, TOP_D], [len, TOP_D], [len, 40], [len, 40]];   // px, nx, py, ny, pz, nz
  for (let f = 0; f < 6; f++) {
    const [a, b] = faces[f];
    for (let q = 0; q < 4; q++) { const i = f * 4 + q; uv.setXY(i, (uv.getX(i) * a) / TOP_TILE, (uv.getY(i) * b) / TOP_TILE); }
  }
  uv.needsUpdate = true;
  return mesh;
}
let renderer, scene, camera, controls, group, ready = false, movers = [];
const anim = { open: 0 };
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
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;                       // колесо мыши прокручивает страницу
  renderer.domElement.style.touchAction = "pan-y";   // вертикальный свайп прокручивает страницу
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minAzimuthAngle = -0.2;
  controls.maxAzimuthAngle = Math.PI / 2 + 0.2;     // смотрим только из комнаты, не из-за стены
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a20, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 6, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 20 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
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
  if (ready) fitCamera();
}
function tick() {
  const target = state.open ? 1 : 0;
  anim.open += (target - anim.open) * 0.12;
  if (Math.abs(target - anim.open) < 0.001) anim.open = target;
  for (const m of movers) m(anim.open);
  controls.update();
  renderer.render(scene, camera);
}

// фасад с фрезеровкой (для МДФ): рамка поверх основной панели
function face(g, w, h, cx, cy, z, front) {
  box(g, w, h, T, cx, cy, z, front);
  if (state.fmat === "ldsp" || state.mill === "modern" || w < 120 || h < 120) return;
  const ins = Math.min(55, w * 0.14, h * 0.14), b = state.mill === "classic" ? 40 : 10, d = state.mill === "vyborka" ? 1 : 5;
  const m = state.mill === "vyborka" ? (() => { const c = front.clone(); c.color = c.color.clone().multiplyScalar(0.72); return c; })() : front;
  const zf = z + T / 2 + d / 2;
  box(g, w - 2 * ins, b, d, cx, cy + h / 2 - ins, zf, m);
  box(g, w - 2 * ins, b, d, cx, cy - h / 2 + ins, zf, m);
  box(g, b, h - 2 * ins, d, cx - w / 2 + ins, cy, zf, m);
  box(g, b, h - 2 * ins, d, cx + w / 2 - ins, cy, zf, m);
}
// группа для стены: локальная ось x — вдоль стены, z — от стены в комнату
function wallGroup(wall) {
  const g = new THREE.Group();
  if (wall === "B") { g.rotation.y = Math.PI / 2; g.position.set(0, 0, state.B * mm); }
  group.add(g);
  return g;
}

function build() {
  if (!ready) return;
  while (group.children.length) {
    const c = group.children.pop();
    c.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  movers = [];
  const s = state, p = plan(s), { h1, h2 } = p.t;
  const body = mat(decor(s.body));
  const front = mat(facadeColor(), s.fmat === "paint" ? 0.45 : 0.5);
  const metal = mat("#b9bcc0", 0.3);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.2, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd3d6da, roughness: 0.38, metalness: 0.25 });   // нержавейка: без карты отражений высокий metalness выглядит чёрным
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color(FRAMES[s.frame][1]), roughness: 0.3, metalness: 0.35 });   // рамка стеклянного пенала
  const tc = topColor(), topRough = s.top === "kedr" ? 0.5 : 0.25;
  const topMat = new THREE.MeshStandardMaterial({ map: topTexture(tc), roughness: topRough });
  topMat.userData.plainUV = true;   // развёртка столешницы своя, по длине линии
  const apronMat = new THREE.MeshStandardMaterial({ color: 0xf7f6f3, roughness: 0.35 });   // фартук: ровный белый, только для вида
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xe8f2f2, roughness: 0.02, transparent: true, opacity: 0.16 });   // прозрачное стекло
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffd54a });   // светодиодная лента: светится ровно, тени её не затемняют
  // тёплый свет от ленты: ярко у ленты и плавно затухает (fade: направление затухания вдоль плоскости)
  const glow = (w, h, opacity) => new THREE.Mesh(new THREE.PlaneGeometry(w * mm, h * mm),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffcf5a, transparent: true, opacity, depthWrite: false }));
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.95 });
  const backMat = mat("#e6e3dc", 0.8);
  const topT = s.top === "kedr" ? 38 : 30;
  const yTop = PLINTH + BASE_H;

  // дверь на петлях: поворачивается вокруг кромки со стороны петель; handleY — высота ручки (null — без ручки)
  // glass — дверь из стекла в алюминиевой рамке 20 мм; inner — дверь холодильника за фасадом, открывается вместе с ним
  const door = (g, x0, w, y0, h, zf, hingeLeft, handleY, opt = {}) => {
    const pv = new THREE.Group();
    pv.position.set((hingeLeft ? x0 : x0 + w) * mm, (y0 + h / 2) * mm, zf * mm);
    const off = hingeLeft ? w / 2 : -w / 2;
    if (opt.glass) {
      box(pv, 20, h - 4, 20, off - w / 2 + 12, 0, 0, alu);
      box(pv, 20, h - 4, 20, off + w / 2 - 12, 0, 0, alu);
      box(pv, w - 3, 20, 20, off, h / 2 - 12, 0, alu);
      box(pv, w - 3, 20, 20, off, -h / 2 + 12, 0, alu);
      box(pv, w - 40, h - 40, 4, off, 0, 0, glassMat);
    } else face(pv, w - 3, h - 4, off, 0, 0, front);
    if (opt.inner) box(pv, w - 50, h - 20, 50, off, 0, -T / 2 - 26, steel);
    if (handleY != null) box(pv, 12, 160, 14, hingeLeft ? w - 40 : -(w - 40), handleY - (y0 + h / 2), T / 2 + 8, metal);
    g.add(pv);
    movers.push((t) => { pv.rotation.y = (hingeLeft ? -1 : 1) * 1.65 * t; });
  };
  // выкатной ящик: фасад, короб и ручка выезжают вместе
  const drawer = (g, x0, w, y0, h, zf, depth) => {
    const dg = new THREE.Group();
    face(dg, w - 3, h - 3, x0 + w / 2, y0 + h / 2, zf, front);
    box(dg, Math.min(160, w * 0.5), 12, 14, x0 + w / 2, y0 + h - 40, zf + 16, metal);
    const bh = Math.max(60, h - 70), z0 = zf - T / 2 - depth / 2;
    box(dg, T, bh, depth, x0 + 30, y0 + 20 + bh / 2, z0, body);
    box(dg, T, bh, depth, x0 + w - 30, y0 + 20 + bh / 2, z0, body);
    box(dg, w - 60, bh, T, x0 + w / 2, y0 + 20 + bh / 2, z0 - depth / 2, body);
    box(dg, w - 60, 6, depth, x0 + w / 2, y0 + 23, z0, body);
    g.add(dg);
    movers.push((t) => { dg.position.z = t * depth * 0.7 * mm; });
  };
  // корпус шкафа изнутри пустой: боковины, дно, крыша, задняя стенка ЛХДФ и полки — видно, когда двери открыты
  const hollow = (g, x0, w, y0, h, d, shelvesN, noRight) => {
    box(g, T, h, d, x0 + T / 2, y0 + h / 2, d / 2, body);
    if (!noRight) box(g, T, h, d, x0 + w - T / 2, y0 + h / 2, d / 2, body);
    box(g, w - 2 * T, T, d, x0 + w / 2, y0 + T / 2, d / 2, body);
    box(g, w - 2 * T, T, d, x0 + w / 2, y0 + h - T / 2, d / 2, body);
    box(g, w - 2 * T, h - 2 * T, 4, x0 + w / 2, y0 + h / 2, 2, backMat);
    for (let i = 1; i <= (shelvesN || 0); i++) shelf(g, x0, w, y0 + (h * i) / (shelvesN + 1), d);
  };
  const shelf = (g, x0, w, y, d, m) => box(g, w - 2 * T - 2, T, d - 30, x0 + w / 2, y, (d - 30) / 2, m || body);
  // вентиляционная решётка: рамка и горизонтальные прорези
  const vent = (g, x, y, z) => {
    const w = 320, h = 48;
    box(g, w, h, 3, x, y, z, steel);
    for (let i = 0; i < 6; i++) box(g, w - 30, 3, 2, x, y - h / 2 + 8 + i * 6.5, z + 2, dark);
  };
  const doorsOf = (g, m, y0, h, zf, len, handleY) => {
    if (doorCount(m.w) === 2) {
      door(g, m.x, m.w / 2, y0, h, zf, true, handleY);
      door(g, m.x + m.w / 2, m.w / 2, y0, h, zf, false, handleY);
    } else door(g, m.x, m.w, y0, h, zf, hingeLeftFor(m, len), handleY);
  };

  // стены и пол
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  box(group, s.A + 40, s.H, 20, s.A / 2 - 20, s.H / 2, -10, wallMat).castShadow = false;
  if (s.form === "corner") box(group, 20, s.H, s.B, -10, s.H / 2, s.B / 2, wallMat).castShadow = false;

  const groups = {};
  for (const r of p.runs) {
    const g = groups[r.wall] = wallGroup(r.wall);
    box(g, r.len, PLINTH - 10, T, r.len / 2, (PLINTH - 10) / 2, BASE_D - 60, front);      // цоколь — МДФ, как фасады
    topUV(box(g, r.len, topT, TOP_D, r.len / 2, yTop + topT / 2, TOP_D / 2, topMat), r.len);   // столешница
    if (h1) box(g, r.len, APRON_H, 6, r.len / 2, yTop + topT + APRON_H / 2, 3, apronMat);   // фартук на стене
    for (const m of r.base) {
      const cx = m.x + m.w / 2, zf = BASE_D + T / 2, yc = PLINTH + BASE_H / 2;
      if (m.kind === "filler") { face(g, m.w - 2, BASE_H - 4, cx, yc, zf, front); continue; }
      if (m.kind === "dw") {                                                                 // посудомойка: фасад откидывается вниз
        box(g, m.w - 30, BASE_H - 30, BASE_D - 40, cx, yc, BASE_D / 2 - 10, steel);
        box(g, m.w - 80, 10, BASE_D - 100, cx, PLINTH + 200, BASE_D / 2, dark);
        box(g, m.w - 80, 10, BASE_D - 100, cx, PLINTH + 450, BASE_D / 2, dark);
        const pv = new THREE.Group();
        pv.position.set(cx * mm, PLINTH * mm, zf * mm);
        face(pv, m.w - 3, BASE_H - 4, 0, BASE_H / 2, 0, front);
        box(pv, Math.min(160, m.w * 0.5), 12, 14, 0, BASE_H - 50, T / 2 + 8, metal);
        box(pv, m.w - 40, BASE_H - 30, 30, 0, BASE_H / 2, -T / 2 - 16, steel);
        g.add(pv);
        movers.push((t) => { pv.rotation.x = 1.4 * t; });
        continue;
      }
      hollow(g, m.x + 1, m.w - 2, PLINTH, BASE_H, BASE_D, m.kind === "doors" || m.kind === "narrow" || m.kind === "corner" ? 1 : 0);
      if (m.kind === "drawers" || m.kind === "hob") {
        let y = PLINTH;
        for (const h of DRAWERS) { drawer(g, m.x, m.w, y, h, zf, BASE_D - 60); y += h; }
      } else if (m.kind === "hobOven") {
        drawer(g, m.x, m.w, PLINTH, 140, zf, BASE_D - 60);
        box(g, m.w - 20, BASE_H - 160, 10, cx, PLINTH + 150 + (BASE_H - 160) / 2, zf, dark);  // духовка
        box(g, m.w - 120, 20, 20, cx, PLINTH + BASE_H - 60, zf + 15, steel);
      } else if (m.kind === "corner") {
        face(g, m.w - 400 - 3, BASE_H - 4, m.x + (m.w - 400) / 2, yc, zf, front);           // глухая часть угла — МДФ, как фасады
        door(g, m.x + m.w - 400, 400, PLINTH, BASE_H, zf, false, PLINTH + BASE_H - 120);
      } else {
        doorsOf(g, m, PLINTH, BASE_H, zf, r.len, PLINTH + BASE_H - 120);
      }
      if (m.kind === "sink") {                                                              // мойка и смеситель
        box(g, Math.min(500, m.w - 100), 6, 420, cx, yTop + topT + 1, 300, steel);
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(14 * mm, 14 * mm, 260 * mm, 16), steel);
        tap.position.set(cx * mm, (yTop + topT + 130) * mm, 90 * mm); g.add(tap);
      }
      if (m.kind === "hob" || m.kind === "hobOven") box(g, 520, 6, 500, cx, yTop + topT + 3, 290, dark);   // варочная панель
    }
    for (const m of h1 ? r.upper : []) {
      const cx = m.x + m.w / 2, zf = UP_D + T / 2;
      if (m.kind === "filler") { face(g, m.w - 2, h1 - 4, cx, UP_Y + h1 / 2, zf, front); continue; }
      hollow(g, m.x + 1, m.w - 2, UP_Y, h1, UP_D, m.kind === "upper" ? Math.max(0, Math.floor(h1 / 350)) : 0);
      if (m.kind === "dryer") {                                                             // сушилка: поддон и решётка, над ней полка
        for (const yy of [UP_Y + 50, UP_Y + h1 * 0.45]) {
          for (let i = 0; i < 9; i++) box(g, 4, 4, UP_D - 40, m.x + 30 + (m.w - 60) * i / 8, yy, UP_D / 2, steel);
          box(g, m.w - 50, 6, 6, cx, yy, 30, steel); box(g, m.w - 50, 6, 6, cx, yy, UP_D - 30, steel);
        }
        shelf(g, m.x, m.w, UP_Y + h1 * 0.78, UP_D);
      }
      if (m.kind === "hood") {                                                              // встроенная вытяжка, короб воздуховода из ЛДСП, полки по бокам
        box(g, m.w - 40, 140, UP_D - 20, cx, UP_Y + 72, UP_D / 2, steel);
        const bh = h1 - 160, by = UP_Y + 140 + bh / 2;
        box(g, T, bh, 200, cx - 100, by, 100, body);
        box(g, T, bh, 200, cx + 100, by, 100, body);
        box(g, 216, bh, T, cx, by, 200, body);
        const sw = (m.w - 2 * T - 216) / 2;
        for (const sx of [m.x + T + sw / 2, m.x + m.w - T - sw / 2]) box(g, sw - 2, T, UP_D - 30, sx, UP_Y + 140 + bh / 2, (UP_D - 30) / 2, body);
      }
      if (s.light) {                                                                        // подсветка под шкафом: лента по кромке, свет на стене и столешнице
        box(g, m.w - 20, 12, 22, cx, UP_Y - 7, UP_D - 25, ledMat);
        const hw = UP_Y - yTop - 40, wall = glow(m.w, hw, 0.75);
        wall.position.set(cx * mm, (UP_Y - hw / 2) * mm, 8 * mm);                           // на стене: ярко сверху, к столешнице гаснет
        g.add(wall);
        const desk = glow(m.w, TOP_D - 40, 0.55);
        desk.rotation.x = -Math.PI / 2;
        desk.position.set(cx * mm, (yTop + 42) * mm, ((TOP_D - 40) / 2 + 10) * mm);       // на столешнице: ярко у стены, к краю гаснет
        g.add(desk);
      }
      doorsOf(g, m, UP_Y, h1, zf, r.ulen, null);                                             // открывается за низ фасада
      if (h2) {
        hollow(g, m.x + 1, m.w - 2, UP_Y + h1 + 2, h2 - 4, UP_D, h2 > 450 ? 1 : 0);
        doorsOf(g, m, UP_Y + h1 + 2, h2 - 4, zf, r.ulen, null);                             // антресоль на нажатие
      }
    }
  }
  // пеналы у правого края основной стены: петли справа (у стены), ручки слева
  const gA = groups.A, top = UP_Y + h1 + h2, yMain = UP_Y + h1;
  for (const t of p.talls) {
    const cx = t.x + t.w / 2, zf = BASE_D + T / 2;
    if (t.kind === "niche") {                                                               // отдельностоящий холодильник
      box(gA, t.w - 30, FRIDGE_H - 30, BASE_D + 40, cx, (FRIDGE_H - 30) / 2, (BASE_D + 40) / 2, steel);
      box(gA, 14, 500, 20, t.x + 50, 1100, BASE_D + 50, dark);
      const last = t === p.talls[p.talls.length - 1];
      box(gA, T, top, BASE_D + T, last ? t.x + t.w - T / 2 : t.x + T / 2, top / 2, (BASE_D + T) / 2, front);   // торцевая панель
      const h = top - FRIDGE_H;
      if (h >= 250) {
        hollow(gA, t.x + 1, t.w - 2, FRIDGE_H, h, BASE_D, 0);
        door(gA, t.x, t.w, FRIDGE_H + 2, h - 4, zf, false, null);
      }
      continue;
    }
    box(gA, t.w - 2, PLINTH - 10, T, cx, (PLINTH - 10) / 2, BASE_D - 60, front);   // цоколь пенала — МДФ
    if (t.kind === "glass") {                                                                // стеклянная дверь во всю высоту, стеклянные полки
      const glass2 = s.glass2 && t === p.talls[p.talls.length - 1];
      hollow(gA, t.x + 1, t.w - 2, PLINTH, top - PLINTH, BASE_D, 0, glass2);
      for (let i = 1; i <= 4; i++) shelf(gA, t.x, t.w, PLINTH + ((top - PLINTH) * i) / 5, BASE_D, s.gShelf === "glass" ? glassMat : body);   // полки из ЛДСП корпуса или стекла
      if (glass2) {                                                                          // стеклянная боковина в алюминиевой рамке
        const sx = t.x + t.w - 10, sh = top - PLINTH;
        box(gA, 20, sh, 20, sx, PLINTH + sh / 2, 10, alu);
        box(gA, 20, sh, 20, sx, PLINTH + sh / 2, BASE_D - 10, alu);
        box(gA, 20, 20, BASE_D, sx, PLINTH + 10, BASE_D / 2, alu);
        box(gA, 20, 20, BASE_D, sx, top - 10, BASE_D / 2, alu);
        box(gA, 4, sh - 40, BASE_D - 40, sx, PLINTH + sh / 2, BASE_D / 2, glassMat);
      }
      // подсветка как в цехе: вертикальные ленты в профиле у передних кромок обеих боковин, внутри тёплый свет
      const ih = top - PLINTH - 2 * T;
      // подсветка как в цехе: вертикальная лента по центру боковины и по центру задней стенки, свет расходится в стороны
      const ym = (top + PLINTH) / 2, lit = (w) => new THREE.MeshBasicMaterial({ map: glowTexture("mid"), color: 0xffcf5a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
      box(gA, 6, ih, 14, t.x + T + 3, ym, BASE_D / 2, ledMat);                               // лента на боковине
      box(gA, 14, ih, 6, cx, ym, 7, ledMat);                                                   // лента на задней стенке
      const side = new THREE.Mesh(new THREE.PlaneGeometry((BASE_D - 30) * mm, ih * mm), lit());
      side.rotation.y = Math.PI / 2;
      side.position.set((t.x + T + 1) * mm, ym * mm, (BASE_D / 2) * mm);
      gA.add(side);
      const back = new THREE.Mesh(new THREE.PlaneGeometry((t.w - 2 * T - 4) * mm, ih * mm), lit());
      back.position.set(cx * mm, ym * mm, 5 * mm);
      gA.add(back);
      door(gA, t.x, t.w, PLINTH, top - PLINTH, zf, false, PLINTH + BASE_H + 160, { glass: true });
      continue;
    }
    hollow(gA, t.x + 1, t.w - 2, PLINTH, top - PLINTH, BASE_D, 0);
    if (h2 && t.kind !== "fridge") shelf(gA, t.x, t.w, yMain, BASE_D);                      // перегородка под антресолью
    // нижний фасад пенала вровень с нижними шкафами: дверь 720 мм; в пенале духовки — ящик 360 вровень с нижним ящиком секции
    if (t.kind === "fridge") {                                                              // встроенный холодильник ≈ 1750 мм, над ним полка
      box(gA, t.w - 50, FRIDGE_IN - 20, BASE_D - 120, cx, PLINTH + FRIDGE_IN / 2, (BASE_D - 120) / 2 + 10, steel);
      shelf(gA, t.x, t.w, PLINTH + FRIDGE_IN + 10, BASE_D);
      door(gA, t.x, t.w, PLINTH, BASE_H, zf, false, PLINTH + BASE_H - 120, { inner: true });
      door(gA, t.x, t.w, PLINTH + BASE_H + 3, FRIDGE_IN - BASE_H - 3, zf, false, PLINTH + BASE_H + 160, { inner: true });
      const dh = top - PLINTH - FRIDGE_IN - VENT_H;                                         // одна дверь до планки, без антресоли
      if (dh > 150) door(gA, t.x, t.w, PLINTH + FRIDGE_IN + 3, dh - 3, zf, false, PLINTH + FRIDGE_IN + 60);
      face(gA, t.w - 3, VENT_H - 4, cx, top - VENT_H / 2, zf, front);                        // планка над дверью
      vent(gA, cx, top - VENT_H / 2, zf + T / 2 + 1);                                        // решётка сверху
      vent(gA, cx, (PLINTH - 10) / 2, BASE_D - 60 + T / 2 + 1);                              // решётка в цоколе
      continue;
    } else {                                                                                 // ящик 360, духовка, СВЧ, полка над СВЧ
      const yo = PLINTH + OVEN_DRAWER;
      drawer(gA, t.x, t.w, PLINTH, OVEN_DRAWER, zf, BASE_D - 60);
      box(gA, t.w - 20, 580, 10, cx, yo + 300, zf, dark);                                    // духовка
      box(gA, t.w - 20, 380, 10, cx, yo + 600 + 200, zf, dark);                              // микроволновка
      shelf(gA, t.x, t.w, yo + 1000 + T / 2, BASE_D);
      const dh = yMain - (yo + 1000);
      if (dh > 150) door(gA, t.x, t.w, yo + 1000, dh, zf, false, yo + 1060);
    }
    if (h2) door(gA, t.x, t.w, yMain + 2, h2 - 4, zf, false, null);
  }
  for (const m of movers) m(anim.open);
  fitCamera();
}

// камера вписывает всю кухню в кадр: по габаритам кухни, углу обзора и пропорциям окна
let fitted = "";
function fitCamera(force) {
  const s = state, key = [s.form, s.A, s.B, s.H, camera.aspect.toFixed(2)].join();
  if (fitted === key && !force) return;
  fitted = key;
  const corner = s.form === "corner";
  const W = s.A * mm, D = (corner ? s.B : TOP_D + 300) * mm, H = s.H * mm;
  const center = new THREE.Vector3(W / 2, H * 0.48, D * 0.4);
  const r = 0.5 * Math.hypot(W, H, D);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (r * (camera.aspect >= 1 ? 0.8 : 0.95)) / Math.sin(Math.min(vfov, hfov) / 2);   // в узком окне телефона — с запасом
  const dir = new THREE.Vector3(corner ? 0.55 : 0.35, 0.32, 1).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  camera.lookAt(center);
  camera.near = 0.1; camera.far = dist * 4;
  camera.updateProjectionMatrix();
}

/* ---------- интерфейс ---------- */
const DIM_FIELDS = [["f-a", "h-a", "A"], ["f-b", "h-b", "B"], ["f-h", "h-h", "H"]];

function swatches(host, list, key) {
  host.innerHTML = "";
  for (const d of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw" + (d.wood ? " wood" : "") + (d.gloss ? " gloss" : "");
    b.style.setProperty("--c", d.color);
    if (d.wood) b.style.backgroundImage = `url(${woodSwatch(d.color)})`;
    if (d.tex) { b.style.backgroundImage = `url(${d.tex})`; b.style.backgroundSize = "cover"; b.style.backgroundPosition = "center"; }
    b.title = d.name;
    b.setAttribute("aria-label", d.name);
    b.setAttribute("aria-pressed", String(state[key] === d.id));
    b.addEventListener("click", () => { state[key] = d.id; refresh(); });
    host.appendChild(b);
  }
}
function pressed(selector, attr, value) {
  document.querySelectorAll(selector).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
}
function syncDims() {
  $("#row-b").hidden = state.form !== "corner";
  $("#lbl-a").textContent = state.form === "corner" ? "Основная стена, мм" : "Длина кухни, мм";
  for (const [id, hintId, key] of DIM_FIELDS) {
    const el = $("#" + id), [lo, hi] = limits(key);
    el.min = lo; el.max = hi;
    $("#" + hintId).textContent = "от " + lo + " до " + hi;
    if (document.activeElement !== el) { el.value = state[key]; el.removeAttribute("aria-invalid"); }
  }
}
function refresh(skipBuild) {
  normalize();
  pressed("[data-form]", "form", state.form);
  pressed("[data-upper]", "upper", state.upper);
  pressed("[data-sink]", "sink", state.sink);
  pressed("[data-light]", "light", String(state.light));
  $("#f-dw").value = String(state.dw);
  $("#f-glassw").value = String(state.glassW);
  $("#glass-row").hidden = !state.pens.glass;
  pressed("[data-glass2]", "glass2", String(state.glass2));
  pressed("[data-gshelf]", "gshelf", state.gShelf);
  pressed("[data-frame]", "frame", state.frame);
  swatches($("#sw-top"), TOP_COLORS, "topColor");
  $("#n-top").textContent = topColor().name;
  pressed("[data-fmat]", "fmat", state.fmat);
  pressed("[data-mill]", "mill", state.mill);
  pressed("[data-top]", "top", state.top);
  pressed("[data-fit]", "fit", state.fit);
  document.querySelectorAll("[data-pen]").forEach((b) => b.setAttribute("aria-pressed", String(state.pens[b.dataset.pen])));
  $("#mill-row").hidden = state.fmat === "ldsp";
  $("#cfg-open").textContent = state.open ? "Закрыть двери и ящики" : "Открыть двери и ящики";
  $("#cfg-open").setAttribute("aria-pressed", String(state.open));
  syncDims();
  swatches($("#sw-body"), DECORS, "body");
  swatches($("#sw-facade"), FMATS[state.fmat].list, "facade");
  $("#n-body").textContent = decor(state.body).name;
  $("#n-facade").textContent = facadeColor().name;
  if (!skipBuild) build();
  price();
}

function facadeText() {
  if (state.fmat === "ldsp") return `ЛДСП, ${facadeColor().name}`;
  return `${FMATS[state.fmat].name}, фрезеровка «${MILLS[state.mill]}», цвет ${facadeColor().name}`;
}
function sizeText() {
  return state.form === "corner" ? `${state.A} × ${state.B} мм` : `${state.A} мм`;
}
function penText(t, p) {
  if (t.kind !== "glass") return PENS[t.kind];
  const two = state.glass2 && t === p.talls[p.talls.length - 1];
  return `пенал ${t.w} мм со стеклянной дверью во всю высоту` + (two ? " и стеклянной боковиной" : "") + `, рамка — ${FRAMES[state.frame][0]}`
    + (state.gShelf === "glass" ? ", стеклянные полки" : ", полки из ЛДСП") + ", с подсветкой";
}
function techText(p) {
  const s = state, t = [`мойка ${s.sink === "left" ? "слева" : "справа"} на основной стене, над ней шкаф с сушилкой`];
  if (p.dw) t.push(`посудомоечная машина ${p.dw / 10} см рядом с мойкой`);
  t.push(p.talls.some((x) => x.kind === "oven") ? "духовка и микроволновка в пенале" : "духовка под варочной панелью");
  t.push("вытяжка встроена в шкаф над варочной панелью");
  return t.join(", ");
}
function price() {
  const e = estimate(state), p = e.plan, F = KITCHEN.fit[state.fit];
  $("#cfg-low").textContent = fmt(e.low);
  $("#cfg-high").textContent = fmt(e.high);
  $("#cfg-notes").hidden = !p.notes.length;
  $("#cfg-notes").textContent = p.notes.length ? "Не поместилось: " + p.notes.join("; ") + ". Увеличьте длину стены или уберите технику." : "";
  const pens = p.talls.map((t) => penText(t, p));
  const lines = [
    "Здравствуйте! Хочу рассчитать кухню (с сайта ordazhihaz.kz, конструктор).",
    `Форма: ${FORMS[state.form].toLowerCase()}, ${sizeText()}, потолок ${state.H} мм`,
    `Верх: ${UPPERS[state.upper]}` + (state.light ? ", подсветка под верхними шкафами" : ""),
    pens.length ? `Пеналы: ${pens.join(", ")}` : "",
    `Техника: ${techText(p)}`,
    `Корпус: ЛДСП, ${decor(state.body).name}`,
    `Фасады: ${facadeText()}`,
    `Столешница: ${KITCHEN.top[state.top].name}, цвет «${topColor().name}»`,
    `Фурнитура: ${F.name}`,
    `Ориентировочно на сайте: от ${fmt(e.low)} до ${fmt(e.high)}`,
    "Фото или план кухни пришлю в этот чат.",
  ].filter(Boolean);
  $("#cfg-send").href = WA + "?text=" + encodeURIComponent(lines.join("\n"));
}

/* ---------- КП ---------- */
// снимок всей кухни с одного ракурса; openT: 0 — всё закрыто, 1 — двери и ящики открыты
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
  btn.disabled = true;
  btn.textContent = "Готовлю КП…";
  try {
    const e = estimate(state), p = e.plan, a = e.acc, F = KITCHEN.fit[state.fit];
    const kedr = state.top === "kedr";
    const pens = p.talls.map((t) => penText(t, p));
    const drawerSec = p.runs.some((r) => r.base.some((m) => m.kind === "drawers" || m.kind === "hob"));
    const items = [{
      name: `${kedr ? "Кухня со столешницей" : "Кухонный гарнитур"}: ${FORMS[state.form].toLowerCase()} ${sizeText()}`,
      lines: [
        `- Высота до потолка ${state.H} мм, ${UPPERS[state.upper]}` + (state.light ? ", подсветка под верхними шкафами" : ""),
        pens.length ? `- Пеналы: ${pens.join(", ")}` : "",
        `- ${techText(p)[0].toUpperCase() + techText(p).slice(1)}`,
        `- Корпус: ЛДСП 16 мм, ${decor(state.body).name}; задняя стенка ЛХДФ`,
        `- Фасады: ${facadeText()}`,
        `- Нижние шкафы с дверями` + (drawerSec ? ", секция с выкатными ящиками 360 + 180 + 180 мм" : "") + (p.talls.some((t) => t.kind === "oven") ? ", в пенале под духовкой ящик 360 мм" : ""),
        `- Фурнитура ${F.name}: петли с доводчиком, направляющие с доводчиком` + (a.push ? ", открывание антресолей нажатием" : ""),
        kedr ? `- Столешница: ${KITCHEN.top.kedr.name}, цвет «${topColor().name}», вырезы под мойку и варочную панель` : "",
      ].filter(Boolean),
      low: e.kitchen.low, high: e.kitchen.high,
    }];
    if (e.stone) items.push({
      name: "Столешница из искусственного камня",
      lines: [`- Длина ${(e.topLen / 1000).toFixed(2).replace(".", ",")} м.п., ширина 600 мм`, `- Вклейка мойки и вырезы, цвет «${topColor().name}» (точный декор по каталогу)`],
      qty: (e.topLen / 1000).toFixed(2).replace(".", ","), unit: "м.п.",
      low: e.stone.low, high: e.stone.high,
    });
    await makeKP({
      subtitle: "по изготовлению кухни",
      section: "Кухня",
      items,
      images: [snapshot(0), snapshot(1)],
      conditions: [
        "Стоимость ориентировочная: рассчитана в конструкторе на сайте ordazhihaz.kz. Точную цену менеджер назовёт после замера и согласования проекта.",
        "Замер — 10 000 ₸, засчитывается в стоимость заказа.",
        "Материалы, цвета и фурнитура подбираются и согласовываются по образцам в нашем офисе. Цвета на изображениях приблизительные.",
        "Условия оплаты: предоплата 70%, остаток 30% перед монтажом.",
        "Доставка и монтаж входят в стоимость.",
        "В стоимость не входят: ручки (их установка включена), бытовая техника, мойка, смеситель, вытяжка и фартук.",
        "Чтобы получить точное КП, отправьте этот расчёт нам в WhatsApp.",
      ],
      file: `КП_ORDA_ZHIHAZ_кухня_${state.A}${state.form === "corner" ? "x" + state.B : ""}`,
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
  el.addEventListener("input", () => {
    const v = Math.round(+el.value), [lo, hi] = limits(key);
    if (el.value !== "" && v >= lo && v <= hi) { el.removeAttribute("aria-invalid"); state[key] = v; refresh(); }
    else el.setAttribute("aria-invalid", "true");
  });
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
  const on = (sel, attr, key, conv) => document.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => {
    state[key] = conv ? conv(b.dataset[attr]) : b.dataset[attr]; refresh();
  }));
  on("[data-form]", "form", "form");
  on("[data-upper]", "upper", "upper");
  on("[data-sink]", "sink", "sink");
  on("[data-light]", "light", "light", (v) => v === "true");
  on("[data-glass2]", "glass2", "glass2", (v) => v === "true");
  on("[data-gshelf]", "gshelf", "gShelf");
  on("[data-frame]", "frame", "frame");
  $("#f-dw").addEventListener("change", (e) => { state.dw = +e.target.value; refresh(); });
  $("#f-glassw").addEventListener("change", (e) => { state.glassW = +e.target.value; refresh(); });
  on("[data-fmat]", "fmat", "fmat");
  on("[data-mill]", "mill", "mill");
  on("[data-top]", "top", "top");
  on("[data-fit]", "fit", "fit");
  document.querySelectorAll("[data-pen]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.pen;
    state.pens[k] = !state.pens[k];
    // холодильник один: либо встроенный в пенал, либо отдельностоящий в нише
    if (state.pens[k] && k === "fridge") state.pens.niche = false;
    if (state.pens[k] && k === "niche") state.pens.fridge = false;
    refresh();
  }));
  for (const [id, , key] of DIM_FIELDS) bindDim(id, key);
  $("#cfg-open").addEventListener("click", () => { state.open = !state.open; refresh(true); });
  $("#cfg-kp").addEventListener("click", (e) => downloadKP(e.currentTarget));
}

if (!KITCHEN.confirmed) $("#cfg-test").hidden = false;
ready = initThree();
bind();
refresh();
