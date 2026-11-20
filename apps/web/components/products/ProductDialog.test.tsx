import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDialog } from './ProductDialog';
import { createProduct, updateProduct } from '../../app/actions/products';

vi.mock('../../app/actions/products', () => ({ createProduct: vi.fn(), updateProduct: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('catalogue product type persistence', () => {
  it.each(['Pethi', 'Karal', 'Packet'])('saves %s once on the medicine record', async (product_type) => {
    vi.mocked(createProduct).mockResolvedValue({ ok: true, data: { id: 'new', name: 'Medicine', product_type } });
    render(<ProductDialog open onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Name on label/), { target: { value: 'Medicine' } });
    fireEvent.change(screen.getByLabelText(/Barcode/), { target: { value: 'ABC' } });
    fireEvent.change(screen.getByLabelText('Product type'), { target: { value: product_type } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
    await waitFor(() => expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ product_type })));
  });

  it('preserves an unsupported existing value when editing other catalogue fields', async () => {
    vi.mocked(updateProduct).mockResolvedValue({ ok: true, data: { id: 'old', name: 'Medicine', product_type: 'Legacy type' } });
    render(<ProductDialog open product={{ id: 'old', name: 'Medicine', barcode: 'ABC', product_type: 'Legacy type' }} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText('Product type')).toHaveValue('Legacy type');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('old', expect.objectContaining({ product_type: 'Legacy type' })));
  });
});
