import { ConfigService } from '@nestjs/config';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';

describe('Digital Label persisted representation', () => {
  it.each([
    { morning: 1.5, lunch: 0, night: 0.5 },
    { morning: 0.5, lunch: 1.5, night: 2 },
  ])('preserves structured quantities %j and supplied text', async (dosage) => {
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
    const finalInstructionText =
      dosage.lunch === 0
        ? 'උදේට 1½  |  රාත්‍රියට ½ | හිස් බඩ දෙන්න'
        : 'උදේට ½  |  දවල් 1½  |  රාත්‍රියට 2 | හිස් බඩ දෙන්න';
    await service.create(
      {
        customerName: 'Patient',
        items: [
          {
            productId,
            quantity: 10,
            dosage,
            instructions: ['EMPTY STOMACH', 'GIVE'],
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
      final_instruction_text: finalInstructionText,
    });
    expect(saved.instructions_json).toMatchObject({
      instructions: ['EMPTY STOMACH', 'GIVE'],
    });
  });
});
