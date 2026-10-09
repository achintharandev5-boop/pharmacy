import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DosageDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  morning!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  lunch!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  night!: number;
}

export class StatDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  qty!: number;

  @IsBoolean()
  isFraction!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  followUp?: string;
}

export class CreatePrescriptionItemDto {
  /** Catalogue product. Omit for a manually named medicine (no stock is deducted). */
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alternativeProductName?: string;

  @IsNumber()
  @Min(0.01)
  @Max(100000)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DosageDto)
  dosage?: DosageDto;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  frequency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  frequencyQty?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => StatDto)
  stat?: StatDto;

  /** Expiry exactly as printed on the label. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  expiryDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  instructions?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  reasons?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  selectedDaysOfWeek?: string[];

  @IsOptional()
  @IsBoolean()
  showAddress?: boolean;

  /** The instruction text exactly as printed, so the record matches the label. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  finalInstructionText?: string;
}

export class CreatePrescriptionDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+\d\s-]{0,20}$/, { message: 'customerPhone must contain only digits, spaces, + or -' })
  customerPhone?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items!: CreatePrescriptionItemDto[];
}

export const SMS_STATUSES = ['SENT', 'FAILED'] as const;

export class LogSmsDto {
  @IsString()
  @Matches(/^[+\d\s-]{7,20}$/, { message: 'recipient must be a phone number' })
  recipient!: string;

  @IsIn(SMS_STATUSES)
  status!: (typeof SMS_STATUSES)[number];

  @IsInt()
  @Min(0)
  @Max(5000)
  messageLength!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}
