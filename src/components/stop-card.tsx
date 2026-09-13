import Link from "next/link";
import { categories, type Stop } from "@/lib/content";
import { Vote } from "./public";
export function StopCard({
  stop,
  labels = {},
}: {
  stop: Stop;
  labels?: Record<string, string>;
}) {
  return (
    <article className="stop-card">
      <span className="category">
        {labels[stop.category] || categories[stop.category] || stop.category}
      </span>
      <Link className="stop-text" href={"/stop/" + stop.id}>
        {stop.text}
      </Link>
      <Vote
        id={stop.id}
        count={stop.votes_count}
        text={stop.text}
        url={
          new URL(
            "/stop/" + stop.id,
            process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
          ).href
        }
      />
    </article>
  );
}
