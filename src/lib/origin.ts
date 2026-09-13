/** Exact configured origins only; never trust Host or forwarded headers. */
export function allowedOrigin(origin: string | null, siteUrl: string, additional = "") {
  if (!origin || origin === "null") return false;
  return [siteUrl, ...additional.split(",")].some((value) => {
    try {
      const url = new URL(value.trim());
      return ["https:", "http:"].includes(url.protocol) && url.origin === origin;
    } catch {
      return false;
    }
  });
}
