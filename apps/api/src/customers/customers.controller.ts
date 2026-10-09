import { Controller, Get, Post, Delete, Body, Query, Param, BadRequestException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll() {
    return this.customersService.findAll();
  }

  @Get('search')
  async search(@Query('phone') phone: string) {
    if (!phone || phone.trim() === '') {
      return this.customersService.findAll();
    }
    return this.customersService.searchByPhone(phone);
  }

  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
