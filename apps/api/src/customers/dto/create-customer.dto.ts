import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Allergy status must be stated explicitly. An empty allergy field never means "no allergies".
 * Requires migration 20261010000100 (adds the column); omit it until then.
 */
export const ALLERGY_STATUSES = ['UNKNOWN', 'NONE_KNOWN', 'HAS_ALLERGIES'] as const;

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d\s-]{7,20}$/, { message: 'phone_number must be a phone number' })
  phone_number!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  age?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  gender?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  medical_notes?: string;

  @IsOptional()
  @IsIn(ALLERGY_STATUSES)
  allergy_status?: (typeof ALLERGY_STATUSES)[number];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  allergies?: string;
}
