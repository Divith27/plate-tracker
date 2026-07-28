(function () {
  "use strict";

  // ---------------- Splash screen ----------------
  (function () {
    var splash = document.getElementById("splash");
    if (!splash) return;
    var removed = false;
    var remove = function () {
      if (removed) return;
      removed = true;
      splash.remove();
    };
    splash.addEventListener("animationend", function (e) {
      if (e.animationName === "splashSlide") remove();
    });
    setTimeout(remove, 2200); // safety net in case animationend doesn't fire
  })();

  // ---------------- Constants ----------------
  var STORAGE_LOGS = "plate_logs_v1";
  var STORAGE_SETTINGS = "plate_settings_v1";
  var STORAGE_CUSTOM = "plate_custom_foods_v1";
  var STORAGE_WORKOUTS = "plate_workouts_v1";
  var STORAGE_PRS = "plate_prs_v1";
  var DEFAULT_SETTINGS = { kcalBudget: 2250, proteinTarget: 155, carbsTarget: null, fatTarget: null, usdaApiKey: "" };

  var STORAGE_WORKOUT_DEFS = "plate_workout_defs_v1";
  var OLD_DEFAULT_EXERCISES_V1 = {
    upper_a: ["Chest Press Machine", "Seated Row Machine", "Lever Shoulder Press", "Lat Pulldown", "Dumbbell Curl", "Rope Push Down"],
    upper_b: ["Peck Deck Fly", "Lever Reverse T-Bar Row", "Dumbbell Lateral Raises", "Cable Straight Arm Pulldown", "Hammer Curl", "Bar Pushdown"],
    lower_a: ["Leg Press", "Seated Leg Curl", "Leg Extension", "Seated Calf Raises"],
    lower_b: ["Dumbbell Squat", "Leg Press (single leg / narrow stance)", "Rear Delt Machine Fly", "Single Leg Calf Raise"]
  };

  var DEFAULT_WORKOUT_DEFS = [
    { id: "upper_a", label: "Upper A", exercises: [
      "Dumbbell Incline Press — Chest", "Seated Row Machine — Back", "Cable Lateral Raise — Shoulders",
      "Neutral Close Grip Lat Pulldown — Back", "Dumbbell Preacher Curl — Biceps", "Rope Push Down — Triceps",
      "Dumbbell Wrist Curl — Forearms", "Trap-Bar Shrug — Upper Traps"
    ] },
    { id: "upper_b", label: "Upper B", exercises: [
      "Peck Deck Fly — Chest", "Lever Reverse T-Bar Row — Back", "Shoulder Press Machine — Shoulders",
      "Neutral Close Grip Lat Pulldown — Lats", "Dumbbell Preacher Curl — Biceps", "Bar Pushdown — Triceps",
      "Dumbbell Wrist Reverse Curl — Forearms", "Trap-Bar Shrug — Upper Traps"
    ] },
    { id: "lower_a", label: "Lower A", exercises: [
      "Leg Press — Quads/Glutes", "Seated Leg Curl — Hamstrings", "Leg Extension — Quads",
      "Standing Calf Raises — Calves", "Weight-Plate Crunch — Abs", "Full Crunch Machine — Abs"
    ] },
    { id: "lower_b", label: "Lower B", exercises: [
      "Leg Press — Quads/Glutes", "Seated Leg Curl — Hamstrings", "Leg Extension — Quads",
      "Standing Calf Raises — Calves", "Full Crunch Machine — Abs", "Deadlift — Lower Back"
    ] },
    { id: "ab", label: "Ab & Core", exercises: ["Leg Raise", "Full Crunch Machine", "Decline Sit-Up", "Bench Side Bend"] },
    { id: "cardio", label: "Cardio", exercises: ["20-30 min cardio (treadmill / cycle / incline walk)"] }
  ];

  function loadWorkoutDefs() {
    try {
      var raw = localStorage.getItem(STORAGE_WORKOUT_DEFS);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_WORKOUT_DEFS));
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : JSON.parse(JSON.stringify(DEFAULT_WORKOUT_DEFS));
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_WORKOUT_DEFS)); }
  }
  function saveWorkoutDefs() {
    localStorage.setItem(STORAGE_WORKOUT_DEFS, JSON.stringify(state.workoutDefs));
  }
  function migrateWorkoutDefsToV2() {
    var STORAGE_DEFS_VERSION = "plate_workout_defs_version_v1";
    var currentVersion = parseInt(localStorage.getItem(STORAGE_DEFS_VERSION) || "1", 10);
    if (currentVersion >= 2) return;
    var newDefaultsById = {};
    DEFAULT_WORKOUT_DEFS.forEach(function (d) { newDefaultsById[d.id] = d.exercises; });
    state.workoutDefs.forEach(function (def) {
      var oldDefault = OLD_DEFAULT_EXERCISES_V1[def.id];
      if (oldDefault && JSON.stringify(def.exercises) === JSON.stringify(oldDefault)) {
        def.exercises = newDefaultsById[def.id].slice();
      }
    });
    saveWorkoutDefs();
    localStorage.setItem(STORAGE_DEFS_VERSION, "2");
  }
  function getWorkoutDef(id) {
    return state.workoutDefs.find(function (w) { return w.id === id; });
  }
  function getWorkoutLabel(id) {
    var def = getWorkoutDef(id);
    return def ? def.label : id;
  }
  function getWorkoutExercises(id) {
    var def = getWorkoutDef(id);
    return def ? def.exercises : [];
  }

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
    customFoods: loadCustomFoods(),
    workouts: loadWorkouts(),
    workoutDefs: loadWorkoutDefs(),
    prs: loadPRs(),
    categories: [],
    activeCategory: "all",
    pendingFood: null, // {name, kcal, protein, carbs, fat, servingLabel}
    pendingQty: 1
  };
  migrateWorkoutDefsToV2();

  function loadWorkouts() {
    try {
      var raw = localStorage.getItem(STORAGE_WORKOUTS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveWorkouts() {
    localStorage.setItem(STORAGE_WORKOUTS, JSON.stringify(state.workouts));
  }

  function loadPRs() {
    try {
      var raw = localStorage.getItem(STORAGE_PRS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function savePRs() {
    localStorage.setItem(STORAGE_PRS, JSON.stringify(state.prs));
  }

  function loadCustomFoods() {
    try {
      var raw = localStorage.getItem(STORAGE_CUSTOM);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveCustomFoods() {
    localStorage.setItem(STORAGE_CUSTOM, JSON.stringify(state.customFoods));
  }

  var CATEGORY_LABELS = {
    all: "All", custom: "Your foods", staple: "Staples", dal_legume: "Dal & legumes", sabzi: "Sabzi",
    dairy_protein: "Dairy & protein", snack: "Snacks", street_food: "Street food",
    sweet: "Sweets", fruit: "Fruit", nuts_seeds: "Nuts & seeds", beverage: "Beverages",
    condiment: "Condiments", dinner_rotation: "Dinner rotation", restaurant: "Restaurant", protein_brand: "Protein brands",
    movie_snacks: "Movie snacks"
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
    chiprow: $("chiprow"),
    inputUsdaKey: $("input-usda-key"),
    btnAddCustom: $("btn-add-custom"),

    sheetCustom: $("sheet-custom"),
    btnCloseCustom: $("btn-close-custom"),
    customName: $("custom-name"),
    customServing: $("custom-serving"),
    customKcal: $("custom-kcal"),
    customProtein: $("custom-protein"),
    customCarbs: $("custom-carbs"),
    customFat: $("custom-fat"),
    btnSaveCustom: $("btn-save-custom"),

    workoutstatus: $("workoutstatus"),
    workoutstatusEmpty: $("workoutstatus-empty"),
    btnPickWorkout: $("btn-pick-workout"),
    sheetWorkoutPicker: $("sheet-workout-picker"),
    tilegrid: $("tilegrid"),
    btnCloseWorkoutPicker: $("btn-close-workout-picker"),
    sheetWorkoutChecklist: $("sheet-workout-checklist"),
    btnCloseChecklist: $("btn-close-checklist"),
    checklistTitle: $("checklist-title"),
    checklist: $("checklist"),
    btnChangeWorkout: $("btn-change-workout"),
    btnRemoveWorkoutChecklist: $("btn-remove-workout-checklist"),
    prlist: $("prlist"),

    workoutdeflist: $("workoutdeflist"),
    btnAddWorkoutDef: $("btn-add-workout-def"),
    sheetEditWorkout: $("sheet-edit-workout"),
    btnCloseEditWorkout: $("btn-close-edit-workout"),
    editWorkoutTitle: $("edit-workout-title"),
    editWorkoutName: $("edit-workout-name"),
    exerciselist: $("exerciselist"),
    btnAddExerciseRow: $("btn-add-exercise-row"),
    btnSaveWorkoutDef: $("btn-save-workout-def"),
    btnResetWorkoutDef: $("btn-reset-workout-def"),
    btnDeleteWorkoutDef: $("btn-delete-workout-def"),

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
      if (view === "prs") renderPRList();
      if (view === "settings") { fillSettingsForm(); renderWorkoutDefList(); }
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
            '<span class="logitem__meta">' + escapeHtml(entry.servingLabel) + ' · ' + Math.round(entry.protein) + 'g protein</span>' +
          '</div>' +
          '<div class="logitem__right">' +
            '<span class="logitem__kcal">' + Math.round(entry.kcal) + ' kcal</span>' +
            '<button class="logitem__del" data-id="' + entry.id + '" aria-label="Remove">&times;</button>' +
          '</div>';
        els.loglist.appendChild(li);
      });
    }
    renderWorkoutStatus();
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
    var logKeys = Object.keys(state.logs).filter(function (k) { return (state.logs[k] || []).length > 0; });
    var workoutKeys = Object.keys(state.workouts);
    var keys = Array.from(new Set(logKeys.concat(workoutKeys))).sort().reverse();
    els.histlist.querySelectorAll(".histitem").forEach(function (n) { n.remove(); });
    var emptyEl = els.histlist.querySelector(".empty");
    if (keys.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    keys.forEach(function (key) {
      var entries = state.logs[key] || [];
      var totals = entries.reduce(function (acc, e) { acc.kcal += e.kcal; acc.protein += e.protein; return acc; }, { kcal: 0, protein: 0 });
      var workout = state.workouts[key];
      var workoutLine = workout ? (' · ' + escapeHtml(getWorkoutLabel(workout.type)) + ' workout') : "";
      var subParts = [];
      if (entries.length > 0) subParts.push(entries.length + ' item' + (entries.length === 1 ? "" : "s") + ' · ' + Math.round(totals.protein) + 'g protein');
      var li = document.createElement("li");
      li.className = "histitem";
      li.innerHTML =
        '<div>' +
          '<div class="histitem__date">' + fmtDateShort(key) + '</div>' +
          '<div class="histitem__sub">' + (subParts.join("") || "No food logged") + workoutLine + '</div>' +
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
    els.inputUsdaKey.value = state.settings.usdaApiKey || "";
  }

  els.btnSaveSettings.addEventListener("click", function () {
    state.settings.kcalBudget = parseInt(els.inputKcalBudget.value, 10) || DEFAULT_SETTINGS.kcalBudget;
    state.settings.proteinTarget = parseInt(els.inputProteinTarget.value, 10) || DEFAULT_SETTINGS.proteinTarget;
    state.settings.carbsTarget = els.inputCarbsTarget.value ? parseInt(els.inputCarbsTarget.value, 10) : null;
    state.settings.fatTarget = els.inputFatTarget.value ? parseInt(els.inputFatTarget.value, 10) : null;
    state.settings.usdaApiKey = els.inputUsdaKey.value.trim();
    saveSettings();
    renderDashboard();
    els.settingsSaved.classList.add("is-visible");
    setTimeout(function () { els.settingsSaved.classList.remove("is-visible"); }, 1500);
  });

  els.btnExportData.addEventListener("click", function () {
    var data = { settings: state.settings, logs: state.logs, customFoods: state.customFoods, workouts: state.workouts, workoutDefs: state.workoutDefs, prs: state.prs };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "plate-export-" + todayKey() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });

  els.btnClearData.addEventListener("click", function () {
    if (!confirm("This erases every logged day, your custom foods, your workout history and definitions, your PRs, and your settings, permanently. Continue?")) return;
    localStorage.removeItem(STORAGE_LOGS);
    localStorage.removeItem(STORAGE_SETTINGS);
    localStorage.removeItem(STORAGE_CUSTOM);
    localStorage.removeItem(STORAGE_WORKOUTS);
    localStorage.removeItem(STORAGE_WORKOUT_DEFS);
    localStorage.removeItem(STORAGE_PRS);
    state.logs = {};
    state.customFoods = [];
    state.workouts = {};
    state.workoutDefs = JSON.parse(JSON.stringify(DEFAULT_WORKOUT_DEFS));
    state.prs = {};
    state.settings = Object.assign({}, DEFAULT_SETTINGS);
    renderDashboard();
    renderHistory();
    fillSettingsForm();
    renderWorkoutDefList();
    renderPRList();
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
    if (!els.sheetAdd.classList.contains("is-open") && !els.sheetQty.classList.contains("is-open") &&
        !els.sheetCustom.classList.contains("is-open") && !els.sheetWorkoutPicker.classList.contains("is-open") &&
        !els.sheetWorkoutChecklist.classList.contains("is-open") && !els.sheetEditWorkout.classList.contains("is-open")) {
      els.scrim.classList.remove("is-open");
    }
  }

  els.btnAddFood.addEventListener("click", function () {
    els.foodSearch.value = "";
    state.activeCategory = "all";
    renderChips();
    renderCuratedDefault();
    openSheet(els.sheetAdd);
    setTimeout(function () { els.foodSearch.focus(); }, 200);
  });
  els.btnCloseSheet.addEventListener("click", function () { closeSheet(els.sheetAdd); });
  els.btnCloseQty.addEventListener("click", function () { closeSheet(els.sheetQty); });
  els.scrim.addEventListener("click", function () {
    closeSheet(els.sheetAdd);
    closeSheet(els.sheetQty);
    closeSheet(els.sheetCustom);
    closeSheet(els.sheetWorkoutPicker);
    closeSheet(els.sheetWorkoutChecklist);
    closeSheet(els.sheetEditWorkout);
  });

  function renderChips() {
    var cats = ["all"];
    if (state.customFoods.length > 0) cats.push("custom");
    cats = cats.concat(state.categories);
    els.chiprow.innerHTML = "";
    cats.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "chip" + (state.activeCategory === cat ? " is-active" : "");
      btn.textContent = CATEGORY_LABELS[cat] || cat;
      btn.addEventListener("click", function () {
        state.activeCategory = cat;
        renderChips();
        if (els.foodSearch.value.trim().length === 0) renderCuratedDefault();
      });
      els.chiprow.appendChild(btn);
    });
  }

  function allBrowsableFoods() {
    return state.customFoods.map(function (f) { return Object.assign({}, f, { category: "custom" }); }).concat(state.curatedFoods);
  }

  function curatedByCategory() {
    var all = allBrowsableFoods();
    if (state.activeCategory === "all") return all;
    return all.filter(function (f) { return f.category === state.activeCategory; });
  }

  function renderCuratedDefault() {
    var list = curatedByCategory();
    els.searchHint.textContent = list.length + " food" + (list.length === 1 ? "" : "s") + (state.activeCategory !== "all" ? " in " + CATEGORY_LABELS[state.activeCategory].toLowerCase() : "") + ". Type 3+ letters to also search online.";
    renderResults(list.map(function (f) { return Object.assign({ source: f.category === "custom" ? "custom" : "home" }, f); }));
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
            '<span class="resultitem__tag">' + (item.source === "custom" ? "Yours" : item.source === "home" ? "Home" : item.source === "usda" ? "USDA" : "OFF") + '</span>' +
          '</div>' +
          '<div class="resultitem__meta">' + escapeHtml(item.serving) + ' · ' + Math.round(item.protein) + 'g protein</div>' +
        '</div>' +
        '<div class="resultitem__kcal">' + Math.round(item.kcal) + '</div>';
      li.addEventListener("click", function () { openQtyForFood(item); });
      els.resultslist.appendChild(li);
    });
  }

  function matchesQuery(name, query) {
    var haystack = name.toLowerCase();
    var words = query.split(/\s+/).filter(Boolean);
    return words.every(function (w) { return haystack.indexOf(w) !== -1; });
  }

  var searchDebounce = null;
  els.foodSearch.addEventListener("input", function () {
    var q = els.foodSearch.value.trim().toLowerCase();
    if (q.length === 0) { renderCuratedDefault(); return; }

    var curatedMatches = curatedByCategory()
      .filter(function (f) { return matchesQuery(f.name, q); })
      .map(function (f) { return Object.assign({ source: f.category === "custom" ? "custom" : "home" }, f); });

    renderResults(curatedMatches);
    els.searchHint.textContent = curatedMatches.length + " home match" + (curatedMatches.length === 1 ? "" : "es") + ". Searching online...";

    if (searchDebounce) clearTimeout(searchDebounce);
    if (q.length < 3) { els.searchHint.textContent = curatedMatches.length + " home matches. Type at least 3 letters to also search online."; return; }

    searchDebounce = setTimeout(function () {
      var usdaKey = (state.settings.usdaApiKey || "").trim();
      var searches = [searchOpenFoodFacts(q)];
      if (usdaKey) searches.push(searchUSDA(q, usdaKey));

      Promise.allSettled(searches).then(function (results) {
        var currentQ = els.foodSearch.value.trim().toLowerCase();
        if (currentQ !== q) return; // stale response
        var online = [];
        results.forEach(function (r) { if (r.status === "fulfilled") online = online.concat(r.value); });
        renderResults(curatedMatches.concat(online));
        els.searchHint.textContent = curatedMatches.length + " home + " + online.length + " online result" + (online.length === 1 ? "" : "s") + ".";
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

  function searchUSDA(query, apiKey) {
    var url = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + encodeURIComponent(apiKey) +
      "&query=" + encodeURIComponent(query) + "&pageSize=8";
    return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.foods) return [];
      return data.foods.map(function (f) {
        var nutrient = function (name) {
          var match = (f.foodNutrients || []).find(function (n) { return n.nutrientName === name; });
          return match ? match.value : 0;
        };
        return {
          name: f.description || "Unnamed food",
          serving: "100g",
          kcal: nutrient("Energy"),
          protein: nutrient("Protein"),
          carbs: nutrient("Carbohydrate, by difference"),
          fat: nutrient("Total lipid (fat)"),
          source: "usda"
        };
      }).filter(function (item) { return item.kcal > 0; });
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

  // ---------------- Custom food ----------------
  els.btnAddCustom.addEventListener("click", function () {
    els.customName.value = "";
    els.customServing.value = "";
    els.customKcal.value = "";
    els.customProtein.value = "";
    els.customCarbs.value = "";
    els.customFat.value = "";
    openSheet(els.sheetCustom);
  });
  els.btnCloseCustom.addEventListener("click", function () { closeSheet(els.sheetCustom); });

  els.btnSaveCustom.addEventListener("click", function () {
    var name = els.customName.value.trim();
    var kcal = parseFloat(els.customKcal.value);
    if (!name || isNaN(kcal) || kcal <= 0) {
      alert("Give it a name and a calorie amount at least.");
      return;
    }
    var food = {
      id: "custom_" + Date.now(),
      name: name,
      category: "custom",
      serving: els.customServing.value.trim() || "1 serving",
      kcal: kcal,
      protein: parseFloat(els.customProtein.value) || 0,
      carbs: parseFloat(els.customCarbs.value) || 0,
      fat: parseFloat(els.customFat.value) || 0
    };
    state.customFoods.push(food);
    saveCustomFoods();
    closeSheet(els.sheetCustom);
    state.activeCategory = "custom";
    renderChips();
    els.foodSearch.value = "";
    renderCuratedDefault();
  });

  // ---------------- Workout ----------------
  function renderWorkoutStatus() {
    var today = state.workouts[todayKey()];
    if (!today) {
      els.workoutstatus.innerHTML =
        '<p class="track__meta" id="workoutstatus-empty">No workout picked for today.</p>' +
        '<button class="btn-primary" id="btn-pick-workout">Log workout</button>';
    } else {
      var exercises = getWorkoutExercises(today.type);
      var doneCount = exercises.filter(function (name) { return today.checked && today.checked[name]; }).length;
      var subLine = exercises.length === 0 ? "Logged for today" : (doneCount + ' of ' + exercises.length + ' done');
      els.workoutstatus.innerHTML =
        '<div class="workoutstatus__row">' +
          '<div>' +
            '<div class="workoutstatus__label">' + escapeHtml(getWorkoutLabel(today.type)) + '</div>' +
            '<div class="workoutstatus__sub">' + subLine + '</div>' +
          '</div>' +
          '<div class="workoutstatus__actions">' +
            '<button class="link-muted" id="btn-open-checklist">Open checklist</button>' +
            '<button class="link-muted link-danger" id="btn-remove-workout">Remove</button>' +
          '</div>' +
        '</div>';
    }
    // Re-bind since innerHTML replaced the buttons
    var pickBtn = document.getElementById("btn-pick-workout");
    if (pickBtn) pickBtn.addEventListener("click", openWorkoutPicker);
    var openBtn = document.getElementById("btn-open-checklist");
    if (openBtn) openBtn.addEventListener("click", function () {
      var today = state.workouts[todayKey()];
      if (today) openWorkoutChecklist(today.type);
    });
    var removeBtn = document.getElementById("btn-remove-workout");
    if (removeBtn) removeBtn.addEventListener("click", function () { removeTodaysWorkout(); });
  }

  function openWorkoutPicker() {
    renderWorkoutTiles();
    openSheet(els.sheetWorkoutPicker);
  }
  els.btnCloseWorkoutPicker.addEventListener("click", function () { closeSheet(els.sheetWorkoutPicker); });

  function renderWorkoutTiles() {
    els.tilegrid.innerHTML = "";
    state.workoutDefs.forEach(function (def) {
      var btn = document.createElement("button");
      btn.className = "tile";
      btn.textContent = def.label;
      btn.addEventListener("click", function () {
        pickWorkoutForToday(def.id);
        closeSheet(els.sheetWorkoutPicker);
        openWorkoutChecklist(def.id);
      });
      els.tilegrid.appendChild(btn);
    });
  }

  function pickWorkoutForToday(type) {
    var key = todayKey();
    var existing = state.workouts[key];
    state.workouts[key] = {
      type: type,
      checked: (existing && existing.type === type) ? existing.checked : {}
    };
    saveWorkouts();
    renderWorkoutStatus();
    renderHistory();
  }

  function removeTodaysWorkout() {
    if (!confirm("Remove today's workout? This won't delete the workout type itself, just today's pick.")) return;
    delete state.workouts[todayKey()];
    saveWorkouts();
    closeSheet(els.sheetWorkoutChecklist);
    renderWorkoutStatus();
    renderHistory();
  }

  // ---------------- PR tracker ----------------
  var prOpenSections = {};

  function prKey(workoutId, exerciseName) {
    return workoutId + "::" + exerciseName;
  }

  function renderPRList() {
    els.prlist.innerHTML = "";
    var defsWithExercises = state.workoutDefs.filter(function (d) { return d.exercises.length > 0; });
    if (defsWithExercises.length === 0) {
      var empty = document.createElement("p");
      empty.className = "track__meta";
      empty.textContent = "No exercises defined yet, add some under Settings → Workouts.";
      els.prlist.appendChild(empty);
      return;
    }
    defsWithExercises.forEach(function (def) {
      var section = document.createElement("div");
      section.className = "prsection" + (prOpenSections[def.id] ? " is-open" : "");

      var header = document.createElement("button");
      header.className = "prsection__header";
      header.innerHTML =
        '<span class="prsection__title">' + escapeHtml(def.label) + '</span>' +
        '<span class="prsection__count">' + def.exercises.length + ' exercise' + (def.exercises.length === 1 ? "" : "s") + '</span>' +
        '<span class="prsection__chevron">&#9660;</span>';
      header.addEventListener("click", function () {
        prOpenSections[def.id] = !prOpenSections[def.id];
        section.classList.toggle("is-open");
      });
      section.appendChild(header);

      var body = document.createElement("div");
      body.className = "prsection__body";
      def.exercises.forEach(function (name) {
        var key = prKey(def.id, name);
        var row = document.createElement("div");
        row.className = "pritem";
        row.innerHTML =
          '<span class="pritem__name">' + escapeHtml(name) + '</span>' +
          '<input type="text" placeholder="e.g. 50kg x 8" value="' + escapeAttr(state.prs[key] || "") + '">';
        var input = row.querySelector("input");
        input.addEventListener("input", function () {
          state.prs[key] = input.value;
          savePRs();
        });
        body.appendChild(row);
      });
      section.appendChild(body);
      els.prlist.appendChild(section);
    });
  }

  function openWorkoutChecklist(type) {
    els.checklistTitle.textContent = getWorkoutLabel(type);
    renderChecklistItems(type);
    openSheet(els.sheetWorkoutChecklist);
  }

  function renderChecklistItems(type) {
    var exercises = getWorkoutExercises(type);
    var today = state.workouts[todayKey()] || { checked: {} };
    els.checklist.innerHTML = "";
    if (exercises.length === 0) {
      var li0 = document.createElement("li");
      li0.className = "empty";
      li0.textContent = "No exercise list for this one, it's already logged for today.";
      els.checklist.appendChild(li0);
      return;
    }
    exercises.forEach(function (name) {
      var isChecked = !!(today.checked && today.checked[name]);
      var li = document.createElement("li");
      li.className = "checkitem" + (isChecked ? " is-checked" : "");
      li.innerHTML =
        '<span class="checkitem__box"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12l5 5L20 6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
        '<span class="checkitem__label">' + escapeHtml(name) + '</span>';
      li.addEventListener("click", function () {
        toggleExercise(type, name);
      });
      els.checklist.appendChild(li);
    });
  }

  function toggleExercise(type, name) {
    var key = todayKey();
    if (!state.workouts[key]) state.workouts[key] = { type: type, checked: {} };
    if (!state.workouts[key].checked) state.workouts[key].checked = {};
    state.workouts[key].checked[name] = !state.workouts[key].checked[name];
    saveWorkouts();
    renderChecklistItems(type);
    renderWorkoutStatus();
  }

  els.btnCloseChecklist.addEventListener("click", function () { closeSheet(els.sheetWorkoutChecklist); });
  els.btnChangeWorkout.addEventListener("click", function () {
    closeSheet(els.sheetWorkoutChecklist);
    openWorkoutPicker();
  });
  els.btnRemoveWorkoutChecklist.addEventListener("click", function () { removeTodaysWorkout(); });

  // ---------------- Workout definition editor (Settings) ----------------
  function renderWorkoutDefList() {
    els.workoutdeflist.innerHTML = "";
    if (state.workoutDefs.length === 0) {
      var li0 = document.createElement("li");
      li0.className = "empty";
      li0.textContent = "No workouts defined yet.";
      els.workoutdeflist.appendChild(li0);
      return;
    }
    state.workoutDefs.forEach(function (def) {
      var li = document.createElement("li");
      li.className = "workoutdefitem";
      li.innerHTML =
        '<div>' +
          '<div class="workoutdefitem__name">' + escapeHtml(def.label) + '</div>' +
          '<div class="workoutdefitem__sub">' + def.exercises.length + ' exercise' + (def.exercises.length === 1 ? "" : "s") + '</div>' +
        '</div>' +
        '<span class="link-muted">Edit</span>';
      li.addEventListener("click", function () { openEditWorkout(def.id); });
      els.workoutdeflist.appendChild(li);
    });
  }

  els.btnAddWorkoutDef.addEventListener("click", function () { openEditWorkout(null); });

  function openEditWorkout(id) {
    state.editingWorkoutId = id;
    var def = id ? getWorkoutDef(id) : null;
    els.editWorkoutTitle.textContent = def ? "Edit workout" : "New workout";
    els.editWorkoutName.value = def ? def.label : "";
    renderExerciseRows(def ? def.exercises.slice() : []);
    els.btnDeleteWorkoutDef.style.display = def ? "block" : "none";
    var codedDefault = id ? DEFAULT_WORKOUT_DEFS.find(function (d) { return d.id === id; }) : null;
    els.btnResetWorkoutDef.style.display = codedDefault ? "block" : "none";
    openSheet(els.sheetEditWorkout);
  }
  els.btnCloseEditWorkout.addEventListener("click", function () { closeSheet(els.sheetEditWorkout); });

  els.btnResetWorkoutDef.addEventListener("click", function () {
    var codedDefault = DEFAULT_WORKOUT_DEFS.find(function (d) { return d.id === state.editingWorkoutId; });
    if (!codedDefault) return;
    if (!confirm('Reset "' + codedDefault.label + '" back to the coded default exercises? This replaces what\'s in the form below, tap Save to confirm.')) return;
    els.editWorkoutName.value = codedDefault.label;
    renderExerciseRows(codedDefault.exercises.slice());
  });

  function renderExerciseRows(exercises) {
    els.exerciselist.innerHTML = "";
    exercises.forEach(function (name) { addExerciseRow(name); });
  }

  function addExerciseRow(value) {
    var li = document.createElement("li");
    li.className = "exerciserow";
    li.innerHTML =
      '<input type="text" value="' + escapeAttr(value || "") + '" placeholder="Exercise name">' +
      '<button class="exerciserow__remove" aria-label="Remove">&times;</button>';
    li.querySelector(".exerciserow__remove").addEventListener("click", function () { li.remove(); });
    els.exerciselist.appendChild(li);
  }

  els.btnAddExerciseRow.addEventListener("click", function () { addExerciseRow(""); });

  els.btnSaveWorkoutDef.addEventListener("click", function () {
    var name = els.editWorkoutName.value.trim();
    if (!name) { alert("Give the workout a name."); return; }
    var exercises = Array.from(els.exerciselist.querySelectorAll("input"))
      .map(function (inp) { return inp.value.trim(); })
      .filter(function (v) { return v.length > 0; });

    if (state.editingWorkoutId) {
      var def = getWorkoutDef(state.editingWorkoutId);
      def.label = name;
      def.exercises = exercises;
    } else {
      var id = "w_" + Date.now();
      state.workoutDefs.push({ id: id, label: name, exercises: exercises });
    }
    saveWorkoutDefs();
    closeSheet(els.sheetEditWorkout);
    renderWorkoutDefList();
    renderWorkoutStatus();
    renderPRList();
  });

  els.btnDeleteWorkoutDef.addEventListener("click", function () {
    if (!state.editingWorkoutId) return;
    if (!confirm("Delete this workout? Past history entries will keep showing its name, but you won't be able to pick it again.")) return;
    state.workoutDefs = state.workoutDefs.filter(function (w) { return w.id !== state.editingWorkoutId; });
    saveWorkoutDefs();
    closeSheet(els.sheetEditWorkout);
    renderWorkoutDefList();
    renderWorkoutStatus();
    renderPRList();
  });

  // ---------------- Utils ----------------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---------------- Boot ----------------
  fetch("foods.json").then(function (r) { return r.json(); }).then(function (data) {
    state.curatedFoods = data.foods.map(function (f) {
      return { id: f.id, name: f.name, category: f.category, serving: f.serving, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat };
    });
    state.categories = data.categories || [];
  }).catch(function () {
    state.curatedFoods = [];
    state.categories = [];
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
