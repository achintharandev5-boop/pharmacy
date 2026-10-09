import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ReceiveStockDto, StockAdjustmentDto } from './dto/inventory.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { STOCK_MANAGERS, type AuthUser } from '../auth/roles';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  async getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('alerts')
  async getAlerts() {
    return this.inventoryService.getAlerts();
  }

  @Get('batches')
  async getBatches(@Query('query') query?: string, @Query('status') status?: string) {
    return this.inventoryService.getBatches(query, status);
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
  async adjustStock(@Body() dto: StockAdjustmentDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.adjustStock(dto, user.id);
  }

  @Get('expiry')
  async getExpiryMatrix() {
    return this.inventoryService.getExpiryMatrix();
  }

  @Get('low-stock')
  async getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get('analytics')
  async getAnalytics(@Query('range') range?: string) {
    return this.inventoryService.getAnalytics(range);
  }
}
