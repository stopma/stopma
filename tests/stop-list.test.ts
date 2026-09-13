import { test } from "node:test";
import assert from "node:assert/strict";
import { byPublication, listUrl, pageNumbers } from "../src/lib/stop-list";
test("publication order uses approval rather than submission or editing", () => {
  const rows = [
    {
      id: "a",
      created_at: "2026-01-01",
      moderation_log: [
        { created_at: "2026-02-02" },
        { created_at: "2026-03-01" },
      ],
    },
    {
      id: "b",
      created_at: "2026-01-02",
      moderation_log: [{ created_at: "2026-02-03" }],
    },
    { id: "c", created_at: "2025-01-01", moderation_log: [] },
  ];
  assert.deepEqual(
    rows.sort(byPublication).map((r) => r.id),
    ["b", "a", "c"],
  );
});
test("pagination preserves sorting and bounds the number of links", () => {
  assert.equal(listUrl(2, "newest"), "/?sort=newest&page=2");
  assert.equal(listUrl(1, "votes"), "/");
  assert.deepEqual(pageNumbers(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(50, 100), [1, "gap", 49, 50, 51, "gap", 100]);
});
