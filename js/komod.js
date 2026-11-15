// Конструктор комода и обувницы: 3D по размерам + ориентировочная цена диапазоном + КП + заявка в WhatsApp.
// Комод — весь в ящиках (3 варианта раскладки). Обувница — 3 яруса откидных секций, сверху по желанию невысокий ящик.
// Фасады и крышка — из одного материала; видимые боковины по желанию — тоже. Ничего не отправляется на сервер.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PRICES, DECORS, FILM_COLORS, PAINT_COLORS } from "./shkaf-prices.js";
import { KITCHEN } from "./kuhnya-prices.js";
import { makeKP } from "./shkaf-kp.js";
import { mm, mat, box, millFace, millInset, woodSwatch, setAnisotropy } from "./cfg3d.js";

const WA = "https://wa.me/77769994032";
const $ = (s, r) => (r || document).querySelector(s);
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
const T = 16;            // ЛДСП корпуса
const TOP_T = 18;        // крышка (материал фасадов)
const PLINTH = 80;       // цоколь — МДФ, как фасады
const LOW = 150;         // невысокий верхний ящик
const GAP = 3;           // зазор между фасадами
const OVER = 20;         // свес крышки над фасадами спереди
const handles = (w) => (w > 600 ? 2 : 1);   // фасад шире 600 мм — две ручки
// где стоят ручки на фасаде шириной w (смещение от центра)
const handleXs = (w) => (handles(w) === 2 ? [-w / 4, w / 4] : [0]);

const KINDS = { komod: "Комод", shoe: "Обувница" };
const LAYOUTS = {
  equal4: "4 одинаковых ящика",
  low3: "невысокий ящик сверху и 3 одинаковых",
  pair3: "2 невысоких ящика сверху (левый и правый) и 3 одинаковых",
};
const PRESETS = {
  komod: [[800, 800, 450], [1000, 850, 450], [1200, 850, 500]],
  shoe: [[600, 0, 300], [800, 0, 300], [1000, 0, 300]],
};
const FMATS = {
  ldsp: { name: "ЛДСП", list: DECORS },
  film: { name: "МДФ в плёнке", list: FILM_COLORS },
  paint: { name: "МДФ в краске", list: PAINT_COLORS },
};
const MILLS = { modern: "Модерн", relief: "Рифлёнка", vyborka: "Выборка", classic: "Классика" };

const state = { kind: "komod", W: 1000, H: 850, D: 450, layout: "equal4", flap: 375, shoeDrawer: true,
  body: "white", fmat: "film", mill: "modern", facade: "f-white", sides: false, fit: "dtc", open: false };
const findIn = (list, id) => list.find((d) => d.id === id) || list[0];
const decor = (id) => findIn(DECORS, id);
const facadeColor = () => findIn(FMATS[state.fmat].list, state.facade);

/* ---------- размеры ---------- */
function limits(key) {
  const shoe = state.kind === "shoe";
  if (key === "W") return shoe ? [400, 1400] : [400, 2000];
  if (key === "H") return [500, 1200];
  return shoe ? [300, 350] : [350, 600];   // D
}
// высота обувницы складывается из ярусов: цоколь + 3 откидных фасада + ящик + крышка
// у обувницы фасады внутренние (между боковинами, над дном), поэтому добавляется толщина дна
const shoeH = (s) => PLINTH + T + 3 * s.flap + (s.shoeDrawer ? LOW : 0) + TOP_T;
function normalize() {
  for (const k of ["W", "H", "D"]) {
    const [lo, hi] = limits(k);
    state[k] = Math.min(hi, Math.max(lo, state[k]));
  }
  state.flap = Math.min(400, Math.max(350, state.flap));
  if (state.kind === "shoe") state.H = shoeH(state);
  if (!FMATS[state.fmat].list.some((c) => c.id === state.facade)) state.facade = FMATS[state.fmat].list[0].id;
}

// фасады снизу вверх: { y, h, x, w, type: "drawer" | "flap" }
function fronts(s) {
  const out = [], x0 = -s.W / 2;
  let y = PLINTH;
  if (s.kind === "shoe") {                       // внутренние фасады: между боковинами, над дном
    const xi = -s.W / 2 + T, wi = s.W - 2 * T;
    y += T;
    for (let i = 0; i < 3; i++) { out.push({ y, h: s.flap, x: xi, w: wi, type: "flap" }); y += s.flap; }
    if (s.shoeDrawer) out.push({ y, h: LOW, x: xi, w: wi, type: "drawer" });
    return out;
  }
  const avail = s.H - PLINTH - TOP_T;
  if (s.layout === "equal4") { for (let i = 0; i < 4; i++) out.push({ y: y + (avail / 4) * i, h: avail / 4, x: x0, w: s.W, type: "drawer" }); return out; }
  const h = (avail - LOW) / 3;
  for (let i = 0; i < 3; i++) out.push({ y: y + h * i, h, x: x0, w: s.W, type: "drawer" });
  const yt = y + 3 * h;
  if (s.layout === "low3") out.push({ y: yt, h: LOW, x: x0, w: s.W, type: "drawer" });
  else { out.push({ y: yt, h: LOW, x: x0, w: s.W / 2, type: "drawer" }); out.push({ y: yt, h: LOW, x: 0, w: s.W / 2, type: "drawer" }); }
  return out;
}

/* ---------- цена ---------- */
export function estimate(s) {
  const P = PRICES, K = KITCHEN, F = K.fit[s.fit], m2 = (a, b) => (a * b) / 1e6;
  const a = { ldsp: {}, back: 0, edge: 0, fac: 0, drawer: 0, flap: 0, handle: 0 };
  const L = (area) => { a.ldsp[s.body] = (a.ldsp[s.body] || 0) + area; };
  const front = (w, h) => {
    if (s.fmat === "ldsp") { a.ldsp[s.facade] = (a.ldsp[s.facade] || 0) + m2(w, h); a.edge += 2 * (w + h); }
    else a.fac += m2(w, h);
  };
  const W = s.W, H = s.H, D = s.D, inner = W - 2 * T;
  if (s.sides) front(D, H - TOP_T); else { L(2 * m2(H - TOP_T, D)); a.edge += 2 * H; }   // боковины
  L(2 * m2(inner, D)); a.edge += 2 * inner;                                              // дно и стяжка под крышкой
  front(W, s.kind === "shoe" ? D : D + T + OVER);                                         // крышка — как фасады; у комода со свесом
  front(W, PLINTH);                                                                       // цоколь — МДФ, как фасады
  a.back += m2(W, H);
  for (const f of fronts(s)) {
    front(f.w, f.h); a.handle += handles(f.w);
    if (f.type === "drawer") {                                                            // короб ящика
      const bh = Math.max(80, f.h - 60);
      L(2 * m2(D - 50, bh) + 2 * m2(f.w - 2 * T - 30, bh)); a.back += m2(f.w - 2 * T, D - 50); a.edge += 2 * f.w; a.drawer++;
    } else { L(m2(f.w - 2 * T, 120)); a.flap++; }                                         // откидная секция: полка-подставка
  }
  let ldsp = 0;
  for (const [id, area] of Object.entries(a.ldsp)) { const sh = P.sheet[decor(id).tier]; ldsp += Math.ceil(area / (sh.area * P.use.ldsp)) * sh.price; }
  const back = Math.ceil(a.back / (P.back.area * P.use.back)) * P.back.price;
  const edge = (a.edge / 1000) * 1.05 * P.edgePerM;
  const facade = s.fmat === "ldsp" ? 0 : a.fac * P.facade[s.fmat][s.mill === "modern" ? "plain" : "frame"];
  const hardware = a.drawer * F.drawer + a.flap * K.shoeFlap + a.handle * K.handle + K.kit;
  const design = (W / 1000) * K.designSmall;
  const total = ldsp + back + edge + facade + hardware + design;
  const r = (x) => Math.round(x / P.roundTo) * P.roundTo;
  return { acc: a, low: r(total * P.range.low), high: r(total * P.range.high) };
}

/* ---------- 3D ---------- */
let renderer, scene, camera, controls, group, ready = false, movers = [];
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
  camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.enableZoom = false;
  renderer.domElement.style.touchAction = "pan-y";
  controls.minPolarAngle = 0.3; controls.maxPolarAngle = Math.PI / 2 - 0.05;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a20, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2.5, 4, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
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
// фасад с фрезеровкой (для МДФ)
function face(g, w, h, cx, cy, z, front) {
  if (state.fmat === "ldsp") box(g, w, h, T, cx, cy, z, front);
  else millFace(g, w, h, T, cx, cy, z, front, state.mill);
}
// ручка — посередине верхнего поля фасада, не заходит на фрезеровку
const handleOff = (w, h) => Math.max(10, Math.min(20, millInset(w, h) / 2));

// веерная опора механизма обувницы (сектор четверти круга с двумя вырезами), толщина 8 мм
const mechMat = mat("#80858c", 0.5);
function fanGeometry(R) {
  const r = R * mm, b = 22 * mm, sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI / 2, false); sh.lineTo(0, 0);
  for (const [a0, a1] of [[0.14, 0.72], [0.85, 1.43]]) {                   // два окна, между ними — спица
    const h = new THREE.Path(), ri = r - b, r0 = b * 1.6;
    h.moveTo(r0 * Math.cos(a0), r0 * Math.sin(a0)); h.absarc(0, 0, ri, a0, a1, false);
    h.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1)); sh.holes.push(h);
  }
  return new THREE.ExtrudeGeometry(sh, { depth: 8 * mm, bevelEnabled: false });
}

function build() {
  if (!ready) return;
  while (group.children.length) { const c = group.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  movers = [];
  const s = state, W = s.W, H = s.H, D = s.D;
  const body = mat(decor(s.body)), front = mat(facadeColor(), s.fmat === "paint" ? 0.45 : 0.5);
  const metal = mat("#b9bcc0", 0.3), backMat = mat("#e6e3dc", 0.8);
  const sideMat = s.sides ? front : body;
  // корпус: боковины, дно, задняя стенка; крышка и цоколь — материал фасадов
  box(group, T, H - TOP_T, D, -W / 2 + T / 2, (H - TOP_T) / 2, D / 2, sideMat);
  box(group, T, H - TOP_T, D, W / 2 - T / 2, (H - TOP_T) / 2, D / 2, sideMat);
  box(group, W - 2 * T, T, D, 0, PLINTH + T / 2, D / 2, body);
  box(group, W - 2 * T, H - PLINTH - TOP_T, 4, 0, (H - TOP_T + PLINTH) / 2, 2, backMat);
  const topD = s.kind === "shoe" ? D : D + T + OVER;                         // у обувницы крышка заподлицо с боковинами
  box(group, W, TOP_T, topD, 0, H - TOP_T / 2, topD / 2, front);
  box(group, W - 2 * T, PLINTH - 10, T, 0, (PLINTH - 10) / 2, D - 40, front);
  const zf = s.kind === "shoe" ? D - T / 2 : D + T / 2;                   // обувница — фасады внутри корпуса
  for (const f of fronts(s)) {
    const cx = f.x + f.w / 2;
    if (f.type === "drawer") {                                                  // выдвижной ящик
      const dg = new THREE.Group();
      face(dg, f.w - GAP, f.h - GAP, cx, f.y + f.h / 2, zf, front);
      for (const hx of handleXs(f.w)) box(dg, Math.min(160, f.w * 0.3), 12, 14, cx + hx, f.y + f.h - handleOff(f.w, f.h), zf + 16, metal);
      const bh = Math.max(60, f.h - 70), dep = D - 60, z0 = zf - T / 2 - dep / 2;
      box(dg, T, bh, dep, f.x + T + 14, f.y + 20 + bh / 2, z0, body); box(dg, T, bh, dep, f.x + f.w - T - 14, f.y + 20 + bh / 2, z0, body);
      box(dg, f.w - 2 * T - 30, bh, T, cx, f.y + 20 + bh / 2, z0 - dep / 2, body);
      box(dg, f.w - 2 * T - 30, 6, dep, cx, f.y + 23, z0, body);
      group.add(dg);
      movers.push((t) => { dg.position.z = t * dep * 0.7 * mm; });
    } else {                                                                    // откидная секция обувницы: наклоняется на себя от нижней кромки
      const pv = new THREE.Group();
      pv.position.set(cx * mm, f.y * mm, zf * mm);
      face(pv, f.w - GAP, f.h - GAP, 0, f.h / 2, 0, front);
      for (const hx of handleXs(f.w)) box(pv, Math.min(160, f.w * 0.3), 12, 14, hx, f.h - handleOff(f.w, f.h), T / 2 + 8, metal);
      const tray = Math.min(D - 60, 180);
      box(pv, f.w - 2 * T - 20, T, tray, 0, f.h * 0.35, -T / 2 - tray / 2, body);   // подставка для обуви
      box(pv, f.w - 2 * T - 20, 60, T, 0, f.h * 0.35 + 30, -T / 2 - tray, body);    // бортик
      // поворотный механизм у каждой боковины: веерная опора, поворачивается вместе с секцией
      const R = Math.min(f.h * 0.72, D - 70, 270);
      for (const sx of [-1, 1]) {
        const mx = sx * (f.w / 2 - T - 10);
        const fan = new THREE.Mesh(fanGeometry(R), mechMat);
        fan.rotation.y = Math.PI / 2;
        fan.position.set((mx - 4) * mm, (T + 16) * mm, (-T / 2 - 2) * mm);
        fan.castShadow = true; pv.add(fan);
        box(group, 10, 26, 70, mx, f.y + T + 13, zf - T / 2 - 45, mechMat);            // неподвижное основание на корпусе
      }
      group.add(pv);
      movers.push((t) => { pv.rotation.x = 0.78 * t; });
    }
  }
  for (const m of movers) m(anim.open);
  fitCamera();
}

let fitted = "";
function fitCamera(force) {
  const s = state, key = [s.W, s.H, s.D, camera.aspect.toFixed(2)].join();
  if (fitted === key && !force) return;
  fitted = key;
  const center = new THREE.Vector3(0, s.H * mm * 0.48, s.D * mm * 0.5);
  const r = 0.5 * Math.hypot(s.W, s.H, s.D) * mm;
  const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (r * 1.05) / Math.sin(Math.min(vfov, hfov) / 2);
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(new THREE.Vector3(0.45, 0.35, 1).normalize(), dist);
  camera.lookAt(center); camera.updateProjectionMatrix();
}

/* ---------- интерфейс ---------- */
const DIM_FIELDS = [["f-w", "h-w", "W"], ["f-h", "h-h", "H"], ["f-d", "h-d", "D"]];
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
function presetButtons() {
  const host = $("#presets");
  host.innerHTML = "";
  for (const [w, h, d] of PRESETS[state.kind]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = state.kind === "shoe" ? `${w} × ${d}` : `${w} × ${h} × ${d}`;
    b.setAttribute("aria-pressed", String(state.W === w && state.D === d && (state.kind === "shoe" || state.H === h)));
    b.addEventListener("click", () => { state.W = w; state.D = d; if (h) state.H = h; refresh(); });
    host.appendChild(b);
  }
}
function syncDims() {
  for (const [id, hintId, key] of DIM_FIELDS) {
    const el = $("#" + id), [lo, hi] = limits(key);
    el.min = lo; el.max = hi;
    $("#" + hintId).textContent = key === "H" && state.kind === "shoe" ? "по ярусам" : "от " + lo + " до " + hi;
    el.readOnly = key === "H" && state.kind === "shoe";
    if (document.activeElement !== el) { el.value = state[key]; el.removeAttribute("aria-invalid"); }
  }
}
function refresh(skipBuild) {
  normalize();
  pressed("[data-kind]", "kind", state.kind);
  pressed("[data-layout]", "layout", state.layout);
  pressed("[data-sdrawer]", "sdrawer", String(state.shoeDrawer));
  pressed("[data-sides]", "sides", String(state.sides));
  pressed("[data-fmat]", "fmat", state.fmat);
  pressed("[data-mill]", "mill", state.mill);
  pressed("[data-fit]", "fit", state.fit);
  $("#row-layout").hidden = state.kind !== "komod";
  $("#row-shoe").hidden = state.kind !== "shoe";
  $("#mill-row").hidden = state.fmat === "ldsp";
  $("#f-flap").value = String(state.flap);
  $("#cfg-open").textContent = state.open ? "Закрыть ящики" : "Открыть ящики";
  syncDims(); presetButtons();
  swatches($("#sw-body"), DECORS, "body");
  swatches($("#sw-facade"), FMATS[state.fmat].list, "facade");
  $("#n-body").textContent = decor(state.body).name;
  $("#n-facade").textContent = facadeColor().name;
  if (!skipBuild) build();
  price();
}
const facadeText = () => (state.fmat === "ldsp" ? `ЛДСП, ${facadeColor().name}` : `${FMATS[state.fmat].name}, фрезеровка «${MILLS[state.mill]}», цвет ${facadeColor().name}`);
const sizeText = () => `${state.W} × ${state.H} × ${state.D} мм`;
function contentText() {
  if (state.kind === "komod") return LAYOUTS[state.layout];
  return `3 яруса откидных секций, фасады по ${state.flap} мм` + (state.shoeDrawer ? ", сверху невысокий выдвижной ящик" : "");
}
function price() {
  const e = estimate(state), F = KITCHEN.fit[state.fit];
  $("#cfg-low").textContent = fmt(e.low);
  $("#cfg-high").textContent = fmt(e.high);
  const lines = [
    `Здравствуйте! Хочу рассчитать: ${KINDS[state.kind].toLowerCase()} (с сайта ordazhihaz.kz, конструктор).`,
    `Размеры: ${sizeText()}`,
    `Наполнение: ${contentText()}`,
    `Корпус: ЛДСП, ${decor(state.body).name}`,
    `Фасады и крышка: ${facadeText()}` + (state.sides ? "; видимые боковины — так же" : ""),
    `Фурнитура: ${F.name}`,
    `Ориентировочно на сайте: от ${fmt(e.low)} до ${fmt(e.high)}`,
    "Фото места, где будет стоять, пришлю в этот чат.",
  ];
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
    const e = estimate(state), F = KITCHEN.fit[state.fit];
    await makeKP({
      subtitle: state.kind === "shoe" ? "по изготовлению обувницы" : "по изготовлению комода",
      section: KINDS[state.kind],
      name: `${KINDS[state.kind]} ${sizeText()}`,
      lines: [
        `- ${contentText()[0].toUpperCase() + contentText().slice(1)}`,
        `- Корпус: ЛДСП 16 мм, ${decor(state.body).name}; задняя стенка ЛХДФ`,
        `- Фасады и крышка: ${facadeText()}` + (state.sides ? "; видимые боковины — из того же материала" : ""),
        `- Цоколь: МДФ, как фасады`,
        `- Фурнитура ${F.name}: направляющие с доводчиком` + (state.kind === "shoe" ? ", механизмы откидных секций" : ""),
      ],
      low: e.low, high: e.high,
      images: [snapshot(0), snapshot(1)],
      conditions: [
        "Стоимость ориентировочная: рассчитана в конструкторе на сайте ordazhihaz.kz. Точную цену менеджер назовёт после согласования проекта.",
        "Материалы, цвета и фурнитура подбираются и согласовываются по образцам в нашем офисе. Цвета на изображениях приблизительные.",
        "Условия оплаты: предоплата 70%, остаток 30% перед монтажом.",
        "Доставка и монтаж входят в стоимость.",
        "В стоимость не входят: ручки (их установка включена).",
        "Чтобы получить точное КП, отправьте этот расчёт нам в WhatsApp.",
      ],
      file: `КП_ORDA_ZHIHAZ_${state.kind === "shoe" ? "обувница" : "комод"}_${state.W}x${state.H}`,
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
  document.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
    if (state.kind === b.dataset.kind) return;
    state.kind = b.dataset.kind;
    const [w, h, d] = PRESETS[state.kind][1];                  // при смене вида — средний типовой размер
    state.W = w; state.D = d; if (h) state.H = h;
    refresh();
  }));
  on("[data-layout]", "layout", "layout");
  on("[data-sdrawer]", "sdrawer", "shoeDrawer", (v) => v === "true");
  on("[data-sides]", "sides", "sides", (v) => v === "true");
  on("[data-fmat]", "fmat", "fmat");
  on("[data-mill]", "mill", "mill");
  on("[data-fit]", "fit", "fit");
  $("#f-flap").addEventListener("change", (e) => { state.flap = +e.target.value; refresh(); });
  for (const [id, , key] of DIM_FIELDS) bindDim(id, key);
  $("#cfg-open").addEventListener("click", () => { state.open = !state.open; refresh(true); });
  $("#cfg-kp").addEventListener("click", (e) => downloadKP(e.currentTarget));
}

if (!KITCHEN.confirmed) $("#cfg-test").hidden = false;
ready = initThree();
bind();
refresh();
