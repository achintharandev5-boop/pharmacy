import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, LogSmsDto } from './dto/create-prescription.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { ALL_ROLES, type AuthUser } from '../auth/roles';

@Controller('prescriptions')
@Roles(...ALL_ROLES)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  async create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.prescriptionsService.create(dto, idempotencyKey, user.id);
  }

  @Get()
  async findAll() {
    return this.prescriptionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Post(':id/print')
  @HttpCode(200)
  async logPrint(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.prescriptionsService.logPrint(id, user.id);
  }

  @Post(':id/sms')
  @HttpCode(200)
  async logSms(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LogSmsDto, @CurrentUser() user: AuthUser) {
    return this.prescriptionsService.logSms(id, dto, user.id);
  }
}
