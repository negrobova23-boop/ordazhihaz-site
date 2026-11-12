// «Собери сам»: заявка с выпадающими списками → стоимость услуг дизайнера и конструктора → готовое сообщение в WhatsApp.
// Ничего не сохраняем и никуда больше не отправляем.
(function () {
  var form = document.getElementById("ss-form");
  if (!form) return;
  // прайс «Собери сам» от 27.10.2026, ₸ за погонный метр
  var RATES = {
    kitchen: { name: "Кухня", design: 7000, tech: 10000 },
    wardrobe: { name: "Шкаф или гардеробная", design: 7000, tech: 8000 },
    cabinet: { name: "Тумба, комод", design: 5000, tech: 5000 },
    other: { name: "Другое", design: 7000, tech: 8000 }
  };
  var fmt = function (n) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸"; };
  var val = function (n) { var el = form.elements[n]; return el ? String(el.value).trim() : ""; };

  function calc() {
    var r = RATES[val("what")] || RATES.other;
    var len = Math.max(0, Math.min(20, parseFloat(val("len").replace(",", ".")) || 0));
    var lines = [], lt = String(len).replace(".", ",");
    if (val("service") === "both") lines.push(["Дизайн, " + lt + " м.п. × " + fmt(r.design), r.design * len]);
    if (val("service") !== "none") lines.push(["Чертежи конструктора, " + lt + " м.п. × " + fmt(r.tech), r.tech * len]);
    return { r: r, len: len, lines: lines, total: lines.reduce(function (a, l) { return a + l[1]; }, 0) };
  }

  function render() {
    form.querySelector("[data-ss-other]").hidden = val("what") !== "other";
    var c = calc();
    document.getElementById("ss-total").textContent = c.lines.length ? fmt(c.total) : "по вашим чертежам — без услуг";
    document.getElementById("ss-lines").innerHTML = c.lines.map(function (l) { return "<li><span>" + l[0] + "</span><b>" + fmt(l[1]) + "</b></li>"; }).join("");
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var c = calc(), opt = function (n) { var s = form.elements[n]; return s.options[s.selectedIndex].text; };
    var what = val("what") === "other" ? "Другое" + (val("other") ? ": " + val("other") : "") : c.r.name;
    var msg = [
      "Здравствуйте! Хочу заказать «Собери сам» (с сайта ordazhihaz.kz).",
      "Что нужно: " + what + ", " + String(c.len).replace(".", ",") + " м",
      val("size") ? "Размеры и описание: " + val("size") : "",
      "Услуги: " + opt("service"),
      "Корпус: " + opt("body"),
      "Фасады: " + opt("facade"),
      "Фурнитура (покупаю сам): " + opt("fit"),
      c.lines.length ? "Услуги дизайнера и конструктора на сайте: " + fmt(c.total) : "",
      "Фото и замеры пришлю в этот чат."
    ].filter(Boolean).join("\n");
    var url = form.action + "?text=" + encodeURIComponent(msg);
    // выбор номера (отдел продаж или руководитель): окно у кнопки отправки
    if (window.ordaWaPick) window.ordaWaPick(url, e.submitter || form.querySelector('button[type="submit"]'));
    else window.open(url, "_blank", "noopener");
  });
  render();
})();
