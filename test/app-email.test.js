const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../src/app");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function postJson(port, path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (response) => {
      let responseBody = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode,
          body: JSON.parse(responseBody),
        });
      });
    });

    request.on("error", reject);
    request.end(body);
  });
}

function createReservationStore(numbers) {
  return {
    reserveSquares: async (reservation) => ({
      squares: numbers.map((number) => ({
        id: number,
        number,
        status: "reserved",
        name: reservation.name,
        email: reservation.email,
        phone: reservation.phone,
        reserved_at: "2026-06-05T14:30:00.000Z",
        paid_at: null,
        created_at: "2026-06-05T14:30:00.000Z",
        updated_at: "2026-06-05T14:30:00.000Z",
      })),
      totalAmount: numbers.length * 5,
    }),
  };
}

test("reservation JSON includes email sent flags when emails are sent", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    ok: true,
    text: async () => "",
  }));

  const app = createApp({
    store: createReservationStore([4]),
    config: {
      adminPassword: "test-password",
      fundraiserUrl: "https://bit.ly/amir-gnr-amc",
      resendApiKey: "test-key",
      fromEmail: "Fundraiser <fundraiser@example.com>",
      adminNotifyEmail: "admin@example.com",
    },
  });
  const server = await listen(app);

  try {
    const port = server.address().port;
    const response = await postJson(port, "/api/reservations", {
      numbers: [4],
      name: "Amir",
      email: "amir@example.com",
      phone: "07123 456789",
      confirmed: true,
    });
    const data = response.body;

    assert.equal(response.status, 201);
    assert.equal(data.supporterEmailSent, true);
    assert.equal(data.adminEmailSent, true);
    assert.deepEqual(data.numbers, [4]);
    assert.equal(data.totalAmount, 5);
  } finally {
    await close(server);
  }
});

test("reservation still saves if email delivery fails", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    ok: false,
    status: 500,
    text: async () => "email provider unavailable",
  }));
  t.mock.method(console, "error", () => {});

  const app = createApp({
    store: createReservationStore([6, 7]),
    config: {
      adminPassword: "test-password",
      fundraiserUrl: "https://bit.ly/amir-gnr-amc",
      resendApiKey: "test-key",
      fromEmail: "Fundraiser <fundraiser@example.com>",
      adminNotifyEmail: "admin@example.com",
    },
  });
  const server = await listen(app);

  try {
    const port = server.address().port;
    const response = await postJson(port, "/api/reservations", {
      numbers: [6, 7],
      name: "Amir",
      email: "amir@example.com",
      confirmed: true,
    });
    const data = response.body;

    assert.equal(response.status, 201);
    assert.equal(data.supporterEmailSent, false);
    assert.equal(data.adminEmailSent, false);
    assert.deepEqual(data.numbers, [6, 7]);
    assert.equal(data.totalAmount, 10);
  } finally {
    await close(server);
  }
});
