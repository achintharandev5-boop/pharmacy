import { Controller, Get, Post, Body } from '@nestjs/common';
import { LabelsService } from './labels.service';

@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  async findAll() {
    return this.labelsService.findAll();
  }

  @Post()
  async create(@Body() createLabelDto: any) {
    return this.labelsService.createLabel(createLabelDto);
  }
}
