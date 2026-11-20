import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { CreatePrescriptionItemDto } from './dto/create-prescription.dto';

describe('Weekly persisted representation', () => {
  it.each(['WEEKLY', 'DAILY', 'EVENING', 'DIGITAL', 'STAT'])(
    'preserves independent Weekly metadata with %s and exact final text',
    async (schedule) => {
      const db = new FakeSupabase({});
      const service = new PrescriptionsService(
        { getClient: () => db.client() } as unknown as SupabaseService,
        { get: () => 'Asia/Colombo' } as unknown as ConfigService,
      );
      const weekly = { qty: 1.5, isFraction: true, confirmed: true };
      const instructions = [
        ...(schedule === 'STAT' ? ['STAT'] : []),
        'WEEKLY',
        ...(['DAILY', 'EVENING'].includes(schedule) ? [schedule] : []),
        'EMPTY STOMACH',
        'TAKE',
      ];
      const text =
        schedule === 'DIGITAL'
          ? 'සතියකට වරක් උදේට 1 | රාත්‍රියට ½ හිස් බඩ ගන්න'
          : schedule === 'DAILY'
            ? 'සතියකට වරක් දිනකට ½ හිස් බඩ ගන්න'
            : schedule === 'EVENING'
              ? 'සතියකට වරක් ½ හවසට හිස් බඩ ගන්න'
              : `${schedule === 'STAT' ? 'පළමුව පමණක් 2 ගන්න ඉන්පසු, ' : ''}සතියකට වරක් 1½ හිස් බඩ ගන්න`;
      await service.create(
        {
          customerName: 'Patient',
          items: [
            {
              alternativeProductName: 'Medicine',
              quantity: 10,
              weekly,
              dosage: {
                morning: schedule === 'DIGITAL' ? 1 : 0,
                lunch: 0,
                night: schedule === 'DIGITAL' ? 0.5 : 0,
              },
              frequency:
                schedule === 'DIGITAL'
                  ? undefined
                  : schedule === 'STAT'
                    ? 'WEEKLY'
                    : schedule,
              frequencyQty:
                schedule === 'DIGITAL'
                  ? undefined
                  : ['DAILY', 'EVENING'].includes(schedule)
                    ? 0.5
                    : 1.5,
              stat:
                schedule === 'STAT'
                  ? { qty: 2, isFraction: false, followUp: 'WEEKLY' }
                  : undefined,
              instructions,
              finalInstructionText: text,
            },
          ],
        },
        undefined,
        null,
      );
      expect(db.table('prescription_items')[0]).toMatchObject({
        instructions_json: { weekly, instructions },
        final_instruction_text: text,
        morning_qty: schedule === 'DIGITAL' ? 1 : 0,
        night_qty: schedule === 'DIGITAL' ? 0.5 : 0,
        frequency_qty:
          schedule === 'DIGITAL'
            ? null
            : ['DAILY', 'EVENING'].includes(schedule)
              ? 0.5
              : 1.5,
        stat_qty: schedule === 'STAT' ? 2 : null,
      });
    },
  );

  it.each([0, -1, Infinity, NaN, '1', undefined])(
    'rejects invalid Weekly metadata quantity %s',
    async (qty) => {
      const dto = plainToInstance(CreatePrescriptionItemDto, {
        quantity: 10,
        weekly: { qty, isFraction: true },
      });
      expect((await validate(dto, { whitelist: true })).length).toBeGreaterThan(
        0,
      );
    },
  );

  it('retains whitelisted metadata and allows unchanged legacy API records without it', async () => {
    const dto = plainToInstance(CreatePrescriptionItemDto, {
      quantity: 10,
      weekly: { qty: 0.5, isFraction: true, confirmed: true, other: 'drop' },
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.weekly).toEqual({ qty: 0.5, isFraction: true, confirmed: true });
    expect(
      await validate(
        plainToInstance(CreatePrescriptionItemDto, {
          quantity: 10,
          instructions: ['WEEKLY'],
        }),
        { whitelist: true },
      ),
    ).toEqual([]);
  });
});
