import { IsDateString, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateLabelDto {
  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customer_name_text!: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alternative_product_name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;

  @IsObject()
  instructions_json!: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  printed_at?: string;
}
