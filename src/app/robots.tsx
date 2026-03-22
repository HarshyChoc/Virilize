import { type MetadataRoute } from 'next';

import { Sitemap } from '@/server/sitemap';
import { getCanonicalUrl } from '@/server/utils/url';

// Robots file cache configuration - revalidate every 24 hours
export const revalidate = 86_400; // 24 hours - content page cache
export const dynamic = 'force-static';

const robots = (): MetadataRoute.Robots => {
  const sitemapModule = new Sitemap();
  return {
    host: getCanonicalUrl(),
    rules: [
      {
        allow: ['/'],
        disallow: ['/api/*', '/signin', '/signup', '/knowledge/*', '/share/*'],
        userAgent: '*',
      },
    ],
    sitemap: sitemapModule.getRobots(),
  };
};

export default robots;
