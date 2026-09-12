// Explicit live integration test. Uses unique disposable records and removes only its own data.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const anonymous = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const tag = "integration-" + randomUUID();
let id;
try {
  const { data: stop, error } = await db
    .from("stops")
    .insert({
      text: "اختبار تقني مؤقت: بغيت يوقف رمي النفايات فالطريق.",
      category: "environment",
    })
    .select()
    .single();
  assert.ifError(error);
  id = stop.id;
  assert.equal(stop.status, "pending");
  const { error: hidden } = await db.rpc("cast_vote", {
    p_stop: id,
    p_visitor: tag,
  });
  assert.ok(hidden);
  const { error: moderated } = await db.rpc("moderate_stop", {
    p_id: id,
    p_text: stop.text,
    p_category: "environment",
    p_status: "published",
    p_admin: "11111111-1111-4111-8111-111111111111",
  });
  assert.ifError(moderated);
  const votes = await Promise.all(
    Array.from({ length: 8 }, () =>
      db.rpc("cast_vote", { p_stop: id, p_visitor: tag }),
    ),
  );
  for (const v of votes) assert.ifError(v.error);
  assert.equal(votes.filter((v) => !v.data.already).length, 1);
  assert.ok(votes.every((v) => v.data.count === 1));
  const { error: visit } = await db.rpc("record_visit", { p_visitor: tag });
  assert.ifError(visit);
  await db.rpc("record_visit", { p_visitor: tag });
  const { count } = await db
    .from("daily_visits")
    .select("*", { count: "exact", head: true })
    .eq("identifier", tag);
  assert.equal(count, 1);
  const { data: stats, error: statsError } = await db.rpc("site_stats");
  assert.ifError(statsError);
  assert.ok(stats.total >= 1 && stats.online >= 1);
  const { error: denied } = await anonymous.from("stops").select("*");
  assert.ok(denied);
  const { error: rpcDenied } = await anonymous.rpc("cast_vote", {
    p_stop: id,
    p_visitor: tag + "-bad",
  });
  assert.ok(rpcDenied);
  const { data: allowed } = await db.rpc("take_rate", {
    p_key: tag,
    p_limit: 1,
    p_seconds: 60,
  });
  assert.equal(allowed, true);
  const { data: blocked } = await db.rpc("take_rate", {
    p_key: tag,
    p_limit: 1,
    p_seconds: 60,
  });
  assert.equal(blocked, false);
  console.log(
    "Live Supabase passed: moderation, concurrent unique voting, presence, daily visit deduplication, RLS and rate limiting.",
  );
} finally {
  if (id) {
    await db.from("moderation_log").delete().eq("stop_id", id);
    await db.from("stops").delete().eq("id", id);
  }
  await db.from("visitors").delete().eq("identifier", tag);
  await db.from("rate_limits").delete().eq("key", tag);
  console.log("Removed only the records created by this integration test.");
}
