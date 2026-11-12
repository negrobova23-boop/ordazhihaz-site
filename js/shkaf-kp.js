// КП из конструктора: лист A4 в фирменном стиле ORDA ZHIHAZ (как КП из Excel-шаблона),
// с изображениями шкафа и водяными знаками. Рисуется в браузере и скачивается PDF-файлом.
// Ничего не отправляется на сервер.

const GREEN = "#1f4a3a", GOLD = "#b08d45", BEIGE = "#f1e9d8", INK = "#1d2a24";
const PW = 1240, PH = 1754, M = 50;                 // A4 при 150 dpi, поля
const SANS = "Arial, 'Helvetica Neue', sans-serif";
const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n);
const loadImg = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const w of para.split(" ")) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function spaced(g, text, cx, y, gap) {
  const chars = [...text], widths = chars.map((c) => g.measureText(c).width);
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1)) / 2;
  chars.forEach((c, i) => { g.fillText(c, x, y); x += widths[i] + gap; });
}
function fitImage(g, img, x, y, w, h) {
  const k = Math.min(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
  const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
  g.fillStyle = "#f4efe5";
  g.fillRect(x, y, w, h);
  g.drawImage(img, ix, iy, iw, ih);
}
// водяной знак поверх изображения: логотип по центру и подпись
function markImage(g, logo, x, y, w, h) {
  g.save();
  g.globalAlpha = 0.28;
  const s = Math.min(w, h) * 0.36;
  g.drawImage(logo, x + (w - s) / 2, y + (h - s) / 2 - 10, s, s);
  g.globalAlpha = 0.45;
  g.fillStyle = GREEN;
  g.font = `bold 15px ${SANS}`;
  g.textAlign = "center";
  g.fillText("ORDA ZHIHAZ · ordazhihaz.kz", x + w / 2, y + h - 10);
  g.restore();
}
// водяной знак на весь лист: повторяющаяся надпись по диагонали
function markPage(g) {
  g.save();
  g.globalAlpha = 0.06;
  g.fillStyle = GREEN;
  g.font = `bold 34px ${SANS}`;
  g.textAlign = "center";
  g.translate(PW / 2, PH / 2);
  g.rotate(-Math.PI / 6);
  for (let y = -PH; y < PH; y += 170) {
    for (let x = -PW; x < PW; x += 380) g.fillText("ORDA ZHIHAZ", x + ((y / 170) % 2 ? 190 : 0), y);
  }
  g.restore();
}

// d: { subtitle, section, images[dataURL], conditions[], file,
//      items: [{ name, lines[], low, high, qty?, unit? }] — или одна позиция полями name, lines, low, high }
export async function makeKP(d) {
  const items = d.items || [{ name: d.name, lines: d.lines, low: d.low, high: d.high }];
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  const g = c.getContext("2d");
  const logo = await loadImg("/logo.png");
  const pics = [];
  for (const src of d.images) if (src) pics.push(await loadImg(src));

  g.fillStyle = "#fff";
  g.fillRect(0, 0, PW, PH);
  g.textBaseline = "alphabetic";

  // шапка
  g.drawImage(logo, PW / 2 - 85, 50, 170, 170);
  g.fillStyle = GREEN;
  g.textAlign = "center";
  g.font = `bold 50px ${SANS}`;
  g.fillText("КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", PW / 2, 290);
  g.fillStyle = GOLD;
  g.font = `bold 21px ${SANS}`;
  spaced(g, d.subtitle.toUpperCase(), PW / 2, 336, 7);
  g.fillRect(M, 362, 52, 5);
  g.textAlign = "right";
  g.fillStyle = "#6b746f";
  g.font = `16px ${SANS}`;
  g.fillText(`Дата: ${new Date().toLocaleDateString("ru-RU")}  ·  предварительный расчёт с сайта ordazhihaz.kz`, PW - M, 368);

  // таблица
  const cols = [["№", 50], ["Наименование и тех. характеристики", 450], ["Фото", 250], ["Кол-во", 70], ["Ед.", 55], ["Цена (тг)", 132], ["Сумма (тг)", 133]];
  const xs = [M];
  for (const [, w] of cols) xs.push(xs[xs.length - 1] + w);
  const TW = xs[xs.length - 1] - M;
  let y = 392;
  const cell = (x, yy, w, h, fill) => { if (fill) { g.fillStyle = fill; g.fillRect(x, yy, w, h); } g.strokeStyle = GOLD; g.lineWidth = 2; g.strokeRect(x, yy, w, h); };

  cols.forEach(([t, w], i) => { cell(xs[i], y, w, 50, GREEN); });
  g.fillStyle = "#fff";
  g.font = `bold 19px ${SANS}`;
  g.textAlign = "center";
  cols.forEach(([t, w], i) => g.fillText(t, xs[i] + w / 2, y + 32));
  y += 50;

  cell(M, y, TW, 40, BEIGE);
  g.fillStyle = GREEN;
  g.textAlign = "left";
  g.font = `bold 20px ${SANS}`;
  g.fillText(d.section.toUpperCase(), M + 20, y + 27);
  y += 40;

  // строки позиций: название, характеристики, изображения (у первой позиции)
  const tx = xs[1] + 8, tw = cols[1][1] - 16;
  const picW = cols[2][1] - 16, picH = Math.round(picW * 0.8);
  items.forEach((it, n) => {
    g.textAlign = "left";
    g.font = `bold 21px ${SANS}`;
    const nameL = wrap(g, it.name, tw);
    g.font = `16px ${SANS}`;
    const lineL = it.lines.flatMap((l) => wrap(g, l, tw));
    const textH = 14 + nameL.length * 27 + lineL.length * 22 + 14;
    const own = n === 0 ? pics : [];
    const picsH = own.length ? own.length * (picH + 10) + 10 : 0;
    const rowH = Math.max(textH, picsH, own.length ? 200 : 90);
    cols.forEach(([, w], i) => cell(xs[i], y, w, rowH));
    g.fillStyle = GREEN;
    g.font = `bold 21px ${SANS}`;
    let ty = y + 34;
    for (const l of nameL) { g.fillText(l, tx, ty); ty += 27; }
    g.font = `16px ${SANS}`;
    for (const l of lineL) { g.fillText(l, tx, ty); ty += 22; }
    own.forEach((p, i) => {
      const px = xs[2] + 8, py = y + 10 + i * (picH + 10) + (rowH - picsH) / 2;
      fitImage(g, p, px, py, picW, picH);
      markImage(g, logo, px, py, picW, picH);
    });
    g.fillStyle = INK;
    g.textAlign = "center";
    g.font = `19px ${SANS}`;
    const mid = y + rowH / 2;
    g.fillText(String(n + 1), xs[0] + cols[0][1] / 2, mid + 7);
    g.fillText(it.qty || "1", xs[3] + cols[3][1] / 2, mid + 7);
    g.fillText(it.unit || "шт", xs[4] + cols[4][1] / 2, mid + 7);
    for (const i of [5, 6]) {
      g.fillText("от " + fmt(it.low), xs[i] + cols[i][1] / 2, mid - 6);
      g.fillText("до " + fmt(it.high), xs[i] + cols[i][1] / 2, mid + 20);
    }
    y += rowH;
  });

  // итог
  cell(M, y, xs[6] - M, 64, GREEN);
  cell(xs[6], y, cols[6][1], 64, GREEN);
  g.fillStyle = "#fff";
  g.textAlign = "right";
  g.font = `bold 21px ${SANS}`;
  g.fillText("Ориентировочная стоимость (без НДС):", xs[6] - 20, y + 39);
  g.textAlign = "center";
  g.font = `bold 18px ${SANS}`;
  const low = items.reduce((a, it) => a + it.low, 0), high = items.reduce((a, it) => a + it.high, 0);
  g.fillText("от " + fmt(low) + " ₸", xs[6] + cols[6][1] / 2, y + 27);
  g.fillText("до " + fmt(high) + " ₸", xs[6] + cols[6][1] / 2, y + 51);
  y += 64;

  // условия
  y += 50;
  g.textAlign = "left";
  g.fillStyle = GREEN;
  g.font = `bold 26px ${SANS}`;
  g.fillText("Условия:", M + 4, y);
  y += 12;
  g.fillStyle = INK;
  g.font = `18px ${SANS}`;
  d.conditions.forEach((t, i) => {
    const ls = wrap(g, t, TW - 60);
    ls.forEach((l, k) => { y += 28; g.fillText((k ? "" : `${i + 1}. `) + l, M + (k ? 44 : 20), y); });
    y += 6;
  });
  y += 44;
  g.font = `bold 19px ${SANS}`;
  g.fillText("С уважением, ORDA ZHIHAZ.  Отдел продаж: +7 776 999 40 32  ·  Руководитель: +7 776 112 12 88", M + 20, y);

  // нижняя полоса
  const fy = Math.max(y + 40, PH - 110);
  g.fillStyle = GREEN;
  g.fillRect(M, fy, TW, 54);
  g.fillStyle = GOLD;
  g.textAlign = "center";
  g.font = `bold 17px ${SANS}`;
  g.fillText("ORDA ZHIHAZ  |  Астана, ул. Шары Жиенкуловой, 5/8  |  ordazhihaz.kz  |  +7 776 999 40 32", PW / 2, fy + 34);

  markPage(g);
  await save(c, d.file);
}

async function save(canvas, file) {
  try {
    if (!window.jspdf) {
      await new Promise((ok, fail) => { const s = document.createElement("script"); s.src = JSPDF; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
    }
    const pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297);
    pdf.save(file + ".pdf");
  } catch (e) {
    // если библиотека PDF не загрузилась, отдаём тот же лист картинкой
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = file + ".png";
    a.click();
  }
}
