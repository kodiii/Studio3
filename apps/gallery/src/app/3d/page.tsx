import type { Metadata } from 'next';
import { Shell } from '@/components/SiteHeader';
import { ThreeGallery } from '@/components/three-gallery/ThreeGallery';
import { pageMeta } from '@/lib/site';

export const metadata: Metadata = pageMeta({
  title: '3D Studio — model viewer and demos',
  description: 'Interactive model viewer for the Maquettekit sample assets, with real statistics, quality variants, a static fallback and five 3D demos.',
  path: '/3d',
});

export default function ThreeDPage() {
  return (
    <Shell>
      <ThreeGallery />
    </Shell>
  );
}
