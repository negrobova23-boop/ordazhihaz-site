// Расчёт за 1 минуту: три шага → готовое сообщение в WhatsApp. Ничего не сохраняем и никуда больше не отправляем.
(function () {
  var form = document.getElementById("calc");
  if (!form) return;
  var steps = form.querySelectorAll(".calc-step");
  var bar = form.querySelector(".calc-bar i");
  var label = form.querySelector(".calc-n");
  var current = 0;
  form.classList.add("js");

  function show(i) {
    current = i;
    steps.forEach(function (s, n) { s.hidden = n !== i; });
    bar.style.width = ((i + 1) / steps.length) * 100 + "%";
    label.textContent = "Шаг " + (i + 1) + " / " + steps.length;
  }

  function value(name) {
    var el = form.querySelector('[name="' + name + '"]:checked') ||
      form.querySelector('[name="' + name + '"]:not([type="radio"])');  // невыбранный вариант — пусто, а не первый
    return el && el.value ? el.value.trim() : "";
  }

  form.addEventListener("click", function (e) {
    var t = e.target;
    if (t.matches("[data-next]")) {
      if (current === 0 && !value("what")) { form.querySelector(".calc-hint").hidden = false; return; }
      show(Math.min(current + 1, steps.length - 1));
    }
    if (t.matches("[data-back]")) show(Math.max(current - 1, 0));
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var lines = [
      form.dataset.intro,
      "Что нужно: " + (value("what") || "—"),
      value("size") ? "Размеры: " + value("size") : "",
      value("kind") ? "Проект: " + value("kind") : "",
      value("city") ? "Район или ЖК: " + value("city") : "",
      value("when") ? "Когда нужно: " + value("when") : "",
      "Фото или план пришлю в этот чат."
    ].filter(Boolean);
    var url = form.action + "?text=" + encodeURIComponent(lines.join("\n"));
    // выбор номера (отдел продаж или руководитель): окно у кнопки отправки
    if (window.ordaWaPick) window.ordaWaPick(url, e.submitter || form.querySelector('button[type="submit"]'));
    else window.open(url, "_blank", "noopener");
  });

  // ссылки из меню (?what=Кухня) сразу выбирают нужный вариант в первом вопросе
  try {
    var want = new URLSearchParams(location.search).get("what");
    if (want) form.querySelectorAll('[name="what"]').forEach(function (r) { if (r.value === want) r.checked = true; });
  } catch (e) {}

  show(0);
})();
