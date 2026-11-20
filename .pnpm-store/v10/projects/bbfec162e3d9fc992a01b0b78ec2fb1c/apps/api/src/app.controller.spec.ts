import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { SupabaseService } from './supabase/supabase.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: SupabaseService,
          useValue: { getClient: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status ok', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
