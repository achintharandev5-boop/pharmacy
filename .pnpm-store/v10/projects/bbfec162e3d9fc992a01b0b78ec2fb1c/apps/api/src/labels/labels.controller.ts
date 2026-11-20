import { Body, Controller, Get, Post } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './labels.dto';

@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  async findAll() {
    return this.labelsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateLabelDto) {
    return this.labelsService.createLabel(dto);
  }
}
