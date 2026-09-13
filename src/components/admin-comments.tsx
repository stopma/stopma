import Link from "next/link";
import { admin, db } from "@/lib/server";
import { CommentModeration } from "./comment-moderation";

export async function AdminComments({
  query,
}: {
  query: {
    status?: string;
    page?: string;
    comment_status?: string;
    comment_page?: string;
  };
}) {
  if (!(await admin())) return null;
  const status = ["pending", "approved", "rejected"].includes(
    query.comment_status || "",
  )
    ? query.comment_status!
    : "pending";
  const page = Math.max(
    1,
    Math.min(10000, parseInt(query.comment_page || "1", 10) || 1),
  );
  const { data, error, count } = await db()
    .from("comments")
    .select("*", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  const ids = [...new Set((data || []).map((c) => c.stop_id))];
  const parents = ids.length
    ? await db().from("stops").select("id,text").in("id", ids)
    : { data: [], error: null };
  const stopTexts = new Map((parents.data || []).map((s) => [s.id, s.text]));
  function href(nextStatus: string, nextPage = 1) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.page) params.set("page", query.page);
    params.set("comment_status", nextStatus);
    if (nextPage > 1) params.set("comment_page", String(nextPage));
    return "/admin?" + params + "#admin-comments";
  }
  return (
    <section id="admin-comments" aria-labelledby="admin-comments-title">
      <h2 id="admin-comments-title">مراجعة التعليقات</h2>
      <nav className="filters" aria-label="حالة التعليقات">
        {Object.entries({
          pending: "قيد المراجعة",
          approved: "المعتمدة",
          rejected: "المرفوضة",
        }).map(([key, label]) => (
          <Link
            key={key}
            href={href(key)}
            prefetch={false}
            aria-current={status === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error || parents.error ? (
        <p role="alert">تعذر تحميل التعليقات. عاود المحاولة.</p>
      ) : (
        <>
          <p>التعليقات ({count || 0})</p>
          {!data?.length ? (
            <p className="empty">ما كاين حتى تعليق فهاد اللائحة.</p>
          ) : (
            data.map((c) => (
              <CommentModeration
                key={c.id + ":" + c.updated_at}
                comment={c}
                stopText={stopTexts.get(c.stop_id) || "STOP المرتبط"}
              />
            ))
          )}
          <nav className="filters" aria-label="صفحات مراجعة التعليقات">
            {page > 1 && <Link href={href(status, page - 1)}>السابق</Link>}
            {(count || 0) > page * 20 && (
              <Link href={href(status, page + 1)}>التالي</Link>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
