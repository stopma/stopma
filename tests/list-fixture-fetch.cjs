// Preloaded only by the isolated browser fixture server. Next.js inlines
// NEXT_PUBLIC_SUPABASE_URL at build time, so redirect its reads locally.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.pathname.startsWith("/rest/v1/")) {
    url.protocol = "http:";
    url.host = "127.0.0.1:54440";
    input = input instanceof Request ? new Request(url, input) : url;
  }
  return originalFetch(input, options);
};
