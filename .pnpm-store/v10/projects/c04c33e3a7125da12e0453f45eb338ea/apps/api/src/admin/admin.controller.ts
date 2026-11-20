import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { ALL_ROLES, type AuthUser } from '../auth/roles';
import {
  DashboardRangeQueryDto,
  DashboardTopProductsQueryDto,
} from './dto/dashboard-query.dto';

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
  @Roles(...ALL_ROLES)
  async getSummary() {
    return this.adminService.getSummary();
  }

  @Get('dashboard/activity')
  @Roles(...ALL_ROLES)
  async getActivity(@Query() query: DashboardRangeQueryDto) {
    return this.adminService.getActivity(query.range);
  }

  @Get('dashboard/status-breakdown')
  @Roles(...ALL_ROLES)
  async getStatusBreakdown(@Query() query: DashboardRangeQueryDto) {
    return this.adminService.getStatusBreakdown(query.range);
  }

  @Get('dashboard/top-products')
  @Roles(...ALL_ROLES)
  async getTopProducts(@Query() query: DashboardTopProductsQueryDto) {
    return this.adminService.getTopProducts(query.range, query.limit ?? 5);
  }

  @Get('dashboard/alerts')
  @Roles(...ALL_ROLES)
  async getAlerts() {
    return this.adminService.getAlerts();
  }

  @Get('dashboard/recent-activity')
  @Roles(...ALL_ROLES)
  async getRecentActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
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
  async getPrescriptions(
    @Query('query') query?: string,
    @Query('status') status?: string,
  ) {
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
  async getLabelLogs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.adminService.getLabelLogs(limit);
  }
}
