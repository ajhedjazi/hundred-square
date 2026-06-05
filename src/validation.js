const VALID_STATUSES = ["available", "reserved", "paid"];

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function validateSquareNumber(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 100) {
    return null;
  }

  return number;
}

function normalizeSquareNumbers(body) {
  const source = Array.isArray(body && body.numbers)
    ? body.numbers
    : [body && body.number];
  const numbers = [];
  const seen = new Set();

  for (const value of source) {
    const number = validateSquareNumber(value);

    if (!number || seen.has(number)) {
      continue;
    }

    seen.add(number);
    numbers.push(number);
  }

  return numbers.sort((a, b) => a - b);
}

function isValidEmail(email) {
  if (typeof email !== "string" || email.length > 254) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateReservationPayload(body) {
  const errors = [];
  const numbers = normalizeSquareNumbers(body);
  const name = sanitizeName(body && body.name);
  const email = String((body && body.email) || "").trim().toLowerCase();
  const confirmed = Boolean(body && body.confirmed);

  if (numbers.length === 0) {
    errors.push("Choose at least one available square from 1 to 100.");
  }

  if (!name) {
    errors.push("Enter your name.");
  } else if (name.length > 100) {
    errors.push("Name must be 100 characters or fewer.");
  }

  if (!email) {
    errors.push("Enter your email address.");
  } else if (!isValidEmail(email)) {
    errors.push("Enter a valid email address.");
  }

  if (!confirmed) {
    errors.push("Confirm the fundraiser eligibility and Gift Aid statement before reserving.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      number: numbers[0] || null,
      numbers,
      name,
      email,
      confirmed,
    },
  };
}

function normalizeStatusFilter(value) {
  if (!value) {
    return null;
  }

  const status = String(value).toLowerCase();
  return VALID_STATUSES.includes(status) ? status : undefined;
}

module.exports = {
  VALID_STATUSES,
  isValidEmail,
  normalizeStatusFilter,
  normalizeSquareNumbers,
  sanitizeName,
  validateReservationPayload,
  validateSquareNumber,
};
