import Link from "next/link";
import { listUrl, pageNumbers, type StopSort } from "@/lib/stop-list";
export function StopPagination({
  page,
  total,
  sort,
}: {
  page: number;
  total: number;
  sort: StopSort;
}) {
  return (
    <nav className="stop-pagination" aria-label="صفحات المنشورات">
      {page > 1 ? (
        <Link prefetch={false} href={listUrl(page - 1, sort)}>
          السابق
        </Link>
      ) : (
        <span aria-disabled="true">السابق</span>
      )}
      {pageNumbers(page, total).map((n, index) =>
        n === "gap" ? (
          <span className="page-gap" key={`gap-${index}`}>
            …
          </span>
        ) : (
          <Link
            prefetch={false}
            href={listUrl(n, sort)}
            key={n}
            aria-label={`الصفحة ${n}`}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </Link>
        ),
      )}
      {page < total ? (
        <Link prefetch={false} href={listUrl(page + 1, sort)}>
          التالي
        </Link>
      ) : (
        <span aria-disabled="true">التالي</span>
      )}
    </nav>
  );
}
