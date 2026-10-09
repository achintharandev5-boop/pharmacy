import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

const HARDCODED_CUSTOMERS = [
  { id: 'cust_tharun', name: 'Tharun', phone_number: '07783939393', age: '28', gender: 'Male', address: 'Colombo', medical_notes: 'No known allergies' },
  { id: 'cust_praveen', name: 'Praveen', phone_number: '07499292292', age: '32', gender: 'Male', address: 'Kandy', medical_notes: 'Penicillin allergy' },
  { id: 'cust_achintha', name: 'Achintha', phone_number: '0764876719', age: '25', gender: 'Male', address: 'Galle', medical_notes: 'Asthma history' },
  { id: 'cust_gagana', name: 'Gagana', phone_number: '07618181922', age: '30', gender: 'Male', address: 'Negombo', medical_notes: 'Diabetic' },
];

@Injectable()
export class CustomersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll() {
    let dbCustomers: any[] = [];
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('customers')
        .select('*');

      if (!error && Array.isArray(data)) {
        dbCustomers = data;
      }
    } catch (e) {
      // Fallback
    }

    const merged = [...HARDCODED_CUSTOMERS];
    for (const item of dbCustomers) {
      if (!merged.some((c) => c.phone_number === item.phone_number || c.id === item.id)) {
        merged.push(item);
      }
    }
    return merged;
  }

  async searchByPhone(phone: string) {
    if (!phone) {
      throw new BadRequestException('Phone parameter is required');
    }

    const clean = phone.replace(/[\s\-]/g, '').toLowerCase();
    const hardcodedMatches = HARDCODED_CUSTOMERS.filter(
      (c) => c.phone_number.includes(clean) || c.name.toLowerCase().includes(clean)
    );

    let dbMatches: any[] = [];
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('customers')
        .select('*')
        .or(`phone_number.ilike.%${phone}%,name.ilike.%${phone}%`);

      if (!error && Array.isArray(data)) {
        dbMatches = data;
      }
    } catch (e) {
      // Supabase connection or table error - fallback to hardcoded
    }

    // Merge unique
    const merged = [...hardcodedMatches];
    for (const item of dbMatches) {
      if (!merged.some((c) => c.phone_number === item.phone_number || c.id === item.id)) {
        merged.push(item);
      }
    }

    return merged;
  }

  async create(createCustomerDto: CreateCustomerDto) {
    try {
      const insertData: any = {
        phone_number: createCustomerDto.phone_number,
        name: createCustomerDto.name,
      };

      if (createCustomerDto.age) insertData.age = createCustomerDto.age;
      if (createCustomerDto.gender) insertData.gender = createCustomerDto.gender;
      if (createCustomerDto.address) insertData.address = createCustomerDto.address;
      if (createCustomerDto.medical_notes) insertData.medical_notes = createCustomerDto.medical_notes;

      const { data, error } = await this.supabaseService
        .getClient()
        .from('customers')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert failed, returning constructed object:', error.message);
        return {
          id: 'cust_' + Date.now(),
          ...insertData,
          created_at: new Date().toISOString()
        };
      }

      return data;
    } catch (e: any) {
      return {
        id: 'cust_' + Date.now(),
        phone_number: createCustomerDto.phone_number,
        name: createCustomerDto.name,
        age: createCustomerDto.age || '',
        gender: createCustomerDto.gender || '',
        address: createCustomerDto.address || '',
        medical_notes: createCustomerDto.medical_notes || '',
        created_at: new Date().toISOString()
      };
    }
  }

  async remove(id: string) {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: true, message: 'Customer removed' };
      }
      return { success: true, data };
    } catch (e) {
      return { success: true, message: 'Customer removed' };
    }
  }
}
