"use client";
import { useEffect, useState } from "react";
import { commenterLabel, type PublicComment } from "@/lib/comments";

const nameKey = "stop-comment-pseudo";
export function Comments({
  stopId,
  comments,
  enabled,
}: {
  stopId: string;
  comments: PublicComment[] | null;
  enabled: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey)?.slice(0, 40) || "");
    } catch {
      /* Storage may be disabled. */
    }
    const controller = new AbortController();
    fetch("/api/comments", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.code === "string") setCode(data.code);
      })
      .catch(() => {
        /* A later submission can establish the identifier. */
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="stop-comments" aria-labelledby="comments-title">
      <h2 id="comments-title">
        {comments === null ? "التعليقات" : `التعليقات (${comments.length})`}
      </h2>
      <form
        className="comment-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setError("");
          setMessage("");
          if (!name.trim() || !content.trim()) {
            setError("كتب الاسم المستعار والتعليق ديالك.");
            return;
          }
          setBusy(true);
          const website = new FormData(event.currentTarget).get("website");
          try {
            const response = await fetch("/api/comments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stop_id: stopId,
                display_name: name,
                content,
                website,
              }),
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "تعذر إرسال التعليق.");
            setCode(data.code);
            setMessage(data.message);
            setContent("");
            try {
              localStorage.setItem(nameKey, name.trim());
            } catch {
              /* Cookie still preserves the identifier. */
            }
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "تعذر إرسال التعليق.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="comment-pseudo">الاسم المستعار (Pseudo)</label>
        <div className="comment-identity">
          <input
            id="comment-pseudo"
            name="pseudo"
            value={name}
            maxLength={40}
            required
            autoComplete="nickname"
            dir="auto"
            disabled={!enabled || busy}
            onChange={(e) => {
              setName(e.target.value);
              try {
                localStorage.setItem(nameKey, e.target.value);
              } catch {
                /* Optional storage. */
              }
            }}
          />
          {code && <bdi className="comment-code">{code}</bdi>}
        </div>
        <label htmlFor="comment-content">التعليق</label>
        <textarea
          id="comment-content"
          name="content"
          dir="auto"
          maxLength={300}
          required
          value={content}
          disabled={!enabled || busy}
          onChange={(e) => setContent(e.target.value)}
          aria-describedby="comment-count comment-note"
        />
        <div className="trap" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="comment-submit">
          <span id="comment-count" dir="ltr">
            {content.length} / 300
          </span>
          <button disabled={!enabled || busy}>
            {busy ? "جاري الإرسال..." : "إرسال التعليق"}
          </button>
        </div>
        <p id="comment-note" className="comment-note">
          التعليقات كتدوز من المراجعة قبل النشر. كننتاقدو السلوك، ماشي الأشخاص.
        </p>
        {!enabled && (
          <p className="comment-note">إرسال التعليقات غير متاح حالياً.</p>
        )}
        {message && (
          <p role="status" className="notice success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </form>
      {comments === null ? (
        <p role="status">تعذر تحميل التعليقات. عاود تحميل الصفحة.</p>
      ) : !comments.length ? (
        <p className="comments-empty">ما كاين حتى تعليق دابا.</p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <div className="comment-meta">
                <strong>
                  <bdi>{comment.display_name}</bdi>
                </strong>
                <span aria-hidden="true">·</span>
                <bdi className="comment-code">
                  {commenterLabel(comment.commenter_code)}
                </bdi>
                <time dateTime={comment.created_at}>
                  {new Intl.DateTimeFormat("ar-MA", {
                    dateStyle: "medium",
                    timeZone: "Africa/Casablanca",
                  }).format(new Date(comment.created_at))}
                </time>
              </div>
              <p dir="auto">{comment.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
