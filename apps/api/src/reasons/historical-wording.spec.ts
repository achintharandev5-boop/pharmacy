import { ConfigService } from '@nestjs/config';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

describe('Historical reason wording', () => {
  it('stores the complete printed text including exact statement whitespace', async () => {
    const productId = 'f2100000-0000-4000-8000-000000000088';
    const db = new FakeSupabase({
      products: [
        {
          id: productId,
          name: 'Synthetic test product',
          stock_quantity: 20,
          expiry_date: '2099-01-01',
          is_active: true,
        },
      ],
    });
    const service = new PrescriptionsService(
      { getClient: () => db.client() } as unknown as SupabaseService,
      new ConfigService({
        PHARMACY_TIMEZONE: 'Asia/Colombo',
        PRESCRIPTION_WRITE_MODE: 'legacy',
      }),
    );
    const reasons = ['  පරීක්ෂණය එක  ', 'පරීක්ෂණය දෙක  '];
    const printed = 'Synthetic dose\n' + reasons.join('\n');
    await service.create(
      {
        customerName: 'Synthetic test patient',
        items: [
          {
            productId,
            quantity: 1,
            dosage: { morning: 1, lunch: 0, night: 0 },
            days: 1,
            reasons,
            finalInstructionText: printed,
          },
        ],
      },
      undefined,
      '0a000000-0000-4000-8000-000000000011',
    );
    expect(db.table('prescription_items')[0]).toMatchObject({
      instructions_json: { reasons },
      final_instruction_text: printed,
    });
  });
});
