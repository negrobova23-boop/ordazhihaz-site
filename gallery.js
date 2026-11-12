// Галерея работ: фильтр по категориям и просмотр фото на весь экран. Ничего не сохраняем и никуда не отправляем.
(function () {
  document.documentElement.classList.add("js");

  document.querySelectorAll(".filters").forEach(function (bar) {
    var grid = document.getElementById(bar.dataset.for);
    if (!grid) return;
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      bar.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      var cat = btn.dataset.cat;
      var n = 0;
      grid.querySelectorAll("a").forEach(function (a) {
        var wasHidden = a.hidden;
        a.hidden = cat !== "all" && a.dataset.cat !== cat;
        if (wasHidden && !a.hidden) {
          a.style.setProperty("--d", Math.min(n++, 8) * 0.025 + "s");
          a.classList.remove("pop");
          void a.offsetWidth;
          a.classList.add("pop");
          a.addEventListener("animationend", function () { a.classList.remove("pop"); }, { once: true });
        }
      });
    });
  });

  var grids = document.querySelectorAll(".works-grid");
  if (!grids.length) return;

  var box = document.createElement("div");
  box.className = "lb";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Просмотр фото");
  box.innerHTML = '<button type="button" class="x" aria-label="Закрыть">×</button>' +
    '<button type="button" class="prev" aria-label="Назад">‹</button>' +
    '<img alt="">' +
    '<button type="button" class="next" aria-label="Вперёд">›</button>' +
    '<div class="lb-count"></div>';
  document.body.appendChild(box);
  var img = box.querySelector("img");
  var count = box.querySelector(".lb-count");
  var list = [];
  var cur = 0;

  function show(i) {
    cur = (i + list.length) % list.length;
    var a = list[cur];
    img.src = a.href;
    img.alt = a.querySelector("img").alt;
    count.textContent = (cur + 1) + " / " + list.length;
  }
  function close() {
    box.classList.remove("on");
    setTimeout(function () { if (!box.classList.contains("on")) img.removeAttribute("src"); }, 200);
  }

  grids.forEach(function (grid) {
    grid.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      list = Array.prototype.filter.call(grid.querySelectorAll("a"), function (x) { return !x.hidden; });
      box.classList.add("on");
      show(list.indexOf(a));
    });
  });
  box.addEventListener("click", function (e) {
    if (e.target.closest(".x") || e.target === box) close();
    else if (e.target.closest(".prev")) show(cur - 1);
    else if (e.target.closest(".next")) show(cur + 1);
  });
  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("on")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  });
})();
