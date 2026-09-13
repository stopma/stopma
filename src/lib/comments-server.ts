import "server-only";
import { createClient } from "@supabase/supabase-js";
import { configured, hash } from "./server";
import { cookies } from "next/headers";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { PublicComment } from "./comments";

export async function commentIdentity() {
  const jar = await cookies();
  const raw = jar.get("stop_commenter")?.value;
  if (raw) {
    const [id, sig] = raw.split(".");
    const expected = hash("comment-cookie:" + id);
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      ) &&
      /^[0-9a-f]{64}$/.test(sig || "") &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return id;
  }
  const id = randomUUID();
  jar.set("stop_commenter", `${id}.${hash("comment-cookie:" + id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 31536000,
  });
  return id;
}

export async function readComments(
  stopId: string,
): Promise<PublicComment[] | null> {
  if (!configured()) return null;
  // Use the public key so RLS also protects this server-rendered list.
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const comments: PublicComment[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("comments")
      .select("id,content,display_name,commenter_code,created_at")
      .eq("stop_id", stopId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 999);
    if (error) return null;
    comments.push(...data);
    if (data.length < 1000) return comments;
  }
}
