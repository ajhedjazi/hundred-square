const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeStatusFilter,
  sanitizeName,
  validateReservationPayload,
  validateSquareNumber,
} = require("../src/validation");

test("validateSquareNumber accepts integers from 1 to 100", () => {
  assert.equal(validateSquareNumber(1), 1);
  assert.equal(validateSquareNumber("100"), 100);
});

test("validateSquareNumber rejects values outside the grid", () => {
  assert.equal(validateSquareNumber(0), null);
  assert.equal(validateSquareNumber(101), null);
  assert.equal(validateSquareNumber("12.5"), null);
});

test("sanitizeName trims and collapses whitespace", () => {
  assert.equal(sanitizeName("  Amir   Example  "), "Amir Example");
});

test("validateReservationPayload requires all public form fields", () => {
  const validation = validateReservationPayload({
    number: 7,
    name: "Amir",
    email: "amir@example.com",
    confirmed: true,
  });

  assert.equal(validation.isValid, true);
  assert.equal(validation.data.number, 7);
  assert.equal(validation.data.email, "amir@example.com");
});

test("validateReservationPayload reports missing or invalid fields", () => {
  const validation = validateReservationPayload({
    number: 120,
    name: "",
    email: "not-an-email",
    confirmed: false,
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.length, 4);
});

test("normalizeStatusFilter accepts valid statuses and rejects unknown filters", () => {
  assert.equal(normalizeStatusFilter("available"), "available");
  assert.equal(normalizeStatusFilter("Reserved"), "reserved");
  assert.equal(normalizeStatusFilter(""), null);
  assert.equal(normalizeStatusFilter("lost"), undefined);
});
