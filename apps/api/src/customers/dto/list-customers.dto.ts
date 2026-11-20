import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_PATIENT_PAGE_SIZE = 100;

/** One page of the patient register, optionally filtered by name or mobile number. */
export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PATIENT_PAGE_SIZE)
  pageSize?: number;
}

/** Possible duplicates of a mobile number, optionally ignoring the record being edited. */
export class DuplicateCustomersQueryDto {
  @IsString()
  @Matches(/^[+\d\s-]{7,20}$/, { message: 'phone must be a phone number' })
  phone!: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
