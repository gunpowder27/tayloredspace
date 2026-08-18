export type ExtractedProduct = { imageUrl?: string; title?: string; price?: string; currency?: string; retailer?: string; sourceUrl: string };
type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : undefined;
const first = <T>(value: T | T[] | undefined): T | undefined => Array.isArray(value) ? value[0] : value;
const typeIncludes = (value: unknown, expected: string) => (Array.isArray(value) ? value : [value]).some((item) => item === expected);
const flattenJsonLd = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as JsonRecord;
  const graph = Array.isArray(record["@graph"]) ? record["@graph"].flatMap(flattenJsonLd) : [];
  return [record, ...graph];
};
const offerDetails = (raw: unknown) => {
  const offer = first(Array.isArray(raw) ? raw : raw ? [raw] : []) as JsonRecord | undefined;
  if (!offer) return {};
  const specification = first(offer.priceSpecification as JsonRecord | JsonRecord[] | undefined);
  return { price: text(offer.price) ?? text(offer.lowPrice) ?? text(specification?.price) ?? text(specification?.minPrice), currency: text(offer.priceCurrency) ?? text(specification?.priceCurrency) };
};

export function extractProduct(document: Document, pageUrl = document.location.href): ExtractedProduct {
  const meta = (...keys: string[]) => {
    for (const key of keys) { const value = document.querySelector<HTMLMetaElement>(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`)?.content?.trim(); if (value) return value; }
  };
  const nodes: JsonRecord[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) { try { nodes.push(...flattenJsonLd(JSON.parse(script.textContent || "null"))); } catch { /* Ignore malformed merchant data. */ } }
  const product = nodes.find((node) => typeIncludes(node["@type"], "Product")) ?? nodes.find((node) => typeIncludes(node["@type"], "ProductGroup"));
  const variant = first(product?.hasVariant as JsonRecord | JsonRecord[] | undefined);
  const source = variant ?? product;
  const offer = offerDetails(source?.offers ?? product?.offers);
  const rawImage = first(source?.image as string | JsonRecord | Array<string | JsonRecord> | undefined) ?? first(product?.image as string | JsonRecord | Array<string | JsonRecord> | undefined);
  const imageUrl = typeof rawImage === "object" ? text(rawImage.url ?? rawImage.contentUrl) : text(rawImage);
  const priced = document.querySelector<HTMLElement>('[itemprop="price"], [data-price], .price, [class*="Price"]');
  const visibleTitle = document.querySelector<HTMLElement>("main h1, h1, main h2")?.textContent?.trim();
  const visibleImage = document.querySelector<HTMLImageElement>('[data-testid*="product"] img[src], main picture img[src], main img[src]');
  return {
    sourceUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || pageUrl,
    imageUrl: imageUrl ?? meta("og:image", "twitter:image", "image") ?? (visibleImage?.currentSrc || visibleImage?.src),
    title: text(source?.name) ?? text(product?.name) ?? meta("og:title", "twitter:title", "name") ?? visibleTitle ?? document.title.trim(),
    price: offer.price ?? meta("product:price:amount", "og:price:amount", "price") ?? priced?.getAttribute("content") ?? priced?.textContent?.trim(),
    currency: offer.currency ?? meta("product:price:currency", "og:price:currency", "priceCurrency"),
    retailer: document.location.hostname.replace(/^www\./, ""),
  };
}
