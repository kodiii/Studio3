import { demoMetas, effectMetas } from '@maquettekit/library/meta';
import type { MetadataRoute } from 'next';
import { SITE_URL, SPECIALTIES } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/', '/effects', '/studios', '/3d', '/system',
    ...SPECIALTIES.map((s) => `/studios/${s.id}`),
    ...effectMetas.map((m) => `/effects/${m.id}`),
    ...demoMetas.map((m) => `/demos/${m.specialty}/${m.id}`),
  ];
  return paths.map((p) => ({ url: `${SITE_URL}${p === '/' ? '' : p}` }));
}
