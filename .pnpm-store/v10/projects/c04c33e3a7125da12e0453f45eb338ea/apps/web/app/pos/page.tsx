import type { Metadata } from 'next';
import { PosWorkstation } from '@/components/pos/PosWorkstation';

export const metadata: Metadata = { title: 'Point of sale' };

export default function PosPage() {
  return <PosWorkstation />;
}
