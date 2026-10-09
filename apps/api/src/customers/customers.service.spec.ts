import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BadRequestException } from '@nestjs/common';

describe('CustomersService', () => {
  let service: CustomersService;
  let supabaseService: SupabaseService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    or: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchByPhone', () => {
    it('should throw BadRequestException if phone is empty', async () => {
      await expect(service.searchByPhone('')).rejects.toThrow(BadRequestException);
    });

    it('should return matched customer records', async () => {
      mockSupabaseClient.or.mockResolvedValueOnce({ data: [], error: null });
      
      const result = await service.searchByPhone('07783939393');
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('customers');
    });
  });
});
