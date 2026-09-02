import * as cheerio from "cheerio";

export type PageExtract = {
  images: string[];
  bodyText: string | null;
  siteName: string | null;
};

const BAD_IMAGE_HINTS = [
  "logo", "sprite", "icon", "avatar", "placeholder", "1x1", "pixel",
  "tracking", "advert", "banner", "badge", "favicon", "spacer", "amp-",
];

function absolutise(src: string, base: string): string | null {
  try {
    const url = new URL(src, base);
    if (!url.protocol.startsWith("http")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function plausibleImage(src: string): boolean {
  const lower = src.toLowerCase();
  if (BAD_IMAGE_HINTS.some((h) => lower.includes(h))) return false;
  if (lower.startsWith("data:")) return false;
  return /\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower) || lower.includes("/image");
}

/** Picks the largest candidate from a srcset string. */
function fromSrcset(srcset: string): string | null {
  const entries = srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .map(([url, size]) => ({ url, w: Number((size ?? "").replace(/\D/g, "")) || 0 }))
    .filter((e) => e.url);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.w - a.w);
  return entries[0].url;
}

const CONTENT_SELECTORS = [
  "article",
  "main",
  "[role='main']",
  ".article-body",
  ".article__body",
  ".story-body",
  ".post-content",
  ".entry-content",
  "#article-body",
  ".content__article-body",
];

export async function extractPage(url: string): Promise<PageExtract> {
  const empty: PageExtract = { images: [], bodyText: null, siteName: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WATCHFLOOR/1.0; +local OSINT dashboard)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return empty;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return empty;

    const html = await res.text();
    const $ = cheerio.load(html);

    const siteName =
      $('meta[property="og:site_name"]').attr("content")?.trim() || null;

    // ---- Images: social cards first, then in-article imagery ----
    const ordered: string[] = [];
    const push = (raw?: string | null) => {
      if (!raw) return;
      const abs = absolutise(raw.trim(), url);
      if (!abs || !plausibleImage(abs)) return;
      if (!ordered.includes(abs)) ordered.push(abs);
    };

    $('meta[property="og:image"], meta[property="og:image:url"]').each((_, el) =>
      push($(el).attr("content")),
    );
    push($('meta[name="twitter:image"]').attr("content"));
    push($('meta[property="twitter:image"]').attr("content"));

    $("figure img, article img, main img, picture img, img").each((_, el) => {
      if (ordered.length >= 8) return;
      const $el = $(el);
      const srcset = $el.attr("srcset") ?? $el.attr("data-srcset");
      if (srcset) {
        const best = fromSrcset(srcset);
        if (best) push(best);
      }
      push($el.attr("src") ?? $el.attr("data-src") ?? $el.attr("data-lazy-src"));
    });

    // ---- Body text: densest paragraph container ----
    $("script, style, noscript, nav, footer, aside, form, figure figcaption").remove();

    let best: { text: string; len: number } = { text: "", len: 0 };
    for (const selector of [...CONTENT_SELECTORS, "body"]) {
      const node = $(selector).first();
      if (node.length === 0) continue;
      const paragraphs = node
        .find("p")
        .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
        .get()
        .filter((t) => t.length > 55 && !/^(share|advertisement|sign up|subscribe)/i.test(t));
      const text = paragraphs.join("\n\n");
      if (text.length > best.len) best = { text, len: text.length };
      if (best.len > 2500) break;
    }

    return {
      images: ordered.slice(0, 6),
      bodyText: best.text.slice(0, 12000) || null,
      siteName,
    };
  } catch {
    return empty;
  }
}

/** Runs async tasks with bounded concurrency. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
