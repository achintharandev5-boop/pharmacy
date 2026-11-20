import { redirect } from 'next/navigation';

/** The medicine catalogue lives at /admin/products; this older address is kept as a redirect. */
export default function InventoryProductsRedirect() {
  redirect('/admin/products');
}
