import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SitesModule } from './sites/sites.module';
import { LocationModule } from './location/location.module';
import { ChargingStationsModule } from './charging-stations/charging-stations.module';
import { EvsesModule } from './evses/evses.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { OcppModule } from './ocpp/ocpp.module';
import { OperatorModule } from './operator/operator.module';
import { RecommendationModule } from './recommendations/recommendation.module';
import { WorkOrderModule } from './work-orders/work-order.module';
import { HealthController } from './health.controller';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    OrganizationsModule,
    SitesModule,
    LocationModule,
    ChargingStationsModule,
    EvsesModule,
    ConnectorsModule,
    SessionsModule,
    AuthorizationModule,
    OcppModule,
    OperatorModule,
    RecommendationModule,
    WorkOrderModule,
  ],
  controllers: [HealthController],
  providers: [
    // ThrottlerModule.forRoot() only registers configuration/storage — it
    // does not enforce anything by itself. Without ThrottlerGuard bound
    // globally here, neither the default limit above nor the @Throttle()
    // overrides already declared on LocationController were ever actually
    // checked on any request.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
