import Link from "next/link";
import { StopPagination } from "@/components/stop-pagination";
import { listUrl } from "@/lib/stop-list";
import { Submit, Presence } from "@/components/public";
import { StopCard } from "@/components/stop-card";
import { readStops, categoryLabels, configured } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; sort?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = params.page;
  const sort = params.sort === "newest" ? "newest" : "votes";
  const requestedPage =
    typeof query === "string" && /^[1-9]\d{0,5}$/.test(query)
      ? Number(query)
      : 1;
  const [result, labels] = await Promise.all([
    readStops(requestedPage, sort),
    categoryLabels(),
  ]);
  const stops = result?.stops;
  const enabled = configured() && process.env.SITE_LAUNCH_READY === "true";
  return (
    <>
      <section className="hero">
        <h1>
          شنو بغيتي يوقف
          <br />
          <em>فالمغرب؟</em>
        </h1>
        <p className="intro">كتب عادة، تصرف أو ظاهرة بغيتيها توقف.</p>
        <Submit enabled={enabled} />
      </section>
      <section className="popular">
        <nav className="stop-sort" aria-label="ترتيب المنشورات">
          <Link
            prefetch={false}
            href={listUrl(1, "votes")}
            aria-current={sort === "votes" ? "true" : undefined}
          >
            الأكثر تصويتاً
          </Link>
          <Link
            prefetch={false}
            href={listUrl(1, "newest")}
            aria-current={sort === "newest" ? "true" : undefined}
          >
            الأحدث
          </Link>
        </nav>
        {stops?.length ? (
          <div className="cards">
            {stops.map((stop) => (
              <StopCard key={stop.id} stop={stop} labels={labels} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-mark" aria-hidden="true">
              ✋
            </span>
            <h3>{stops ? "كل تغيير كيبدا بكلمة." : "كنوجدو مساحة لصوتك."}</h3>
            <p>
              {stops && requestedPage > 1
                ? "ما كايناش منشورات أخرى فهاد الصفحة."
                : stops
                  ? "ما كاين حتى STOP منشور دابا. كتب أول فكرة، وغادي تظهر من بعد المراجعة."
                  : "المنشورات غادي تبان هنا منين تتفتح المنصة."}
            </p>
          </div>
        )}
        {result && (
          <StopPagination
            page={result.page}
            total={result.totalPages}
            sort={sort}
          />
        )}
      </section>
      <Presence enabled={enabled} />
    </>
  );
}
