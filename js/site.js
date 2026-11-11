// Оживление сайта: слайдер фото на главной, появление блоков при прокрутке, счётчик цифр, тень шапки.
// Ничего не отправляется никуда. Если у посетителя включено «уменьшить анимацию», движение отключается.
(function () {
  var d = document;
  d.documentElement.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // тень под шапкой при прокрутке
  var top = d.querySelector(".top");
  function onScroll() { if (top) top.classList.toggle("scrolled", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // логотип на фоне: при открытии «наезжает» издалека, при прокрутке приближается и поворачивается,
  // на компьютере слегка наклоняется вслед за курсором
  var bg = d.createElement("div");
  bg.className = "bg-logo";
  bg.setAttribute("aria-hidden", "true");
  bg.appendChild(d.createElement("i"));
  d.body.appendChild(bg);
  if (!reduce) {
    var mx = 0, my = 0, ticking = false;
    var paint = function () {
      ticking = false;
      var max = Math.max(1, d.documentElement.scrollHeight - window.innerHeight);
      var p = Math.min(1, window.scrollY / max);
      bg.style.setProperty("--s", (1 + p * 0.45).toFixed(3));
      bg.style.setProperty("--r", (p * 14).toFixed(2) + "deg");
      bg.style.setProperty("--ry", (mx * 12).toFixed(2) + "deg");
      bg.style.setProperty("--rx", (-my * 9).toFixed(2) + "deg");
    };
    var ask = function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    if (window.matchMedia("(pointer: fine)").matches) {
      window.addEventListener("mousemove", function (e) {
        mx = e.clientX / window.innerWidth - 0.5;
        my = e.clientY / window.innerHeight - 0.5;
        ask();
      }, { passive: true });
    }
    paint();
  }

  // слайдер фото на главной
  var hero = d.querySelector(".hero-media");
  if (hero) {
    var slides = hero.querySelectorAll(".slide");
    var dots = hero.querySelectorAll(".hero-dots button");
    var cur = 0, timer = null;
    var show = function (n) {
      slides[cur].classList.remove("on");
      if (dots[cur]) dots[cur].removeAttribute("aria-current");
      cur = (n + slides.length) % slides.length;
      slides[cur].classList.add("on");
      if (dots[cur]) dots[cur].setAttribute("aria-current", "true");
    };
    var start = function () {
      if (reduce || slides.length < 2) return;
      clearInterval(timer);
      timer = setInterval(function () { if (!d.hidden) show(cur + 1); }, 6500);
    };
    dots.forEach(function (b, k) {
      b.addEventListener("click", function () { show(k); start(); });
    });
    start();
  }

  // появление блоков при прокрутке
  var targets = d.querySelectorAll(
    "main > section:not(.hero2), main .facts li, main .price, main .card, main .seg, main .loc, main .equip figure, main .kinds div, main .works-grid a, main .cert, main .faq details"
  );
  var groups = new Map();
  targets.forEach(function (el) {
    el.classList.add("reveal");
    var p = el.parentElement;
    var n = groups.get(p) || 0;
    groups.set(p, n + 1);
    if (el.matches(".facts li, .price, .card, .works-grid a, .equip figure, .kinds div")) el.style.setProperty("--d", (n % 4) * 0.08 + "s");
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add("in"); });
  }

  // счётчик цифр
  var counters = d.querySelectorAll("[data-count]");
  var fmt = new Intl.NumberFormat("ru-RU");
  function run(el) {
    var end = +el.dataset.count;
    if (reduce) { el.textContent = fmt.format(end); return; }
    var t0 = null, dur = 1400;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt.format(Math.round(end * e));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { run(e.target); co.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { el.textContent = "0"; co.observe(el); });
  }
})();
