const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeApiPath, normalizeEvent } = require("../src/netlify-handler");

test("normalizeApiPath preserves normal API paths", () => {
  assert.equal(normalizeApiPath("/api/health"), "/api/health");
  assert.equal(normalizeApiPath("/api/reservations"), "/api/reservations");
});

test("normalizeApiPath maps Netlify function paths back to API routes", () => {
  assert.equal(normalizeApiPath("/.netlify/functions/api"), "/api");
  assert.equal(normalizeApiPath("/.netlify/functions/api/health"), "/api/health");
  assert.equal(normalizeApiPath("/.netlify/functions/api/admin/squares"), "/api/admin/squares");
});

test("normalizeApiPath maps function-local splats to API routes", () => {
  assert.equal(normalizeApiPath("/health"), "/api/health");
  assert.equal(normalizeApiPath("/reservations"), "/api/reservations");
});

test("normalizeEvent keeps query strings while normalizing rawUrl", () => {
  const event = normalizeEvent({
    path: "/.netlify/functions/api/admin/squares",
    rawUrl: "https://example.netlify.app/.netlify/functions/api/admin/squares?status=reserved",
  });

  assert.equal(event.path, "/api/admin/squares");
  assert.equal(event.rawPath, "/api/admin/squares");
  assert.equal(event.rawUrl, "https://example.netlify.app/api/admin/squares?status=reserved");
});
