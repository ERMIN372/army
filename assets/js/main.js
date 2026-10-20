(function () {
  "use strict";

  var D = window.SITE_DATA || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var rub = function (n) {
    return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";
  };
  var short = function (n) {
    if (n >= 1e6) return (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " млн ₽";
    if (n >= 1e3) return Math.round(n / 1e3).toLocaleString("ru-RU") + " тыс ₽";
    return rub(n);
  };
  var VERIFY = ' <span class="verify" title="Значение из открытых источников — сверьте перед подписанием">сверить</span>';

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }
  };

  /* ---------- Тема ---------- */
  var root = document.documentElement;
  var saved = store.get("theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  $$("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      store.set("theme", next);
    });
  });

  /* ---------- Мобильное меню ---------- */
  var burger = $(".burger");
  var nav = $(".nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---------- Подстановка данных ---------- */
  var pick = function (path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, D);
  };
  $$("[data-bind]").forEach(function (el) {
    var v = pick(el.getAttribute("data-bind"));
    if (v == null) return;
    var fmt = el.getAttribute("data-fmt");
    el.textContent = fmt === "rub" ? rub(v) : fmt === "short" ? short(v) : v;
  });
  $$("[data-bind-href]").forEach(function (el) {
    var v = pick(el.getAttribute("data-bind-href"));
    if (v) el.setAttribute("href", v);
  });
  $$("[data-updated]").forEach(function (el) {
    var d = new Date(D.updated);
    if (!isNaN(d)) el.textContent = d.toLocaleDateString("ru-RU");
  });

  /* ---------- Калькулятор ---------- */
  var calc = $("#calc");
  if (calc) {
    var sel = $("#calc-region", calc);
    var custom = $("#calc-custom", calc);
    var customWrap = $("#calc-custom-wrap", calc);
    var monthly = $("#calc-monthly", calc);
    var months = $("#calc-months", calc);
    var monthsOut = $("#calc-months-out", calc);

    (D.regions || []).forEach(function (r, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = r.name + " — " + short(r.amount);
      sel.appendChild(o);
    });
    var oc = document.createElement("option");
    oc.value = "custom";
    oc.textContent = "Мой регион — введу сумму сам";
    sel.appendChild(oc);

    monthly.value = (D.monthly && D.monthly.from) || 0;

    var render = function () {
      var isCustom = sel.value === "custom";
      customWrap.hidden = !isCustom;
      var reg = isCustom ? Math.max(0, +custom.value || 0) : ((D.regions[+sel.value] || {}).amount || 0);
      var fed = (D.federal && D.federal.amount) || 0;
      var m = Math.max(0, +months.value || 0);
      var pay = Math.max(0, +monthly.value || 0) * m;
      var total = fed + reg + pay;

      monthsOut.textContent = m + " мес.";
      $("#out-total").textContent = rub(total);
      $("#out-fed").textContent = rub(fed);
      $("#out-reg").textContent = rub(reg);
      $("#out-pay").textContent = rub(pay);
      $("#out-pay-cap").textContent = "Денежное довольствие × " + m + " мес.";
      var pct = function (v) { return total ? (v / total * 100).toFixed(2) + "%" : "0"; };
      $("#bar-fed").style.width = pct(fed);
      $("#bar-reg").style.width = pct(reg);
      $("#bar-pay").style.width = pct(pay);
    };
    [sel, custom, monthly, months].forEach(function (el) {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });
    render();
  }

  /* ---------- Таблица регионов ---------- */
  var regTable = $("#regions-table");
  if (regTable) {
    var tbody = $("tbody", regTable);
    var q = $("#regions-q");
    var countEl = $("#regions-count");
    var sortKey = "amount";
    var sortDir = -1;
    var fed = (D.federal && D.federal.amount) || 0;

    var draw = function () {
      var term = (q.value || "").trim().toLowerCase();
      var rows = (D.regions || []).filter(function (r) {
        return !term || (r.name + " " + r.district).toLowerCase().indexOf(term) !== -1;
      }).sort(function (a, b) {
        var x = a[sortKey], y = b[sortKey];
        return (typeof x === "string" ? x.localeCompare(y, "ru") : x - y) * sortDir;
      });
      tbody.innerHTML = rows.map(function (r) {
        return "<tr><td>" + r.name + "</td><td>" + r.district + "</td>" +
          '<td class="num">' + rub(r.amount) + (r.check ? VERIFY : "") + "</td>" +
          '<td class="num">' + rub(r.amount + fed) + "</td>" +
          '<td class="muted">' + (r.extra || "—") + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="muted">Регион не найден в справочнике. Уточните сумму в пункте отбора или напишите нам.</td></tr>';
      countEl.textContent = "Показано: " + rows.length + " из " + D.regions.length;
    };
    q.addEventListener("input", draw);
    $$("th button[data-sort]", regTable).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-sort");
        sortDir = sortKey === k ? -sortDir : (k === "name" || k === "district" ? 1 : -1);
        sortKey = k;
        draw();
      });
    });
    draw();
  }

  /* ---------- Компенсации ---------- */
  var comp = $("#compensations");
  if (comp) {
    comp.innerHTML = (D.compensations || []).map(function (c) {
      return "<tr><td>" + c.title + '</td><td class="num">' + c.value + (c.check ? VERIFY : "") +
        '</td><td class="muted">' + c.basis + "</td></tr>";
    }).join("");
  }

  /* ---------- Вакансии ---------- */
  var vacGrid = $("#vacancies");
  if (vacGrid) {
    var limit = +vacGrid.getAttribute("data-limit") || 0;
    var catNames = { combat: "Боевые", tech: "Технические", support: "Обеспечение" };
    var drawVac = function (cat) {
      var list = (D.vacancies || []).filter(function (v) { return !cat || cat === "all" || v.cat === cat; });
      if (limit) list = list.slice(0, limit);
      vacGrid.innerHTML = list.map(function (v, i) {
        return '<article class="cell"><span class="idx">' + String(i + 1).padStart(2, "0") + " / " + catNames[v.cat] + "</span>" +
          "<h3>" + v.title + "</h3><p>" + v.text + '</p><div class="meta">' +
          v.tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</div></article>";
      }).join("");
    };
    $$("[data-vac-filter]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$("[data-vac-filter]").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        drawVac(chip.getAttribute("data-vac-filter"));
      });
    });
    drawVac("all");
  }

  /* ---------- Чек-лист документов ---------- */
  var docs = $("#docs");
  if (docs) {
    var KEY = "docs-checked";
    var checked = {};
    try { checked = JSON.parse(store.get(KEY) || "{}") || {}; } catch (e) { checked = {}; }
    docs.innerHTML = (D.documents || []).map(function (d) {
      return '<li><label><input type="checkbox" data-doc="' + d.id + '"' + (checked[d.id] ? " checked" : "") + ">" +
        "<div><strong>" + d.title + "</strong><small>" + d.note + "</small></div>" +
        (d.must ? '<span class="tag tag--accent">обязательно</span>' : '<span class="tag">по ситуации</span>') +
        "</label></li>";
    }).join("");
    var upd = function () {
      var boxes = $$("input[data-doc]", docs);
      var n = boxes.filter(function (b) { return b.checked; }).length;
      $("#docs-progress-text").textContent = n + " / " + boxes.length;
      $("#docs-progress-bar").style.width = (boxes.length ? n / boxes.length * 100 : 0) + "%";
    };
    docs.addEventListener("change", function (e) {
      var id = e.target.getAttribute("data-doc");
      if (!id) return;
      checked[id] = e.target.checked;
      store.set(KEY, JSON.stringify(checked));
      upd();
    });
    var reset = $("#docs-reset");
    if (reset) reset.addEventListener("click", function () {
      checked = {};
      store.set(KEY, "{}");
      $$("input[data-doc]", docs).forEach(function (b) { b.checked = false; });
      upd();
    });
    upd();
  }

  /* ---------- Поиск по FAQ ---------- */
  var faqQ = $("#faq-q");
  if (faqQ) {
    var items = $$(".faq details");
    var empty = $("#faq-empty");
    faqQ.addEventListener("input", function () {
      var t = faqQ.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (d) {
        var hit = !t || d.textContent.toLowerCase().indexOf(t) !== -1;
        d.hidden = !hit;
        if (hit) shown++;
        if (t && hit) d.open = true;
      });
      $$(".faq-cat").forEach(function (c) {
        var any = $$("details", c.nextElementSibling).some(function (d) { return !d.hidden; });
        c.hidden = !any;
        c.nextElementSibling.hidden = !any;
      });
      empty.hidden = shown !== 0;
    });
  }

  /* ---------- Форма заявки ---------- */
  $$("form[data-lead]").forEach(function (form) {
    var status = $(".form-status", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$("[required]", form).forEach(function (f) {
        var bad = f.type === "checkbox" ? !f.checked : !f.value.trim();
        if (f.type === "tel" && !bad) bad = f.value.replace(/\D/g, "").length < 10;
        f.classList.toggle("field-error", bad);
        if (bad) ok = false;
      });
      if (!ok) {
        status.className = "form-status err";
        status.textContent = "Заполните отмеченные поля и подтвердите согласие.";
        return;
      }
      var endpoint = form.getAttribute("action");
      var done = function () {
        status.className = "form-status ok";
        status.textContent = "Заявка принята. Мы перезвоним в рабочее время.";
        form.reset();
      };
      if (!endpoint || endpoint === "#") {
        // Обработчик не подключён — см. README, раздел «Форма заявки»
        done();
        return;
      }
      fetch(endpoint, { method: "POST", body: new FormData(form) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () {
          status.className = "form-status err";
          status.textContent = "Не удалось отправить. Позвоните нам или напишите в Telegram.";
        });
    });
  });

  /* ---------- Маска телефона (мягкая) ---------- */
  $$('input[type="tel"]').forEach(function (inp) {
    inp.addEventListener("input", function () {
      var d = inp.value.replace(/\D/g, "");
      if (d[0] === "8") d = "7" + d.slice(1);
      if (d && d[0] !== "7") d = "7" + d;
      d = d.slice(0, 11);
      var out = d ? "+7" : "";
      if (d.length > 1) out += " (" + d.slice(1, 4);
      if (d.length >= 4) out += ")";
      if (d.length > 4) out += " " + d.slice(4, 7);
      if (d.length > 7) out += "-" + d.slice(7, 9);
      if (d.length > 9) out += "-" + d.slice(9, 11);
      inp.value = out;
    });
  });

  var y = $("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
