// Requires explicit owner authorization for a temporary admin test session.
// Generates a one-use sign-in token through Supabase Admin API; sends no email.
// Never logs tokens, cookies, passwords or keys; signs out only its own session.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
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
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => jar.set(name, value)),
    },
  },
);
const tag = randomUUID().replace(/[0-9-]/g, "x");
let id;
const errors = [];
async function checked(promise) {
  const result = await promise;
  assert.ifError(result.error);
  return result.data;
}
async function moderate(text, status) {
  const cookie = Array.from(
    jar,
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  ).join("; ");
  const response = await fetch(base + "/api/moderate", {
    method: "POST",
    headers: {
      origin: new URL(base).origin,
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ id, text, status, category: "environment" }),
  });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
}
try {
  const { user } = await checked(
    db.auth.admin.getUserById(process.env.ADMIN_USER_ID),
  );
  assert.ok(user.email_confirmed_at);
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
  const cookie = Array.from(
    jar,
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  ).join("; ");
  const text = "اختبار إدارة مؤقت: رمي النفايات " + tag;
  const stop = await checked(
    db
      .from("stops")
      .insert({ text, category: "environment" })
      .select()
      .single(),
  );
  id = stop.id;
  const page = await fetch(base + "/admin", { headers: { cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(
    html.includes(tag),
    "Pending post must appear in private dashboard",
  );
  for (const label of ["موافقة ونشر", "رفض", "حفظ التعديل"])
    assert.ok(html.includes(label), label);
  const edited = "اختبار إدارة مؤقت: وقف رمي النفايات " + tag;
  await moderate(edited, "pending");
  let saved = await checked(
    db.from("stops").select("text,status").eq("id", id).single(),
  );
  assert.equal(saved.text, edited);
  assert.equal(saved.status, "pending");
  await moderate(edited, "published");
  assert.equal((await fetch(base + "/stop/" + id)).status, 200);
  await moderate(edited, "rejected");
  assert.equal((await fetch(base + "/stop/" + id)).status, 404);
  saved = await checked(
    db.from("stops").select("status").eq("id", id).single(),
  );
  assert.equal(saved.status, "rejected");
  const denied = await fetch(base + "/api/moderate", {
    method: "POST",
    headers: {
      origin: new URL(base).origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id,
      text: edited,
      status: "published",
      category: "environment",
    }),
  });
  assert.equal(denied.status, 401);
  console.log(
    "Admin HTTP passed: verified owner session, private Pending list, Edit, Approve, Reject, detail visibility, unauthorized access denied.",
  );
} finally {
  if (id) {
    for (const table of ["moderation_log", "stops"]) {
      const { error } = await db
        .from(table)
        .delete()
        .eq(table === "stops" ? "id" : "stop_id", id);
      if (error) errors.push(table + ": " + error.message);
    }
  }
  const { error } = await auth.auth.signOut({ scope: "local" });
  if (error) errors.push("test signout: " + error.message);
  if (errors.length) throw new Error(errors.join("; "));
  console.log(
    "Disposable test records removed; only the temporary test session signed out.",
  );
}
