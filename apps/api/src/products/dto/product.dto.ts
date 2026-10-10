import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/**
 * Catalogue fields only. Stock quantity, batches and expiry dates are never set here: they
 * change only through goods receiving, adjustments and dispensing, which keep the ledger.
 */
class ProductFields {
  @IsOptional() @IsString() @MaxLength(200) generic_name?: string;
  @IsOptional() @IsString() @MaxLength(200) brand_name?: string;
  @IsOptional() @IsString() @MaxLength(60) strength?: string;
  @IsOptional() @IsString() @MaxLength(60) dosage_form?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(200) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(30) unit_of_measure?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) pack_size?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) retail_price?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) reorder_level?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) minimum_stock?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) maximum_stock?: number;
  @IsOptional() @IsBoolean() rx_required?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class CreateProductDto extends ProductFields {
  /** The name printed on labels. */
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;

  @IsString() @Matches(/^[\w-]{1,64}$/, { message: 'barcode may contain letters, digits, - and _ only' }) barcode!: string;
}

export class UpdateProductDto extends ProductFields {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;

  @IsOptional() @IsString() @Matches(/^[\w-]{1,64}$/, { message: 'barcode may contain letters, digits, - and _ only' }) barcode?: string;
}

export const PRODUCT_FIELDS = [
  'name',
  'barcode',
  'generic_name',
  'brand_name',
  'strength',
  'dosage_form',
  'category',
  'manufacturer',
  'unit_of_measure',
  'pack_size',
  'retail_price',
  'reorder_level',
  'minimum_stock',
  'maximum_stock',
  'rx_required',
  'is_active',
] as const;
