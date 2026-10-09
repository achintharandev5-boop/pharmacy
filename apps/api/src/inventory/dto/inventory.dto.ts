import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReceiveStockItemDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  batchNumber!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  purchaseCost!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10_000_000)
  retailPrice?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  manufacturedDate?: string;

  /** Required: received stock must carry the expiry printed on the pack. */
  @IsDateString({ strict: true })
  expiryDate!: string;
}

export class ReceiveStockDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  grnNumber?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockItemDto)
  items!: ReceiveStockItemDto[];
}

export const ADJUSTMENT_TYPES = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'RETURNED'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

/** Adjustment types that reduce stock. RETURNED adds stock (unchanged from the existing behaviour). */
export const DECREASING_TYPES: readonly AdjustmentType[] = ['ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED'];

export class StockAdjustmentDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsIn(ADJUSTMENT_TYPES)
  type!: AdjustmentType;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
