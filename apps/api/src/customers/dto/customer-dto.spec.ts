import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateCustomerDto } from './update-customer.dto';
import {
  DuplicateCustomersQueryDto,
  ListCustomersQueryDto,
} from './list-customers.dto';

describe('patient DTO validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const body = (value: object) =>
    pipe.transform(value, { type: 'body', metatype: UpdateCustomerDto });
  const listQuery = (value: object) =>
    pipe.transform(value, { type: 'query', metatype: ListCustomersQueryDto });
  const dupQuery = (value: object) =>
    pipe.transform(value, {
      type: 'query',
      metatype: DuplicateCustomersQueryDto,
    });

  it('accepts a partial edit and drops unknown fields', async () => {
    await expect(
      body({ address: 'Kandy', id: 'x', created_at: 'y' }),
    ).resolves.toEqual({ address: 'Kandy' });
  });

  it.each([
    ['a blank name', { name: '   ' }],
    ['a null name', { name: null }],
    ['a null mobile number', { phone_number: null }],
    ['an invalid mobile number', { phone_number: 'call me' }],
    ['an unknown allergy status', { allergy_status: 'MAYBE' }],
    ['a null allergy status', { allergy_status: null }],
    ['an over-long address', { address: 'x'.repeat(501) }],
  ])('rejects %s', async (_label, value) => {
    await expect(body(value)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converts paging parameters and enforces their bounds', async () => {
    await expect(
      listQuery({ q: 'nimal', page: '2', pageSize: '50' }),
    ).resolves.toMatchObject({ q: 'nimal', page: 2, pageSize: 50 });
    await expect(listQuery({ page: '0' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(listQuery({ pageSize: '101' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(listQuery({ page: 'two' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires a phone number and a valid excluded id for the duplicate check', async () => {
    await expect(dupQuery({ phone: '0771234567' })).resolves.toMatchObject({
      phone: '0771234567',
    });
    await expect(dupQuery({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      dupQuery({ phone: '0771234567', excludeId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
