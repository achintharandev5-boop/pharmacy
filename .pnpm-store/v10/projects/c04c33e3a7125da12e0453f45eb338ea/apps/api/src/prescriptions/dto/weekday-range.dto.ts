import { Equals, IsIn } from 'class-validator';

const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/** Weekday endpoints only; no dates, duration or inferred week ordering. */
export class WeekdayRangeDto {
  @IsIn(WEEKDAYS)
  start!: string;

  @IsIn(WEEKDAYS)
  end!: string;

  @Equals(true)
  confirmed!: boolean;
}
