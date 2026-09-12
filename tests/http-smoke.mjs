// Run against an unconfigured local build: node tests/http-smoke.mjs
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
for (const path of [
  "/",
  "/admin",
  "/privacy",
  "/rules",
  "/robots.txt",
  "/sitemap.xml",
]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}
const missing = await fetch(base + "/stop/not-a-uuid");
assert.equal(missing.status, 404);
const csrf = await fetch(base + "/api/submit", {
  method: "POST",
  headers: {
    origin: "https://evil.example",
    "content-type": "application/json",
  },
  body: JSON.stringify({ text: "بغيت يوقف رمي الزبل فالزنقة." }),
});
assert.equal(csrf.status, 403);
const closed = await fetch(base + "/api/submit", {
  method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ text: "بغيت يوقف رمي الزبل فالزنقة." }),
});
assert.equal(closed.status, 503);
console.log(
  "HTTP smoke passed: public routes, private setup state, 404, CSRF, unavailable service.",
);
