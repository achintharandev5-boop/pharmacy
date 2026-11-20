import React from 'react';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductToolbar } from './ProductToolbar';
import { useLabelStore } from '../../store/labelStore';

vi.mock('../CustomerSearchInput', () => ({ CustomerSearchInput: () => null }));
vi.mock('../ProductSearchInput', () => ({ ProductSearchInput: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a> }));

const state = () => useLabelStore.getState();

beforeEach(() => state().allClear());

describe('ProductToolbar quantity', () => {
  it('shows quantity as unset instead of implying a default of one', () => {
    render(<ProductToolbar />);

    expect(screen.getByRole('button', { name: 'Product quantity not set. Enter quantity' })).toHaveTextContent('Set');
    expect(screen.getByRole('button', { name: 'Decrease product quantity' })).toBeDisabled();
    expect(state().productQuantity).toBeNull();
  });

  it('sets one only after the operator explicitly taps increase', () => {
    render(<ProductToolbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase product quantity' }));

    expect(state().productQuantity).toBe(1);
    expect(screen.getByRole('button', { name: 'Product quantity: 1' })).toHaveTextContent('1');
  });
});
