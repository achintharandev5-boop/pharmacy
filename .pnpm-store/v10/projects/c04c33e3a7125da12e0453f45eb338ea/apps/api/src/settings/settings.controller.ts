import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { ALL_ROLES, Role, type AuthUser } from '../auth/roles';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Pharmacy staff can read the settings; the cashier and accounts without a role cannot. */
  @Get()
  @Roles(...ALL_ROLES)
  get() {
    return this.settings.get();
  }

  @Patch()
  @Roles(Role.Admin)
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateSettingsDto) {
    return this.settings.update(user, body);
  }
}
