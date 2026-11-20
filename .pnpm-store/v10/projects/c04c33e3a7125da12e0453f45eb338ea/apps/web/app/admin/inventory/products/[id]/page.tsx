import { redirect } from 'next/navigation';

export default async function InventoryProductRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/products/${encodeURIComponent(id)}`);
}
