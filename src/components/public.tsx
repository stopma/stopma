"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { number } from "@/lib/content";
import { Share } from "./share";
export async function post(action: string, body: object) {
  const response = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "وقع مشكل. عاود المحاولة.");
  return data;
}
export function Submit({ enabled }: { enabled: boolean }) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  return (
    <form
      className="composer"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          const form = e.currentTarget;
          const data = await post("submit", {
            text,
            website: new FormData(form).get("website"),
          });
          setMessage(data.message);
          setError(false);
          setText("");
        } catch (e) {
          setMessage((e as Error).message);
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="stop-text" className="sr-only">
        شنو بغيتي يوقف فالمغرب؟
      </label>
      <textarea
        id="stop-text"
        name="text"
        placeholder="بغيت يوقف..."
        required
        minLength={12}
        maxLength={400}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!enabled}
      />
      <div className="trap" aria-hidden="true">
        <label>
          Website
          <input name="website" autoComplete="off" tabIndex={-1} />
        </label>
      </div>
      <div className="composer-bottom">
        <span className="counter">
          {number(text.length)} / {number(400)}
        </span>
        <button disabled={busy || !enabled}>
          {busy ? "كنرسلو الفكرة..." : "نشر STOP"}{" "}
          <span aria-hidden="true">←</span>
        </button>
      </div>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={error ? "notice error" : "notice success"}
        >
          {message}
        </p>
      )}
      <p className="form-note">
        <span aria-hidden="true">◇</span> كننتاقدو السلوك، ماشي الأشخاص.
      </p>
      {!enabled && (
        <p className="notice">
          المنصة قيد التحضير. استقبال المشاركات غادي يفتح قريباً.
        </p>
      )}
    </form>
  );
}
export function Vote({
  id,
  count,
  text,
  url,
}: {
  id: string;
  count: number;
  text: string;
  url: string;
}) {
  const router = useRouter();
  const [votes, setVotes] = useState(count),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => setVotes(count), [count]);
  return (
    <div className="vote-wrap">
      <span className="support">
        <strong>{number(votes)}</strong> مؤيد
      </span>
      <div className="stop-actions">
        <button
          className="vote"
          disabled={busy || done}
          aria-pressed={done}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const data = await post("vote", { id });
              setVotes(data.count);
              setDone(true);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {done ? "✓ وصل صوتك" : busy ? "لحظة..." : "حتى أنا"}
        </button>
        <Share text={text} url={url} />
      </div>
      {done && (
        <p className="share-prompt" role="status">
          متافق؟ شاركها مع الآخرين.
        </p>
      )}
      {error && (
        <span role="alert" className="error vote-error">
          {error}
        </span>
      )}
    </div>
  );
}
export function Presence({ enabled }: { enabled: boolean }) {
  const [stats, setStats] = useState<{ total: number; online: number } | null>(
    null,
  );
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    async function beat() {
      if (document.visibilityState !== "visible") return;
      try {
        const data = await post("presence", {});
        if (alive && !data.excluded) setStats(data);
      } catch {
        /* Preserve no fabricated stats on failure. */ if (alive)
          setStats(null);
      }
    }
    void beat();
    const timer = setInterval(beat, 30000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled]);
  return (
    <section className="presence" aria-label="إحصائيات الزيارات">
      <div>
        <strong>{stats ? number(stats.total) : "—"}</strong>
        <span>زائر من البداية</span>
      </div>
      <div>
        <strong>
          <i className={stats ? "online-dot" : ""} />
          {stats ? number(stats.online) : "—"}
        </strong>
        <span>متصل دابا</span>
      </div>
      <p>
        {stats
          ? "زيارات متصفحات فعلية · النشاط خلال آخر دقيقتين"
          : "الإحصائيات غير متاحة حالياً"}
      </p>
    </section>
  );
}
