import { Submit, Presence } from "@/components/public";
import { StopCard } from "@/components/stop-card";
import { readStops, categoryLabels, configured } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [stops, labels] = await Promise.all([readStops(), categoryLabels()]);
  const enabled = configured() && process.env.SITE_LAUNCH_READY === "true";
  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          <span /> مساحة لصوتك
        </div>
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
          <h2>حوايج بغيناها توقف</h2>
          <span>
            الأكثر دعماً <span aria-hidden="true">↙</span>
          </span>
        </div>
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
              {stops
                ? "ما كاين حتى STOP منشور دابا. كتب أول فكرة، وغادي تظهر من بعد المراجعة."
                : "المنشورات غادي تبان هنا منين تتفتح المنصة."}
            </p>
          </div>
        )}
      </section>
      <Presence enabled={enabled} />
    </>
  );
}
