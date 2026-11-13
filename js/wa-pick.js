// Выбор, куда писать в WhatsApp: у любой кнопки WhatsApp открывается небольшое окно с двумя номерами.
// Текст заявки (из калькулятора и конструктора) сохраняется. Ничего не отправляется на сервер.
(function () {
  var NUMS = [
    { n: "77769994032", label: "Отдел продаж", show: "+7 776 999 40 32" },
    { n: "77761121288", label: "Руководитель", show: "+7 776 112 12 88" }
  ];
  var pop = null, startY = 0;

  function close() {
    if (pop) { pop.remove(); pop = null; }
    window.removeEventListener("scroll", onScroll);
  }
  function onScroll() { if (pop && Math.abs(window.scrollY - startY) > 60) close(); }
  function textOf(url) {
    try { return new URL(url, location.href).searchParams.get("text") || ""; } catch (e) { return ""; }
  }
  // если у кнопки нет своего сообщения — подставляем готовое, с названием страницы, откуда пишет клиент
  function defaultText() {
    var h = document.querySelector("h1");
    var page = h ? h.textContent.trim() : document.title.split(" — ")[0];
    return "Здравствуйте! Хочу получить расчёт стоимости (с сайта ordazhihaz.kz, страница «" + page + "»).\nФото или размеры пришлю в этот чат.";
  }
  function withText(url) {
    if (textOf(url)) return url;
    return url.split("?")[0] + "?text=" + encodeURIComponent(defaultText());
  }

  function open(anchor, url) {
    close();
    var text = textOf(withText(url));
    pop = document.createElement("div");
    pop.className = "wa-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Куда написать в WhatsApp");
    pop.innerHTML = '<p class="wa-pop-t">Куда написать?</p>' + NUMS.map(function (x) {
      return '<a href="https://wa.me/' + x.n + (text ? "?text=" + encodeURIComponent(text) : "") +
        '" target="_blank" rel="noopener nofollow"><div><b>' + x.label + "</b><span>" + x.show + "</span></div></a>";
    }).join("");
    document.body.appendChild(pop);

    var r = anchor.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var left = r.left;
    if (left + w > vw - 8) left = r.right - w;
    left = Math.max(8, Math.min(left, vw - w - 8));
    var top = r.bottom + 8;
    if (r.bottom + h + 16 > window.innerHeight && r.top > h + 16) top = r.top - h - 8;
    pop.style.left = left + window.scrollX + "px";
    pop.style.top = top + window.scrollY + "px";
    startY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
    if (a) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // кнопки, где номер уже назван явно, открываются сразу — но тоже с готовым сообщением
      if (a.closest(".wa-pop, .wa-md-in, .cta-btns") || /^WhatsApp:\s/.test(a.textContent.trim())) {
        if (!a.closest(".wa-pop")) a.href = withText(a.href);
        return;
      }
      e.preventDefault();
      open(a, a.href);
      return;
    }
    if (pop && !e.target.closest(".wa-pop")) close();
  }, true);

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  window.ordaWaPick = function (url, anchor) { open(anchor || document.body, url); };
})();
