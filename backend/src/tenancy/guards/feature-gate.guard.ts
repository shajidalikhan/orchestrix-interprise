import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { TenancyService } from '../tenancy.service';

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tenancyService: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>('required_feature', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    const tenantId = this.tenancyService.getTenantId();
    if (!tenantId) {
      // Bypassed if no tenantId context exists (e.g. SUPERADMIN requests)
      return true;
    }

    // Lookup tenant config (bypass isolation filter by querying directly using the raw client)
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        enableAi: true,
        enableVerification: true,
        enableIntegrations: true,
        enableMobileSync: true,
      },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant configuration not found');
    }

    const isEnabled = tenant[requiredFeature as keyof typeof tenant];
    if (isEnabled === false) {
      throw new ForbiddenException(`The feature "${requiredFeature}" is disabled under your current subscription plan. Please upgrade to unlock.`);
    }

    return true;
  }
}
