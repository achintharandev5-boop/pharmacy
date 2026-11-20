import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StagingGatewayMiddleware } from './staging/staging-gateway.middleware';
import { ReasonsModule } from './reasons/reasons.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { validateEnv } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { LabelsModule } from './labels/labels.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { AdminModule } from './admin/admin.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PosModule } from './pos/pos.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ReasonsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    AuthModule,
    CustomersModule,
    ProductsModule,
    LabelsModule,
    PrescriptionsModule,
    AdminModule,
    InventoryModule,
    SuppliersModule,
    PosModule,
    SettingsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards run in registration order: authenticate first, then check roles.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StagingGatewayMiddleware).forRoutes('{*path}');
  }
}
