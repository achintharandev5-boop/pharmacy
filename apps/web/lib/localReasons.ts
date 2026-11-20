import type { CatalogueReason } from './reasonCatalogue';
import { uiTestEnabled } from './uiTestMode';
const KEY = 'pharmacy-ui-test-reasons-v1';
export function readLocalReasons(): CatalogueReason[] {
  if (!uiTestEnabled()) return [];
  const value: unknown = JSON.parse(sessionStorage.getItem(KEY) || '[]');
  if (!Array.isArray(value) || value.some(r => !r || typeof r.id !== 'string' || typeof r.text !== 'string' || !r.text.trim() || r.text.length > 200 || /[\r\n]/.test(r.text) || typeof r.is_active !== 'boolean')) {
    throw new Error('Invalid temporary reason data. Reset the UI test session.');
  }
  return value as CatalogueReason[];
}
export function writeLocalReasons(rows: CatalogueReason[]) {
  if (uiTestEnabled()) sessionStorage.setItem(KEY, JSON.stringify(rows));
}
export function clearLocalReasons() {
  if (uiTestEnabled()) sessionStorage.removeItem(KEY);
}

