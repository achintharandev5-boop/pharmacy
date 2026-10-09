import { describe, it, expect } from 'vitest';
import { HARDCODED_PRODUCTS } from './products';

describe('HARDCODED_PRODUCTS dataset', () => {
  it('contains all 21 requested products', () => {
    expect(HARDCODED_PRODUCTS.length).toBe(21);
  });

  it('contains Lasix 40mg Tabs 500s with correct details', () => {
    const lasix = HARDCODED_PRODUCTS.find(p => p.name === "Lasix 40mg Tabs 500's");
    expect(lasix).toBeDefined();
    expect(lasix?.expiry_date).toBe('8/31/2027');
    expect(lasix?.stock_quantity).toBe(2);
    expect(lasix?.pack_size).toBe(500);
    expect(lasix?.product_type).toBe('TABLET');
  });

  it('contains 400-D with correct details', () => {
    const prod = HARDCODED_PRODUCTS.find(p => p.name === '400-D');
    expect(prod).toBeDefined();
    expect(prod?.expiry_date).toBe('1/8/2028');
    expect(prod?.stock_quantity).toBe(2);
    expect(prod?.pack_size).toBe(30);
    expect(prod?.product_type).toBe('CAP');
  });

  it('contains Acemin Syrup 200ml with correct details', () => {
    const prod = HARDCODED_PRODUCTS.find(p => p.name === 'Acemin Syrup 200ml');
    expect(prod).toBeDefined();
    expect(prod?.expiry_date).toBe('1/1/2028');
    expect(prod?.stock_quantity).toBe(3);
    expect(prod?.pack_size).toBe(1);
    expect(prod?.product_type).toBe('SYRUP');
  });

  it('contains Bigmet 500mg Tablets 100s with quantity 10', () => {
    const prod = HARDCODED_PRODUCTS.find(p => p.name === "Bigmet 500mg Tablets 100's");
    expect(prod).toBeDefined();
    expect(prod?.expiry_date).toBe('7/31/2027');
    expect(prod?.stock_quantity).toBe(10);
  });

  it('contains Zithrin and Zithrine', () => {
    const z1 = HARDCODED_PRODUCTS.find(p => p.name === "Zithrin 500mg Tablets 2x6's");
    const z2 = HARDCODED_PRODUCTS.find(p => p.name === "Zithrine 250mg Capsules 2x6's");
    expect(z1).toBeDefined();
    expect(z2).toBeDefined();
  });
});
