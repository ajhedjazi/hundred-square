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

test("admin API can mark a reserved square paid and release an unpaid reservation", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hundred-square-admin-"));
  const store = await createLocalFileStore(path.join(tempDir, "reservations.json"));
  const app = createApp({
    store,
    config: {
      adminPassword: "test-password",
      fundraiserUrl: "https://example.com/fundraiser",
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

  await store.reserveSquares({
    numbers: [21, 22],
    name: "Supporter",
    email: "supporter@example.com",
  });

  const port = server.address().port;
  const paidResponse = await requestJson(port, "/api/admin/squares/21/paid", "POST");
  const releaseResponse = await requestJson(port, "/api/admin/squares/22/release", "POST");
  const adminResponse = await requestJson(port, "/api/admin/squares");
  const paidSquare = adminResponse.body.squares.find((square) => square.number === 21);
  const releasedSquare = adminResponse.body.squares.find((square) => square.number === 22);

  assert.equal(paidResponse.status, 200);
  assert.equal(paidResponse.body.square.status, "paid");
  assert.equal(releaseResponse.status, 200);
  assert.equal(releaseResponse.body.square.status, "available");
  assert.equal(paidSquare.status, "paid");
  assert.equal(releasedSquare.status, "available");
  assert.equal(adminResponse.body.totals.paid, 1);
  assert.equal(adminResponse.body.totals.reserved, 0);
});
