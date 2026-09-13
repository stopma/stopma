import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const fixture = process.env.LIST_FIXTURE === "1";
const base = fixture ? "http://127.0.0.1:3004" : process.env.TEST_BASE_URL;
assert.ok(base);
let server, app, browser;
let rows;
try {
  if (fixture) {
    rows = Array.from({ length: 34 }, (_, i) => ({
      id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      text: `وقف رمي النفايات فالطريق وحافظ على نظافة الحي ${i + 1}`,
      category: "environment",
      status: i < 31 ? "published" : "pending",
      votes_count: i % 7,
      created_at: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      updated_at: new Date().toISOString(),
      moderation_log: [
        { created_at: new Date(Date.UTC(2026, 2, 34 - i)).toISOString() },
      ],
    }));
    server = createServer((req, res) => {
      const u = new URL(req.url, "http://localhost");
      res.setHeader("content-type", "application/json");
      if (u.pathname.endsWith("/categories"))
        return res.end(
          JSON.stringify([{ id: "environment", label: "البيئة" }]),
        );
      if (!u.pathname.endsWith("/stops")) {
        res.statusCode = 404;
        return res.end("{}");
      }
      let data = rows.filter((r) => r.status === "published");
      const ids = u.searchParams.get("id");
      if (ids?.startsWith("in.")) data = data.filter((r) => ids.includes(r.id));
      const order = u.searchParams.get("order") || "";
      if (order.includes("votes_count"))
        data.sort(
          (a, b) =>
            b.votes_count - a.votes_count ||
            b.created_at.localeCompare(a.created_at) ||
            b.id.localeCompare(a.id),
        );
      else data.sort((a, b) => a.id.localeCompare(b.id));
      const total = data.length,
        offset = Number(u.searchParams.get("offset") || 0),
        limit = Number(u.searchParams.get("limit") || 1000);
      data = data.slice(offset, offset + limit);
      res.setHeader(
        "content-range",
        `${offset}-${offset + data.length - 1}/${total}`,
      );
      res.end(req.method === "HEAD" ? "" : JSON.stringify(data));
    });
    await new Promise((r) => server.listen(54440, "127.0.0.1", r));
    app = spawn(
      process.execPath,
      [
        "--require",
        "./tests/list-fixture-fetch.cjs",
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3004",
      ],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54440",
          SUPABASE_SERVICE_ROLE_KEY: "fixture",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture",
          VISITOR_SECRET: "local-test-only-".repeat(4),
          SITE_LAUNCH_READY: "false",
          NEXT_PUBLIC_SITE_URL: base,
        },
        stdio: "ignore",
      },
    );
    for (let attempt = 0; ; attempt++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      assert.ok(attempt < 60, "Test server starts");
      await new Promise((r) => setTimeout(r, 500));
    }
  } else {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const { data, error } = await db
      .from("stops")
      .select("id,votes_count,created_at,moderation_log(created_at)")
      .eq("status", "published")
      .eq("moderation_log.action", "published");
    assert.ifError(error);
    rows = data;
  }
  rows = rows.filter((r) => !r.status || r.status === "published");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    await context.route("**/api/presence", (r) =>
      r.fulfill({ json: { total: 0, online: 0 } }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const sort of ["votes", "newest"]) {
      const date = (r) =>
        r.moderation_log.length
          ? Math.min(...r.moderation_log.map((l) => Date.parse(l.created_at)))
          : Date.parse(r.created_at);
      const expected = [...rows].sort(
        (a, b) =>
          (sort === "votes"
            ? b.votes_count - a.votes_count
            : date(b) - date(a)) ||
          b.created_at.localeCompare(a.created_at) ||
          b.id.localeCompare(a.id),
      );
      await page.goto(base);
      await page
        .getByRole("navigation", { name: "ترتيب المنشورات" })
        .getByRole("link", {
          name: sort === "votes" ? "الأكثر تصويتاً" : "الأحدث",
          exact: true,
        })
        .click();
      await page.waitForURL(base + (sort === "votes" ? "/" : "/?sort=newest"));
      for (
        let number = 1;
        number <= Math.ceil(expected.length / 10);
        number++
      ) {
        const nav = page.getByRole("navigation", { name: "صفحات المنشورات" });
        await nav
          .locator('[aria-current="page"]')
          .filter({ hasText: String(number) })
          .waitFor();
        const ids = await page
          .locator(".stop-card .stop-text")
          .evaluateAll((nodes) =>
            nodes.map((n) => n.getAttribute("href").split("/").at(-1)),
          );
        assert.deepEqual(
          ids,
          expected.slice((number - 1) * 10, number * 10).map((r) => r.id),
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "No overflow",
        );
        if (number < Math.ceil(expected.length / 10)) {
          await nav.getByRole("link", { name: "التالي", exact: true }).click();
          await page.waitForURL(
            (url) => url.searchParams.get("page") === String(number + 1),
          );
          assert.equal(
            new URL(page.url()).searchParams.get("sort"),
            sort === "newest" ? "newest" : null,
          );
        }
      }
      if (expected.length > 10) {
        const nav = page.getByRole("navigation", { name: "صفحات المنشورات" });
        await nav.getByRole("link", { name: "الصفحة 2", exact: true }).click();
        await page.waitForURL((url) => url.searchParams.get("page") === "2");
        await nav.getByRole("link", { name: "السابق", exact: true }).click();
        await page.waitForURL((url) => !url.searchParams.has("page"));
      }
      console.log(
        "Passed",
        fixture ? "fixture" : "production",
        width,
        sort,
        expected.length,
        "STOPs: page sizes, order, next/previous/numbers, no overflow.",
      );
    }
    await page.goto(base + "/?page=999999&sort=newest");
    assert.equal(
      await page.locator('.stop-pagination [aria-current="page"]').innerText(),
      String(Math.max(1, Math.ceil(rows.length / 10))),
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close();
  app?.kill();
  if (server) await new Promise((r) => server.close(r));
}
