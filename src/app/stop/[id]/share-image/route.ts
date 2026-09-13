import { z } from "zod";
import { configured, db } from "@/lib/server";
import { renderStopShareImage } from "@/lib/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  if (!configured()) return new Response("Unavailable", { status: 503 });
  const { data, error } = await db()
    .from("stops")
    .select("text")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) return new Response("Unavailable", { status: 503 });
  if (!data) return new Response("Not found", { status: 404 });
  const png = await renderStopShareImage(data.text);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
