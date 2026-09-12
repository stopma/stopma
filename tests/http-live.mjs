// Run only against a local test server with SITE_LAUNCH_READY=true, sharing configured Supabase.
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const base = "http://localhost:3001";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const token = randomUUID().replaceAll("-", "").replace(/[0-9]/g, "x");
let cookie = "",
  id,
  identifier;
async function call(action, body) {
  const response = await fetch(base + "/api/" + action, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const set = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("stop_visitor="));
  if (set) cookie = set.split(";")[0];
  return { status: response.status, data: await response.json() };
}
try {
  const denied = await call("moderate", {});
  assert.equal(denied.status, 401);
  const submitted = await call("submit", {
    text: "اختبار مؤقت لسلوك رمي النفايات " + token,
    website: "",
  });
  assert.equal(submitted.status, 201);
  const { data: stop, error } = await db
    .from("stops")
    .select("*")
    .like("text", "%" + token)
    .single();
  assert.ifError(error);
  id = stop.id;
  assert.equal(stop.status, "pending");
  const hidden = await fetch(base + "/stop/" + id);
  assert.equal(hidden.status, 404);
  await db.rpc("moderate_stop", {
    p_id: id,
    p_text: stop.text,
    p_category: "environment",
    p_status: "published",
    p_admin: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal((await fetch(base + "/stop/" + id)).status, 200);
  const vote = await call("vote", { id });
  assert.equal(vote.status, 200);
  assert.equal(vote.data.count, 1);
  assert.equal(vote.data.already, false);
  const twice = await call("vote", { id });
  assert.equal(twice.data.count, 1);
  assert.equal(twice.data.already, true);
  const presence = await call("presence", {});
  assert.equal(presence.status, 200);
  assert.ok(presence.data.online >= 1);
  const raw = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
  identifier = createHmac("sha256", process.env.VISITOR_SECRET)
    .update("visitor:" + raw)
    .digest("hex");
  const { count } = await db
    .from("visitors")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier);
  assert.equal(count, 1);
  const invalid = await call("submit", { text: "اتصل بنا على 0612345678" });
  assert.equal(invalid.status, 400);
  console.log(
    "Live HTTP passed: pending submission, private moderation protection, hidden pending details, published details, voting deduplication, heartbeat, content validation.",
  );
} finally {
  if (id) {
    await db.from("moderation_log").delete().eq("stop_id", id);
    await db.from("stops").delete().eq("id", id);
  }
  if (identifier)
    await db.from("visitors").delete().eq("identifier", identifier);
  console.log("Test post and test visitor removed.");
}
