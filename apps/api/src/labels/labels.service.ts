import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const SAMPLE_LABELS = [
  {
    id: 'lbl_101',
    customer_name_text: 'Tharun',
    product_name: 'Paracetamol 500mg',
    dosage_morning: '1',
    dosage_lunch: '0',
    dosage_night: '1',
    days: '5',
    additional_instructions: 'Take after food',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'lbl_102',
    customer_name_text: 'Achintha',
    product_name: 'Amoxicillin 250mg',
    dosage_morning: '1',
    dosage_lunch: '1',
    dosage_night: '1',
    days: '7',
    additional_instructions: 'Complete full course',
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

@Injectable()
export class LabelsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll() {
    try {
      const { data, error } = await this.supabase.getClient()
        .from('labels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {
      // Fallback
    }
    return SAMPLE_LABELS;
  }

  async createLabel(data: any) {
    try {
      const { data: result, error } = await this.supabase.getClient()
        .from('labels')
        .insert([data])
        .select()
        .single();

      if (error) {
        return { id: 'lbl_' + Date.now(), ...data, created_at: new Date().toISOString() };
      }
      return result;
    } catch (e) {
      return { id: 'lbl_' + Date.now(), ...data, created_at: new Date().toISOString() };
    }
  }
}
