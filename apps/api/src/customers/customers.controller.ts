import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  DuplicateCustomersQueryDto,
  ListCustomersQueryDto,
} from './dto/list-customers.dto';
import { Roles } from '../auth/decorators';
import { Role } from '../auth/roles';

/** Patient register. Routes without @Roles are limited to the pharmacy staff roles (RolesGuard). */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /** One page of patients: `{ items, total, page, pageSize }`. */
  @Get()
  async list(@Query() query: ListCustomersQueryDto) {
    return this.customersService.list(query);
  }

  @Get('search')
  async search(@Query('phone') phone: string) {
    return this.customersService.searchByPhone(phone);
  }

  /** Patients already registered with this mobile number (a warning, never a block). */
  @Get('duplicates')
  async duplicates(@Query() query: DuplicateCustomersQueryDto) {
    return this.customersService.findDuplicates(query.phone, query.excludeId);
  }

  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  /** Deleting a patient record is restricted to administrators. */
  @Roles(Role.Admin)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }
}
