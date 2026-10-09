import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/roles';

export class ReprintDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  async getSummary() {
    return this.adminService.getSummary();
  }

  @Get('dashboard/activity')
  async getActivity(@Query('range') range?: string) {
    return this.adminService.getActivity(range);
  }

  @Get('dashboard/status-breakdown')
  async getStatusBreakdown(@Query('range') range?: string) {
    return this.adminService.getStatusBreakdown(range);
  }

  @Get('dashboard/top-products')
  async getTopProducts(
    @Query('range') range?: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit = 5,
  ) {
    return this.adminService.getTopProducts(range, limit);
  }

  @Get('dashboard/alerts')
  async getAlerts() {
    return this.adminService.getAlerts();
  }

  @Get('dashboard/recent-activity')
  async getRecentActivity(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10) {
    return this.adminService.getRecentActivity(limit);
  }

  @Get('health')
  async getHealth() {
    return this.adminService.getHealth();
  }

  @Get('patients/:id')
  async getPatientProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getPatientProfile(id);
  }

  @Get('prescriptions')
  async getPrescriptions(@Query('query') query?: string, @Query('status') status?: string) {
    return this.adminService.getPrescriptions(query, status);
  }

  @Get('prescriptions/:id')
  async getPrescriptionById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getPrescriptionById(id);
  }

  @Post('prescriptions/:id/reprint')
  @HttpCode(200)
  async reprintPrescriptionLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReprintDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.adminService.reprintPrescriptionLabel(id, body.reason, user.id);
  }

  @Get('products')
  async getProducts(
    @Query('query') query?: string,
    @Query('category') category?: string,
    @Query('stockStatus') stockStatus?: string,
  ) {
    return this.adminService.getProducts(query, category, stockStatus);
  }

  @Get('products/:id')
  async getProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getProductById(id);
  }

  @Get('products/:id/movements')
  async getProductMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getProductMovements(id);
  }

  @Get('inventory/summary')
  async getInventoryDashboard() {
    return this.adminService.getInventoryDashboard();
  }

  @Get('labels/logs')
  async getLabelLogs(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20) {
    return this.adminService.getLabelLogs(limit);
  }
}
