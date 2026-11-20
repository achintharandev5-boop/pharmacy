import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ReasonsService } from './reasons.service';
import {
  ReasonsController,
  AdminReasonsController,
} from './reasons.controller';
@Module({
  imports: [SupabaseModule],
  controllers: [ReasonsController, AdminReasonsController],
  providers: [ReasonsService],
})
export class ReasonsModule {}
