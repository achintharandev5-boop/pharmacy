import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, unwrapList, unwrapRequired } from '../common/db';
import { CreateCustomerDto } from './dto/create-customer.dto';

const OPTIONAL_FIELDS = ['age', 'gender', 'address', 'medical_notes', 'allergy_status', 'allergies'] as const;

/** Patients. All results come from the database; there are no built-in records. */
@Injectable()
export class CustomersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  async findAll() {
    return unwrapList(
      await this.db.from('customers').select('*').order('name', { ascending: true }),
      'load patients',
    );
  }

  async searchByPhone(term: string) {
    const clean = likeTerm(term ?? '');
    if (!clean) throw new BadRequestException('Phone parameter is required');
    return unwrapList(
      await this.db
        .from('customers')
        .select('*')
        .or(`phone_number.ilike.%${clean}%,name.ilike.%${clean}%`)
        .order('name', { ascending: true })
        .limit(50),
      'search patients',
    );
  }

  async create(dto: CreateCustomerDto) {
    const row: Record<string, string> = {
      phone_number: dto.phone_number.trim(),
      name: dto.name.trim(),
    };
    for (const field of OPTIONAL_FIELDS) {
      const value = dto[field];
      if (typeof value === 'string' && value.trim() !== '') row[field] = value.trim();
    }

    return unwrapRequired(await this.db.from('customers').insert(row).select().single(), 'save the patient');
  }

  async remove(id: string) {
    const deleted = unwrapList(await this.db.from('customers').delete().eq('id', id).select('id'), 'delete the patient');
    if (deleted.length === 0) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Patient not found.' });
    return { success: true, id };
  }
}
