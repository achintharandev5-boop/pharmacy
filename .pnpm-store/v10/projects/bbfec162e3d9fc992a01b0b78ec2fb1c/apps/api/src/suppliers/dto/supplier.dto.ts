import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const PHONE = /^[+\d\s()-]{7,25}$/;

/**
 * Empty strings from optional form fields are accepted and stored as null; they are checked
 * against the format only when a value is present.
 */
export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact_person?: string;

  @IsOptional()
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @Matches(PHONE, { message: 'phone must be a phone number' })
  phone?: string;

  @IsOptional()
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registration_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact_person?: string;

  @IsOptional()
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @Matches(PHONE, { message: 'phone must be a phone number' })
  phone?: string;

  @IsOptional()
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registration_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export const SUPPLIER_FIELDS = [
  'name',
  'contact_person',
  'phone',
  'email',
  'address',
  'registration_number',
  'notes',
  'active',
] as const;
