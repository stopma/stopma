import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContent, inferCategory } from "../src/lib/content";
test("accepts behavior criticism and normalizes whitespace", () => {
  assert.equal(
    validateContent("  بغيت يوقف   رمي الزبل فالزنقة. ").text,
    "بغيت يوقف رمي الزبل فالزنقة.",
  );
});
test("rejects short and oversized submissions", () => {
  assert.ok(validateContent("سلام").error);
  assert.ok(validateContent("ا".repeat(401)).error);
});
test("rejects contact details, links, script markup and obvious targeting", () => {
  for (const text of [
    "بغيت يوقف هاد السيد محمد",
    "بغيت يوقف هذا 0612345678",
    "بغيت يوقف هذا ٠٦١٢٣٤٥٦٧٨",
    "بغيت يوقف هذا test@example.com",
    "بغيت يوقف هذا https://example.com",
    "بغيت يوقف <script>alert(1)</script>",
    "بغيت يوقف نقتلك دابا",
  ])
    assert.ok(validateContent(text).error, text);
});
test("detects categories without adding another public input", () => {
  assert.equal(inferCategory("رمي النفايات"), "environment");
  assert.equal(inferCategory("السياقة الخطيرة"), "road");
  assert.equal(inferCategory("الرشوة فالإدارة"), "administration");
});
