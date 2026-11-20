import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PatientReturnDto, ReasonDto, ReceiveStockDto, StockAdjustmentDto } from './dto/inventory.dto';
import { DashboardRangeQueryDto } from '../admin/dto/dashboard-query.dto';
import { DashboardLimitQueryDto, LowStockQueryDto } from './dto/dashboard-query.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { ALL_ROLES, STOCK_MANAGERS, type AuthUser } from '../auth/roles';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  @Roles(...ALL_ROLES)
  async getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('dashboard/expiry')
  @Roles(...ALL_ROLES)
  async getDashboardExpiry(@Query() query: DashboardLimitQueryDto) {
    return this.inventoryService.getUpcomingExpiryBatches(query.limit);
  }

  @Get('dashboard/movement-activity')
  @Roles(...ALL_ROLES)
  async getDashboardMovementActivity(@Query() query: DashboardRangeQueryDto) {
    return this.inventoryService.getMovementActivity(query.range);
  }

  @Get('alerts')
  async getAlerts() {
    return this.inventoryService.getAlerts();
  }

  @Get('batches')
  async getBatches(@Query('query') query?: string, @Query('status') status?: string) {
    return this.inventoryService.getBatches(query, status);
  }

  /** Label workstation: dispensable batches of one medicine and their GRN expiry dates. */
  @Get('dispensing-batches')
  @Roles(...ALL_ROLES)
  async getDispensingBatches(
    @Query('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.inventoryService.getDispensingBatches(productId);
  }

  @Get('movements')
  async getMovements(@Query('query') query?: string, @Query('type') type?: string) {
    return this.inventoryService.getMovements(query, type);
  }

  @Roles(...STOCK_MANAGERS)
  @Post('receipts')
  async receiveStock(
    @Body() dto: ReceiveStockDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.inventoryService.receiveStock(dto, user.id, idempotencyKey);
  }

  @Roles(...STOCK_MANAGERS)
  @Post('adjustments')
  async adjustStock(
    @Body() dto: StockAdjustmentDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.inventoryService.adjustStock(dto, user.id, idempotencyKey);
  }

  @Roles(...STOCK_MANAGERS)
  @Post('batches/:id/quarantine')
  async quarantineBatch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.quarantineBatch(id, dto.reason, user.id);
  }

  @Roles(...STOCK_MANAGERS)
  @Post('batches/:id/release')
  async releaseBatch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.releaseBatch(id, dto.reason, user.id);
  }

  @Get('patient-returns')
  async getPatientReturns(@Query('status') status?: string) {
    return this.inventoryService.getPatientReturns(status);
  }

  /** Any staff member with a role may record a return at the counter; it does not change stock. */
  @Roles(...ALL_ROLES)
  @Post('patient-returns')
  async recordPatientReturn(@Body() dto: PatientReturnDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.recordPatientReturn(dto, user.id);
  }

  @Roles(...STOCK_MANAGERS)
  @Post('patient-returns/:id/dispose')
  async disposePatientReturn(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.disposePatientReturn(id, dto.reason, user.id);
  }

  @Get('expiry')
  async getExpiryMatrix() {
    return this.inventoryService.getExpiryMatrix();
  }

  @Get('low-stock')
  @Roles(...ALL_ROLES)
  async getLowStock(@Query() query: LowStockQueryDto) {
    return this.inventoryService.getLowStock(query.limit);
  }

  @Get('analytics')
  async getAnalytics(@Query('range') range?: string) {
    return this.inventoryService.getAnalytics(range);
  }
}
