const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAdminReservationEmail,
  buildSupporterReservationEmail,
  sendReservationEmails,
} = require("../src/email");

const reservation = {
  name: "Amir",
  email: "amir@example.com",
  phone: "07123 456789",
  numbers: [3, 8],
  totalAmount: 10,
  reservedAt: "2026-06-05T14:30:00.000Z",
  fundraiserUrl: "https://bit.ly/amir-gnr-amc",
};

test("admin reservation email includes supporter and reservation details", () => {
  const email = buildAdminReservationEmail({
    ...reservation,
    adminNotifyEmail: "admin@example.com",
  });

  assert.equal(email.to, "admin@example.com");
  assert.equal(email.replyTo, "amir@example.com");
  assert.equal(email.subject, "New square reservation: Amir - Square(s) 3, 8");
  assert.match(email.text, /New square reservation received/);
  assert.match(email.text, /Name: Amir/);
  assert.match(email.text, /Email: amir@example\.com/);
  assert.match(email.text, /Phone: 07123 456789/);
  assert.match(email.text, /Square\(s\): 3, 8/);
  assert.match(email.text, /Number of squares: 2/);
  assert.match(email.text, /Expected donation: \u00a310/);
  assert.match(email.text, /Status: Reserved \/ awaiting payment/);
  assert.match(email.text, /https:\/\/bit\.ly\/amir-gnr-amc/);
  assert.match(email.text, /Only mark this reservation as paid once the donation has been confirmed/);
  assert.match(email.html, /<table/);
  assert.doesNotMatch(email.text, /reference/i);
});

test("supporter reservation email is short and only includes payment essentials", () => {
  const email = buildSupporterReservationEmail(reservation);

  assert.equal(email.to, "amir@example.com");
  assert.equal(email.subject, "Your square reservation");
  assert.match(email.text, /Hi Amir/);
  assert.match(email.text, /Reserved square\(s\): 3, 8/);
  assert.match(email.text, /Amount to donate: \u00a310/);
  assert.match(email.text, /https:\/\/bit\.ly\/amir-gnr-amc/);
  assert.match(email.text, /entered into the draw once payment has been confirmed/);
  assert.doesNotMatch(email.text, /reference/i);
  assert.doesNotMatch(email.text, /Gift Aid/i);
  assert.doesNotMatch(email.text, /07123/);
  assert.doesNotMatch(email.text, /admin/i);
});

test("sendReservationEmails sends supporter and admin emails separately", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      url,
      body: JSON.parse(options.body),
    });

    return {
      ok: true,
      text: async () => "",
    };
  };

  const result = await sendReservationEmails({
    resendApiKey: "test-key",
    fromEmail: "Fundraiser <fundraiser@example.com>",
    adminNotifyEmail: "admin@example.com",
    fundraiserUrl: reservation.fundraiserUrl,
  }, reservation, {
    fetchImpl,
    logger: { log() {}, error() {} },
  });

  assert.deepEqual(result, {
    supporterEmailSent: true,
    adminEmailSent: true,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.to[0], "amir@example.com");
  assert.equal(requests[0].body.subject, "Your square reservation");
  assert.equal(requests[1].body.to[0], "admin@example.com");
  assert.equal(requests[1].body.reply_to, "amir@example.com");
  assert.equal(requests[1].body.subject, "New square reservation: Amir - Square(s) 3, 8");
});

test("sendReservationEmails returns false flags when delivery fails", async () => {
  const errors = [];
  const result = await sendReservationEmails({
    resendApiKey: "test-key",
    fromEmail: "Fundraiser <fundraiser@example.com>",
    adminNotifyEmail: "admin@example.com",
    fundraiserUrl: reservation.fundraiserUrl,
  }, reservation, {
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => "bad key",
    }),
    logger: { log() {}, error(message) { errors.push(message); } },
  });

  assert.deepEqual(result, {
    supporterEmailSent: false,
    adminEmailSent: false,
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Supporter reservation email failed/);
  assert.match(errors[1], /Admin reservation email failed/);
});

test("sendReservationEmails skips admin email if ADMIN_NOTIFY_EMAIL is missing", async () => {
  let requestCount = 0;
  const messages = [];
  const result = await sendReservationEmails({
    resendApiKey: "test-key",
    fromEmail: "Fundraiser <fundraiser@example.com>",
    fundraiserUrl: reservation.fundraiserUrl,
  }, reservation, {
    fetchImpl: async () => {
      requestCount += 1;
      return {
        ok: true,
        text: async () => "",
      };
    },
    logger: { log(message) { messages.push(message); }, error() {} },
  });

  assert.deepEqual(result, {
    supporterEmailSent: true,
    adminEmailSent: false,
  });
  assert.equal(requestCount, 1);
  assert.match(messages.join("\n"), /ADMIN_NOTIFY_EMAIL/);
});
