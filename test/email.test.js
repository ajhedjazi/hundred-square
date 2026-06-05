const test = require("node:test");
const assert = require("node:assert/strict");
const { buildReservationEmail } = require("../src/email");

test("reservation email includes donation amount and no reference instruction", () => {
  const email = buildReservationEmail({
    name: "Amir",
    numbers: [3, 8],
    totalAmount: 10,
    fundraiserUrl: "https://bit.ly/amir-gnr-amc",
  });

  assert.match(email.text, /reserved squares 3, 8/);
  assert.match(email.text, /donate \u00a310/);
  assert.match(email.text, /https:\/\/bit\.ly\/amir-gnr-amc/);
  assert.doesNotMatch(email.text, /reference/i);
});
