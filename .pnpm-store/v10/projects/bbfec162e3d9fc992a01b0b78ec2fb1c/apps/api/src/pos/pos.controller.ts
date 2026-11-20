import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { POS_SELLERS, STOCK_MANAGERS, type AuthUser } from '../auth/roles';
import { PosCatalogQueryDto, PosCustomerQueryDto } from './dto/pos.dto';
import { PosService } from './pos.service';

/**
 * Point of sale. Every route names its roles explicitly, so an account without a role is
 * always refused. Checkout, payments and invoices are not implemented: they wait for the
 * accountant's decisions (PHARMACY_POS_IMPLEMENTATION_PLAN.md §4).
 */
@Controller('pos')
@Roles(...POS_SELLERS)
export class PosController {
  constructor(private readonly posService: PosService) {}

  /** Batch numbers are shown only to stock managers ("batch visibility where authorized"). */
  @Get('catalog')
  async catalog(
    @Query() query: PosCatalogQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const includeBatches =
      user.role !== null && STOCK_MANAGERS.includes(user.role);
    return this.posService.searchCatalog(query, includeBatches);
  }

  /** Minimal patient lookup by phone (no records, history or clinical details). */
  @Get('customers')
  async customers(@Query() query: PosCustomerQueryDto) {
    return this.posService.lookupCustomers(query.phone);
  }
}
