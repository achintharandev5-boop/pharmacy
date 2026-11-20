import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { AnyAuthenticatedUser, CurrentUser, Public } from './decorators';
import type { AuthUser } from './roles';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Public()
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    const client = this.supabaseService.createSessionClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      const status = (error as { status?: number }).status;
      if (status === undefined || status >= 500) {
        this.logger.error(
          `Sign-in failed: authentication service error (${status ?? 'network'})`,
        );
        throw new ServiceUnavailableException(
          'Authentication service is unavailable. Please try again.',
        );
      }
      // Same message for unknown user and wrong password.
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!data.session) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Return only what the web app needs; never the full user object.
    return {
      access_token: data.session.access_token,
      token_type: data.session.token_type,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
    };
  }

  /**
   * The signed-in user's identity and role, as the API sees them. Open to any signed-in account,
   * including one without a role, so the interface can explain what access is missing.
   */
  @AnyAuthenticatedUser()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
