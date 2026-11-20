import {
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { SupabaseService } from '../supabase/supabase.service';

describe('Sign-in provider failure containment', () => {
  const signInWithPassword = jest.fn();
  let controller: AuthController;
  let errorLog: jest.SpyInstance;
  const credentials = {
    email: 'synthetic@example.invalid',
    password: 'synthetic-fixture',
  };

  beforeEach(async () => {
    signInWithPassword.mockReset();
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: SupabaseService,
          useValue: {
            createSessionClient: () => ({ auth: { signInWithPassword } }),
          },
        },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  afterEach(() => jest.restoreAllMocks());

  it('redacts thrown provider details and returns a retryable outage', async () => {
    signInWithPassword.mockRejectedValue(new Error('PRIVATE_PROVIDER_DETAIL'));
    await expect(controller.login(credentials)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      'PRIVATE_PROVIDER_DETAIL',
    );
  });

  it('keeps invalid credentials indistinguishable', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { status: 400 },
    });
    await expect(controller.login(credentials)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('reports provider server errors without exposing provider text', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { status: 503, message: 'PRIVATE_PROVIDER_DETAIL' },
    });
    await expect(controller.login(credentials)).rejects.toThrow(
      'Authentication service is unavailable',
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      'PRIVATE_PROVIDER_DETAIL',
    );
  });

  it('returns only the existing access-session fields on success', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'synthetic-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 12345,
          refresh_token: 'private-refresh',
          user: { id: 'private-user' },
        },
      },
      error: null,
    });
    await expect(controller.login(credentials)).resolves.toEqual({
      access_token: 'synthetic-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 12345,
    });
  });
});
