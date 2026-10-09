import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InventoryService, ReceiveStockDto, StockAdjustmentDto } from './inventory.service';

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

  @Post('receipts')
  async receiveStock(@Body() dto: ReceiveStockDto) {
    return this.inventoryService.receiveStock(dto);
  }

  @Post('adjustments')
  async adjustStock(@Body() dto: StockAdjustmentDto) {
    return this.inventoryService.adjustStock(dto);
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
