"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "./public";
import type { Stop } from "@/lib/content";
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      className="login"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await post("login", {
            email: data.get("email"),
            password: data.get("password"),
          });
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>دخول الإدارة</h1>
      <p>هاد المساحة خاصة بمراجعة المشاركات.</p>
      <label>
        البريد الإلكتروني
        <input
          type="email"
          name="email"
          dir="ltr"
          autoComplete="username"
          required
        />
      </label>
      <label>
        كلمة المرور
        <input
          type="password"
          name="password"
          dir="ltr"
          autoComplete="current-password"
          required
        />
      </label>
      <button disabled={busy}>
        {busy ? "جاري الدخول..." : "تسجيل الدخول"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
export function Logout() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="secondary"
        onClick={async () => {
          try {
            await post("logout", {});
            router.refresh();
          } catch {
            setError("تعذر الخروج. عاود المحاولة.");
          }
        }}
      >
        خروج
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function Moderate({
  stop,
  labels,
}: {
  stop: Stop;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [text, setText] = useState(stop.text),
    [category, setCategory] = useState(stop.category),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(status: string) {
    setBusy(true);
    setMessage("");
    try {
      await post("moderate", { id: stop.id, text, category, status });
      setMessage("تحفظ التغيير.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="moderation-item">
      <small>
        {new Intl.DateTimeFormat("ar-MA", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Africa/Casablanca",
        }).format(new Date(stop.created_at))}{" "}
        · {stop.status}
      </small>
      <label className="sr-only" htmlFor={"text-" + stop.id}>
        نص STOP
      </label>
      <textarea
        id={"text-" + stop.id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={400}
      />
      <label className="sr-only" htmlFor={"category-" + stop.id}>
        الفئة
      </label>
      <select
        id={"category-" + stop.id}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {Object.entries(labels).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <div className="actions">
        <button disabled={busy} onClick={() => save("published")}>
          موافقة ونشر
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => save("rejected")}
        >
          رفض
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => save(stop.status)}
        >
          حفظ التعديل
        </button>
        {stop.status !== "pending" && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => save("pending")}
          >
            إرجاع للمراجعة
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </article>
  );
}
export function CategoryEditor({
  items,
}: {
  items: { id: string; label: string; active: boolean }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await post("category", {
        id: data.get("id"),
        label: data.get("label"),
        active: data.get("active") === "on",
      });
      setMessage("تحفظت الفئة.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details>
      <summary>تعديل التصنيفات</summary>
      {items.map((c) => (
        <form className="category-edit" key={c.id} onSubmit={save}>
          <input type="hidden" name="id" value={c.id} />
          <input
            aria-label={"اسم الفئة " + c.label}
            name="label"
            defaultValue={c.label}
            required
            maxLength={40}
          />
          <label>
            <input type="checkbox" name="active" defaultChecked={c.active} />{" "}
            مفعلة
          </label>
          <button className="secondary">حفظ</button>
        </form>
      ))}
      <h3>إضافة فئة</h3>
      <form className="category-edit" onSubmit={save}>
        <input
          aria-label="معرّف الفئة باللاتينية"
          placeholder="معرّف لاتيني"
          name="id"
          pattern="[a-z][a-z0-9_-]{1,40}"
          required
        />
        <input
          aria-label="اسم الفئة الجديدة"
          placeholder="اسم الفئة"
          name="label"
          maxLength={40}
          required
        />
        <input type="hidden" name="active" value="on" />
        <button>إضافة</button>
      </form>
      <p role="status">{message}</p>
    </details>
  );
}
