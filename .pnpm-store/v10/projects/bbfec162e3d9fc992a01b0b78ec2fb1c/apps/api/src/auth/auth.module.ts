import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [LoginRateLimitGuard],
})
export class AuthModule {}
