(function () {
  var STORAGE_KEY = "bento-rice-v1";
  var ORIGINAL_BENTO = "original-bento";
  var ORIGINAL_BOWL = "original-bowl";
  var calc = window.RiceCalc;

  var SEED = [
    { id: "b-genki", name: "元気弁当", grams: 200, category: "bento" },
    { id: "b-yakizakana", name: "焼魚弁当", grams: 180, category: "bento" },
    { id: "b-soboro", name: "野菜たっぷり鶏そぼろ丼", grams: 200, category: "bowl" },
  ];

  var state = load();
  var pinMode = "enter";

  var title = document.getElementById("title");
  var navButton = document.getElementById("nav-button");
  var makeScreen = document.getElementById("make-screen");
  var pinScreen = document.getElementById("pin-screen");
  var masterScreen = document.getElementById("master-screen");
  var rowsEl = document.getElementById("rows");
  var kgValue = document.getElementById("kg-value");
  var shoValue = document.getElementById("sho-value");
  var metaLine = document.getElementById("meta-line");
  var singleInput = document.getElementById("single-grams");
  var leftoverInput = document.getElementById("leftover-grams");
  var neededGrams = document.getElementById("needed-grams");
  var netGrams = document.getElementById("net-grams");
  var pinHelp = document.getElementById("pin-help");
  var pinALabel = document.getElementById("pin-a-label");
  var pinBWrap = document.getElementById("pin-b-wrap");
  var pinA = document.getElementById("pin-a");
  var pinB = document.getElementById("pin-b");
  var pinError = document.getElementById("pin-error");
  var pinSubmit = document.getElementById("pin-submit");
  var yieldInput = document.getElementById("yield-ratio");
  var yieldError = document.getElementById("yield-error");
  var newName = document.getElementById("new-name");
  var newGrams = document.getElementById("new-grams");
  var addError = document.getElementById("add-error");
  var masterList = document.getElementById("master-list");
  var pinChangeError = document.getElementById("pin-change-error");
  var confirmModal = document.getElementById("confirm-modal");

  var adminMark = document.getElementById("admin-mark");
  var adminScreen = document.getElementById("admin-screen");

  navButton.addEventListener("click", function () {
    if (makeScreen.classList.contains("active")) {
      showAdmin();
      return;
    }
    showMake();
  });
  document.getElementById("admin-back").addEventListener("click", showMake);
  document.getElementById("admin-enter").addEventListener("click", openPin);

  document.getElementById("clear-all").addEventListener("click", function () {
    confirmModal.hidden = false;
    document.getElementById("confirm-cancel").focus();
  });
  document.getElementById("confirm-cancel").addEventListener("click", closeConfirm);
  document.getElementById("confirm-ok").addEventListener("click", function () {
    state.rows = [blankRow()];
    save();
    paintRows();
    patchTotals();
    closeConfirm();
    focusBento(state.rows[0].id);
  });
  confirmModal.addEventListener("click", function (event) {
    if (event.target === confirmModal) closeConfirm();
  });

  pinSubmit.addEventListener("click", submitPin);
  pinA.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (pinMode === "setup") pinB.focus();
      else submitPin();
    }
  });
  pinB.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPin();
    }
  });

  yieldInput.addEventListener("change", saveYield);
  document.getElementById("add-bento").addEventListener("click", addBento);
  newGrams.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.getElementById("new-quantity").focus();
  });
  document.getElementById("new-quantity").addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addBento();
  });
  document.getElementById("change-pin").addEventListener("click", changePin);

  singleInput.addEventListener("input", onSingleInput);
  singleInput.addEventListener("focus", function () { singleInput.select(); });
  leftoverInput.addEventListener("input", onLeftoverInput);
  leftoverInput.addEventListener("focus", function () { leftoverInput.select(); });
  rowsEl.addEventListener("change", onBentoChange);
  rowsEl.addEventListener("input", onRowInput);
  rowsEl.addEventListener("keydown", onRowKeydown);
  rowsEl.addEventListener("click", onRowClick);

  showMake();
  registerServiceWorker();

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.bentos) || !Array.isArray(parsed.rows)) return freshState();
      if (!parsed.rows.length) parsed.rows = [blankRow()];
      if (!Number.isFinite(parsed.yieldRatio) || parsed.yieldRatio <= 0) parsed.yieldRatio = 2.2;
      parsed.leftover = digits(parsed.leftover).slice(0, 6) || "0";
      parsed.single = "0";
      if (!Array.isArray(parsed.bentos)) parsed.bentos = [];
      parsed.bentos.forEach(function (bento) {
        bento.category = inferCategory(bento);
        var count = Number(digits(bento.quantity).slice(0, 5));
        bento.quantity = count > 0 ? count : null;
      });
      mergeCatalog(parsed);
      parsed.rows = [blankRow()];
      return parsed;
    } catch (error) {
      return freshState();
    }
  }

  function freshState() {
    var source = window.RiceMenus && window.RiceMenus.length ? window.RiceMenus : SEED;
    return {
      pinHash: null,
      yieldRatio: 2.2,
      leftover: "0",
      single: "0",
      bentos: source.map(function (bento) { return Object.assign({}, bento); }),
      rows: [blankRow()],
    };
  }

  function mergeCatalog(parsed) {
    var catalog = window.RiceMenus || [];
    catalog.forEach(function (item) {
      var key = calc.normalizeName(item.name);
      var count = Number(item.quantity);
      var existing = parsed.bentos.find(function (bento) {
        return calc.normalizeName(bento.name) === key;
      });
      if (existing) {
        if (!(Number(existing.quantity) > 0) && count > 0) existing.quantity = count;
        return;
      }
      parsed.bentos.push({
        id: item.id,
        name: item.name,
        grams: item.grams,
        category: item.category === "bowl" ? "bowl" : "bento",
        quantity: count > 0 ? count : null
      });
    });
  }

  function blankRow(category) {
    return {
      id: uid(),
      bentoId: null,
      grams: "",
      quantity: "",
      category: category === "bowl" ? "bowl" : "bento",
    };
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showAdmin() {
    title.textContent = "炊飯計算";
    navButton.textContent = "戻る";
    adminMark.hidden = true;
    makeScreen.classList.remove("active");
    pinScreen.classList.remove("active");
    masterScreen.classList.remove("active");
    adminScreen.classList.add("active");
    document.getElementById("admin-enter").focus();
  }

  function showMake() {
    title.textContent = "炊飯計算";
    navButton.textContent = "登録";
    adminMark.hidden = false;
    makeScreen.classList.add("active");
    adminScreen.classList.remove("active");
    pinScreen.classList.remove("active");
    masterScreen.classList.remove("active");
    reflectRegisteredMenus(state);
    ensureTrailingBlank(state);
    save();
    paintRows();
    singleInput.value = state.single || "0";
    leftoverInput.value = state.leftover || "0";
    patchTotals();
  }

  function openPin() {
    pinError.textContent = "";
    pinA.value = "";
    pinB.value = "";
    pinMode = state.pinHash ? "enter" : "setup";
    title.textContent = "登録";
    navButton.textContent = "製造へ";
    adminMark.hidden = true;
    adminScreen.classList.remove("active");
    if (pinMode === "setup") {
      pinHelp.textContent = "登録画面用の暗証番号を決めてください。4桁の数字です。忘れると、登録画面は開けなくなります。";
      pinALabel.textContent = "新しい番号";
      pinBWrap.hidden = false;
      pinSubmit.textContent = "設定する";
    } else {
      pinHelp.textContent = "管理者の4桁の番号を入れてください。";
      pinALabel.textContent = "暗証番号";
      pinBWrap.hidden = true;
      pinSubmit.textContent = "開く";
    }
    makeScreen.classList.remove("active");
    masterScreen.classList.remove("active");
    pinScreen.classList.add("active");
    pinA.focus();
  }

  function showMaster() {
    title.textContent = "登録";
    navButton.textContent = "製造へ";
    adminMark.hidden = true;
    adminScreen.classList.remove("active");
    pinScreen.classList.remove("active");
    makeScreen.classList.remove("active");
    masterScreen.classList.add("active");
    yieldInput.value = String(state.yieldRatio);
    yieldError.textContent = "";
    addError.textContent = "";
    pinChangeError.textContent = "";
    paintMaster();
  }

  async function submitPin() {
    var first = digits(pinA.value);
    pinError.textContent = "";
    if (!/^\d{4}$/.test(first)) {
      pinError.textContent = "4桁の数字で入力してください。";
      return;
    }
    if (pinMode === "setup") {
      if (first !== digits(pinB.value)) {
        pinError.textContent = "番号が一致しません。";
        return;
      }
      state.pinHash = await hashPin(first);
      save();
      showMaster();
      return;
    }
    var hashed = await hashPin(first);
    if (hashed !== state.pinHash) {
      pinError.textContent = "番号が違います。";
      return;
    }
    showMaster();
  }

  function paintRows() {
    rowsEl.innerHTML = "";
    state.rows.forEach(function (row) {
      rowsEl.appendChild(rowElement(row));
    });
  }

  function rowElement(row) {
    var article = document.createElement("article");
    article.className = "row" + (isComplete(row) ? " complete" : "");
    article.dataset.rowId = row.id;
    var category = row.category === "bowl" ? "bowl" : "bento";
    article.innerHTML =
      '<div class="menu-block">' +
        '<div class="kind" role="group" aria-label="種類">' +
          '<button type="button" class="kind-button" data-action="kind" data-category="bento" aria-pressed="' + (category === "bento" ? "true" : "false") + '">お弁当</button>' +
          '<button type="button" class="kind-button" data-action="kind" data-category="bowl" aria-pressed="' + (category === "bowl" ? "true" : "false") + '">丼・重</button>' +
        '</div>' +
        '<select id="menu-' + row.id + '" class="pick" data-category="' + category + '" aria-label="' + (category === "bowl" ? "丼・重" : "お弁当") + '">' + menuOptions(category, row.bentoId) + '</select>' +
      '</div>' +
      '<div class="stat per-stat">' +
        '<label for="per-' + row.id + '">1食</label>' +
        '<strong data-per>—</strong>' +
        '<input id="per-' + row.id + '" class="per-grams" type="text" inputmode="decimal" maxlength="7" placeholder="0" enterkeyhint="next" autocomplete="off" hidden>' +
      '</div>' +
      '<div class="field">' +
        '<label for="qty-' + row.id + '">個数</label>' +
        '<input id="qty-' + row.id + '" class="qty" type="text" inputmode="numeric" maxlength="5" placeholder="0" enterkeyhint="next" autocomplete="off">' +
      '</div>' +
      '<p class="stat line"><span>必要量</span> <strong data-line>—</strong></p>' +
      '<button type="button" class="clear-row" data-action="clear-row">クリア</button>';
    article.querySelector(".qty").value = row.quantity;
    fillDerived(article, row);
    return article;
  }

  function menuOptions(category, selectedId) {
    var originalId = category === "bowl" ? ORIGINAL_BOWL : ORIGINAL_BENTO;
    var placeholder = '<option value="">選択</option>';
    var original = '<option value="' + originalId + '"' + (selectedId === originalId ? " selected" : "") + ">オリジナル</option>";
    var options = state.bentos.filter(function (bento) {
      return bento.category === category;
    }).map(function (bento) {
      var selected = bento.id === selectedId ? " selected" : "";
      return '<option value="' + escapeAttr(bento.id) + '"' + selected + ">" + escapeHtml(bento.name) + "</option>";
    }).join("");
    return placeholder + original + options;
  }

  function onBentoChange(event) {
    if (!event.target.classList.contains("pick")) return;
    var rowEl = event.target.closest("[data-row-id]");
    var row = rowById(rowEl.dataset.rowId);
    if (!row) return;
    row.bentoId = event.target.value || null;
    var fixedQuantity = registeredQuantity(row.bentoId);
    if (fixedQuantity) {
      row.quantity = fixedQuantity;
      rowEl.querySelector(".qty").value = fixedQuantity;
    }
    fillDerived(rowEl, row);
    rowEl.classList.toggle("complete", isComplete(row));
    var added = ensureTrailingBlank(state);
    save();
    patchTotals();
    if (added) rowsEl.appendChild(rowElement(added));
    if (isOriginalId(row.bentoId)) {
      var perInput = rowEl.querySelector(".per-grams");
      perInput.focus();
      perInput.select();
      return;
    }
    if (fixedQuantity && isComplete(row)) {
      var next = nextBlankAfter(row.id);
      if (next) focusBento(next.id);
      return;
    }
    if (row.bentoId) {
      var qty = rowEl.querySelector(".qty");
      qty.focus();
      qty.select();
    }
  }

  function onRowInput(event) {
    var rowEl = event.target.closest("[data-row-id]");
    if (!rowEl) return;
    var row = rowById(rowEl.dataset.rowId);
    if (!row) return;
    if (event.target.classList.contains("per-grams")) {
      var grams = gramText(event.target.value);
      if (event.target.value !== grams) event.target.value = grams;
      row.grams = grams;
    } else if (event.target.classList.contains("qty")) {
      var cleaned = digits(event.target.value).slice(0, 5);
      if (event.target.value !== cleaned) event.target.value = cleaned;
      row.quantity = cleaned;
    } else {
      return;
    }
    fillDerived(rowEl, row);
    rowEl.classList.toggle("complete", isComplete(row));
    var added = ensureTrailingBlank(state);
    save();
    patchTotals();
    if (added) rowsEl.appendChild(rowElement(added));
  }

  function onRowKeydown(event) {
    if (event.key !== "Enter") return;
    var rowEl = event.target.closest("[data-row-id]");
    if (!rowEl) return;
    var row = rowById(rowEl.dataset.rowId);
    if (!row) return;
    if (event.target.classList.contains("pick")) {
      event.preventDefault();
      if (isOriginalId(row.bentoId)) rowEl.querySelector(".per-grams").focus();
      else if (row.bentoId) rowEl.querySelector(".qty").focus();
      return;
    }
    if (event.target.classList.contains("per-grams")) {
      event.preventDefault();
      rowEl.querySelector(".qty").focus();
      return;
    }
    if (event.target.classList.contains("qty")) {
      event.preventDefault();
      if (!isComplete(row)) return;
      var added = ensureTrailingBlank(state);
      if (added) {
        save();
        rowsEl.appendChild(rowElement(added));
      }
      var next = nextBlankAfter(row.id);
      if (next) focusBento(next.id);
    }
  }

  function onRowClick(event) {
    var kind = event.target.closest("[data-action='kind']");
    if (kind) {
      var kindRowEl = kind.closest("[data-row-id]");
      var kindRow = rowById(kindRowEl.dataset.rowId);
      if (!kindRow || kindRow.category === kind.dataset.category) return;
      applyCategory(kindRowEl, kindRow, kind.dataset.category);
      return;
    }
    var button = event.target.closest("[data-action='clear-row']");
    if (!button) return;
    var rowEl = button.closest("[data-row-id]");
    var row = rowById(rowEl.dataset.rowId);
    row.bentoId = null;
    row.grams = "";
    row.quantity = "";
    rowEl.classList.remove("complete");
    rowEl.querySelector(".pick").value = "";
    rowEl.querySelector(".per-grams").value = "";
    rowEl.querySelector(".qty").value = "";
    fillDerived(rowEl, row);
    save();
    patchTotals();
    focusBento(row.id);
  }

  function fillDerived(rowEl, row) {
    syncKind(rowEl, row);
    var original = isOriginalId(row.bentoId);
    var bento = original ? null : bentoById(row.bentoId);
    var per = rowEl.querySelector("[data-per]");
    var perInput = rowEl.querySelector(".per-grams");
    var perLabel = rowEl.querySelector(".per-stat label");
    var line = rowEl.querySelector("[data-line]");
    var clearButton = rowEl.querySelector("[data-action='clear-row']");
    per.hidden = original;
    perInput.hidden = !original;
    perLabel.htmlFor = original ? perInput.id : "";
    if (original) {
      if (perInput.value !== row.grams) perInput.value = row.grams;
      var custom = calc.lineCookedGrams(Number(row.grams), Number(row.quantity));
      line.textContent = custom > 0 ? formatGrams(custom) : "—";
      clearButton.setAttribute("aria-label", originalLabel(row.bentoId) + "の行をクリア");
      return;
    }
    if (!bento) {
      per.textContent = "—";
      line.textContent = "—";
      clearButton.setAttribute("aria-label", "この行をクリア");
      return;
    }
    per.textContent = formatGrams(bento.grams);
    var cooked = calc.lineCookedGrams(bento.grams, Number(row.quantity));
    line.textContent = cooked > 0 ? formatGrams(cooked) : "—";
    clearButton.setAttribute("aria-label", bento.name + "の行をクリア");
  }

  function onSingleInput() {
    state.single = cleanAmount(singleInput);
    save();
    patchTotals();
  }

  function onLeftoverInput() {
    state.leftover = cleanAmount(leftoverInput);
    save();
    patchTotals();
  }

  function cleanAmount(input) {
    var cleaned = digits(input.value).slice(0, 6).replace(/^0+(\d)/, "$1") || "0";
    if (input.value !== cleaned) input.value = cleaned;
    return cleaned;
  }

  function cookedTotal() {
    return state.rows.reduce(function (sum, row) {
      return sum + rowCookedGrams(row);
    }, 0);
  }

  function rowCookedGrams(row) {
    if (isOriginalId(row.bentoId)) {
      return calc.lineCookedGrams(Number(row.grams), Number(row.quantity));
    }
    var bento = bentoById(row.bentoId);
    if (!bento) return 0;
    return calc.lineCookedGrams(bento.grams, Number(row.quantity));
  }

  function patchTotals() {
    var cooked = cookedTotal();
    var single = Number(state.single) || 0;
    var leftover = Number(state.leftover) || 0;
    var net = calc.netCookedGrams(cooked, leftover, single);
    var result = calc.summarize(net, state.yieldRatio);
    kgValue.innerHTML = result.kg.toFixed(2) + "<em>kg</em>";
    shoValue.innerHTML = "（" + result.sho.toFixed(2) + "<em>升</em>）";
    neededGrams.textContent = formatGrams(cooked);
    netGrams.textContent = formatGrams(net);
    metaLine.textContent = "必要炊飯量 " + formatGrams(net) + " ÷ " + trimNumber(state.yieldRatio) + "　1升 = 生米1.5kg";
  }

  function paintMaster() {
    masterList.innerHTML = ["bento", "bowl"].map(function (category) {
      var items = state.bentos.filter(function (bento) { return bento.category === category; });
      var body = items.length
        ? items.map(masterItemHtml).join("")
        : '<p class="help empty-group">まだありません</p>';
      return '<section class="master-group"><h3>' + (category === "bowl" ? "丼・重" : "お弁当") + "</h3>" + body + "</section>";
    }).join("");
    masterList.querySelectorAll(".master-item").forEach(function (item) {
      var id = item.dataset.bentoId;
      item.querySelector(".master-category").addEventListener("change", function (event) {
        recategorizeBento(id, event.target);
      });
      item.querySelector(".master-name").addEventListener("change", function (event) {
        renameBento(id, event.target);
      });
      item.querySelector(".master-grams").addEventListener("change", function (event) {
        regramBento(id, event.target);
      });
      var quantityInput = item.querySelector(".master-qty");
      if (quantityInput) {
        quantityInput.addEventListener("change", function (event) {
          requantityBento(id, event.target);
        });
      }
    });
  }

  function masterItemHtml(bento) {
    var quantityField = '<div class="field"><label for="qty-master-' + bento.id + '">個数</label>' +
      '<input id="qty-master-' + bento.id + '" class="master-qty" type="text" inputmode="numeric" maxlength="5" value="' + escapeAttr(bento.quantity ? String(bento.quantity) : "") + '"></div>';
    return '<div class="master-item" data-bento-id="' + escapeAttr(bento.id) + '">' +
      '<div class="field"><label for="category-' + bento.id + '">プルダウン</label>' +
      '<select id="category-' + bento.id + '" class="master-category">' +
      '<option value="bento"' + (bento.category === "bento" ? " selected" : "") + ">お弁当</option>" +
      '<option value="bowl"' + (bento.category === "bowl" ? " selected" : "") + ">丼・重</option>" +
      "</select></div>" +
      '<div class="field"><label for="name-' + bento.id + '">名前</label>' +
      '<input id="name-' + bento.id + '" class="master-name" type="text" maxlength="40" value="' + escapeAttr(bento.name) + '"></div>' +
      '<div class="field"><label for="grams-' + bento.id + '">1食（g）</label>' +
      '<input id="grams-' + bento.id + '" class="master-grams" type="number" inputmode="decimal" min="1" step="1" value="' + escapeAttr(String(bento.grams)) + '"></div>' +
      quantityField +
      "</div>";
  }

  function renameBento(id, input) {
    var bento = bentoById(id);
    var name = input.value.trim();
    addError.textContent = "";
    if (!name) {
      input.value = bento.name;
      addError.textContent = "名前を入力してください。";
      return;
    }
    if (isDuplicateName(name, id)) {
      input.value = bento.name;
      addError.textContent = "同じ名前がすでにあります。";
      return;
    }
    bento.name = name;
    save();
    paintRows();
    patchTotals();
  }

  function regramBento(id, input) {
    var bento = bentoById(id);
    var grams = Number(input.value);
    addError.textContent = "";
    if (!Number.isFinite(grams) || grams <= 0) {
      input.value = String(bento.grams);
      addError.textContent = "1食のグラムを入力してください。";
      return;
    }
    bento.grams = grams;
    save();
    paintRows();
    patchTotals();
  }

  function recategorizeBento(id, input) {
    var bento = bentoById(id);
    bento.category = input.value === "bowl" ? "bowl" : "bento";
    addError.textContent = "";
    save();
    paintMaster();
    paintRows();
    patchTotals();
  }

  function requantityBento(id, input) {
    var bento = bentoById(id);
    var count = Number(digits(input.value).slice(0, 5));
    addError.textContent = "";
    if (!(count > 0)) {
      input.value = bento.quantity ? String(bento.quantity) : "";
      addError.textContent = "個数を入力してください。";
      return;
    }
    bento.quantity = count;
    state.rows.forEach(function (row) {
      if (row.bentoId === id) row.quantity = String(count);
    });
    reflectRegisteredMenus(state);
    ensureTrailingBlank(state);
    save();
    paintRows();
    patchTotals();
  }

  function addBento() {
    var categoryInput = document.getElementById("new-category");
    var quantityInput = document.getElementById("new-quantity");
    var name = newName.value.trim();
    var grams = Number(newGrams.value);
    var category = categoryInput.value === "bowl" ? "bowl" : "bento";
    var quantity = Number(digits(quantityInput.value).slice(0, 5));
    addError.textContent = "";
    if (!name) {
      addError.textContent = "名前を入力してください。";
      return;
    }
    if (isDuplicateName(name)) {
      addError.textContent = "同じ名前がすでにあります。";
      return;
    }
    if (!Number.isFinite(grams) || grams <= 0) {
      addError.textContent = "1食のグラムを入力してください。";
      return;
    }
    if (!(quantity > 0)) {
      addError.textContent = "個数を入力してください。";
      return;
    }
    var item = { id: uid(), name: name, grams: grams, category: category, quantity: quantity };
    state.bentos.push(item);
    reflectRegisteredMenus(state);
    newName.value = "";
    newGrams.value = "";
    quantityInput.value = "";
    save();
    paintMaster();
    newName.focus();
  }

  function saveYield() {
    var ratio = Number(yieldInput.value);
    if (!Number.isFinite(ratio) || ratio <= 0) {
      yieldInput.value = String(state.yieldRatio);
      yieldError.textContent = "倍率は0より大きい数にしてください。";
      return;
    }
    state.yieldRatio = ratio;
    yieldError.textContent = "";
    save();
    patchTotals();
  }

  async function changePin() {
    var current = digits(document.getElementById("pin-current").value);
    var next = digits(document.getElementById("pin-next").value);
    var again = digits(document.getElementById("pin-next2").value);
    pinChangeError.textContent = "";
    pinChangeError.classList.remove("ok");
    if ((await hashPin(current)) !== state.pinHash) {
      pinChangeError.textContent = "今の番号が違います。";
      return;
    }
    if (!/^\d{4}$/.test(next)) {
      pinChangeError.textContent = "新しい番号は4桁の数字にしてください。";
      return;
    }
    if (next !== again) {
      pinChangeError.textContent = "新しい番号が一致しません。";
      return;
    }
    state.pinHash = await hashPin(next);
    save();
    document.getElementById("pin-current").value = "";
    document.getElementById("pin-next").value = "";
    document.getElementById("pin-next2").value = "";
    pinChangeError.textContent = "番号を変更しました。";
    pinChangeError.classList.add("ok");
  }

  function isComplete(row) {
    return rowComplete(row, state.bentos);
  }

  function rowComplete(row, bentos) {
    if (isOriginalId(row.bentoId)) {
      return Number(row.grams) > 0 && Number(row.quantity) > 0;
    }
    var bento = findBento(bentos, row.bentoId);
    return Boolean(bento && Number(row.quantity) > 0);
  }

  function isBlank(row) {
    return !row.bentoId && !row.quantity;
  }

  function ensureTrailingBlank(target) {
    var last = target.rows[target.rows.length - 1];
    if (!last || !rowComplete(last, target.bentos)) return null;
    var row = blankRow(last.category);
    target.rows.push(row);
    return row;
  }

  function nextBlankAfter(rowId) {
    var index = state.rows.findIndex(function (row) { return row.id === rowId; });
    for (var i = index + 1; i < state.rows.length; i += 1) {
      if (isBlank(state.rows[i])) return state.rows[i];
    }
    return null;
  }

  function focusBento(rowId) {
    var select = document.getElementById("menu-" + rowId);
    if (!select) return;
    select.focus();
    select.scrollIntoView({ block: "center" });
  }

  function bentoById(id) {
    return findBento(state.bentos, id);
  }

  function findBento(bentos, id) {
    return bentos.find(function (bento) { return bento.id === id; }) || null;
  }

  function rowById(id) {
    return state.rows.find(function (row) { return row.id === id; }) || null;
  }

  function isDuplicateName(name, exceptId) {
    var key = calc.normalizeName(name);
    return state.bentos.some(function (bento) {
      return bento.id !== exceptId && calc.normalizeName(bento.name) === key;
    });
  }

  function closeConfirm() {
    confirmModal.hidden = true;
  }

  function inferCategory(bento) {
    if (bento.category === "bowl" || bento.category === "bento") return bento.category;
    return /丼|重/.test(String(bento.name || "")) ? "bowl" : "bento";
  }

  function selectionCategory(id) {
    return categoryForId(id, state.bentos);
  }

  function categoryForId(id, bentos) {
    if (id === ORIGINAL_BOWL) return "bowl";
    if (id === ORIGINAL_BENTO) return "bento";
    var bento = findBento(bentos, id);
    return bento ? inferCategory(bento) : "";
  }

  function applyCategory(rowEl, row, category) {
    var next = category === "bowl" ? "bowl" : "bento";
    if (selectionCategory(row.bentoId) !== next) {
      row.bentoId = null;
      row.grams = "";
      row.quantity = "";
      rowEl.querySelector(".per-grams").value = "";
      rowEl.querySelector(".qty").value = "";
    }
    row.category = next;
    var select = rowEl.querySelector(".pick");
    select.dataset.category = next;
    select.innerHTML = menuOptions(next, row.bentoId);
    fillDerived(rowEl, row);
    rowEl.classList.toggle("complete", isComplete(row));
    save();
    patchTotals();
    select.focus();
  }

  function isOriginalId(id) {
    return id === ORIGINAL_BENTO || id === ORIGINAL_BOWL;
  }

  function originalLabel(id) {
    return id === ORIGINAL_BOWL ? "オリジナルの丼・重" : "オリジナルのお弁当";
  }

  function syncKind(rowEl, row) {
    var category = row.category === "bowl" ? "bowl" : "bento";
    row.category = category;
    rowEl.querySelectorAll("[data-action='kind']").forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.category === category ? "true" : "false");
    });
    var select = rowEl.querySelector(".pick");
    select.setAttribute("aria-label", category === "bowl" ? "丼・重" : "お弁当");
    if (select.dataset.category !== category) {
      select.dataset.category = category;
      select.innerHTML = menuOptions(category, row.bentoId);
    }
    select.value = selectionCategory(row.bentoId) === category ? row.bentoId : "";
  }

  function reflectRegisteredMenus(target) {
    var kept = [];
    var seen = {};
    target.rows.forEach(function (row) {
      var bento = findBento(target.bentos, row.bentoId);
      if (bento && Number(bento.quantity) > 0) {
        if (seen[bento.id]) return;
        seen[bento.id] = true;
        row.category = bento.category === "bowl" ? "bowl" : "bento";
      }
      kept.push(row);
    });
    target.rows = kept;
  }

  function registeredQuantity(id) {
    var bento = bentoById(id);
    if (!bento) return "";
    var count = Number(bento.quantity);
    return count > 0 ? String(count) : "";
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function gramText(value) {
    var match = String(value || "").replace(/[^\d.]/g, "").match(/^(\d{0,5})(\.\d?)?/);
    if (!match) return "";
    return (match[1] || "") + (match[2] || "");
  }

  function formatGrams(value) {
    var rounded = calc.roundHalfUp(value, 1);
    var text = Number.isInteger(rounded)
      ? rounded.toLocaleString("ja-JP")
      : rounded.toLocaleString("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return text + "g";
  }

  function trimNumber(value) {
    return String(calc.roundHalfUp(Number(value), 2)).replace(/\.0$/, "").replace(/(\.\d)0$/, "$1");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  async function hashPin(pin) {
    var text = "bento-rice:" + pin;
    if (window.crypto && crypto.subtle) {
      var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    }
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "fnv:" + (hash >>> 0).toString(16);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
