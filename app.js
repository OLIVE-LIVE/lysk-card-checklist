(function () {
  var CARD_STORAGE_KEY = "lysk-card-checklist:v2";
  var TRIGGER_STORAGE_KEY = "lysk-hidden-triggers:v1";
  var cards = window.LYSK_CARDS && window.LYSK_CARDS.length ? window.LYSK_CARDS : [];
  var records = {};
  var triggers = [];
  var currentCard = null;
  var storage = createStorage();

  var CORE_SUB_STATS = ["暴擊率", "暴擊傷害", "攻擊%", "生命%", "防禦%", "傷害提升", "虛弱增傷", "誓約回能", "加速回能"];
  var CORE_MAIN_STATS = ["", "攻擊%", "生命%", "防禦%", "暴擊率", "暴擊傷害", "誓約回能", "加速回能", "虛弱增傷"];
  var CORE_SLOT_OPTIONS = {
    "日冕": ["", "α", "β", "α + β"],
    "月晖": ["", "γ", "δ", "γ + δ"],
    "月暉": ["", "γ", "δ", "γ + δ"]
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
    coreRecommendation: document.getElementById("coreRecommendation"),
    coreSlot: document.getElementById("coreSlotSelect"),
    coreMain: document.getElementById("coreMainSelect"),
    coreQuality: document.getElementById("coreQualitySelect"),
    coreSubStats: document.getElementById("coreSubStats"),
    coreNote: document.getElementById("coreNoteInput"),
    deleteCurrent: document.getElementById("deleteCurrentBtn"),
    resetForm: document.getElementById("resetFormBtn"),
    search: document.getElementById("searchInput"),
    list: document.getElementById("recordList"),
    empty: document.getElementById("emptyState"),
    triggerRole: document.getElementById("triggerRoleSelect"),
    triggerCategory: document.getElementById("triggerCategorySelect"),
    triggerTitle: document.getElementById("triggerTitleInput"),
    triggerNote: document.getElementById("triggerNoteInput"),
    triggerDone: document.getElementById("triggerDoneInput"),
    addTrigger: document.getElementById("addTriggerBtn"),
    triggerSearch: document.getElementById("triggerSearchInput"),
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

  function cardId(card) {
    return card.role + "::" + card.name;
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

  function uniqueRoles() {
    var seen = {};
    var roles = [];
    for (var i = 0; i < cards.length; i += 1) {
      if (cards[i].role && !seen[cards[i].role]) {
        seen[cards[i].role] = true;
        roles.push(cards[i].role);
      }
    }
    return roles;
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
      showStatus("這個瀏覽器目前無法寫入 localStorage，本次資料只會暫存在畫面上。");
    }
  }

  function initSelectors() {
    if (!cards.length) {
      showStatus("卡片資料沒有載入。請確認上傳時有包含 cards.js。");
      disableCardForm(true);
      return;
    }

    var roles = uniqueRoles();
    replaceChildren(els.character, roles.map(function (role) { return option(role, role); }));
    replaceChildren(els.triggerRole, [option("通用", "通用")].concat(roles.map(function (role) { return option(role, role); })));
    replaceChildren(els.coreMain, CORE_MAIN_STATS.map(function (stat) { return option(stat, stat || "未選擇"); }));
    renderCoreSubStats([]);
    updateCardOptions();
  }

  function disableCardForm(disabled) {
    var controls = [els.character, els.card, els.owned, els.duplicate, els.rank, els.coreSlot, els.coreMain, els.coreQuality, els.coreNote, els.deleteCurrent, els.resetForm, els.search];
    for (var i = 0; i < controls.length; i += 1) if (controls[i]) controls[i].disabled = disabled;
  }

  function cardsForRole(role) {
    var list = [];
    for (var i = 0; i < cards.length; i += 1) if (cards[i].role === role) list.push(cards[i]);
    return list;
  }

  function updateCardOptions() {
    var roleCards = cardsForRole(els.character.value);
    replaceChildren(els.card, roleCards.map(function (card) { return option(cardId(card), card.name); }));
    currentCard = roleCards[0] || null;
    if (currentCard) els.card.value = cardId(currentCard);
    renderEditor();
  }

  function selectCard() {
    currentCard = null;
    for (var i = 0; i < cards.length; i += 1) {
      if (cardId(cards[i]) === els.card.value) {
        currentCard = cards[i];
        break;
      }
    }
    renderEditor();
  }

  function emptyCore() {
    return { slot: "", main: "", quality: "", subStats: [], note: "" };
  }

  function normalizeCore(core) {
    if (!core) return emptyCore();
    if (typeof core === "string") {
      var legacy = emptyCore();
      legacy.note = core;
      return legacy;
    }
    return {
      slot: core.slot || "",
      main: core.main || "",
      quality: core.quality || "",
      subStats: Array.isArray(core.subStats) ? core.subStats : [],
      note: core.note || ""
    };
  }

  function getCurrentRecord() {
    return currentCard ? records[cardId(currentCard)] || {} : {};
  }

  function getCurrentCore() {
    return normalizeCore(getCurrentRecord().core);
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

  function renderEditor() {
    var record = getCurrentRecord();
    var core = normalizeCore(record.core);
    if (!currentCard) {
      setImage(els.image, "", "");
      els.title.textContent = "尚未選擇";
      els.meta.textContent = "請選擇卡片";
      els.owned.checked = false;
      els.duplicate.value = "";
      els.rank.value = "";
      renderCoreInputs(emptyCore());
      return;
    }

    setImage(els.image, currentCard.image, currentCard.name + " 圖示");
    els.title.textContent = currentCard.name;
    els.meta.textContent = currentCard.role + " / " + currentCard.rarity + "星 / " + currentCard.color + " / " + currentCard.type + " / " + currentCard.talent + " / " + currentCard.availability;
    els.owned.checked = !!record.owned;
    els.duplicate.value = record.duplicate || "";
    els.rank.value = record.rank || "";
    renderCoreRecommendation();
    renderCoreInputs(core);
  }

  function renderCoreInputs(core) {
    var slots = CORE_SLOT_OPTIONS[currentCard && currentCard.type] || ["", "α", "β", "γ", "δ"];
    replaceChildren(els.coreSlot, slots.map(function (slot) { return option(slot, slot || "未選擇"); }));
    els.coreSlot.value = core.slot || "";
    els.coreMain.value = core.main || "";
    els.coreQuality.value = core.quality || "";
    els.coreNote.value = core.note || "";
    renderCoreSubStats(core.subStats || []);
  }

  function renderCoreSubStats(selected) {
    var chosen = {};
    for (var i = 0; i < selected.length; i += 1) chosen[selected[i]] = true;
    var buttons = CORE_SUB_STATS.map(function (stat) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = chosen[stat] ? "chip is-selected" : "chip";
      btn.textContent = stat;
      btn.onclick = function () {
        var core = readCoreInputs();
        var index = core.subStats.indexOf(stat);
        if (index >= 0) core.subStats.splice(index, 1);
        else core.subStats.push(stat);
        applyCoreToInputs(core);
        saveCurrent();
      };
      return btn;
    });
    replaceChildren(els.coreSubStats, buttons);
  }

  function recommendedMain(card) {
    if (!card) return "";
    if (card.talent === "攻击") return "攻擊%";
    if (card.talent === "防御") return "防禦%";
    if (card.talent === "生命") return "生命%";
    return "";
  }

  function pairCandidates(card) {
    if (!card || card.type !== "日冕") return [];
    return cards.filter(function (item) {
      return item !== card &&
        item.role === card.role &&
        item.type === "日冕" &&
        item.rarity === card.rarity &&
        item.color === card.color &&
        item.talent === card.talent;
    }).slice(0, 3);
  }

  function renderCoreRecommendation() {
    if (!currentCard) {
      els.coreRecommendation.textContent = "";
      return;
    }

    var main = recommendedMain(currentCard) || "依隊伍需求";
    var slots = currentCard.type === "日冕" ? "α / β" : "γ / δ";
    var pairs = pairCandidates(currentCard).map(function (card) { return card.name; }).join("、");
    var lines = [
      "<strong>" + currentCard.type + "建議</strong>：位置 " + slots + "，主屬性優先 " + main + "。",
      "<strong>副屬性</strong>：暴擊率、暴擊傷害、傷害提升，再補 " + main + "。"
    ];

    if (currentCard.type === "日冕") {
      lines.push("<strong>日卡套</strong>：" + (pairs ? "可搭配 " + pairs + "，" : "") + "先湊同角色同星譜需求，再挑 α / β 芯核。");
    }

    els.coreRecommendation.innerHTML = lines.map(function (line) { return "<p>" + line + "</p>"; }).join("");
  }

  function readCoreInputs() {
    return {
      slot: els.coreSlot.value,
      main: els.coreMain.value,
      quality: els.coreQuality.value,
      subStats: getSelectedSubStats(),
      note: trim(els.coreNote.value)
    };
  }

  function applyCoreToInputs(core) {
    els.coreSlot.value = core.slot || "";
    els.coreMain.value = core.main || "";
    els.coreQuality.value = core.quality || "";
    els.coreNote.value = core.note || "";
    renderCoreSubStats(core.subStats || []);
  }

  function getSelectedSubStats() {
    var stats = [];
    var buttons = els.coreSubStats.querySelectorAll(".chip.is-selected");
    for (var i = 0; i < buttons.length; i += 1) stats.push(buttons[i].textContent);
    return stats;
  }

  function normalizeNumber(value) {
    if (value === "") return "";
    var num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return "";
    return String(num);
  }

  function trim(value) {
    return String(value || "").replace(/^\s+|\s+$/g, "");
  }

  function coreHasData(core) {
    return !!(core.slot || core.main || core.quality || core.note || (core.subStats && core.subStats.length));
  }

  function hasData(record) {
    return !!(record.owned || record.duplicate || record.rank || coreHasData(normalizeCore(record.core)));
  }

  function saveCurrent() {
    if (!currentCard) return;
    var id = cardId(currentCard);
    var record = {
      owned: els.owned.checked,
      duplicate: normalizeNumber(els.duplicate.value),
      rank: normalizeNumber(els.rank.value),
      core: readCoreInputs(),
      updatedAt: new Date().toISOString()
    };
    if (hasData(record)) records[id] = record;
    else delete records[id];
    saveJSON(CARD_STORAGE_KEY, records);
    renderRecords();
  }

  function resetCurrent() {
    els.owned.checked = false;
    els.duplicate.value = "";
    els.rank.value = "";
    applyCoreToInputs(emptyCore());
    saveCurrent();
    renderEditor();
  }

  function deleteCurrent() {
    if (!currentCard) return;
    delete records[cardId(currentCard)];
    saveJSON(CARD_STORAGE_KEY, records);
    renderRecords();
    renderEditor();
  }

  function addBadge(parent, text, type) {
    if (!text) return;
    var badge = document.createElement("span");
    badge.className = type ? "badge " + type : "badge";
    badge.textContent = text;
    parent.appendChild(badge);
  }

  function coreSummary(coreValue) {
    var core = normalizeCore(coreValue);
    var parts = [];
    if (core.slot) parts.push(core.slot);
    if (core.main) parts.push(core.main);
    if (core.quality) parts.push(core.quality);
    if (core.subStats && core.subStats.length) parts.push(core.subStats.join("/"));
    if (core.note) parts.push(core.note);
    return parts.join(" / ");
  }

  function renderRecord(item) {
    var card = item.card;
    var record = item.record;
    var wrap = document.createElement("article");
    wrap.className = "record";
    var img = document.createElement("img");
    setImage(img, card.image, card.name + " 圖示");
    var main = document.createElement("div");
    main.className = "record-main";
    var title = document.createElement("div");
    title.className = "record-title";
    title.textContent = card.name + " / " + card.role;
    var badges = document.createElement("div");
    badges.className = "badges";
    addBadge(badges, card.rarity + "星", "star");
    addBadge(badges, card.color);
    addBadge(badges, card.type);
    if (record.owned) addBadge(badges, "已取得", "owned");
    addBadge(badges, record.duplicate ? "疊卡 " + record.duplicate : "");
    addBadge(badges, record.rank ? "升星 " + record.rank : "", "star");
    addBadge(badges, coreSummary(record.core), "core");
    var actions = document.createElement("div");
    actions.className = "record-actions";
    var edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "編輯";
    edit.onclick = function () {
      switchView("cardsView");
      els.character.value = card.role;
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
      renderRecords();
      renderEditor();
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
    var query = (els.search.value || "").toLowerCase();
    var items = [];
    var owned = 0;
    var id;
    for (id in records) if (records.hasOwnProperty(id) && records[id].owned) owned += 1;
    els.ownedCount.textContent = String(owned);
    for (id in records) {
      if (!records.hasOwnProperty(id)) continue;
      for (var i = 0; i < cards.length; i += 1) {
        if (cardId(cards[i]) === id) {
          var haystack = (cards[i].role + " " + cards[i].name).toLowerCase();
          if (!query || haystack.indexOf(query) !== -1) items.push({ id: id, card: cards[i], record: records[id] });
          break;
        }
      }
    }
    items.sort(function (a, b) {
      var roleCompare = a.card.role.localeCompare(b.card.role, "zh-Hant");
      return roleCompare || a.card.name.localeCompare(b.card.name, "zh-Hant");
    });
    replaceChildren(els.list, []);
    for (var j = 0; j < items.length; j += 1) els.list.appendChild(renderRecord(items[j]));
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

  function createTrigger() {
    var title = trim(els.triggerTitle.value);
    if (!title) {
      showStatus("請先輸入觸發名稱。");
      return;
    }
    triggers.push({
      id: String(Date.now()),
      role: els.triggerRole.value,
      category: els.triggerCategory.value,
      title: title,
      note: trim(els.triggerNote.value),
      done: els.triggerDone.checked,
      updatedAt: new Date().toISOString()
    });
    els.triggerTitle.value = "";
    els.triggerNote.value = "";
    els.triggerDone.checked = false;
    saveJSON(TRIGGER_STORAGE_KEY, triggers);
    renderTriggers();
  }

  function renderTrigger(item) {
    var wrap = document.createElement("article");
    wrap.className = "record no-image";
    var main = document.createElement("div");
    main.className = "record-main";
    var title = document.createElement("div");
    title.className = "record-title";
    title.textContent = item.title;
    var badges = document.createElement("div");
    badges.className = "badges";
    addBadge(badges, item.role);
    addBadge(badges, item.category, "star");
    if (item.done) addBadge(badges, "已觸發", "done");
    var note = document.createElement("p");
    note.className = "record-note";
    note.textContent = item.note || "";
    var actions = document.createElement("div");
    actions.className = "record-actions";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = item.done ? "取消觸發" : "標記觸發";
    toggle.onclick = function () {
      item.done = !item.done;
      item.updatedAt = new Date().toISOString();
      saveJSON(TRIGGER_STORAGE_KEY, triggers);
      renderTriggers();
    };
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "刪除";
    remove.onclick = function () {
      triggers = triggers.filter(function (trigger) { return trigger.id !== item.id; });
      saveJSON(TRIGGER_STORAGE_KEY, triggers);
      renderTriggers();
    };
    actions.appendChild(toggle);
    actions.appendChild(remove);
    main.appendChild(title);
    main.appendChild(badges);
    if (item.note) main.appendChild(note);
    main.appendChild(actions);
    wrap.appendChild(main);
    return wrap;
  }

  function renderTriggers() {
    var query = (els.triggerSearch.value || "").toLowerCase();
    var items = triggers.filter(function (item) {
      var text = (item.role + " " + item.category + " " + item.title + " " + item.note).toLowerCase();
      return !query || text.indexOf(query) !== -1;
    });
    items.sort(function (a, b) {
      return Number(a.done) - Number(b.done) || b.updatedAt.localeCompare(a.updatedAt);
    });
    replaceChildren(els.triggerList, []);
    for (var i = 0; i < items.length; i += 1) els.triggerList.appendChild(renderTrigger(items[i]));
    els.triggerEmpty.style.display = items.length ? "none" : "block";
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
    els.coreSlot.onchange = saveCurrent;
    els.coreMain.onchange = saveCurrent;
    els.coreQuality.onchange = saveCurrent;
    els.coreNote.oninput = saveCurrent;
    els.deleteCurrent.onclick = deleteCurrent;
    els.resetForm.onclick = resetCurrent;
    els.search.oninput = renderRecords;
    els.addTrigger.onclick = createTrigger;
    els.triggerSearch.oninput = renderTriggers;
  }

  bindEvents();
  if (!storage.usable) showStatus("這個瀏覽器封鎖 localStorage，本次紀錄可能無法永久保存。");
  records = loadJSON(CARD_STORAGE_KEY, {});
  triggers = loadJSON(TRIGGER_STORAGE_KEY, []);
  initSelectors();
  renderRecords();
  renderTriggers();
})();
