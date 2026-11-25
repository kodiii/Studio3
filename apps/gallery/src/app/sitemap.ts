import { demos, effects } from '@maquettekit/library/registry';
import type { MetadataRoute } from 'next';
import { SITE_URL, SPECIALTIES } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/', '/effects', '/studios', '/3d', '/system',
    ...SPECIALTIES.map((s) => `/studios/${s.id}`),
    ...effects.map((e) => `/effects/${e.meta.id}`),
    ...demos.map((d) => `/demos/${d.meta.specialty}/${d.meta.id}`),
  ];
  return paths.map((p) => ({ url: `${SITE_URL}${p === '/' ? '' : p}` }));
}
