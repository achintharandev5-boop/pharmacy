import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrapList, unwrapRequired } from '../common/db';
import { CreateLabelDto } from './labels.dto';

/** Legacy single-label records (table `labels`). Prescriptions are the primary record. */
@Injectable()
export class LabelsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll() {
    return unwrapList(
      await this.supabase.getClient().from('labels').select('*').order('created_at', { ascending: false }).limit(20),
      'load labels',
    );
  }

  async createLabel(dto: CreateLabelDto) {
    const row = {
      customer_id: dto.customer_id ?? null,
      customer_name_text: dto.customer_name_text.trim(),
      product_id: dto.product_id ?? null,
      alternative_product_name: dto.alternative_product_name?.trim() || null,
      days: dto.days ?? null,
      instructions_json: dto.instructions_json,
      printed_at: dto.printed_at ?? null,
    };
    return unwrapRequired(await this.supabase.getClient().from('labels').insert(row).select().single(), 'save the label');
  }
}
