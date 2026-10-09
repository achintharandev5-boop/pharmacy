import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post()
  async create(
    @Body() createPrescriptionDto: CreatePrescriptionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.prescriptionsService.create(createPrescriptionDto, idempotencyKey);
  }

  @Get()
  async findAll() {
    return this.prescriptionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Post(':id/print')
  async logPrint(@Param('id') id: string) {
    return this.prescriptionsService.logPrint(id);
  }

  @Post(':id/sms')
  async logSms(
    @Param('id') id: string,
    @Body() body: { recipient: string; message: string },
  ) {
    return this.prescriptionsService.logSms(id, body.recipient, body.message);
  }
}
