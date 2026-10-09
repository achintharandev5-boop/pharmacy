import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let supabaseMock: any;

  beforeEach(async () => {
    supabaseMock = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'rx_test_123', prescription_number: 'RX-20261005-000001' },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject prescription creation if requested stock exceeds available stock', async () => {
    const dto: any = {
      customerName: 'Test Patient',
      items: [
        {
          productId: 'prod_lasix_40', // Available: 50
          quantity: 100, // Requested 100 > 50
        },
      ],
    };

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('should reject prescription creation if product is expired', async () => {
    // Mock an expired product
    supabaseMock.getClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'prod_expired',
                name: 'Expired Syrup',
                stock_quantity: 100,
                expiry_date: '2020-01-01',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const dto: any = {
      customerName: 'Test Patient',
      items: [
        {
          productId: 'prod_expired',
          quantity: 1,
        },
      ],
    };

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
  });
});
