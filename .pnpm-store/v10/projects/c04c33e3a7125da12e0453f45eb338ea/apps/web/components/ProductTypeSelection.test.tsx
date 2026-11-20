import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductSearchInput } from './ProductSearchInput';
import { LabelCard } from './PrintableLabel';
import { searchProducts, getProductByBarcode } from '../app/actions/products';
import { useLabelStore, type LabelData } from '../store/labelStore';
import { buildFinalInstruction } from '../lib/labelBuilder';
import { resolveProductType, toSelectedProduct } from '../lib/productType';

vi.mock('../app/actions/products', () => ({ searchProducts: vi.fn(), getProductByBarcode: vi.fn() }));
const state = () => useLabelStore.getState();
const medicine = (product_type?: string | null) => ({ id: 'medicine-id', name: 'Test medicine', product_type });

beforeEach(() => { state().allClear(); vi.clearAllMocks(); });

describe('automatic product type selection', () => {
  it.each([['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']])('search selects %s and displays %s', async (type, sinhala) => {
    vi.mocked(searchProducts).mockResolvedValue({ ok: true, data: [medicine(type)] });
    render(<ProductSearchInput />);
    fireEvent.change(screen.getByPlaceholderText('Name, barcode or brand'), { target: { value: 'Test' } });
    await userEvent.click(await screen.findByRole('button', { name: /Test medicine/ }));
    expect(state().product?.product_type).toBe(type);
    expect(state().labels[0].product?.product_type).toBe(type);
    expect(screen.getByLabelText('Selected product type')).toHaveTextContent(`${type} · ${sinhala}`);
  });

  it('barcode lookup retains the stored type', async () => {
    vi.mocked(getProductByBarcode).mockResolvedValue({ ok: true, data: medicine('Karal') });
    render(<ProductSearchInput />);
    const input = screen.getByPlaceholderText('Name, barcode or brand');
    for (const key of ['1', '2', '3', 'Enter']) fireEvent.keyDown(input, { key });
    await waitFor(() => expect(screen.getByLabelText('Selected product type')).toHaveTextContent('Product type: Karal · කරල්'));
    expect(state().product?.product_type).toBe('Karal');
  });

  it('updates the indicator when changing products or clearing the selection', () => {
    render(<ProductSearchInput />);
    for (const [type, sinhala] of [['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']]) {
      act(() => state().setProduct(toSelectedProduct(medicine(type))));
      expect(screen.getByLabelText('Selected product type')).toHaveTextContent(sinhala);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Clear medicine search' }));
    expect(state().product).toBeNull();
    expect(screen.getByLabelText('Selected product type')).toHaveTextContent('No medicine selected');
  });

  it.each([undefined, null, '', 'Syrup', 'Tablet'])('warns for missing/unsupported %s without inventing a type', (value) => {
    act(() => state().setProduct(toSelectedProduct(medicine(value))));
    render(<ProductSearchInput />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Product type is missing|Unsupported product type/);
    expect(resolveProductType(value).sinhala).toBeNull();
    expect(state().product?.product_type).toBe(value ?? null);
    expect(screen.getByLabelText('Selected product type')).not.toHaveTextContent('පෙති');
  });

  it('each label retains its product type while navigating and editing an existing label', () => {
    state().setProduct(medicine('Pethi'));
    state().incrementDosage('morning');
    state().addLabel();
    state().setProduct({ ...medicine('Packet'), id: 'second' });
    state().selectLabel(0);
    expect(state().product?.product_type).toBe('Pethi');
    state().setAlternativeProductName('Edited name');
    expect(state().product?.product_type).toBe('Pethi');
    state().selectLabel(1);
    expect(state().product?.product_type).toBe('Packet');
    state().selectLabel(0);
    expect(state().dosage.morning.qty).toBe(1);
    expect(state().labels[1].product?.product_type).toBe('Packet');
  });

  it('restores a saved label draft without losing product type or mutating the saved record', () => {
    state().setProduct(medicine('Karal'));
    state().incrementDosage('night');
    const saved = JSON.parse(JSON.stringify(state().labels[0])) as LabelData;
    state().allClear();
    state().restoreLabel(saved);
    expect(state().product?.product_type).toBe('Karal');
    expect(state().dosage.night.qty).toBe(1);
    state().setProduct(medicine('Packet'));
    expect(saved.product?.product_type).toBe('Karal');
    expect(state().labels[0].product?.product_type).toBe('Packet');
  });

  it('restores legacy drafts with no product type without defaulting to Pethi', () => {
    state().setProduct({ id: 'old', name: 'Legacy medicine' });
    const saved = JSON.parse(JSON.stringify(state().labels[0])) as LabelData;
    state().allClear();
    state().restoreLabel(saved);
    expect(state().product).toEqual(saved.product);
    expect(resolveProductType(state().product?.product_type).type).toBeNull();
  });

  it('retains catalogue metadata for dynamic product-type printing without a fallback', () => {
    state().toggleAdditionalInstruction('8H');
    state().appendDigit('1');
    state().confirmNumberPad();
    const texts = ['Pethi', 'Karal', 'Packet', undefined].map((type) => {
      state().setProduct(medicine(type));
      const built = buildFinalInstruction(state().labels[0]);
      expect(built.product?.product_type).toBe(type);
      return render(<LabelCard labelItem={built} />).container.textContent;
    });
    expect(texts[0]).toContain('පෙති 1');
    expect(texts[1]).toContain('කරල් 1');
    expect(texts[2]).toContain('පැකට් 1');
    expect(texts[3]).not.toContain('පෙති');
  });
});
