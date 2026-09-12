import Link from "next/link";
export default function Missing() {
  return (
    <section className="prose">
      <h1>هاد الصفحة ما كايناش.</h1>
      <p>يمكن الرابط تبدّل، أو المنشور مازال ما تنشرش.</p>
      <Link href="/">رجوع للرئيسية ←</Link>
    </section>
  );
}
