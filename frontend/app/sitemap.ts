import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://academi.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = [
    { url: "/", changeFrequency: "monthly" as const, priority: 1.0 },
    { url: "/dashboard", changeFrequency: "daily" as const, priority: 0.8 },
    { url: "/research", changeFrequency: "daily" as const, priority: 0.9 },
    { url: "/bookmarks", changeFrequency: "weekly" as const, priority: 0.6 },
    { url: "/collections", changeFrequency: "weekly" as const, priority: 0.6 },
    { url: "/survey", changeFrequency: "weekly" as const, priority: 0.7 },
    { url: "/checkup", changeFrequency: "weekly" as const, priority: 0.7 },
    { url: "/versions", changeFrequency: "weekly" as const, priority: 0.5 },
    { url: "/refs", changeFrequency: "weekly" as const, priority: 0.6 },
    { url: "/gap-analysis", changeFrequency: "weekly" as const, priority: 0.7 },
    { url: "/billing", changeFrequency: "monthly" as const, priority: 0.5 },
    { url: "/settings", changeFrequency: "monthly" as const, priority: 0.3 },
  ];

  return staticPages.map((page) => ({
    url: `${BASE_URL}${page.url}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
