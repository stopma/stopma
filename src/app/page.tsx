import Link from "next/link";
import { Submit, Presence } from "@/components/public";
import { StopCard } from "@/components/stop-card";
import { readStops, categoryLabels, configured } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = (await searchParams).page;
  const requestedPage =
    typeof query === "string" && /^[1-9]\d{0,5}$/.test(query)
      ? Number(query)
      : 1;
  const [stops, labels] = await Promise.all([
    readStops(requestedPage),
    categoryLabels(),
  ]);
  const hasNext = (stops?.length ?? 0) > 4;
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
        <div className="section-heading">
          <span>
            الأكثر دعماً <span aria-hidden="true">↙</span>
          </span>
        </div>
        {stops?.length ? (
          <div className="cards">
            {stops.slice(0, 4).map((stop) => (
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
        {stops && (requestedPage > 1 || hasNext) && (
          <nav className="actions" aria-label="صفحات المنشورات">
            {requestedPage > 1 && (
              <Link
                prefetch={false}
                href={requestedPage === 2 ? "/" : `/?page=${requestedPage - 1}`}
              >
                السابق
              </Link>
            )}
            {hasNext && (
              <Link prefetch={false} href={`/?page=${requestedPage + 1}`}>
                المزيد من STOP
              </Link>
            )}
          </nav>
        )}
      </section>
      <Presence enabled={enabled} />
    </>
  );
}
