import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, unwrap, unwrapList, unwrapRequired } from '../common/db';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  MAX_PATIENT_PAGE_SIZE,
  type ListCustomersQueryDto,
} from './dto/list-customers.dto';

const OPTIONAL_FIELDS = [
  'age',
  'gender',
  'address',
  'medical_notes',
  'allergy_status',
  'allergies',
] as const;
/** Free-text fields an edit may clear. Name, mobile number and allergy status can be changed but not cleared. */
const CLEARABLE_FIELDS = [
  'age',
  'gender',
  'address',
  'medical_notes',
  'allergies',
] as const;
const DEFAULT_PAGE_SIZE = 25;
const DUPLICATE_LIMIT = 20;

/**
 * Mobile number reduced to digits, with the Sri Lankan +94 prefix written as a leading 0, so
 * "+94 77 123 4567" and "077-123-4567" compare equal. Used only to warn about possible duplicates.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('94')
    ? `0${digits.slice(2)}`
    : digits;
}

/** Patients. All results come from the database; there are no built-in records. */
@Injectable()
export class CustomersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  /** One page of the register, ordered by name. Never returns the whole table. */
  async list(query: ListCustomersQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_PAGE_SIZE,
      MAX_PATIENT_PAGE_SIZE,
    );
    const clean = likeTerm(query.q ?? '');
    const filter = clean
      ? `phone_number.ilike.%${clean}%,name.ilike.%${clean}%`
      : null;

    const countQuery = this.db
      .from('customers')
      .select('id', { count: 'exact', head: true });
    const rowsQuery = this.db.from('customers').select('*');
    const [countRes, rowsRes] = await Promise.all([
      filter ? countQuery.or(filter) : countQuery,
      (filter ? rowsQuery.or(filter) : rowsQuery)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1),
    ]);
    unwrap(countRes, 'count patients');
    const items = unwrapList(rowsRes, 'load patients');
    return { items, total: countRes.count ?? items.length, page, pageSize };
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

  /**
   * Patients already registered with the same mobile number. Families often share one number,
   * so this is a warning for the user to check, never a reason to refuse a registration.
   */
  async findDuplicates(phone: string, excludeId?: string) {
    const wanted = normalisePhone(phone);
    if (wanted.length < 7)
      throw new BadRequestException('Phone parameter is required');
    // Match the last nine digits with anything between them, so stored spaces, dashes or a +94
    // prefix do not hide a match; then compare the normalised numbers exactly.
    const pattern = `%${wanted.slice(-9).split('').join('%')}%`;
    const rows = unwrapList<Record<string, string>>(
      await this.db
        .from('customers')
        .select('id, name, phone_number, created_at')
        .ilike('phone_number', pattern)
        .order('name', { ascending: true })
        .limit(DUPLICATE_LIMIT),
      'check for existing patients',
    );
    return rows.filter(
      (r) =>
        r.id !== excludeId && normalisePhone(r.phone_number ?? '') === wanted,
    );
  }

  async create(dto: CreateCustomerDto) {
    const row: Record<string, string> = {
      phone_number: dto.phone_number.trim(),
      name: dto.name.trim(),
    };
    for (const field of OPTIONAL_FIELDS) {
      const value = dto[field];
      if (typeof value === 'string' && value.trim() !== '')
        row[field] = value.trim();
    }

    return unwrapRequired<Record<string, unknown>>(
      await this.db.from('customers').insert(row).select().single(),
      'save the patient',
    );
  }

  /** Changes only the fields sent. The audit trigger on `customers` records which fields changed. */
  async update(id: string, dto: UpdateCustomerDto) {
    const current = unwrap<Record<string, unknown>>(
      await this.db.from('customers').select('*').eq('id', id).maybeSingle(),
      'load the patient',
    );
    if (!current)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Patient not found.',
      });

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.phone_number !== undefined)
      patch.phone_number = dto.phone_number.trim();
    for (const field of CLEARABLE_FIELDS) {
      const value = dto[field];
      if (value !== undefined)
        patch[field] =
          typeof value === 'string' && value.trim() !== ''
            ? value.trim()
            : null;
    }
    if (
      dto.allergy_status !== undefined &&
      dto.allergy_status !== current.allergy_status
    ) {
      patch.allergy_status = dto.allergy_status;
      patch.allergy_status_updated_at = new Date().toISOString();
    }

    // Same rule as the database CHECK, reported clearly instead of as a rejected value.
    const status =
      'allergy_status' in patch ? patch.allergy_status : current.allergy_status;
    const allergies =
      'allergies' in patch ? patch.allergies : current.allergies;
    if (
      status === 'HAS_ALLERGIES' &&
      (typeof allergies !== 'string' || allergies.trim() === '')
    ) {
      throw new BadRequestException({
        code: 'ALLERGIES_REQUIRED',
        message: 'List the allergies when the patient has allergies.',
      });
    }

    const changed = Object.keys(patch).filter(
      (k) =>
        k === 'allergy_status_updated_at' || patch[k] !== (current[k] ?? null),
    );
    if (changed.length === 0) return current;

    return unwrapRequired<Record<string, unknown>>(
      await this.db
        .from('customers')
        .update(patch)
        .eq('id', id)
        .select()
        .single(),
      'update the patient',
    );
  }

  async remove(id: string) {
    const deleted = unwrapList(
      await this.db.from('customers').delete().eq('id', id).select('id'),
      'delete the patient',
    );
    if (deleted.length === 0)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Patient not found.',
      });
    return { success: true, id };
  }
}
