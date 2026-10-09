import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

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
  async getStatusBreakdown() {
    return this.adminService.getStatusBreakdown();
  }

  @Get('dashboard/top-products')
  async getTopProducts(
    @Query('range') range?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getTopProducts(range, limit ? parseInt(limit, 10) : 5);
  }

  @Get('dashboard/alerts')
  async getAlerts() {
    return this.adminService.getAlerts();
  }

  @Get('dashboard/recent-activity')
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.adminService.getRecentActivity(limit ? parseInt(limit, 10) : 10);
  }

  @Get('health')
  async getHealth() {
    return this.adminService.getHealth();
  }

  @Get('patients/:id')
  async getPatientProfile(@Param('id') id: string) {
    return this.adminService.getPatientProfile(id);
  }

  @Get('prescriptions')
  async getPrescriptions(
    @Query('query') query?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getPrescriptions(query, status);
  }

  @Get('prescriptions/:id')
  async getPrescriptionById(@Param('id') id: string) {
    return this.adminService.getPrescriptionById(id);
  }

  @Post('prescriptions/:id/reprint')
  async reprintPrescriptionLabel(
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.adminService.reprintPrescriptionLabel(id, body?.reason);
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
  async getProductById(@Param('id') id: string) {
    return this.adminService.getProductById(id);
  }

  @Get('products/:id/movements')
  async getProductMovements(@Param('id') id: string) {
    return this.adminService.getProductMovements(id);
  }

  @Get('inventory/summary')
  async getInventoryDashboard() {
    return this.adminService.getInventoryDashboard();
  }

  @Get('labels/logs')
  async getLabelLogs(@Query('limit') limit?: string) {
    return this.adminService.getLabelLogs(limit ? parseInt(limit, 10) : 20);
  }
}

