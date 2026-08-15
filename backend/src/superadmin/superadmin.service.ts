import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperadminService {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCompanies() {
    this.logger.log('Superadmin: Fetching all registered companies (tenants)');
    
    // We bypass tenant isolation since no tenantId is set in the context
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map(t => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      subscriptionStatus: t.subscriptionStatus || 'BASIC',
      maxUsers: t.maxUsers,
      enableAi: t.enableAi,
      enableVerification: t.enableVerification,
      enableIntegrations: t.enableIntegrations,
      enableMobileSync: t.enableMobileSync,
      userCount: t._count.users,
      createdAt: t.createdAt,
    }));
  }

  async updateCompanyFeatures(
    id: string,
    payload: {
      maxUsers?: number;
      enableAi?: boolean;
      enableVerification?: boolean;
      enableIntegrations?: boolean;
      enableMobileSync?: boolean;
      subscriptionStatus?: string;
    },
  ) {
    this.logger.log(`Superadmin: Updating features for tenant ${id}`);
    
    return this.prisma.tenant.update({
      where: { id },
      data: {
        maxUsers: payload.maxUsers,
        enableAi: payload.enableAi,
        enableVerification: payload.enableVerification,
        enableIntegrations: payload.enableIntegrations,
        enableMobileSync: payload.enableMobileSync,
        subscriptionStatus: payload.subscriptionStatus,
      },
    });
  }

  async getSystemStats() {
    this.logger.log('Superadmin: Compiling system statistics');
    
    const [totalTenants, totalUsers, totalProjects, totalTasks, totalEvaluations] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.task.count(),
      this.prisma.evaluation.count(),
    ]);

    return {
      totalTenants,
      totalUsers,
      totalProjects,
      totalTasks,
      totalEvaluations,
      timestamp: new Date().toISOString(),
    };
  }
}
