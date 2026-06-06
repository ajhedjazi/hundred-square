const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/app");
const { createLocalFileStore } = require("../src/local-store");

function requestJson(port, route, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method,
      headers: {
        "X-Admin-Password": "test-password",
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
    request.end();
  });
}

async function createFixture(t, config = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hundred-square-admin-"));
  const store = await createLocalFileStore(path.join(tempDir, "reservations.json"));
  const app = createApp({
    store,
    config: {
      adminPassword: "test-password",
      fundraiserUrl: "https://example.com/fundraiser",
      ...config,
    },
  });
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  return {
    store,
    port: server.address().port,
  };
}

test("admin API marks a grouped reservation paid and can release a separate unpaid reservation", async (t) => {
  t.mock.method(console, "log", () => {});
  const { store, port } = await createFixture(t);

  await store.reserveSquares({
    numbers: [21, 22],
    name: "Supporter",
    email: "supporter@example.com",
  });
  await store.reserveSquares({
    numbers: [23],
    name: "Another Supporter",
    email: "another@example.com",
  });

  const paidResponse = await requestJson(port, "/api/admin/squares/21/paid", "POST");
  const releaseResponse = await requestJson(port, "/api/admin/squares/23/release", "POST");
  const adminResponse = await requestJson(port, "/api/admin/squares");
  const publicResponse = await requestJson(port, "/api/squares");
  const paidSquare = adminResponse.body.squares.find((square) => square.number === 21);
  const groupedPaidSquare = adminResponse.body.squares.find((square) => square.number === 22);
  const releasedSquare = adminResponse.body.squares.find((square) => square.number === 23);
  const publicPaidSquares = publicResponse.body.squares
    .filter((square) => square.status === "paid")
    .map((square) => square.number);

  assert.equal(paidResponse.status, 200);
  assert.equal(paidResponse.body.square.status, "paid");
  assert.deepEqual(paidResponse.body.squares.map((square) => square.number), [21, 22]);
  assert.equal(paidResponse.body.totalAmount, 10);
  assert.equal(paidResponse.body.paidConfirmationEmailSent, false);
  assert.equal(paidResponse.body.paidConfirmationEmailStatus, "skipped");
  assert.equal(releaseResponse.status, 200);
  assert.equal(releaseResponse.body.square.status, "available");
  assert.equal(paidSquare.status, "paid");
  assert.equal(groupedPaidSquare.status, "paid");
  assert.equal(releasedSquare.status, "available");
  assert.equal(adminResponse.body.totals.paid, 2);
  assert.equal(adminResponse.body.totals.reserved, 0);
  assert.deepEqual(publicPaidSquares, [21, 22]);
});

test("mark paid sends and tracks one confirmation email without duplicates", async (t) => {
  const requests = [];
  t.mock.method(global, "fetch", async (url, options) => {
    requests.push({
      url,
      body: JSON.parse(options.body),
    });
    return {
      ok: true,
      text: async () => "",
    };
  });
  const { store, port } = await createFixture(t, {
    resendApiKey: "test-key",
    fromEmail: "Fundraiser <fundraiser@example.com>",
  });

  await store.reserveSquares({
    numbers: [31, 32],
    name: "Supporter",
    email: "supporter@example.com",
  });

  const paidResponse = await requestJson(port, "/api/admin/squares/31/paid", "POST");
  const duplicateResponse = await requestJson(port, "/api/admin/squares/32/paid", "POST");
  const adminResponse = await requestJson(port, "/api/admin/squares?status=paid");

  assert.equal(paidResponse.status, 200);
  assert.equal(paidResponse.body.paidConfirmationEmailSent, true);
  assert.equal(paidResponse.body.paidConfirmationEmailStatus, "sent");
  assert.deepEqual(paidResponse.body.squares.map((square) => square.number), [31, 32]);
  assert.equal(duplicateResponse.status, 404);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.to[0], "supporter@example.com");
  assert.equal(requests[0].body.subject, "Your square is confirmed \u2014 thank you");
  assert.match(requests[0].body.text, /Confirmed square\(s\): 31, 32/);
  assert.match(requests[0].body.text, /Amount received: \u00a310/);
  assert.ok(adminResponse.body.squares.every((square) => square.paidConfirmationEmailSentAt));
});

test("mark paid keeps the reservation paid when confirmation email delivery fails", async (t) => {
  const errors = [];
  t.mock.method(global, "fetch", async () => ({
    ok: false,
    status: 500,
    text: async () => "email provider unavailable",
  }));
  t.mock.method(console, "error", (message) => errors.push(message));
  const { store, port } = await createFixture(t, {
    resendApiKey: "test-key",
    fromEmail: "Fundraiser <fundraiser@example.com>",
  });

  await store.reserveSquares({
    numbers: [41],
    name: "Supporter",
    email: "supporter@example.com",
  });

  const paidResponse = await requestJson(port, "/api/admin/squares/41/paid", "POST");
  const duplicateResponse = await requestJson(port, "/api/admin/squares/41/paid", "POST");
  const adminResponse = await requestJson(port, "/api/admin/squares?status=paid");

  assert.equal(paidResponse.status, 200);
  assert.equal(paidResponse.body.square.status, "paid");
  assert.equal(paidResponse.body.paidConfirmationEmailSent, false);
  assert.equal(paidResponse.body.paidConfirmationEmailStatus, "failed");
  assert.equal(duplicateResponse.status, 404);
  assert.equal(adminResponse.body.squares[0].status, "paid");
  assert.equal(adminResponse.body.squares[0].paidConfirmationEmailSentAt, null);
  assert.match(errors.join("\n"), /Paid confirmation email failed/);
});

test("mark paid clearly skips unsupported Resend onboarding recipients", async (t) => {
  const warnings = [];
  let requestCount = 0;
  t.mock.method(global, "fetch", async () => {
    requestCount += 1;
    throw new Error("fetch should not be called");
  });
  t.mock.method(console, "warn", (message) => warnings.push(message));
  const { store, port } = await createFixture(t, {
    resendApiKey: "test-key",
    fromEmail: "Amir Fundraiser <onboarding@resend.dev>",
    adminNotifyEmail: "amir@example.com",
  });

  await store.reserveSquares({
    numbers: [51],
    name: "Supporter",
    email: "supporter@example.com",
  });

  const paidResponse = await requestJson(port, "/api/admin/squares/51/paid", "POST");

  assert.equal(paidResponse.status, 200);
  assert.equal(paidResponse.body.square.status, "paid");
  assert.equal(paidResponse.body.paidConfirmationEmailSent, false);
  assert.equal(paidResponse.body.paidConfirmationEmailStatus, "skipped");
  assert.equal(requestCount, 0);
  assert.match(warnings.join("\n"), /onboarding@resend\.dev/);
});

test("legacy multi-square reservations are grouped when local data is loaded", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hundred-square-legacy-"));
  const filePath = path.join(tempDir, "reservations.json");
  const reservedAt = "2026-06-05T14:30:00.000Z";

  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  await fs.writeFile(filePath, JSON.stringify({
    squares: [61, 62].map((number) => ({
      id: number,
      number,
      status: "reserved",
      name: "Legacy Supporter",
      email: "legacy@example.com",
      reserved_at: reservedAt,
      created_at: reservedAt,
      updated_at: reservedAt,
    })),
  }), "utf8");

  const store = await createLocalFileStore(filePath);
  const paidResult = await store.markSquarePaid(61);

  assert.deepEqual(paidResult.squares.map((square) => square.number), [61, 62]);
  assert.equal(paidResult.totalAmount, 10);
});
