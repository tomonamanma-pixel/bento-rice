(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RiceCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var SHO_KG = 1.5;

  function roundHalfUp(value, digits) {
    if (!Number.isFinite(value)) return 0;
    var factor = 10 ** digits;
    var shifted = value * factor;
    var rounded = Math.sign(shifted) * Math.floor(Math.abs(shifted) + 0.5 + 1e-9);
    return rounded / factor;
  }

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[\u30a1-\u30f6]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0x60);
      });
  }

  function lineCookedGrams(grams, quantity) {
    if (!Number.isFinite(grams) || !Number.isFinite(quantity)) return 0;
    if (grams <= 0 || quantity <= 0) return 0;
    return grams * quantity;
  }

  function netCookedGrams(cookedGrams, leftoverGrams, singleGrams) {
    var cooked = Number.isFinite(cookedGrams) && cookedGrams > 0 ? cookedGrams : 0;
    var single = Number(singleGrams);
    var leftover = Number(leftoverGrams);
    if (!Number.isFinite(single) || single < 0) single = 0;
    if (!Number.isFinite(leftover) || leftover < 0) leftover = 0;
    return Math.max(0, cooked + single - leftover);
  }

  function summarize(cookedGrams, yieldRatio) {
    var cooked = Number.isFinite(cookedGrams) && cookedGrams > 0 ? cookedGrams : 0;
    var ratio = Number(yieldRatio);
    var rawGrams = ratio > 0 ? cooked / ratio : 0;
    var kg = rawGrams / 1000;
    var sho = kg / SHO_KG;
    return {
      cookedGrams: cooked,
      kg: roundHalfUp(kg, 2),
      sho: roundHalfUp(sho, 2),
    };
  }

  function matchBentos(bentos, query) {
    var q = normalizeName(query);
    if (!q) return [];
    return bentos
      .map(function (bento) {
        return { bento: bento, name: normalizeName(bento.name) };
      })
      .filter(function (item) {
        return item.name.indexOf(q) !== -1;
      })
      .sort(function (a, b) {
        var aStart = a.name.indexOf(q) === 0 ? 0 : 1;
        var bStart = b.name.indexOf(q) === 0 ? 0 : 1;
        if (aStart !== bStart) return aStart - bStart;
        return a.bento.name.localeCompare(b.bento.name, "ja");
      })
      .map(function (item) {
        return item.bento;
      });
  }

  return {
    SHO_KG: SHO_KG,
    roundHalfUp: roundHalfUp,
    normalizeName: normalizeName,
    lineCookedGrams: lineCookedGrams,
    netCookedGrams: netCookedGrams,
    summarize: summarize,
    matchBentos: matchBentos,
  };
});
