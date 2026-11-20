import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ALLERGY_STATUSES } from './create-customer.dto';

/**
 * Edit of an existing patient. Only the fields sent are changed. Name and mobile number can be
 * changed but never cleared; for the other text fields an empty string clears the value.
 * Prescriptions keep the patient name they were printed with, so an edit never alters history.
 */
export class UpdateCustomerDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @Matches(/^[+\d\s-]{7,20}$/, {
    message: 'phone_number must be a phone number',
  })
  phone_number?: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must not be blank' })
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  age?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medical_notes?: string;

  @ValidateIf((_, v) => v !== undefined)
  @IsIn(ALLERGY_STATUSES)
  allergy_status?: (typeof ALLERGY_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  allergies?: string;
}
