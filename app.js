(function () {
  var CARD_STORAGE_KEY = "lysk-card-checklist:v3";
  var LEGACY_CARD_STORAGE_KEY = "lysk-card-checklist:v2";
  var TRIGGER_STORAGE_KEY = "lysk-hidden-trigger-checks:v2";
  var CALCULATOR_STORAGE_KEY = "lysk-attribute-calculator:v2";
  var GACHA_STORAGE_KEY = "lysk-gacha-calculator:v2";

  var cards = window.LYSK_CARDS || [];
  var hiddenTriggers = window.LYSK_HIDDEN_TRIGGERS || [];
  var records = {};
  var triggerChecks = {};
  var currentCard = null;
  var storage = createStorage();

  var STAT_OPTIONS = [
    "生命", "攻擊", "防禦", "生命%", "攻擊%", "防禦%",
    "暴擊率", "暴擊傷害", "傷害加成", "虛弱增傷", "誓約增傷", "能量恢復"
  ];
  var CORE_SLOTS = ["", "α", "β", "γ", "δ"];
  var POOL_LABELS = {
    single: "單人月卡池",
    daily: "日卡池",
    triple: "多人月卡池",
    same: "繼續本次卡池"
  };
  var LAST_CARD_OPTIONS = {
    normal: [
      ["up_no_target", "UP 卡"],
      ["standard_no_target", "常駐卡"]
    ],
    triple: [
      ["targeted", "UP 卡是定向"],
      ["up_with_target", "UP 卡非定向（當時已選定向）"],
      ["up_no_target", "UP 卡非定向（當時未選定向）"],
      ["standard_with_target", "常駐卡（當時已選定向）"],
      ["standard_no_target", "常駐卡（當時未選定向）"]
    ]
  };

  var els = {
    status: document.getElementById("statusBanner"),
    ownedCount: document.getElementById("ownedCount"),
    tabs: document.querySelectorAll(".tabs button"),
    views: document.querySelectorAll(".view"),
    character: document.getElementById("characterSelect"),
    card: document.getElementById("cardSelect"),
    image: document.getElementById("cardImage"),
    title: document.getElementById("cardTitle"),
    meta: document.getElementById("cardMeta"),
    owned: document.getElementById("ownedInput"),
    duplicate: document.getElementById("duplicateInput"),
    rank: document.getElementById("rankInput"),
    deleteCurrent: document.getElementById("deleteCurrentBtn"),
    resetForm: document.getElementById("resetFormBtn"),
    search: document.getElementById("searchInput"),
    list: document.getElementById("recordList"),
    empty: document.getElementById("emptyState"),
    cardDataInfo: document.getElementById("cardDataInfo"),
    calcRole: document.getElementById("calcRoleSelect"),
    calcCard: document.getElementById("calcCardSelect"),
    calcLevel: document.getElementById("calcLevelInput"),
    calcAdvance: document.getElementById("calcAdvanceSelect"),
    calcFocus: document.getElementById("calcFocusSelect"),
    coreRecommendation: document.getElementById("coreRecommendation"),
    baseHp: document.getElementById("baseHpInput"),
    baseAtk: document.getElementById("baseAtkInput"),
    baseDef: document.getElementById("baseDefInput"),
    coreSlotA: document.getElementById("coreSlotASelect"),
    coreSlotB: document.getElementById("coreSlotBSelect"),
    coreRowsA: document.getElementById("coreRowsA"),
    coreRowsB: document.getElementById("coreRowsB"),
    calculatorResult: document.getElementById("calculatorResult"),
    resetCalculator: document.getElementById("resetCalculatorBtn"),
    remainingTo5Star: document.getElementById("remainingTo5StarInput"),
    currentPool: document.getElementById("currentPoolTypeSelect"),
    lastObtained: document.getElementById("lastObtainedCardSelect"),
    nextPool: document.getElementById("nextPoolTypeSelect"),
    gachaResult: document.getElementById("gachaResult"),
    triggerDataInfo: document.getElementById("triggerDataInfo"),
    triggerRole: document.getElementById("triggerRoleSelect"),
    triggerCategory: document.getElementById("triggerCategorySelect"),
    triggerStatus: document.getElementById("triggerStatusSelect"),
    triggerSearch: document.getElementById("triggerSearchInput"),
    checkVisibleTriggers: document.getElementById("checkVisibleTriggersBtn"),
    resetVisibleTriggers: document.getElementById("resetVisibleTriggersBtn"),
    triggerProgressTitle: document.getElementById("triggerProgressTitle"),
    triggerList: document.getElementById("triggerList"),
    triggerEmpty: document.getElementById("triggerEmptyState")
  };

  function createStorage() {
    try {
      var testKey = CARD_STORAGE_KEY + ":test";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return {
        usable: true,
        read: function (key) { return window.localStorage.getItem(key); },
        write: function (key, value) { window.localStorage.setItem(key, value); }
      };
    } catch (error) {
      return {
        usable: false,
        memory: {},
        read: function (key) { return this.memory[key] || ""; },
        write: function (key, value) { this.memory[key] = value; }
      };
    }
  }

  function showStatus(message) {
    els.status.textContent = message;
    els.status.hidden = false;
  }

  function trim(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
  }

  function normalizeSearch(value) {
    var map = {
      "話": "话", "與": "与", "雙": "双", "張": "张", "觸": "触", "發": "发",
      "獲": "获", "隱": "隐", "錄": "录", "條": "条", "覺": "觉", "體": "体",
      "寫": "写", "臺": "台", "檢": "检", "關": "关", "選": "选", "擇": "择",
      "戰": "战", "貓": "猫", "喵": "喵", "願": "愿", "裡": "里", "為": "为"
    };
    return String(value || "").toLowerCase().replace(/[話與雙張觸發獲隱錄條覺體寫臺檢關選擇戰貓願裡為]/g, function (ch) {
      return map[ch] || ch;
    });
  }

  function num(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function percent(value) {
    return num(value) / 100;
  }

  function formatNumber(value) {
    if (!isFinite(value)) return "0";
    return Math.round(value * 100) / 100 + "";
  }

  function formatInteger(value) {
    if (!isFinite(value)) return "0";
    return Math.round(value).toLocaleString("zh-Hant");
  }

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(storage.read(key) || JSON.stringify(fallback)) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      storage.write(key, JSON.stringify(value));
    } catch (error) {
      showStatus("資料暫時無法寫入 localStorage，請確認瀏覽器沒有封鎖本機儲存。");
    }
  }

  function replaceChildren(parent, children) {
    while (parent.firstChild) parent.removeChild(parent.firstChild);
    for (var i = 0; i < children.length; i += 1) parent.appendChild(children[i]);
  }

  function option(value, text) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text || value || "未選擇";
    return opt;
  }

  function unique(values) {
    var seen = {};
    var result = [];
    for (var i = 0; i < values.length; i += 1) {
      if (values[i] && !seen[values[i]]) {
        seen[values[i]] = true;
        result.push(values[i]);
      }
    }
    return result;
  }

  function cardId(card) {
    return card.role + "::" + card.name;
  }

  function rolesFromCards() {
    return unique(cards.map(function (card) { return card.role; }));
  }

  function cardsForRole(role) {
    return cards.filter(function (card) { return card.role === role; });
  }

  function findCardById(id) {
    for (var i = 0; i < cards.length; i += 1) {
      if (cardId(cards[i]) === id) return cards[i];
    }
    return null;
  }

  function setImage(img, src, alt) {
    img.onerror = function () { img.className = "is-hidden"; };
    if (src) {
      img.className = "";
      img.src = src;
      img.alt = alt || "";
    } else {
      img.className = "is-hidden";
      img.removeAttribute("src");
      img.alt = "";
    }
  }

  function sanitizeRecord(record) {
    return {
      owned: !!record.owned,
      duplicate: normalizeNumber(record.duplicate),
      rank: normalizeNumber(record.rank),
      updatedAt: record.updatedAt || new Date().toISOString()
    };
  }

  function normalizeNumber(value) {
    if (value === "" || value === undefined || value === null) return "";
    var parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? "" : String(parsed);
  }

  function hasData(record) {
    return !!(record.owned || record.duplicate || record.rank);
  }

  function migrateRecords() {
    var current = loadJSON(CARD_STORAGE_KEY, null);
    if (current) return current;

    var legacy = loadJSON(LEGACY_CARD_STORAGE_KEY, {});
    var migrated = {};
    for (var id in legacy) {
      if (!legacy.hasOwnProperty(id)) continue;
      var record = sanitizeRecord(legacy[id]);
      if (hasData(record)) migrated[id] = record;
    }
    saveJSON(CARD_STORAGE_KEY, migrated);
    return migrated;
  }

  function initCardSelectors() {
    if (!cards.length) {
      showStatus("找不到卡片資料，請確認 cards.js 有一起上傳。");
      els.cardDataInfo.textContent = "卡片資料未載入";
      return;
    }

    var roles = rolesFromCards();
    replaceChildren(els.character, roles.map(function (role) { return option(role, role); }));
    replaceChildren(els.calcRole, roles.map(function (role) { return option(role, role); }));
    els.cardDataInfo.textContent = "已載入 " + cards.length + " 張卡片";
    updateCardOptions();
    updateCalcCardOptions();
  }

  function updateCardOptions() {
    var list = cardsForRole(els.character.value);
    replaceChildren(els.card, list.map(function (card) { return option(cardId(card), card.name); }));
    currentCard = list[0] || null;
    if (currentCard) els.card.value = cardId(currentCard);
    renderEditor();
  }

  function selectCard() {
    currentCard = findCardById(els.card.value);
    renderEditor();
  }

  function getCurrentRecord() {
    return currentCard ? records[cardId(currentCard)] || {} : {};
  }

  function renderEditor() {
    var record = getCurrentRecord();
    if (!currentCard) {
      setImage(els.image, "", "");
      els.title.textContent = "尚未選擇卡片";
      els.meta.textContent = "請選擇角色與卡片";
      els.owned.checked = false;
      els.duplicate.value = "";
      els.rank.value = "";
      return;
    }

    setImage(els.image, currentCard.image, currentCard.name);
    els.title.textContent = currentCard.name;
    els.meta.textContent = [
      currentCard.role,
      currentCard.rarity + "星",
      currentCard.color,
      currentCard.type,
      currentCard.talent,
      currentCard.availability
    ].filter(Boolean).join(" / ");
    els.owned.checked = !!record.owned;
    els.duplicate.value = record.duplicate || "";
    els.rank.value = record.rank || "";
  }

  function saveCurrent() {
    if (!currentCard) return;
    var id = cardId(currentCard);
    var record = sanitizeRecord({
      owned: els.owned.checked,
      duplicate: els.duplicate.value,
      rank: els.rank.value,
      updatedAt: new Date().toISOString()
    });
    if (hasData(record)) records[id] = record;
    else delete records[id];
    saveJSON(CARD_STORAGE_KEY, records);
    renderRecords();
  }

  function resetCurrent() {
    els.owned.checked = false;
    els.duplicate.value = "";
    els.rank.value = "";
    saveCurrent();
  }

  function deleteCurrent() {
    if (!currentCard) return;
    delete records[cardId(currentCard)];
    saveJSON(CARD_STORAGE_KEY, records);
    renderEditor();
    renderRecords();
  }

  function addBadge(parent, text, type) {
    if (!text) return;
    var badge = document.createElement("span");
    badge.className = type ? "badge " + type : "badge";
    badge.textContent = text;
    parent.appendChild(badge);
  }

  function renderRecord(item) {
    var wrap = document.createElement("article");
    wrap.className = "record";

    var img = document.createElement("img");
    setImage(img, item.card.image, item.card.name);

    var main = document.createElement("div");
    main.className = "record-main";

    var title = document.createElement("div");
    title.className = "record-title";
    title.textContent = item.card.name + " / " + item.card.role;

    var badges = document.createElement("div");
    badges.className = "badges";
    addBadge(badges, item.card.rarity + "星", "star");
    addBadge(badges, item.card.color);
    addBadge(badges, item.card.type);
    if (item.record.owned) addBadge(badges, "已取得", "owned");
    addBadge(badges, item.record.duplicate ? "疊卡 " + item.record.duplicate : "");
    addBadge(badges, item.record.rank ? "升星 " + item.record.rank : "", "star");

    var actions = document.createElement("div");
    actions.className = "record-actions";
    var edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "編輯";
    edit.onclick = function () {
      switchView("cardsView");
      els.character.value = item.card.role;
      updateCardOptions();
      els.card.value = item.id;
      selectCard();
      window.scrollTo(0, 0);
    };
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "刪除";
    remove.onclick = function () {
      delete records[item.id];
      saveJSON(CARD_STORAGE_KEY, records);
      renderEditor();
      renderRecords();
    };
    actions.appendChild(edit);
    actions.appendChild(remove);

    main.appendChild(title);
    main.appendChild(badges);
    main.appendChild(actions);
    wrap.appendChild(img);
    wrap.appendChild(main);
    return wrap;
  }

  function renderRecords() {
    var query = trim(els.search.value).toLowerCase();
    var items = [];
    var owned = 0;

    for (var id in records) {
      if (!records.hasOwnProperty(id)) continue;
      if (records[id].owned) owned += 1;
      var card = findCardById(id);
      if (!card) continue;
      var text = (card.role + " " + card.name + " " + card.color + " " + card.type).toLowerCase();
      if (!query || text.indexOf(query) !== -1) items.push({ id: id, card: card, record: records[id] });
    }

    items.sort(function (a, b) {
      return a.card.role.localeCompare(b.card.role, "zh-Hant") ||
        a.card.name.localeCompare(b.card.name, "zh-Hant");
    });

    els.ownedCount.textContent = String(owned);
    replaceChildren(els.list, items.map(renderRecord));
    els.empty.style.display = items.length ? "none" : "block";
  }

  function switchView(viewId) {
    for (var i = 0; i < els.views.length; i += 1) {
      els.views[i].className = els.views[i].id === viewId ? "view is-active" : "view";
    }
    for (var j = 0; j < els.tabs.length; j += 1) {
      els.tabs[j].className = els.tabs[j].getAttribute("data-view") === viewId ? "is-active" : "";
    }
  }

  function updateCalcCardOptions() {
    var list = cardsForRole(els.calcRole.value);
    replaceChildren(els.calcCard, list.map(function (card) { return option(cardId(card), card.name); }));
    if (list[0]) els.calcCard.value = cardId(list[0]);
    renderCoreRecommendation();
    renderCalculator();
  }

  function selectedCalcCard() {
    return findCardById(els.calcCard.value);
  }

  function recommendedMain(card) {
    if (!card) return "攻擊%";
    if (card.talent === "生命") return "生命%";
    if (card.talent === "防禦") return "防禦%";
    return "攻擊%";
  }

  function renderCoreRecommendation() {
    var card = selectedCalcCard();
    if (!card) {
      els.coreRecommendation.textContent = "請先選擇卡片。";
      return;
    }
    var slots = card.type === "日冕" ? "α / β" : "γ / δ";
    var main = recommendedMain(card);
    els.coreRecommendation.innerHTML = [
      "<p><strong>" + card.type + "芯核建議</strong>：優先看 " + slots + "，主屬性可先選 " + main + "。</p>",
      "<p><strong>副詞條</strong>：暴擊率、暴擊傷害、傷害加成，再補 " + main + " 或缺少的基礎屬性。</p>",
      card.type === "日冕" ? "<p><strong>日卡套</strong>：同角色、同星譜的日冕成套時，先湊套裝需求，再微調 α / β 芯核。</p>" : ""
    ].join("");
  }

  function initCoreInputs() {
    replaceChildren(els.coreSlotA, CORE_SLOTS.map(function (slot) { return option(slot, slot || "未選擇"); }));
    replaceChildren(els.coreSlotB, CORE_SLOTS.map(function (slot) { return option(slot, slot || "未選擇"); }));
    renderCoreRows(els.coreRowsA, "A");
    renderCoreRows(els.coreRowsB, "B");
  }

  function renderCoreRows(tbody, coreKey) {
    var rows = [];
    for (var i = 0; i < 5; i += 1) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-core", coreKey);
      tr.setAttribute("data-row", String(i));

      var statCell = document.createElement("td");
      var stat = document.createElement("select");
      stat.className = "core-stat";
      replaceChildren(stat, STAT_OPTIONS.map(function (item) { return option(item, item); }));
      statCell.appendChild(stat);
      tr.appendChild(statCell);

      ["initial", "step", "growth"].forEach(function (name) {
        var td = document.createElement("td");
        var input = document.createElement("input");
        input.className = "core-" + name;
        input.type = "number";
        input.inputMode = "decimal";
        input.placeholder = name === "growth" ? "0" : "0";
        td.appendChild(input);
        tr.appendChild(td);
      });

      var totalCell = document.createElement("td");
      var total = document.createElement("output");
      total.className = "core-total";
      total.textContent = "0";
      totalCell.appendChild(total);
      tr.appendChild(totalCell);
      rows.push(tr);
    }
    replaceChildren(tbody, rows);
  }

  function calcStateFromDOM() {
    return {
      role: els.calcRole.value,
      card: els.calcCard.value,
      level: clamp(parseInt(els.calcLevel.value || "1", 10), 1, 80),
      advance: els.calcAdvance.value,
      focus: els.calcFocus.value,
      baseHp: num(els.baseHp.value),
      baseAtk: num(els.baseAtk.value),
      baseDef: num(els.baseDef.value),
      coreA: readCore("A"),
      coreB: readCore("B")
    };
  }

  function readCore(coreKey) {
    var tbody = coreKey === "A" ? els.coreRowsA : els.coreRowsB;
    var slot = coreKey === "A" ? els.coreSlotA.value : els.coreSlotB.value;
    var rows = [];
    var trs = tbody.querySelectorAll("tr");
    for (var i = 0; i < trs.length; i += 1) {
      rows.push({
        stat: trs[i].querySelector(".core-stat").value,
        initial: num(trs[i].querySelector(".core-initial").value),
        step: num(trs[i].querySelector(".core-step").value),
        growth: num(trs[i].querySelector(".core-growth").value)
      });
    }
    return { slot: slot, rows: rows };
  }

  function applyCalcState(state) {
    if (!state) return;
    if (state.role) {
      els.calcRole.value = state.role;
      updateCalcCardOptions();
    }
    if (state.card && findCardById(state.card)) els.calcCard.value = state.card;
    if (state.level) els.calcLevel.value = state.level;
    if (state.advance !== undefined) els.calcAdvance.value = state.advance;
    if (state.focus) els.calcFocus.value = state.focus;
    els.baseHp.value = state.baseHp || "";
    els.baseAtk.value = state.baseAtk || "";
    els.baseDef.value = state.baseDef || "";
    applyCore("A", state.coreA);
    applyCore("B", state.coreB);
  }

  function applyCore(coreKey, core) {
    if (!core) return;
    var slot = coreKey === "A" ? els.coreSlotA : els.coreSlotB;
    var tbody = coreKey === "A" ? els.coreRowsA : els.coreRowsB;
    slot.value = core.slot || "";
    var trs = tbody.querySelectorAll("tr");
    for (var i = 0; i < trs.length; i += 1) {
      var row = core.rows && core.rows[i] ? core.rows[i] : {};
      trs[i].querySelector(".core-stat").value = row.stat || STAT_OPTIONS[0];
      trs[i].querySelector(".core-initial").value = row.initial || "";
      trs[i].querySelector(".core-step").value = row.step || "";
      trs[i].querySelector(".core-growth").value = row.growth || "";
    }
  }

  function sumCoreRows(core) {
    var total = {};
    for (var i = 0; i < core.rows.length; i += 1) {
      var row = core.rows[i];
      var value = row.initial + row.step * row.growth;
      total[row.stat] = (total[row.stat] || 0) + value;
    }
    return total;
  }

  function addTotals(a, b) {
    var result = {};
    var key;
    for (key in a) if (a.hasOwnProperty(key)) result[key] = (result[key] || 0) + a[key];
    for (key in b) if (b.hasOwnProperty(key)) result[key] = (result[key] || 0) + b[key];
    return result;
  }

  function updateCoreRowTotals() {
    var rows = document.querySelectorAll(".stat-table tbody tr");
    for (var i = 0; i < rows.length; i += 1) {
      var initial = num(rows[i].querySelector(".core-initial").value);
      var step = num(rows[i].querySelector(".core-step").value);
      var growth = num(rows[i].querySelector(".core-growth").value);
      rows[i].querySelector(".core-total").textContent = formatNumber(initial + step * growth);
    }
  }

  function renderCalculator() {
    updateCoreRowTotals();
    var state = calcStateFromDOM();
    var coreTotals = addTotals(sumCoreRows(state.coreA), sumCoreRows(state.coreB));
    var hp = state.baseHp * (1 + percent(coreTotals["生命%"])) + num(coreTotals["生命"]);
    var atk = state.baseAtk * (1 + percent(coreTotals["攻擊%"])) + num(coreTotals["攻擊"]);
    var def = state.baseDef * (1 + percent(coreTotals["防禦%"])) + num(coreTotals["防禦"]);
    var focusValue = state.focus === "hp" ? hp : state.focus === "def" ? def : atk;
    var critRate = clamp(num(coreTotals["暴擊率"]), 0, 100);
    var critDmg = num(coreTotals["暴擊傷害"]);
    var dmgBonus = num(coreTotals["傷害加成"]) + num(coreTotals["虛弱增傷"]) + num(coreTotals["誓約增傷"]);
    var critFactor = 1 + percent(critRate) * percent(critDmg);
    var dmgFactor = 1 + percent(dmgBonus);
    var score = focusValue * critFactor * dmgFactor;
    var result = [
      ["生命總值", formatInteger(hp)],
      ["攻擊總值", formatInteger(atk)],
      ["防禦總值", formatInteger(def)],
      ["暴擊率", formatNumber(critRate) + "%"],
      ["暴擊傷害", formatNumber(critDmg) + "%"],
      ["估算輸出指數", formatInteger(score)]
    ];

    replaceChildren(els.calculatorResult, result.map(function (item) {
      var card = document.createElement("div");
      card.className = "result-card";
      var label = document.createElement("span");
      label.textContent = item[0];
      var strong = document.createElement("strong");
      strong.textContent = item[1];
      card.appendChild(label);
      card.appendChild(strong);
      return card;
    }));
    saveJSON(CALCULATOR_STORAGE_KEY, state);
  }

  function resetCalculator() {
    els.calcLevel.value = "1";
    els.calcAdvance.value = "0";
    els.calcFocus.value = "atk";
    els.baseHp.value = "";
    els.baseAtk.value = "";
    els.baseDef.value = "";
    applyCore("A", { slot: "", rows: [] });
    applyCore("B", { slot: "", rows: [] });
    saveJSON(CALCULATOR_STORAGE_KEY, {});
    renderCalculator();
  }

  function gachaStateFromDOM() {
    return {
      remainingTo5Star: clamp(parseInt(els.remainingTo5Star.value || "1", 10), 1, 70),
      currentPoolType: els.currentPool.value,
      lastObtainedCard: els.lastObtained.value,
      nextPoolType: els.nextPool.value
    };
  }

  function renderLastObtainedOptions() {
    var currentValue = els.lastObtained.value;
    var options = els.currentPool.value === "triple" ? LAST_CARD_OPTIONS.triple : LAST_CARD_OPTIONS.normal;
    replaceChildren(els.lastObtained, options.map(function (pair) { return option(pair[0], pair[1]); }));
    var exists = options.some(function (pair) { return pair[0] === currentValue; });
    els.lastObtained.value = exists ? currentValue : options[1][0];
  }

  function gachaResult(state) {
    var currentPulls = 70 - state.remainingTo5Star;
    var bigPity = state.lastObtainedCard.indexOf("standard") !== -1;
    var targetedPity = 0;
    if (state.currentPoolType === "triple") {
      targetedPity = state.lastObtainedCard === "standard_with_target" || state.lastObtainedCard === "up_with_target" ? 1 : 0;
    }
    var targetTriple = state.nextPoolType === "triple" || (state.nextPoolType === "same" && state.currentPoolType === "triple");
    var remainingPulls;
    if (targetTriple) {
      if (state.currentPoolType === "triple" && state.nextPoolType === "same" && targetedPity === 1) {
        remainingPulls = state.remainingTo5Star;
      } else {
        remainingPulls = state.remainingTo5Star + 70;
      }
    } else {
      remainingPulls = bigPity ? state.remainingTo5Star : state.remainingTo5Star + 70;
    }
    var probabilityText = currentPulls < 60 ?
      "還需 " + (60 - currentPulls) + " 抽開始提升機率" :
      "目前機率約 " + (11 + (currentPulls - 61) * 10) + "% → " + Math.min(100, 11 + (currentPulls - 60) * 10) + "%";
    var steps = remainingPulls > 70 ? [
      { pulls: state.remainingTo5Star, text: targetTriple ? "先出 5 星並累積心願值" : "先出 5 星並觸發大保底" },
      { pulls: 70, text: targetTriple ? "再出定向思念" : "再出 UP 思念" }
    ] : [
      { pulls: remainingPulls, text: targetTriple ? "取得定向思念" : "取得 UP 思念" }
    ];
    return {
      currentPulls: currentPulls,
      bigPity: bigPity,
      targetedPity: targetedPity,
      targetTriple: targetTriple,
      remainingPulls: remainingPulls,
      probabilityText: probabilityText,
      steps: steps
    };
  }

  function renderGacha() {
    renderLastObtainedOptions();
    var state = gachaStateFromDOM();
    els.remainingTo5Star.value = state.remainingTo5Star;
    var result = gachaResult(state);
    var upRate = state.currentPoolType === "triple" ? "75%" : "50%";
    var lines = [
      ["小保底", result.currentPulls + "/70", result.probabilityText],
      ["大保底", result.bigPity ? "已觸發" : "未觸發", result.bigPity ? "下個 5 星必定是 UP 思念" : "下個 5 星有 " + upRate + " 機率為 UP 思念"]
    ];
    if (state.currentPoolType === "triple" || state.nextPoolType === "triple") {
      lines.push(["定向", result.targetedPity + "/1",
        state.currentPoolType !== "triple" ? "切換到多人月卡池後可選定向" :
          state.nextPoolType === "triple" && state.nextPoolType !== "same" ? "切換多人卡池會重置心願值" :
            result.targetedPity ? "下個 5 星必定是定向思念" : "目前未累積心願值"
      ]);
    }
    lines.push(["預計最多", result.remainingPulls + " 抽", result.targetTriple ? "獲得定向思念（需選定向）" : "獲得 UP 思念"]);

    var wrap = document.createElement("div");
    for (var i = 0; i < lines.length; i += 1) {
      var line = document.createElement("div");
      line.className = "status-line";
      line.innerHTML = "<span>" + lines[i][0] + "</span><strong>" + lines[i][1] + "</strong><em>" + lines[i][2] + "</em>";
      wrap.appendChild(line);
    }
    var detail = document.createElement("div");
    detail.className = "detail-text";
    detail.innerHTML = result.steps.map(function (step) {
      return "<p>在 " + step.pulls + " 抽內：" + step.text + "</p>";
    }).join("");
    wrap.appendChild(detail);
    replaceChildren(els.gachaResult, [wrap]);
    saveJSON(GACHA_STORAGE_KEY, state);
  }

  function initTriggers() {
    if (!hiddenTriggers.length) {
      els.triggerDataInfo.textContent = "找不到隱藏觸發資料，請確認 hidden-triggers.js 有一起上傳。";
      return;
    }
    var roles = ["全部"].concat(unique(hiddenTriggers.map(function (item) { return item.role; })));
    var categories = ["全部"].concat(unique(hiddenTriggers.map(function (item) { return item.system; })));
    replaceChildren(els.triggerRole, roles.map(function (role) { return option(role, role); }));
    replaceChildren(els.triggerCategory, categories.map(function (category) { return option(category, category); }));
    els.triggerDataInfo.textContent = "已載入 " + hiddenTriggers.length + " 筆隱藏觸發資料";
  }

  function triggerDone(id) {
    return !!triggerChecks[id];
  }

  function filteredTriggers() {
    var role = els.triggerRole.value;
    var category = els.triggerCategory.value;
    var status = els.triggerStatus.value;
    var query = normalizeSearch(trim(els.triggerSearch.value));
    return hiddenTriggers.filter(function (item) {
      if (role !== "全部" && item.role !== role) return false;
      if (category !== "全部" && item.system !== category) return false;
      if (status === "done" && !triggerDone(item.id)) return false;
      if (status === "todo" && triggerDone(item.id)) return false;
      var text = normalizeSearch([item.role, item.system, item.subtype, item.condition, item.reward].join(" "));
      return !query || text.indexOf(query) !== -1;
    });
  }

  function renderTrigger(item) {
    var wrap = document.createElement("article");
    wrap.className = "record no-image trigger-card";
    var label = document.createElement("label");
    label.className = "trigger-check";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = triggerDone(item.id);
    input.onchange = function () {
      if (input.checked) triggerChecks[item.id] = true;
      else delete triggerChecks[item.id];
      saveJSON(TRIGGER_STORAGE_KEY, triggerChecks);
      renderTriggers();
    };

    var body = document.createElement("div");
    var title = document.createElement("div");
    title.className = "record-title";
    title.textContent = "#" + item.id + " " + item.role + " / " + item.subtype;
    var badges = document.createElement("div");
    badges.className = "badges";
    addBadge(badges, item.system, "star");
    addBadge(badges, triggerDone(item.id) ? "已完成" : "未完成", triggerDone(item.id) ? "done" : "");
    var condition = document.createElement("p");
    condition.className = "record-note";
    condition.textContent = "條件：" + item.condition;
    var reward = document.createElement("p");
    reward.className = "record-note";
    reward.textContent = "獲得：" + item.reward;

    body.appendChild(title);
    body.appendChild(badges);
    body.appendChild(condition);
    body.appendChild(reward);
    label.appendChild(input);
    label.appendChild(body);
    wrap.appendChild(label);
    return wrap;
  }

  function renderTriggers() {
    var items = filteredTriggers();
    var doneCount = hiddenTriggers.filter(function (item) { return triggerDone(item.id); }).length;
    els.triggerProgressTitle.textContent = "觸發清單 " + doneCount + "/" + hiddenTriggers.length;
    replaceChildren(els.triggerList, items.map(renderTrigger));
    els.triggerEmpty.style.display = items.length ? "none" : "block";
  }

  function setVisibleTriggers(done) {
    var items = filteredTriggers();
    for (var i = 0; i < items.length; i += 1) {
      if (done) triggerChecks[items[i].id] = true;
      else delete triggerChecks[items[i].id];
    }
    saveJSON(TRIGGER_STORAGE_KEY, triggerChecks);
    renderTriggers();
  }

  function restoreGacha() {
    var state = loadJSON(GACHA_STORAGE_KEY, null);
    if (!state) return;
    if (state.remainingTo5Star) els.remainingTo5Star.value = state.remainingTo5Star;
    if (state.currentPoolType) els.currentPool.value = state.currentPoolType;
    renderLastObtainedOptions();
    if (state.lastObtainedCard) els.lastObtained.value = state.lastObtainedCard;
    if (state.nextPoolType) els.nextPool.value = state.nextPoolType;
  }

  function bindEvents() {
    for (var i = 0; i < els.tabs.length; i += 1) {
      els.tabs[i].onclick = function () { switchView(this.getAttribute("data-view")); };
    }
    els.character.onchange = updateCardOptions;
    els.card.onchange = selectCard;
    els.owned.onchange = saveCurrent;
    els.duplicate.oninput = saveCurrent;
    els.rank.oninput = saveCurrent;
    els.deleteCurrent.onclick = deleteCurrent;
    els.resetForm.onclick = resetCurrent;
    els.search.oninput = renderRecords;

    els.calcRole.onchange = updateCalcCardOptions;
    els.calcCard.onchange = function () { renderCoreRecommendation(); renderCalculator(); };
    [
      els.calcLevel, els.calcAdvance, els.calcFocus, els.baseHp, els.baseAtk, els.baseDef,
      els.coreSlotA, els.coreSlotB, els.coreRowsA, els.coreRowsB
    ].forEach(function (el) {
      el.oninput = renderCalculator;
      el.onchange = renderCalculator;
    });
    els.resetCalculator.onclick = resetCalculator;

    [els.remainingTo5Star, els.currentPool, els.lastObtained, els.nextPool].forEach(function (el) {
      el.oninput = renderGacha;
      el.onchange = renderGacha;
    });

    [els.triggerRole, els.triggerCategory, els.triggerStatus].forEach(function (el) {
      el.onchange = renderTriggers;
    });
    els.triggerSearch.oninput = renderTriggers;
    els.checkVisibleTriggers.onclick = function () { setVisibleTriggers(true); };
    els.resetVisibleTriggers.onclick = function () { setVisibleTriggers(false); };
  }

  bindEvents();
  if (!storage.usable) showStatus("目前瀏覽器不能使用 localStorage，本次資料只能暫存在這個分頁。");
  records = migrateRecords();
  triggerChecks = loadJSON(TRIGGER_STORAGE_KEY, {});
  initCardSelectors();
  initCoreInputs();
  initTriggers();
  restoreGacha();
  applyCalcState(loadJSON(CALCULATOR_STORAGE_KEY, null));
  renderRecords();
  renderCoreRecommendation();
  renderCalculator();
  renderGacha();
  renderTriggers();
})();
