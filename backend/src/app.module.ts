import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VerificationModule } from './verification/verification.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { AiModule } from './ai/ai.module';
import { FreelancersModule } from './freelancers/freelancers.module';
import { DeveloperModule } from './developer/developer.module';
import { BillingModule } from './billing/billing.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SyncModule } from './sync/sync.module';
import { SuperadminModule } from './superadmin/superadmin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    TenancyModule,
    PrismaModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    VerificationModule,
    EvaluationsModule,
    AiModule,
    FreelancersModule,
    DeveloperModule,
    BillingModule,
    SyncModule,
    SuperadminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenancyMiddleware)
      .forRoutes('*');
  }
}
