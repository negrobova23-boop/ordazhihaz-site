// «Услуги цеха»: заявка на распил, присадку, фасады, гнутые панели → ориентировочная сумма по прайсу → готовое сообщение в WhatsApp.
// Ничего не сохраняем и никуда больше не отправляем.
(function () {
  var form = document.getElementById("us-form");
  if (!form) return;
  // прайс-лист цеха, ₸
  var CUT = { ldsp: ["ЛДСП", 1500], mdf: ["МДФ", 2000], hdf: ["ХДФ", 1000], top: ["Столешница", 2000, " шт."] };
  var EDGE = 180, DRILL = 5000, VENEER = [40000, 55000];
  var MILL = { modern: "Модерн", vyborka: "Выборка", relief: "Рельеф", shtapik: "Штапики" };
  var FACADE = {   // за м²: [16 мм, 18 мм]
    film: { modern: [16000, 18000], vyborka: [18500, 20000], relief: [18000, 20000], shtapik: [22000, 24000] },
    paint: { modern: [26000, 28000], vyborka: [30000, 35000], relief: [30000, 35000], shtapik: [32000, 36000] }
  };
  var COVER = { film: "плёнка", paint: "краска", veneer: "шпон" };
  var picked = {}, cover = "film";
  var fmt = function (n) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸"; };
  var val = function (n) { var el = form.elements[n]; return el ? String(el.value).trim() : ""; };
  var num = function (n) { return Math.max(0, parseFloat(val(n).replace(",", ".")) || 0); };
  var txt = function (n) { var s = form.elements[n]; return s.options[s.selectedIndex].text; };
  var dec = function (x) { return String(x).replace(".", ","); };
  // 1 лист, 2 листа, 5 листов
  var sheets = function (n) {
    var a = n % 10, b = n % 100;
    return n + (a === 1 && b !== 11 ? " лист" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? " листа" : " листов");
  };

  function calc() {
    var lines = [], low = 0, high = 0, add = function (t, a, b) { lines.push([t, a, b == null ? a : b]); low += a; high += b == null ? a : b; };
    if (picked.cut) {
      var m = CUT[val("cutMat")], q = num("cutQty");
      add("Распил " + m[0] + ": " + (m[2] ? q + m[2] : sheets(q)) + " × " + fmt(m[1]), q * m[1]);
      if (num("edge")) add("Кромка с прифуговкой: " + num("edge") + " м × " + fmt(EDGE), num("edge") * EDGE);
    }
    if (picked.drill) add("Присадка: " + sheets(num("drillQty")) + " × " + fmt(DRILL), num("drillQty") * DRILL);
    if (picked.facade) {
      var a = num("area");
      if (cover === "veneer") add("Фасады, шпон: " + dec(a) + " м² × 40 000–55 000 ₸", a * VENEER[0], a * VENEER[1]);
      else {
        var p = FACADE[cover][val("mill")][val("thick") === "18" ? 1 : 0];
        add("Фасады, " + COVER[cover] + ", " + MILL[val("mill")] + ", " + val("thick") + " мм: " + dec(a) + " м² × " + fmt(p), a * p);
      }
    }
    return { lines: lines, low: low, high: high };
  }

  function render() {
    form.querySelectorAll("[data-us]").forEach(function (b) { b.setAttribute("aria-pressed", String(!!picked[b.dataset.us])); });
    form.querySelectorAll(".us-block").forEach(function (f) { f.hidden = !picked[f.dataset.for]; });
    form.querySelectorAll("[data-cover]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cover === cover)); });
    document.getElementById("us-mill").hidden = cover === "veneer";
    document.getElementById("us-thick").hidden = cover === "veneer";
    var c = calc(), sum = document.getElementById("us-sum");
    sum.hidden = !c.lines.length;
    document.getElementById("us-total").textContent = c.low === c.high ? fmt(c.low) : fmt(c.low) + " – " + fmt(c.high);
    document.getElementById("us-lines").innerHTML = c.lines.map(function (l) {
      return "<li><span>" + l[0] + "</span><b>" + (l[1] === l[2] ? fmt(l[1]) : fmt(l[1]) + " – " + fmt(l[2])) + "</b></li>";
    }).join("");
  }

  form.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.us) { picked[b.dataset.us] = !picked[b.dataset.us]; document.getElementById("us-hint").hidden = true; render(); }
    if (b.dataset.cover) { cover = b.dataset.cover; render(); }
  });
  form.addEventListener("input", render);
  form.addEventListener("change", render);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!Object.keys(picked).some(function (k) { return picked[k]; })) { document.getElementById("us-hint").hidden = false; return; }
    var c = calc(), msg = ["Здравствуйте! Заявка в цех (с сайта ordazhihaz.kz, «Услуги цеха»)."];
    if (picked.cut) msg.push("Распил: " + CUT[val("cutMat")][0] + ", " + (CUT[val("cutMat")][2] ? num("cutQty") + CUT[val("cutMat")][2] : sheets(num("cutQty"))) + (num("edge") ? "; кромка с прифуговкой " + num("edge") + " м" : ""));
    if (picked.drill) msg.push("Присадка: " + sheets(num("drillQty")) + (val("drillFit") ? ", фурнитура: " + val("drillFit") : ""));
    if (picked.facade) msg.push("МДФ-фасады: " + COVER[cover] + (cover === "veneer" ? "" : ", фрезеровка «" + MILL[val("mill")] + "», " + val("thick") + " мм")
      + ", " + dec(num("area")) + " м²" + (val("color") ? ", цвет: " + val("color") : ""));
    if (picked.bent) msg.push("Гнутые панели: радиус " + txt("radius") + ", " + txt("bentCover").toLowerCase() + (val("bentSize") ? ", " + val("bentSize") : ""));
    if (picked.other) msg.push("Другое: " + (val("otherText") || "опишу в чате"));
    if (val("note")) msg.push("Комментарий: " + val("note"));
    if (c.lines.length) msg.push("Ориентировочно по прайсу на сайте: " + (c.low === c.high ? fmt(c.low) : fmt(c.low) + " – " + fmt(c.high)));
    msg.push("Чертёж, раскрой или фото пришлю в этот чат.");
    var url = form.action + "?text=" + encodeURIComponent(msg.join("\n"));
    // выбор номера (отдел продаж или руководитель): окно у кнопки отправки
    if (window.ordaWaPick) window.ordaWaPick(url, e.submitter || form.querySelector('button[type="submit"]'));
    else window.open(url, "_blank", "noopener");
  });
  render();
})();
