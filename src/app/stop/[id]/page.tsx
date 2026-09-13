import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { db, configured, categoryLabels } from "@/lib/server";
import { Vote, Presence } from "@/components/public";
import { StopCard } from "@/components/stop-card";
import { categories } from "@/lib/content";
export const dynamic = "force-dynamic";
async function getStop(id: string) {
  if (!configured() || !z.uuid().safeParse(id).success) return null;
  const { data } = await db()
    .from("stops")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return data;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stop = await getStop(id);
  if (!stop) notFound();
  const url = new URL(
    "/stop/" + id,
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ).href;
  const image = new URL("/opengraph-image", url).href;
  return {
    title: stop?.text?.slice(0, 70) || "STOP غير موجود",
    description: stop?.text,
    alternates: { canonical: "/stop/" + id },
    openGraph: {
      type: "article",
      locale: "ar_MA",
      siteName: "STOP.ma",
      url,
      title: stop.text,
      description: stop.text,
      images: [{ url: image, width: 1200, height: 630, alt: "STOP.ma" }],
    },
    twitter: {
      card: "summary_large_image",
      title: stop.text,
      description: stop.text,
      images: [image],
    },
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stop = await getStop(id);
  if (!stop) notFound();
  const [{ data: similar }, labels] = await Promise.all([
    db()
      .from("stops")
      .select("*")
      .eq("status", "published")
      .eq("category", stop.category)
      .neq("id", id)
      .order("votes_count", { ascending: false })
      .limit(3),
    categoryLabels(),
  ]);
  return (
    <div className="detail">
      <Link className="back" href="/">
        → رجوع للرئيسية
      </Link>
      <article className="detail-card">
        <span className="category">
          {labels[stop.category] || categories[stop.category]}
        </span>
        <h1>{stop.text}</h1>
        <Vote
          id={id}
          count={stop.votes_count}
          text={stop.text}
          url={
            new URL(
              "/stop/" + id,
              process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            ).href
          }
        />
      </article>
      {!!similar?.length && (
        <section>
          <h2>STOP من نفس الفئة</h2>
          <div className="cards">
            {similar.map((s) => (
              <StopCard key={s.id} stop={s} labels={labels} />
            ))}
          </div>
        </section>
      )}
      <Presence enabled={process.env.SITE_LAUNCH_READY === "true"} />
    </div>
  );
}
