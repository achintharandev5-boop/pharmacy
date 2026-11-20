import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [SupabaseModule],
  controllers: [PosController],
  providers: [PosService],
})
export class PosModule {}
