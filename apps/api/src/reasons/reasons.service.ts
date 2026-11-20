import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrapList, unwrapRequired } from '../common/db';
import { AuthUser } from '../auth/roles';
@Injectable()
export class ReasonsService {
  constructor(private readonly supabase: SupabaseService) {}
  private scope(user: AuthUser) {
    if (
      !user.pharmacyId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        user.pharmacyId,
      )
    )
      throw new ForbiddenException(
        'A trusted pharmacy assignment is required for the reasons catalogue.',
      );
    return user.pharmacyId;
  }
  private text(text: string) {
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 200 ||
      /[\r\n]/.test(text)
    )
      throw new BadRequestException(
        'Enter a nonblank reason of at most 200 characters on one line.',
      );
    return text; // Preserve exact wording; never translate or normalize.
  }
  async list(user: AuthUser, admin = false) {
    const pharmacyId = this.scope(user);
    let query = this.supabase
      .getClient()
      .from('reasons')
      .select('id, text, is_active')
      .eq('pharmacy_id', pharmacyId)
      .order('text');
    if (!admin) query = query.eq('is_active', true);
    return unwrapList(await query, 'load reasons');
  }
  async create(user: AuthUser, text: string) {
    const pharmacyId = this.scope(user);
    return unwrapRequired(
      await this.supabase
        .getClient()
        .from('reasons')
        .insert({
          pharmacy_id: pharmacyId,
          text: this.text(text),
          is_active: true,
          updated_by: user.id,
        })
        .select('id, text, is_active')
        .single(),
      'create reason',
    );
  }
  async edit(user: AuthUser, id: string, text: string) {
    const pharmacyId = this.scope(user);
    return unwrapRequired(
      await this.supabase
        .getClient()
        .from('reasons')
        .update({ text: this.text(text), updated_by: user.id })
        .eq('pharmacy_id', pharmacyId)
        .eq('id', id)
        .select('id, text, is_active')
        .single(),
      'edit reason',
    );
  }
  async deactivate(user: AuthUser, id: string) {
    const pharmacyId = this.scope(user);
    return unwrapRequired(
      await this.supabase
        .getClient()
        .from('reasons')
        .update({ is_active: false, updated_by: user.id })
        .eq('pharmacy_id', pharmacyId)
        .eq('id', id)
        .select('id, text, is_active')
        .single(),
      'deactivate reason',
    );
  }
}
