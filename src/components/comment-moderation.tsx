"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { commenterLabel, type PublicComment } from "@/lib/comments";

export type ModeratedComment = PublicComment & {
  stop_id: string;
  status: "pending" | "approved" | "rejected";
  updated_at: string;
};
export function CommentModeration({
  comment,
  stopText,
}: {
  comment: ModeratedComment;
  stopText: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(comment.content);
  const [name, setName] = useState(comment.display_name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function act(action: "approve" | "reject" | "edit" | "delete") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/comments/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: comment.id,
          updated_at: comment.updated_at,
          action,
          content,
          display_name: name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ التغيير.");
      setMessage(action === "delete" ? "تحذف التعليق." : "تحفظ التغيير.");
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      setError(true);
      setMessage(err instanceof Error ? err.message : "تعذر حفظ التغيير.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className="moderation-item comment-moderation"
      data-comment-id={comment.id}
    >
      <small>
        <time dateTime={comment.created_at}>
          {new Intl.DateTimeFormat("ar-MA", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Casablanca",
          }).format(new Date(comment.created_at))}
        </time>{" "}
        · {comment.status}
      </small>
      <p className="comment-parent">
        STOP: <Link href={"/stop/" + comment.stop_id}>{stopText}</Link>
      </p>
      <p className="comment-admin-code">
        <bdi>{commenterLabel(comment.commenter_code)}</bdi> ·{" "}
        <bdi>{comment.commenter_code}</bdi>
      </p>
      <label htmlFor={"comment-name-" + comment.id}>
        الاسم المستعار (Pseudo)
      </label>
      <input
        id={"comment-name-" + comment.id}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        required
        disabled={busy}
        dir="auto"
      />
      <label htmlFor={"comment-text-" + comment.id}>نص التعليق</label>
      <textarea
        id={"comment-text-" + comment.id}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={300}
        required
        disabled={busy}
        dir="auto"
      />
      <div className="actions">
        <button disabled={busy} onClick={() => act("approve")}>
          موافقة ونشر
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act("reject")}
        >
          رفض
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => act("edit")}
        >
          حفظ التعديل
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          حذف
        </button>
      </div>
      {confirmDelete && (
        <div className="comment-delete-confirm">
          <p>حذف هاد التعليق نهائياً؟</p>
          <div className="actions">
            <button disabled={busy} onClick={() => act("delete")}>
              تأكيد الحذف
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
      {message && <p role={error ? "alert" : "status"}>{message}</p>}
    </article>
  );
}
