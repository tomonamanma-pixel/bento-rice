const test = require("node:test");
const assert = require("node:assert/strict");
const calc = require("./calc.js");

test("example batch converts 4800g cooked rice to 2.18kg and 1.45 sho", function () {
  const cooked =
    calc.lineCookedGrams(200, 10) +
    calc.lineCookedGrams(180, 10) +
    calc.lineCookedGrams(200, 5);
  assert.equal(cooked, 4800);
  const result = calc.summarize(cooked, 2.2);
  assert.equal(result.kg, 2.18);
  assert.equal(result.sho, 1.45);
});

test("yield 2.0 uses an exact 2.40kg and 1.60 sho", function () {
  const result = calc.summarize(4800, 2);
  assert.equal(result.kg, 2.4);
  assert.equal(result.sho, 1.6);
});

test("leftover cooked rice is subtracted before converting to raw rice", function () {
  const net = calc.netCookedGrams(5000, 1500);
  assert.equal(net, 3500);
  const result = calc.summarize(net, 2.2);
  assert.equal(result.cookedGrams, 3500);
  assert.equal(result.kg, 1.59);
  assert.equal(result.sho, 1.06);
});

test("leftover larger than the batch cooks nothing", function () {
  assert.equal(calc.netCookedGrams(1000, 1500), 0);
  const result = calc.summarize(calc.netCookedGrams(1000, 1500), 2.2);
  assert.equal(result.kg, 0);
  assert.equal(result.sho, 0);
});

test("blank leftover keeps the full cooked amount", function () {
  assert.equal(calc.netCookedGrams(5000, 0), 5000);
  assert.equal(calc.netCookedGrams(5000, ""), 5000);
});

test("store single rice is added before leftover is subtracted", function () {
  assert.equal(calc.netCookedGrams(5000, 1500, 800), 4300);
  assert.equal(calc.netCookedGrams(5000, 1500, 0), 3500);
  assert.equal(calc.netCookedGrams(1000, 3000, 500), 0);
});

test("empty batch is zero", function () {
  const result = calc.summarize(0, 2.2);
  assert.equal(result.kg, 0);
  assert.equal(result.sho, 0);
});

test("partial name finds そぼろ inside the donburi", function () {
  const bentos = [
    { id: "1", name: "元気弁当", grams: 200 },
    { id: "2", name: "焼魚弁当", grams: 180 },
    { id: "3", name: "野菜たっぷり鶏そぼろ丼", grams: 200 },
  ];
  const hits = calc.matchBentos(bentos, "そぼろ");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "野菜たっぷり鶏そぼろ丼");
});

test("katakana query matches hiragana in the name", function () {
  const hits = calc.matchBentos(
    [{ id: "3", name: "野菜たっぷり鶏そぼろ丼", grams: 200 }],
    "ソボロ"
  );
  assert.equal(hits.length, 1);
});
