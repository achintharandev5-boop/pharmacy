import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PosCatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Matches(/^[\w-]{1,64}$/, { message: 'Invalid barcode' })
  barcode?: string;

  /** Comma-separated product ids (at most 50), to recheck the items already in a cart. */
  @IsOptional()
  @Matches(/^[0-9a-f-]{36}(,[0-9a-f-]{36}){0,49}$/i, {
    message: 'Invalid product ids',
  })
  ids?: string;
}

export class PosCustomerQueryDto {
  @IsString()
  @Matches(/^[\d\s+()-]{1,20}$/, { message: 'Enter a phone number.' })
  phone!: string;
}
