import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/app/actions/products', () => ({ searchProducts: vi.fn(), getProductByBarcode: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ handleLogout: vi.fn() }));
import { ProductSearchInput } from './ProductSearchInput';
import { searchProducts } from '@/app/actions/products';
import { useLabelStore } from '@/store/labelStore';
import { QueryView } from './ui/States';
import { UI_TEST_UNAVAILABLE } from '@/lib/uiTestMode';
import { UiTestControls } from './UiTestControls';
beforeEach(() => { vi.stubEnv('NODE_ENV','development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE','true'); useLabelStore.setState(useLabelStore.getInitialState(),true); });
afterEach(() => vi.unstubAllEnvs());
it('supports manual test-product input without catalogue requests', () => {
 render(<ProductSearchInput />);
 fireEvent.change(screen.getByLabelText('Manual test-product name'), { target: { value: 'User entered medicine' } });
 expect(useLabelStore.getState().product?.name).toBe('User entered medicine');
 expect(searchProducts).not.toHaveBeenCalled();
});
it('renders unavailable data as an honest empty state', () => {
 render(<QueryView query={{ status:'error', data:undefined, error:UI_TEST_UNAVAILABLE, isFetching:false, retry:vi.fn() }}>{() => <p>invented</p>}</QueryView>);
 expect(screen.getByText('No data loaded')).toBeInTheDocument();
 expect(screen.queryByText('invented')).not.toBeInTheDocument();
});
it('offers session reset and clears label input', () => {
 useLabelStore.getState().setProduct({ id:'manual',name:'temporary' });
 render(<UiTestControls />); fireEvent.click(screen.getByText('Reset UI Test Session'));
 expect(useLabelStore.getState().product).toBeNull();
});
it('lets the tester state a temporary product type for a typed test product only', () => {
 const { unmount } = render(<ProductSearchInput />);
 const select = () => screen.queryByLabelText('Temporary test product type (UI testing only)');
 expect(select()).toBeNull();
 fireEvent.change(screen.getByLabelText('Manual test-product name'), { target: { value: 'Typed tablet' } });
 expect(screen.getByLabelText('Selected product type')).toHaveTextContent('Product type is missing');
 fireEvent.change(select()!, { target: { value: 'Karal' } });
 expect(useLabelStore.getState().product).toEqual({ id: 'manual', name: 'Typed tablet', product_type: 'Karal' });
 expect(screen.getByLabelText('Selected product type')).toHaveTextContent('Product type: Karal · කරල්');
 // A different name is a different test product: its type must be stated again.
 fireEvent.change(screen.getByLabelText('Manual test-product name'), { target: { value: 'Typed syrup' } });
 expect(useLabelStore.getState().product?.product_type).toBeUndefined();
 unmount();
 vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'false');
 useLabelStore.getState().setProduct({ id: 'manual', name: 'Typed outside UI testing' });
 render(<ProductSearchInput />);
 expect(select()).toBeNull();
});
