import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchByName', () => {
    it('should throw BadRequestException if q is empty', async () => {
      await expect(service.searchByName('')).rejects.toThrow(BadRequestException);
    });

    it('should return a partial match (text search with partial match)', async () => {
      const mockData = [{ id: '1', name: 'Panadol' }];
      mockSupabaseClient.ilike.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.searchByName('Pana');
      
      expect(result).toBeDefined();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products');
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('name', '%Pana%');
    });

    it('should return empty array or hardcoded array for no DB results', async () => {
      mockSupabaseClient.ilike.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.searchByName('NonExistent');
      
      expect(result).toBeDefined();
      expect(mockSupabaseClient.ilike).toHaveBeenCalledWith('name', '%NonExistent%');
    });
  });

  describe('findByBarcode', () => {
    it('should return product if barcode found (barcode found)', async () => {
      const mockData = { id: '1', name: 'Test', barcode: '123', retail_price: 10 };
      mockSupabaseClient.single.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.findByBarcode('123');
      
      expect(result).toEqual(mockData);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('barcode', '123');
      expect(mockSupabaseClient.single).toHaveBeenCalled();
    });

    it('should throw NotFoundException if barcode not found (barcode not found)', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      await expect(service.findByBarcode('999')).rejects.toThrow(NotFoundException);
    });
  });
});
