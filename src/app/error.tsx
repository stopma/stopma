"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="prose">
      <h1>وقع مشكل مؤقت.</h1>
      <p>حاول مرة أخرى من بعد شوية.</p>
      <button onClick={reset}>عاود المحاولة</button>
    </section>
  );
}
