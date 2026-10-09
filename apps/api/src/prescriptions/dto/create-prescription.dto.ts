import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class DosageDto {
  @IsNumber()
  @Min(0)
  morning: number;

  @IsNumber()
  @Min(0)
  lunch: number;

  @IsNumber()
  @Min(0)
  night: number;
}

export class StatDto {
  @IsNumber()
  @Min(0)
  qty: number;

  @IsBoolean()
  isFraction: boolean;

  @IsOptional()
  @IsString()
  followUp?: string;
}

export class CreatePrescriptionItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  alternativeProductName?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  days?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DosageDto)
  dosage?: DosageDto;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StatDto)
  stat?: StatDto;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instructions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reasons?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedDaysOfWeek?: string[];

  @IsOptional()
  @IsBoolean()
  showAddress?: boolean;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
