(function () {
  var STORAGE_KEY = "lysk-card-checklist:v2";
  var cards = window.LYSK_CARDS && window.LYSK_CARDS.length ? window.LYSK_CARDS : [];
  var records = {};
  var currentCard = null;
  var storage = createStorage();

  var els = {
    character: document.getElementById("characterSelect"),
    card: document.getElementById("cardSelect"),
    image: document.getElementById("cardImage"),
    title: document.getElementById("cardTitle"),
    meta: document.getElementById("cardMeta"),
    owned: document.getElementById("ownedInput"),
    duplicate: document.getElementById("duplicateInput"),
    rank: document.getElementById("rankInput"),
    core: document.getElementById("coreInput"),
    deleteCurrent: document.getElementById("deleteCurrentBtn"),
    resetForm: document.getElementById("resetFormBtn"),
    search: document.getElementById("searchInput"),
    list: document.getElementById("recordList"),
    empty: document.getElementById("emptyState"),
    ownedCount: document.getElementById("ownedCount"),
    status: document.getElementById("statusBanner")
  };

  function createStorage() {
    try {
      var testKey = STORAGE_KEY + ":test";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return {
        usable: true,
        read: function () { return window.localStorage.getItem(STORAGE_KEY); },
        write: function (value) { window.localStorage.setItem(STORAGE_KEY, value); }
      };
    } catch (error) {
      return {
        usable: false,
        memory: "",
        read: function () { return this.memory; },
        write: function (value) { this.memory = value; }
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

  function loadRecords() {
    var raw = storage.read() || "{}";
    try {
      records = JSON.parse(raw) || {};
    } catch (error) {
      records = {};
      showStatus("已略過損壞的舊紀錄，請重新儲存目前卡片。");
    }
  }

  function saveRecords() {
    try {
      storage.write(JSON.stringify(records));
    } catch (error) {
      showStatus("這個瀏覽器目前無法寫入 localStorage，本次資料只會暫存在畫面上。");
    }
    renderRecords();
  }

  function option(value, text) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
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

  function disableForm(disabled) {
    var controls = [els.character, els.card, els.owned, els.duplicate, els.rank, els.core, els.deleteCurrent, els.resetForm, els.search];
    for (var i = 0; i < controls.length; i += 1) if (controls[i]) controls[i].disabled = disabled;
  }

  function initSelectors() {
    if (!cards.length) {
      showStatus("卡片資料沒有載入。請確認上傳到 Netlify 時有包含 cards.js。");
      disableForm(true);
      return;
    }
    var roles = uniqueRoles();
    var opts = [];
    for (var i = 0; i < roles.length; i += 1) opts.push(option(roles[i], roles[i]));
    replaceChildren(els.character, opts);
    updateCardOptions();
  }

  function cardsForRole(role) {
    var list = [];
    for (var i = 0; i < cards.length; i += 1) if (cards[i].role === role) list.push(cards[i]);
    return list;
  }

  function updateCardOptions() {
    var roleCards = cardsForRole(els.character.value);
    var opts = [];
    for (var i = 0; i < roleCards.length; i += 1) opts.push(option(cardId(roleCards[i]), roleCards[i].name));
    replaceChildren(els.card, opts);
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

  function getCurrentRecord() {
    return currentCard ? records[cardId(currentCard)] || {} : {};
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
    if (!currentCard) {
      setImage(els.image, "", "");
      els.title.textContent = "尚未選擇";
      els.meta.textContent = "請選擇卡片";
      els.owned.checked = false;
      els.duplicate.value = "";
      els.rank.value = "";
      els.core.value = "";
      return;
    }
    setImage(els.image, currentCard.image, currentCard.name + " 圖示");
    els.title.textContent = currentCard.name;
    els.meta.textContent = currentCard.role + " / " + currentCard.rarity + "星 / " + currentCard.color + " / " + currentCard.type + " / " + currentCard.talent + " / " + currentCard.availability;
    els.owned.checked = !!record.owned;
    els.duplicate.value = record.duplicate || "";
    els.rank.value = record.rank || "";
    els.core.value = record.core || "";
  }

  function normalizeNumber(value) {
    if (value === "") return "";
    var num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return "";
    return String(num);
  }

  function hasData(record) {
    return !!(record.owned || record.duplicate || record.rank || record.core);
  }

  function saveCurrent() {
    if (!currentCard) return;
    var id = cardId(currentCard);
    var record = {
      owned: els.owned.checked,
      duplicate: normalizeNumber(els.duplicate.value),
      rank: normalizeNumber(els.rank.value),
      core: els.core.value.replace(/^\s+|\s+$/g, ""),
      updatedAt: new Date().toISOString()
    };
    if (hasData(record)) records[id] = record;
    else delete records[id];
    saveRecords();
  }

  function resetCurrent() {
    els.owned.checked = false;
    els.duplicate.value = "";
    els.rank.value = "";
    els.core.value = "";
    saveCurrent();
    renderEditor();
  }

  function deleteCurrent() {
    if (!currentCard) return;
    delete records[cardId(currentCard)];
    saveRecords();
    renderEditor();
  }

  function addBadge(parent, text, type) {
    if (!text) return;
    var badge = document.createElement("span");
    badge.className = type ? "badge " + type : "badge";
    badge.textContent = text;
    parent.appendChild(badge);
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
    addBadge(badges, record.core, "core");
    var actions = document.createElement("div");
    actions.className = "record-actions";
    var edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "編輯";
    edit.onclick = function () {
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
      saveRecords();
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

  function bindEvents() {
    els.character.onchange = updateCardOptions;
    els.card.onchange = selectCard;
    els.owned.onchange = saveCurrent;
    els.duplicate.oninput = saveCurrent;
    els.rank.oninput = saveCurrent;
    els.core.oninput = saveCurrent;
    els.deleteCurrent.onclick = deleteCurrent;
    els.resetForm.onclick = resetCurrent;
    els.search.oninput = renderRecords;
  }

  bindEvents();
  if (!storage.usable) showStatus("這個瀏覽器封鎖 localStorage，本次紀錄可能無法永久保存。");
  loadRecords();
  initSelectors();
  renderRecords();
})();
