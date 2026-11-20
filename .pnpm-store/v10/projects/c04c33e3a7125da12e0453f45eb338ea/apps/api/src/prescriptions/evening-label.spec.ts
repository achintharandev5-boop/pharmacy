import { ConfigService } from '@nestjs/config';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

describe('Evening persisted representation', () => {
  it.each([false, true])(
    'preserves independent Evening and Digital quantities, digital=%s',
    async (digital) => {
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
      const dosage = {
        morning: digital ? 1 : 0,
        lunch: digital ? 2 : 0,
        night: digital ? 3 : 0,
      };
      const finalInstructionText = digital
        ? 'උදේට 1  |  දවල් 2  |  හවසට 1½  |  රාත්‍රියට 3 | හිස් බඩ දෙන්න'
        : '1½ හවසට හිස් බඩ දෙන්න';
      await service.create(
        {
          customerName: 'Patient',
          items: [
            {
              productId,
              quantity: 10,
              dosage,
              frequency: 'EVENING',
              frequencyQty: 1.5,
              instructions: ['EVENING', 'EMPTY STOMACH', 'GIVE'],
              finalInstructionText,
            },
          ],
        },
        undefined,
        null,
      );
      const saved: Record<string, unknown> = db.table('prescription_items')[0];
      expect(saved).toMatchObject({
        morning_qty: dosage.morning,
        lunch_qty: dosage.lunch,
        night_qty: dosage.night,
        frequency_type: 'EVENING',
        frequency_qty: 1.5,
        final_instruction_text: finalInstructionText,
      });
      expect(saved.instructions_json).toMatchObject({
        instructions: ['EVENING', 'EMPTY STOMACH', 'GIVE'],
      });
    },
  );
});
