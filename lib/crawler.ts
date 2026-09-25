/**
 * Coarse crawler check for request User-Agent strings.
 * Modeled on the isbot list: search engines, preview fetchers, and generic
 * bot/spider tokens. Empty and ordinary browser agents are not crawlers.
 */
const CRAWLER_UA =
  /bot\b|crawler|crawl|spider|slurp|facebookexternalhit|facebookcatalog|facebot|whatsapp|telegrambot|slackbot|discordbot|embedly|quora link preview|pinterest|redditbot|applebot|bingpreview|bingbot|googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|duckduckbot|baiduspider|yandex|sogou|exabot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt-user|oai-searchbot|claudebot|anthropic-ai|amazonbot|linkedinbot|twitterbot|headlesschrome|phantomjs|lighthouse|pagespeed|wget\/|curl\/|python-requests|go-http-client|libwww-perl|scrapy|heritrix|ccbot|dataforseo|seekport|seznambot|qwantify|trendiction|diffbot|tiktokspider|perplexitybot/i

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const trimmed = userAgent.trim()
  if (!trimmed) return false
  return CRAWLER_UA.test(trimmed)
}
