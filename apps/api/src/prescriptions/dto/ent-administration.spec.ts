import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePrescriptionItemDto } from './create-prescription.dto';

const ent = { site: 'nose', direction: 'left', unit: 'spray', pluralUnit: 'sprays', template: 'Apply {qty} {unit} to {location} {time}.' };

describe('ENT prescription metadata', () => {
  it('accepts optional metadata without changing existing instruction limits', async () => {
    const dto = plainToInstance(CreatePrescriptionItemDto, { quantity: 1, instructions: ['CUSTOM'], frequency: 'CUSTOM', frequencyQty: 2, ent: { ...ent, customHours: 3, startDay: '2026-11-01', endDay: '2026-11-04' } });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    expect(dto.ent).toMatchObject({ ...ent, customHours: 3, startDay: '2026-11-01', endDay: '2026-11-04' });
    expect(await validate(plainToInstance(CreatePrescriptionItemDto, { quantity: 1 }))).toEqual([]);
  });
  it.each([
    { ...ent, customHours: 0 },
    { ...ent, customHours: 25 },
    { ...ent, customHours: 1.5 },
    { ...ent, startDay: '2026-02-30' },
    { ...ent, endDay: 'invalid' },
    { ...ent, site: 'invalid' },
    { ...ent, direction: 'invalid' },
    { ...ent, unit: '' },
    { ...ent, template: 'Missing quantity and location' },
  ])('rejects invalid ENT configuration', async invalid => {
    const errors = await validate(plainToInstance(CreatePrescriptionItemDto, { quantity: 1, ent: invalid }));
    expect(errors.some(e => e.property === 'ent')).toBe(true);
  });
});
