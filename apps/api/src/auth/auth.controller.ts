import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const { data, error } = await this.supabaseService.getClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return data.session;
  }
}
