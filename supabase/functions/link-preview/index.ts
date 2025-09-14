import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Preview = {
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
  url?: string;
  domain?: string;
  price?: string;
  currency?: string;
};

// Allowlist localhost and a placeholder prod origin. Update with your live domain when ready.
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:8080",
  "https://frolicking-snickerdoodle-2a0250.netlify.app"
]);

function ok(json: unknown, status = 200, req?: Request) {
  const origin = req?.headers.get("origin") || "";
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "http://localhost:8080";
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
    },
  });
}

function absoluteUrl(src: string | undefined, base: string) {
  if (!src) return undefined;
  try { return new URL(src, base).toString(); } catch { return undefined; }
}

function domainOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return undefined; }
}

function isHttp(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

function decodeHtmlEntities(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/* -------- Generic OG/Twitter extraction -------- */
function extractGeneric(html: string, baseUrl: string): Preview {
  const get = (re: RegExp) => (html.match(re)?.[1] || "").trim() || undefined;
  const meta = (p: string) =>
    get(new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)["']`, "i")) ||
    get(new RegExp(`<meta[^>]+name=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"));

  const title = meta("og:title") || meta("twitter:title") || get(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = meta("og:description") || meta("twitter:description") || meta("description");
  const img = meta("og:image") || meta("twitter:image");
  const site_name = meta("og:site_name") || domainOf(baseUrl);
  const image_url = absoluteUrl(img, baseUrl);

  return { title, description, image_url, site_name, url: baseUrl, domain: domainOf(baseUrl) };
}

/* -------- Amazon-specific extraction -------- */
function normalizeAmazonUrl(input: string) {
  try {
    const u = new URL(input);
    const asin = u.pathname.match(/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1]
      || u.pathname.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1];
    if (!asin) return input;
    u.pathname = `/dp/${asin.toUpperCase()}`;
    // remove noise
    ["tag", "ascsubtag", "pd_rd_w", "pd_rd_wg", "pd_rd_r", "ref", "th"].forEach(k => u.searchParams.delete(k));
    u.protocol = "https:";
    return u.toString();
  } catch { return input; }
}

function extractAmazon(html: string, baseUrl: string): Preview {
  const base = normalizeAmazonUrl(baseUrl);

  // 1) JSON-LD Product
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const m of scripts) {
    try {
      const raw = m[1].trim();
      // Some pages embed multiple JSON objects; try to parse arrays and single objects
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of candidates) {
        if (!obj) continue;
        const t = Array.isArray(obj["@type"]) ? obj["@type"].join(",") : obj["@type"];
        if (String(t || "").toLowerCase().includes("product")) {
          const title = obj.name || obj.headline || obj.alternateName;
          const image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
          const price = obj.offers?.price || obj.offers?.priceSpecification?.price;
          const currency = obj.offers?.priceCurrency || obj.offers?.priceSpecification?.priceCurrency;
          const image_url = absoluteUrl(image, base);
          return {
            title,
            image_url,
            site_name: "Amazon",
            url: base,
            domain: domainOf(base),
            price: price ? String(price) : undefined,
            currency: currency ? String(currency) : undefined,
          };
        }
      }
    } catch { /* ignore and continue */ }
  }

  // 2) productTitle element
  const title = (html.match(/id=["']productTitle["'][^>]*>\s*([^<]+?)\s*</i)?.[1] || "").trim();

  // 3) landingImage data-a-dynamic-image
  let image_url: string | undefined;
  const landing = html.match(/id=["']landingImage["'][^>]+data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
  if (landing) {
    try {
      const decoded = decodeHtmlEntities(landing);
      const map = JSON.parse(decoded); // {"url1":[w,h], "url2":[w,h], ...}
      const first = Object.keys(map)[0];
      image_url = absoluteUrl(first, base);
    } catch { /* ignore */ }
  }

  // 4) OG fallback combined with title above
  const generic = extractGeneric(html, base);
  return {
    title: title || generic.title || "Amazon",
    image_url: image_url || generic.image_url || absoluteUrl("/favicon.ico", base),
    site_name: "Amazon",
    url: base,
    domain: domainOf(base),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return ok({}, 204, req);

  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url || !isHttp(url)) return ok({ error: "Invalid URL" }, 400, req);

    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "upgrade-insecure-requests": "1",
      },
    });

    const finalUrl = res.url || url;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("text/html")) {
      return ok({
        title: domainOf(finalUrl),
        image_url: absoluteUrl("/favicon.ico", finalUrl),
        url: finalUrl,
        domain: domainOf(finalUrl),
      }, 200, req);
    }

    const html = await res.text();
    const hostname = domainOf(finalUrl) || "";
    const preview =
      /amazon\./i.test(hostname) ? extractAmazon(html, finalUrl) : extractGeneric(html, finalUrl);
    if (!preview.image_url) preview.image_url = absoluteUrl("/favicon.ico", finalUrl);
    if (!preview.site_name) preview.site_name = hostname;
    return ok(preview, 200, req);
  } catch (e) {
    return ok({ error: "Fetch failed", message: String(e?.message || e) }, 500, req);
  }
});
