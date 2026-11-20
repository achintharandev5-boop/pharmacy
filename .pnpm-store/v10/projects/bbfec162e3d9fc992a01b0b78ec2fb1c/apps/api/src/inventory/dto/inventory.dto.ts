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

/**
 * Stock adjustments. Returns are not adjustments in the old sense:
 *   SUPPLIER_RETURN  units physically sent back to the supplier; removes them from a batch
 *   patient returns  recorded separately (PatientReturnDto) and never added back to stock
 * The former RETURNED type (which added stock) is refused.
 */
export const ADJUSTMENT_TYPES = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'SUPPLIER_RETURN'] as const;
export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

/** Adjustment types that reduce stock. Only ADJUSTMENT_IN (a recount) increases it. */
export const DECREASING_TYPES: readonly AdjustmentType[] = ['ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'SUPPLIER_RETURN'];

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

/** A reason for a quarantine, release or disposal; kept in the audit history. */
export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Medicine brought back by a patient. Held for review; it does not change stock. */
export class PatientReturnDto {
  /** Catalogue medicine, when known. */
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Required when the medicine is not in the catalogue. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchNumber?: string;

  @IsOptional()
  @IsUUID()
  prescriptionId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
