import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.syncly.mn";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/dashboard/", "/admin/", "/setup/", "/api/", "/auth/"],
        },
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
