import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
} from 'class-validator';

/** Independent Weekly workflow metadata in the existing instructions_json column. */
export class WeeklyDosageDto {
  @IsNumber()
  @IsPositive()
  @Max(100)
  qty!: number;

  @IsBoolean()
  isFraction!: boolean;

  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
