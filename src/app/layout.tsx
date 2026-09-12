import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "STOP.ma — شنو بغيتي يوقف فالمغرب؟",
    template: "%s | STOP.ma",
  },
  description:
    "كتب عادة، تصرف أو ظاهرة بغيتيها توقف. كننتاقدو السلوك، ماشي الأشخاص.",
  alternates: { canonical: "/" },
  robots:
    process.env.SITE_LAUNCH_READY === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar-MA" dir="rtl">
      <body>
        <a className="skip" href="#main">
          دوز للمحتوى
        </a>
        <header className="header">
          <Link
            href="/"
            className="logo"
            dir="ltr"
            aria-label="STOP.ma الرئيسية"
          >
            STOP<span>.ma</span>
          </Link>
          <Link href="/rules" className="quiet">
            الفكرة والقواعد <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>صوت صغير. تغيير كبير.</span>
          <nav aria-label="روابط الموقع">
            <Link href="/rules">قواعد المشاركة</Link>
            <Link href="/privacy">الخصوصية</Link>
            <Link href="/admin">الإدارة</Link>
          </nav>
          <span dir="ltr" className="footer-brand">
            STOP.ma © {new Date().getFullYear()}
          </span>
        </footer>
      </body>
    </html>
  );
}
