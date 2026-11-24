import type { Metadata } from 'next';
import { Shell } from '@/components/SiteHeader';
import { ThreeGallery } from '@/components/three-gallery/ThreeGallery';

export const metadata: Metadata = {
  title: '3D Studio — model viewer and demos',
  description: 'Interactive model viewer for the Maquettekit sample assets, with real statistics, quality variants, a static fallback and five 3D demos.',
};

export default function ThreeDPage() {
  return (
    <Shell>
      <ThreeGallery />
    </Shell>
  );
}
