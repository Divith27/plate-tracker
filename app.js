(function () {
  "use strict";

  // ---------------- Constants ----------------
  var STORAGE_LOGS = "plate_logs_v1";
  var STORAGE_SETTINGS = "plate_settings_v1";
  var DEFAULT_SETTINGS = { kcalBudget: 2250, proteinTarget: 155, carbsTarget: null, fatTarget: null };

  var todayKey = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  var fmtDate = function (key) {
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  };

  var fmtDateShort = function (key) {
    var parts = key.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  };

  // ---------------- State ----------------
  var state = {
    settings: loadSettings(),
    logs: loadLogs(),
    curatedFoods: [],
    pendingFood: null, // {name, kcal, protein, carbs, fat, servingLabel}
    pendingQty: 1
  };

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
  }

  function loadLogs() {
    try {
      var raw = localStorage.getItem(STORAGE_LOGS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveLogs() {
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(state.logs));
  }

  function todaysEntries() {
    var key = todayKey();
    if (!state.logs[key]) state.logs[key] = [];
    return state.logs[key];
  }

  // ---------------- DOM refs ----------------
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    tabs: document.querySelectorAll(".tab"),
    views: document.querySelectorAll(".view"),
    todayDate: $("today-date"),
    kcalRemaining: $("kcal-remaining"),
    kcalEaten: $("kcal-eaten"),
    kcalBudget: $("kcal-budget"),
    trackFill: $("kcal-track-fill"),
    proteinNum: $("protein-num"),
    proteinTarget: $("protein-target"),
    carbsNum: $("carbs-num"),
    fatNum: $("fat-num"),
    loglist: $("loglist"),
    loglistEmpty: $("loglist-empty"),
    btnAddFood: $("btn-add-food"),
    btnResetDay: $("btn-reset-day"),
    histlist: $("histlist"),

    inputKcalBudget: $("input-kcal-budget"),
    inputProteinTarget: $("input-protein-target"),
    inputCarbsTarget: $("input-carbs-target"),
    inputFatTarget: $("input-fat-target"),
    btnSaveSettings: $("btn-save-settings"),
    settingsSaved: $("settings-saved"),
    btnExportData: $("btn-export-data"),
    btnClearData: $("btn-clear-data"),

    scrim: $("scrim"),
    sheetAdd: $("sheet-add"),
    btnCloseSheet: $("btn-close-sheet"),
    foodSearch: $("food-search"),
    searchHint: $("search-hint"),
    resultslist: $("resultslist"),

    sheetQty: $("sheet-qty"),
    btnCloseQty: $("btn-close-qty"),
    qtyFoodName: $("qty-food-name"),
    qtyServingLabel: $("qty-serving-label"),
    qtyMinus: $("qty-minus"),
    qtyPlus: $("qty-plus"),
    qtyVal: $("qty-val"),
    qtyPreview: $("qty-preview"),
    btnConfirmAdd: $("btn-confirm-add")
  };

  // ---------------- View switching ----------------
  els.tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var view = tab.getAttribute("data-view");
      els.tabs.forEach(function (t) { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      els.views.forEach(function (v) { v.classList.remove("is-active"); });
      $("view-" + view).classList.add("is-active");
      if (view === "history") renderHistory();
      if (view === "settings") fillSettingsForm();
    });
  });

  // ---------------- Dashboard render ----------------
  function renderDashboard() {
    els.todayDate.textContent = fmtDate(todayKey());
    var entries = todaysEntries();
    var totals = entries.reduce(function (acc, e) {
      acc.kcal += e.kcal; acc.protein += e.protein; acc.carbs += e.carbs; acc.fat += e.fat;
      return acc;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    var budget = state.settings.kcalBudget;
    var remaining = Math.round(budget - totals.kcal);

    els.kcalRemaining.textContent = remaining;
    els.kcalEaten.textContent = Math.round(totals.kcal);
    els.kcalBudget.textContent = budget;
    els.proteinNum.textContent = Math.round(totals.protein);
    els.proteinTarget.textContent = state.settings.proteinTarget;
    els.carbsNum.textContent = Math.round(totals.carbs);
    els.fatNum.textContent = Math.round(totals.fat);

    var pct = Math.max(0, Math.min(100, (totals.kcal / budget) * 100));
    els.trackFill.style.width = pct + "%";

    els.loglist.querySelectorAll(".logitem").forEach(function (n) { n.remove(); });
    if (entries.length === 0) {
      els.loglistEmpty.style.display = "block";
    } else {
      els.loglistEmpty.style.display = "none";
      entries.slice().reverse().forEach(function (entry) {
        var li = document.createElement("li");
        li.className = "logitem";
        li.innerHTML =
          '<div class="logitem__main">' +
            '<span class="logitem__name">' + escapeHtml(entry.name) + '</span>' +
            '<span class="logitem__meta">' + escapeHtml(entry.servingLabel) + '</span>' +
          '</div>' +
          '<div class="logitem__right">' +
            '<span class="logitem__kcal">' + Math.round(entry.kcal) + ' kcal</span>' +
            '<button class="logitem__del" data-id="' + entry.id + '" aria-label="Remove">&times;</button>' +
          '</div>';
        els.loglist.appendChild(li);
      });
    }
  }

  els.loglist.addEventListener("click", function (e) {
    var btn = e.target.closest(".logitem__del");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var key = todayKey();
    state.logs[key] = (state.logs[key] || []).filter(function (e2) { return e2.id !== id; });
    saveLogs();
    renderDashboard();
  });

  els.btnResetDay.addEventListener("click", function () {
    if (!confirm("Clear all of today's log entries?")) return;
    state.logs[todayKey()] = [];
    saveLogs();
    renderDashboard();
  });

  // ---------------- History ----------------
  function renderHistory() {
    var keys = Object.keys(state.logs).filter(function (k) { return (state.logs[k] || []).length > 0; }).sort().reverse();
    els.histlist.querySelectorAll(".histitem").forEach(function (n) { n.remove(); });
    var emptyEl = els.histlist.querySelector(".empty");
    if (keys.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    keys.forEach(function (key) {
      var entries = state.logs[key];
      var totals = entries.reduce(function (acc, e) { acc.kcal += e.kcal; acc.protein += e.protein; return acc; }, { kcal: 0, protein: 0 });
      var li = document.createElement("li");
      li.className = "histitem";
      li.innerHTML =
        '<div>' +
          '<div class="histitem__date">' + fmtDateShort(key) + '</div>' +
          '<div class="histitem__sub">' + entries.length + ' item' + (entries.length === 1 ? "" : "s") + ' · ' + Math.round(totals.protein) + 'g protein</div>' +
        '</div>' +
        '<div class="histitem__kcal">' + Math.round(totals.kcal) + '</div>';
      els.histlist.appendChild(li);
    });
  }

  // ---------------- Settings ----------------
  function fillSettingsForm() {
    els.inputKcalBudget.value = state.settings.kcalBudget;
    els.inputProteinTarget.value = state.settings.proteinTarget;
    els.inputCarbsTarget.value = state.settings.carbsTarget || "";
    els.inputFatTarget.value = state.settings.fatTarget || "";
  }

  els.btnSaveSettings.addEventListener("click", function () {
    state.settings.kcalBudget = parseInt(els.inputKcalBudget.value, 10) || DEFAULT_SETTINGS.kcalBudget;
    state.settings.proteinTarget = parseInt(els.inputProteinTarget.value, 10) || DEFAULT_SETTINGS.proteinTarget;
    state.settings.carbsTarget = els.inputCarbsTarget.value ? parseInt(els.inputCarbsTarget.value, 10) : null;
    state.settings.fatTarget = els.inputFatTarget.value ? parseInt(els.inputFatTarget.value, 10) : null;
    saveSettings();
    renderDashboard();
    els.settingsSaved.classList.add("is-visible");
    setTimeout(function () { els.settingsSaved.classList.remove("is-visible"); }, 1500);
  });

  els.btnExportData.addEventListener("click", function () {
    var data = { settings: state.settings, logs: state.logs };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "plate-export-" + todayKey() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });

  els.btnClearData.addEventListener("click", function () {
    if (!confirm("This erases every logged day and your settings, permanently. Continue?")) return;
    localStorage.removeItem(STORAGE_LOGS);
    localStorage.removeItem(STORAGE_SETTINGS);
    state.logs = {};
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    renderDashboard();
    renderHistory();
    fillSettingsForm();
  });

  // ---------------- Add-food sheet ----------------
  function openSheet(sheetEl) {
    els.scrim.classList.add("is-open");
    sheetEl.classList.add("is-open");
    sheetEl.setAttribute("aria-hidden", "false");
  }
  function closeSheet(sheetEl) {
    sheetEl.classList.remove("is-open");
    sheetEl.setAttribute("aria-hidden", "true");
    if (!els.sheetAdd.classList.contains("is-open") && !els.sheetQty.classList.contains("is-open")) {
      els.scrim.classList.remove("is-open");
    }
  }

  els.btnAddFood.addEventListener("click", function () {
    els.foodSearch.value = "";
    renderResults([]);
    els.searchHint.textContent = "Showing home food. Keep typing to search everything online.";
    renderCuratedDefault();
    openSheet(els.sheetAdd);
    setTimeout(function () { els.foodSearch.focus(); }, 200);
  });
  els.btnCloseSheet.addEventListener("click", function () { closeSheet(els.sheetAdd); });
  els.btnCloseQty.addEventListener("click", function () { closeSheet(els.sheetQty); });
  els.scrim.addEventListener("click", function () {
    closeSheet(els.sheetAdd);
    closeSheet(els.sheetQty);
  });

  function renderCuratedDefault() {
    var list = state.curatedFoods.slice(0, 12);
    renderResults(list.map(function (f) { return Object.assign({ source: "home" }, f); }));
  }

  function renderResults(items) {
    els.resultslist.innerHTML = "";
    if (items.length === 0) {
      var li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matches. Try a different word.";
      els.resultslist.appendChild(li);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "resultitem";
      li.innerHTML =
        '<div>' +
          '<div class="resultitem__name">' + escapeHtml(item.name) +
            '<span class="resultitem__tag">' + (item.source === "home" ? "Home" : "OFF") + '</span>' +
          '</div>' +
          '<div class="resultitem__meta">' + escapeHtml(item.serving) + ' · ' + Math.round(item.protein) + 'g protein</div>' +
        '</div>' +
        '<div class="resultitem__kcal">' + Math.round(item.kcal) + '</div>';
      li.addEventListener("click", function () { openQtyForFood(item); });
      els.resultslist.appendChild(li);
    });
  }

  var searchDebounce = null;
  els.foodSearch.addEventListener("input", function () {
    var q = els.foodSearch.value.trim().toLowerCase();
    if (q.length === 0) { renderCuratedDefault(); return; }

    var curatedMatches = state.curatedFoods
      .filter(function (f) { return f.name.toLowerCase().indexOf(q) !== -1; })
      .map(function (f) { return Object.assign({ source: "home" }, f); });

    renderResults(curatedMatches);

    if (searchDebounce) clearTimeout(searchDebounce);
    if (q.length < 3) return;
    searchDebounce = setTimeout(function () {
      searchOpenFoodFacts(q).then(function (offItems) {
        var currentQ = els.foodSearch.value.trim().toLowerCase();
        if (currentQ !== q) return; // stale response
        renderResults(curatedMatches.concat(offItems));
      }).catch(function () {
        els.searchHint.textContent = "Couldn't reach the online database, showing home food only.";
      });
    }, 450);
  });

  function searchOpenFoodFacts(query) {
    var url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(query) +
      "&search_simple=1&action=process&json=1&page_size=8";
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.products) return [];
      return data.products.map(function (p) {
        var n = p.nutriments || {};
        var kcal = n["energy-kcal_serving"] || n["energy-kcal_100g"] || 0;
        var protein = n["proteins_serving"] || n["proteins_100g"] || 0;
        var carbs = n["carbohydrates_serving"] || n["carbohydrates_100g"] || 0;
        var fat = n["fat_serving"] || n["fat_100g"] || 0;
        var servingLabel = p.serving_size ? p.serving_size : "100g";
        return {
          name: p.product_name || p.generic_name || "Unnamed product",
          serving: servingLabel,
          kcal: kcal, protein: protein, carbs: carbs, fat: fat,
          source: "off"
        };
      }).filter(function (item) { return item.kcal > 0 && item.name !== "Unnamed product"; });
    });
  }

  // ---------------- Quantity sheet ----------------
  function openQtyForFood(food) {
    state.pendingFood = food;
    state.pendingQty = 1;
    els.qtyFoodName.textContent = food.name;
    els.qtyServingLabel.textContent = "1 serving = " + food.serving;
    els.qtyVal.textContent = "1";
    updateQtyPreview();
    openSheet(els.sheetQty);
  }

  function updateQtyPreview() {
    var f = state.pendingFood, q = state.pendingQty;
    els.qtyPreview.textContent = Math.round(f.kcal * q) + " kcal · " + Math.round(f.protein * q) + "g protein";
  }

  els.qtyMinus.addEventListener("click", function () {
    state.pendingQty = Math.max(0.5, state.pendingQty - 0.5);
    els.qtyVal.textContent = state.pendingQty;
    updateQtyPreview();
  });
  els.qtyPlus.addEventListener("click", function () {
    state.pendingQty = state.pendingQty + 0.5;
    els.qtyVal.textContent = state.pendingQty;
    updateQtyPreview();
  });

  els.btnConfirmAdd.addEventListener("click", function () {
    var f = state.pendingFood, q = state.pendingQty;
    var entry = {
      id: Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      name: f.name,
      servingLabel: q + " × " + f.serving,
      kcal: f.kcal * q,
      protein: f.protein * q,
      carbs: f.carbs * q,
      fat: f.fat * q,
      time: new Date().toISOString()
    };
    todaysEntries().push(entry);
    saveLogs();
    renderDashboard();
    closeSheet(els.sheetQty);
    closeSheet(els.sheetAdd);
  });

  // ---------------- Utils ----------------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- Boot ----------------
  fetch("foods.json").then(function (r) { return r.json(); }).then(function (data) {
    state.curatedFoods = data.foods.map(function (f) {
      return { id: f.id, name: f.name, serving: f.serving, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat };
    });
  }).catch(function () {
    state.curatedFoods = [];
  }).finally(function () {
    renderDashboard();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  renderDashboard();
})();
