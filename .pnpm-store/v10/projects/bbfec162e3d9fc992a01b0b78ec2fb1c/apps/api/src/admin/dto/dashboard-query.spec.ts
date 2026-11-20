import {
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { AdminController } from '../admin.controller';
import { InventoryController } from '../../inventory/inventory.controller';
import { PrescriptionsController } from '../../prescriptions/prescriptions.controller';
import { RolesGuard } from '../../auth/roles.guard';
import { ALL_ROLES } from '../../auth/roles';
import { ROLES_KEY } from '../../auth/decorators';
import {
  DashboardRangeQueryDto,
  DashboardTopProductsQueryDto,
} from './dashboard-query.dto';

describe('dashboard query validation and access metadata', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const methodTarget = (prototype: object, property: string) =>
    Object.getOwnPropertyDescriptor(prototype, property)?.value as object;

  it('accepts supported ranges and numeric top-product limits', async () => {
    const range = (await pipe.transform(
      { range: '7d' },
      { type: 'query', metatype: DashboardRangeQueryDto },
    )) as DashboardRangeQueryDto;
    const top = (await pipe.transform(
      { range: '30d', limit: '6' },
      { type: 'query', metatype: DashboardTopProductsQueryDto },
    )) as DashboardTopProductsQueryDto;
    expect(range).toMatchObject({ range: '7d' });
    expect(top).toMatchObject({ range: '30d', limit: 6 });
  });

  it('rejects unsupported ranges and limits outside the API bounds', async () => {
    await expect(
      pipe.transform(
        { range: '365d' },
        { type: 'query', metatype: DashboardRangeQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { limit: '0' },
        { type: 'query', metatype: DashboardTopProductsQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { limit: '51' },
        { type: 'query', metatype: DashboardTopProductsQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a pharmacy role for dashboard and dashboard inventory reads', () => {
    for (const target of [
      methodTarget(AdminController.prototype, 'getSummary'),
      methodTarget(AdminController.prototype, 'getActivity'),
      methodTarget(AdminController.prototype, 'getTopProducts'),
      methodTarget(InventoryController.prototype, 'getDashboardExpiry'),
      methodTarget(
        InventoryController.prototype,
        'getDashboardMovementActivity',
      ),
      methodTarget(InventoryController.prototype, 'getSummary'),
      methodTarget(InventoryController.prototype, 'getLowStock'),
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, target)).toEqual(ALL_ROLES);
    }
    expect(Reflect.getMetadata(ROLES_KEY, PrescriptionsController)).toEqual(
      ALL_ROLES,
    );
  });

  it('rejects dashboard reads when a verified user has no pharmacy role', () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === ROLES_KEY ? ALL_ROLES : undefined,
    };
    const guard = new RolesGuard(reflector as never);
    const context = {
      getHandler: () => methodTarget(AdminController.prototype, 'getSummary'),
      getClass: () => AdminController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'user-without-role', role: null } }),
      }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
