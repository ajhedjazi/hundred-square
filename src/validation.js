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

function isValidEmail(email) {
  if (typeof email !== "string" || email.length > 254) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateReservationPayload(body) {
  const errors = [];
  const number = validateSquareNumber(body && body.number);
  const name = sanitizeName(body && body.name);
  const email = String((body && body.email) || "").trim().toLowerCase();
  const confirmed = Boolean(body && body.confirmed);

  if (!number) {
    errors.push("Choose a valid square from 1 to 100.");
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
    errors.push("Confirm that your square is only confirmed once the donation has been received.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      number,
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
  sanitizeName,
  validateReservationPayload,
  validateSquareNumber,
};
