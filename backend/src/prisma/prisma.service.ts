import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenancyService } from '../tenancy/tenancy.service';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  public readonly client;

  constructor(private readonly tenancyService: TenancyService) {
    let connectionString = process.env.DATABASE_URL;
    if (connectionString && connectionString.startsWith('prisma+postgres://')) {
      connectionString = 'postgres://postgres:postgres@localhost:51214/template1';
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter });

    const tenancyServiceRef = this.tenancyService;
    this.client = this.prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const tenantId = tenancyServiceRef.getTenantId();
            
            const tenantIsolatedModels = [
              'User',
              'Project',
              'Task',
              'Evaluation',
              'FreelancerTest',
              'WebhookSubscription',
              'DeviceToken',
              'AuditLog',
              'ApiKey',
            ];

            if (tenantId && tenantIsolatedModels.includes(model)) {
              const anyArgs = args as any;
              
              // Inject tenantId filter to query conditions
              if (['findFirst', 'findMany', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                anyArgs.where = anyArgs.where || {};
                anyArgs.where.tenantId = tenantId;
              }

              // Inject tenantId for creations and updates
              if (operation === 'create') {
                anyArgs.data = anyArgs.data || {};
                anyArgs.data.tenantId = tenantId;
              } else if (operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((item) => ({
                    ...item,
                    tenantId,
                  }));
                } else if (anyArgs.data) {
                  anyArgs.data.tenantId = tenantId;
                }
              } else if (operation === 'upsert') {
                anyArgs.create = anyArgs.create || {};
                anyArgs.create.tenantId = tenantId;
                anyArgs.update = anyArgs.update || {};
                anyArgs.update.tenantId = tenantId;
              }
            }

            return query(args);
          },
        },
      },
    });

    // Proxy model calls to the extended client
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return target.client[prop];
      },
    }) as any;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
export interface PrismaService extends PrismaClient {}
