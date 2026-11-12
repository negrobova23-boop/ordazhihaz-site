// Расчёт за 1 минуту: три шага → готовое сообщение в WhatsApp. Ничего не сохраняем и никуда больше не отправляем.
// Шаг 1 — что нужно; шаг 2 — нужен ли замер; шаг 3 — запись на замер или отправка проекта и размеров.
(function () {
  var form = document.getElementById("calc");
  if (!form) return;
  var step = function (name) { return form.querySelector('[data-step="' + name + '"]'); };
  var steps = form.querySelectorAll(".calc-step");
  var bar = form.querySelector(".calc-bar i");
  var label = form.querySelector(".calc-n");
  var other = form.querySelector("[data-other]");
  var path = ["what", "kind"];      // третий шаг зависит от ответа про замер
  var current = 0;
  form.classList.add("js");

  // подсказка в поле размеров — под выбранную мебель
  var EXAMPLES = {
    "Кухня": "например: угловая кухня 3,2 × 2 м, потолок 2,7 м",
    "Шкаф или гардеробная": "например: шкаф 2 × 2,4 м, глубина 60 см",
    "Прихожая, ванная, детская или спальня": "например: прихожая 1,8 м, тумба в ванную 80 см",
    "Стеновые панели": "например: стена 4 × 2,7 м",
    "Мебель для бизнеса": "например: ресепшн 2 м, 10 шкафчиков",
    "Другое": "например: стол 1,6 × 0,8 м"
  };

  function value(name) {
    var el = form.querySelector('[name="' + name + '"]:checked') ||
      form.querySelector('[name="' + name + '"]:not([type="radio"])');  // невыбранный вариант — пусто, а не первый
    return el && el.value ? el.value.trim() : "";
  }

  function show(i) {
    current = i;
    var name = path[i] || (value("kind") === "measure" ? "measure" : "send");
    steps.forEach(function (s) { s.hidden = s.dataset.step !== name; });
    bar.style.width = ((i + 1) / 3) * 100 + "%";
    label.textContent = "Шаг " + (i + 1) + " / 3";
    form.querySelectorAll(".calc-hint").forEach(function (h) { h.hidden = true; });
  }

  function sync() {
    other.hidden = value("what") !== "Другое";
    var size = form.querySelector('[name="size"]');
    size.placeholder = EXAMPLES[value("what")] || EXAMPLES["Другое"];
  }

  form.addEventListener("change", sync);
  form.addEventListener("click", function (e) {
    var t = e.target;
    if (t.matches("[data-next]")) {
      var need = path[current];
      if (need && !value(need)) { steps[current].querySelector(".calc-hint").hidden = false; return; }
      show(Math.min(current + 1, 2));
    }
    if (t.matches("[data-back]")) show(Math.max(current - 1, 0));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var what = value("what") === "Другое" ? "Другое" + (value("other") ? ": " + value("other") : "") : value("what");
    var measure = value("kind") === "measure";
    var lines = measure ? [
      "Здравствуйте! Хочу записаться на замер (с сайта ordazhihaz.kz).",
      "Что нужно: " + (what || "—"),
      value("city") ? "Адрес: " + value("city") : "",
      value("time") ? "Удобное время для замера: " + value("time") : "",
      value("when") ? "Когда нужна мебель: " + value("when") : ""
    ] : [
      form.dataset.intro,
      "Что нужно: " + (what || "—"),
      value("size") ? "Размеры: " + value("size") : "",
      value("when") ? "Когда нужна мебель: " + value("when") : "",
      value("kind") === "project" ? "Дизайн-проект есть — пришлю в этот чат." : "Размеры есть — пришлю план или фото в этот чат."
    ];
    var url = form.action + "?text=" + encodeURIComponent(lines.filter(Boolean).join("\n"));
    // выбор номера (отдел продаж или руководитель): окно у кнопки отправки
    if (window.ordaWaPick) window.ordaWaPick(url, e.submitter || form.querySelector('button[type="submit"]'));
    else window.open(url, "_blank", "noopener");
  });

  // ссылки из меню (?what=Кухня) сразу выбирают нужный вариант в первом вопросе
  try {
    var want = new URLSearchParams(location.search).get("what");
    if (want) form.querySelectorAll('[name="what"]').forEach(function (r) { if (r.value === want) r.checked = true; });
  } catch (e) {}

  sync();
  show(0);
})();
