import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/driver", "/me", "/login", "/signup", "/auth", "/favorites"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
