export const PAGE_SIZE = 10;
export type StopSort = "votes" | "newest";
export function listUrl(page: number, sort: StopSort) {
  const query = new URLSearchParams();
  if (sort === "newest") query.set("sort", sort);
  if (page > 1) query.set("page", String(page));
  return query.size ? `/?${query}` : "/";
}
export function pageNumbers(page: number, total: number): (number | "gap")[] {
  const numbers = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) for (let n = 1; n <= Math.min(4, total); n++) numbers.add(n);
  if (page >= total - 2)
    for (let n = Math.max(1, total - 3); n <= total; n++) numbers.add(n);
  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const n of [...numbers]
    .filter((n) => n > 0 && n <= total)
    .sort((a, b) => a - b)) {
    if (previous && n > previous + 1) result.push("gap");
    result.push(n);
    previous = n;
  }
  return result;
}
export type PublicationRow = {
  id: string;
  created_at: string;
  moderation_log: { created_at: string }[];
};
export function byPublication(a: PublicationRow, b: PublicationRow) {
  const first = (row: PublicationRow) =>
    Math.min(...row.moderation_log.map((log) => Date.parse(log.created_at)));
  const date = (row: PublicationRow) =>
    row.moderation_log.length ? first(row) : Date.parse(row.created_at);
  return (
    date(b) - date(a) ||
    Date.parse(b.created_at) - Date.parse(a.created_at) ||
    b.id.localeCompare(a.id)
  );
}
