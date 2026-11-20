import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
