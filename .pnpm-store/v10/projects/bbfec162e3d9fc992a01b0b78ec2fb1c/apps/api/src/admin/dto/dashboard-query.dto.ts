import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const DASHBOARD_RANGES = ['7d', '30d', '90d'] as const;

export class DashboardRangeQueryDto {
  @IsOptional()
  @IsIn(DASHBOARD_RANGES)
  range?: (typeof DASHBOARD_RANGES)[number];
}

export class DashboardTopProductsQueryDto extends DashboardRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
