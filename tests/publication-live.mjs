// Live regression: requires owner-authorized temporary admin session.
// Creates and removes only its own test STOP. Never changes existing STOPs.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.TEST_BASE_URL;
assert.ok(base, "Set TEST_BASE_URL explicitly");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const jar = new Map();
const auth = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => jar.set(name, value)),
    },
  },
);
async function checked(request) {
  const result = await request;
  assert.ifError(result.error);
  return result.data;
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
let id;
try {
  const { user } = await checked(
    db.auth.admin.getUserById(process.env.ADMIN_USER_ID),
  );
  const link = await checked(
    db.auth.admin.generateLink({ type: "magiclink", email: user.email }),
  );
  const session = await checked(
    auth.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    }),
  );
  assert.equal(session.user.id, process.env.ADMIN_USER_ID);
  const context = await browser.newContext();
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      url: base,
      httpOnly: true,
      secure: base.startsWith("https:"),
      sameSite: "Lax",
    })),
  );
  const adminPage = await context.newPage();
  const text =
    "اختبار تقني مؤقت: وقف رمي النفايات فالطريق " +
    randomUUID().replace(/[0-9-]/g, "x");
  const stop = await checked(
    db
      .from("stops")
      .insert({ text, category: "environment", status: "pending" })
      .select("id,status")
      .single(),
  );
  id = stop.id;
  assert.equal(stop.status, "pending");
  assert.equal((await fetch(base + "/stop/" + id)).status, 404);
  await adminPage.goto(base + "/admin");
  const card = adminPage
    .locator(".moderation-item")
    .filter({ has: adminPage.locator("textarea", { hasText: text }) });
  await card.waitFor();
  const approval = adminPage.waitForResponse(
    (r) => r.url().endsWith("/api/moderate") && r.request().method() === "POST",
  );
  await card.getByRole("button", { name: "موافقة ونشر" }).click();
  assert.equal((await approval).status(), 200);
  assert.equal(
    (await checked(db.from("stops").select("status").eq("id", id).single()))
      .status,
    "published",
  );
  assert.equal((await fetch(base + "/stop/" + id)).status, 200);
  const published = await checked(
    db
      .from("stops")
      .select("id")
      .eq("status", "published")
      .order("votes_count", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  );
  for (const width of [1440, 390]) {
    const publicContext = await browser.newContext({
      viewport: { width, height: 900 },
    });
    // Prevent the test browser from contributing visitor analytics.
    await publicContext.route("**/api/presence", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"total":0,"online":0}',
      }),
    );
    const page = await publicContext.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const seen = [];
    await page.goto(base);
    for (let number = 1; ; number++) {
      await page.locator(".stop-card").first().waitFor();
      const ids = await page
        .locator(".stop-card .stop-text")
        .evaluateAll((links) =>
          links.map((a) => a.getAttribute("href").split("/").at(-1)),
        );
      assert.ok(ids.length <= 10);
      seen.push(...ids);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No horizontal overflow",
      );
      const next = page.getByRole("link", {
        name: "التالي",
        exact: true,
      });
      if (!(await next.count())) break;
      assert.ok(number < 100, "Pagination must terminate");
      await next.click();
      await page.waitForURL(base + "/?page=" + (number + 1));
    }
    assert.deepEqual(
      seen,
      published.map((s) => s.id),
      "Every published STOP is reachable in vote order",
    );
    assert.ok(seen.includes(id), "Approved test STOP appears without redeploy");
    assert.deepEqual(errors, []);
    console.log(
      "Passed",
      width,
      "px: Admin approval immediately visible; all",
      seen.length,
      "published STOPs reachable; no overflow or browser errors.",
    );
    await publicContext.close();
  }
} finally {
  await browser.close();
  if (id) {
    await checked(db.from("moderation_log").delete().eq("stop_id", id));
    await checked(db.from("stops").delete().eq("id", id));
  }
  const { error } = await auth.auth.signOut({ scope: "local" });
  assert.ifError(error);
  console.log(
    "Removed only the disposable test record; signed out temporary session.",
  );
}
