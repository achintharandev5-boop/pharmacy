import { ConfigService } from '@nestjs/config';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

describe('Daily persisted representation', () => {
  it.each(['DAILY', 'STAT', 'EOD', 'WEEKLY'])(
    'preserves %s modifier, Daily quantity and exact text',
    async (modifier) => {
      const productId = '11111111-1111-4111-8111-111111111111';
      const db = new FakeSupabase({
        products: [
          {
            id: productId,
            name: 'Medicine',
            stock_quantity: 100,
            expiry_date: '2030-01-01',
            is_active: true,
          },
        ],
      });
      const service = new PrescriptionsService(
        { getClient: () => db.client() } as unknown as SupabaseService,
        { get: () => 'Asia/Colombo' } as unknown as ConfigService,
      );
      const instructions = [
        ...(modifier === 'DAILY' ? [] : [modifier]),
        'DAILY',
        'EMPTY STOMACH',
        'GIVE',
      ];
      const finalInstructionText = `${modifier === 'STAT' ? 'පළමුව පමණක් 2½ ගන්න ඉන්පසු, ' : modifier === 'EOD' ? 'දිනක් හැර දිනක්, ' : modifier === 'WEEKLY' ? 'සතියකට වරක් ' : ''}දිනකට ½ හිස් බඩ දෙන්න`;
      await service.create(
        {
          customerName: 'Patient',
          items: [
            {
              productId,
              quantity: 10,
              dosage: { morning: 0, lunch: 0, night: 0 },
              frequency: 'DAILY',
              frequencyQty: 0.5,
              stat:
                modifier === 'STAT'
                  ? { qty: 2.5, isFraction: true, followUp: 'DAILY' }
                  : undefined,
              instructions,
              finalInstructionText,
            },
          ],
        },
        undefined,
        null,
      );
      const saved: Record<string, unknown> = db.table('prescription_items')[0];
      expect(saved).toMatchObject({
        frequency_type: 'DAILY',
        frequency_qty: 0.5,
        morning_qty: 0,
        lunch_qty: 0,
        night_qty: 0,
        final_instruction_text: finalInstructionText,
      });
      expect(saved.instructions_json).toMatchObject({ instructions });
      if (modifier === 'STAT') expect(saved.stat_qty).toBe(2.5);
    },
  );
});
