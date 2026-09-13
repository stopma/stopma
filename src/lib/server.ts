import {
  PAGE_SIZE,
  byPublication,
  type PublicationRow,
  type StopSort,
} from "./stop-list";
import "server-only";
import { allowedOrigin } from "./origin";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.VISITOR_SECRET &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
export function db() {
  if (!configured()) throw new Error("unconfigured");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function auth() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server render cannot write; login refreshes in route. */
          }
        },
      },
    },
  );
}
export async function admin() {
  if (!configured() || !process.env.ADMIN_USER_ID) return null;
  const client = await auth();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id === process.env.ADMIN_USER_ID ? user : null;
}
export function hash(value: string) {
  if ((process.env.VISITOR_SECRET?.length ?? 0) < 32)
    throw new Error("invalid_secret");
  return createHmac("sha256", process.env.VISITOR_SECRET!)
    .update(value)
    .digest("hex");
}
export async function visitor() {
  const jar = await cookies();
  const raw = jar.get("stop_visitor")?.value;
  if (raw) {
    const [id, sig] = raw.split(".");
    const expected = hash(id);
    if (
      sig?.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return { id: hash("visitor:" + id), fresh: false };
  }
  const id = randomUUID();
  jar.set("stop_visitor", `${id}.${hash(id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 31536000,
  });
  return { id: hash("visitor:" + id), fresh: true };
}
export function sameOrigin(req: NextRequest) {
  return allowedOrigin(
    req.headers.get("origin"),
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    process.env.ALLOWED_ORIGINS,
  );
}
export async function limit(
  req: NextRequest,
  scope: string,
  maximum: number,
  seconds: number,
  identity?: string,
) {
  // Trust Vercel's overwritten edge header only on Vercel; never arbitrary forwarded headers.
  const ip =
    process.env.VERCEL === "1"
      ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
      : "local";
  const key = hash(`${scope}:${identity || ip}`);
  const { data, error } = await db().rpc("take_rate", {
    p_key: key,
    p_limit: maximum,
    p_seconds: seconds,
  });
  if (error) throw error;
  return data === true;
}
export async function readStops(requestedPage = 1, sort: StopSort = "votes") {
  if (!configured()) return null;
  const client = db();
  const { count, error: countError } = await client
    .from("stops")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  if (countError) return null;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  let query = client.from("stops").select("*").eq("status", "published");
  if (sort === "newest") {
    // There is no published_at column. Read the first recorded approval;
    // old approvals removed by retention fall back to submission time.
    const index: PublicationRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from("stops")
        .select("id,created_at,moderation_log(created_at)")
        .eq("status", "published")
        .eq("moderation_log.action", "published")
        .order("id")
        .order("created_at", {
          referencedTable: "moderation_log",
          ascending: true,
        })
        .limit(1, { referencedTable: "moderation_log" })
        .range(offset, offset + 999);
      if (error) return null;
      index.push(...data);
      if (data.length < 1000) break;
    }
    const ids = index
      .sort(byPublication)
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((row) => row.id);
    if (!ids.length) return { stops: [], page, totalPages };
    const { data, error } = await query.in("id", ids);
    if (error) return null;
    return {
      stops: data.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)),
      page,
      totalPages,
    };
  }
  const { data, error } = await query
    .order("votes_count", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return error ? null : { stops: data, page, totalPages };
}
export async function categoryLabels() {
  if (!configured()) return {};
  const { data } = await db().from("categories").select("id,label");
  return Object.fromEntries((data || []).map((c) => [c.id, c.label]));
}
