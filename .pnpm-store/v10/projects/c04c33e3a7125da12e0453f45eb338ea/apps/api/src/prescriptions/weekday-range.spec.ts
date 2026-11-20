import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { CreatePrescriptionItemDto } from './dto/create-prescription.dto';

describe('Weekday range persisted representation', () => {
  it.each(['FRIDAY', 'MONDAY'])(
    'retains %s endpoint metadata and exact generated Sinhala text',
    async (end) => {
      const db = new FakeSupabase({});
      const service = new PrescriptionsService(
        { getClient: () => db.client() } as unknown as SupabaseService,
        { get: () => 'Asia/Colombo' } as unknown as ConfigService,
      );
      const weekdayRange = { start: 'MONDAY', end, confirmed: true };
      const text = `සඳුදා සිට ${end === 'FRIDAY' ? 'සිකුරාදා' : 'සඳුදා'} දක්වා දිනකට ½ හිස් බඩ ගන්න`;
      await service.create(
        {
          customerName: 'Patient',
          items: [
            {
              alternativeProductName: 'Medicine',
              quantity: 10,
              weekdayRange,
              selectedDaysOfWeek: [],
              instructions: ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH', 'TAKE'],
              frequency: 'DAILY',
              frequencyQty: 0.5,
              finalInstructionText: text,
            },
          ],
        },
        undefined,
        null,
      );
      expect(db.table('prescription_items')[0]).toMatchObject({
        instructions_json: { weekdayRange, selectedDaysOfWeek: [] },
        final_instruction_text: text,
        frequency_qty: 0.5,
      });
    },
  );
  it.each([
    {},
    { start: 'MONDAY' },
    { end: 'FRIDAY' },
    { start: 'BAD', end: 'FRIDAY', confirmed: true },
    { start: 'MONDAY', end: 'BAD', confirmed: true },
    { start: 'MONDAY', end: 'FRIDAY', confirmed: false },
    { start: ['MONDAY'], end: 'FRIDAY', confirmed: true },
  ])('rejects malformed range metadata %j', async (weekdayRange) => {
    const dto = plainToInstance(CreatePrescriptionItemDto, {
      quantity: 10,
      weekdayRange,
    });
    expect((await validate(dto, { whitelist: true })).length).toBeGreaterThan(
      0,
    );
  });
  it('retains valid whitelisted metadata and accepts unchanged historical payloads without it', async () => {
    const dto = plainToInstance(CreatePrescriptionItemDto, {
      quantity: 10,
      weekdayRange: {
        start: 'MONDAY',
        end: 'FRIDAY',
        confirmed: true,
        other: 'drop',
      },
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.weekdayRange).toEqual({
      start: 'MONDAY',
      end: 'FRIDAY',
      confirmed: true,
    });
    expect(
      await validate(
        plainToInstance(CreatePrescriptionItemDto, { quantity: 10 }),
        { whitelist: true },
      ),
    ).toEqual([]);
  });
});
