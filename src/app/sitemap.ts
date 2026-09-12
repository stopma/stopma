import type { MetadataRoute } from "next";
import { configured, db } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (process.env.SITE_LAUNCH_READY !== "true") return [];
  const { data } = configured()
    ? await db()
        .from("stops")
        .select("id,updated_at")
        .eq("status", "published")
        .limit(10000)
    : { data: [] };
  return [
    ...["", "/rules", "/privacy"].map((path) => ({ url: base + path })),
    ...(data || []).map((s) => ({
      url: base + "/stop/" + s.id,
      lastModified: s.updated_at,
    })),
  ];
}
