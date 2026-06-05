const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeStatusFilter,
  sanitizeName,
  sanitizePhone,
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

test("sanitizePhone trims and collapses whitespace", () => {
  assert.equal(sanitizePhone("  07123   456789  "), "07123 456789");
});

test("validateReservationPayload requires all public form fields", () => {
  const validation = validateReservationPayload({
    number: 7,
    name: "Amir",
    email: "amir@example.com",
    phone: " 07123 456789 ",
    confirmed: true,
  });

  assert.equal(validation.isValid, true);
  assert.equal(validation.data.number, 7);
  assert.deepEqual(validation.data.numbers, [7]);
  assert.equal(validation.data.email, "amir@example.com");
  assert.equal(validation.data.phone, "07123 456789");
});

test("validateReservationPayload accepts multiple square numbers", () => {
  const validation = validateReservationPayload({
    numbers: [8, "3", 8],
    name: "Amir",
    email: "amir@example.com",
    confirmed: true,
  });

  assert.equal(validation.isValid, true);
  assert.deepEqual(validation.data.numbers, [3, 8]);
});

test("validateReservationPayload reports missing or invalid fields", () => {
  const validation = validateReservationPayload({
    number: 120,
    name: "",
    email: "not-an-email",
    phone: "1".repeat(41),
    confirmed: false,
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.errors.length, 5);
});

test("normalizeStatusFilter accepts valid statuses and rejects unknown filters", () => {
  assert.equal(normalizeStatusFilter("available"), "available");
  assert.equal(normalizeStatusFilter("Reserved"), "reserved");
  assert.equal(normalizeStatusFilter(""), null);
  assert.equal(normalizeStatusFilter("lost"), undefined);
});
