import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenancyService } from '../../tenancy/tenancy.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret = process.env.JWT_SECRET || 'orchestrix-super-secret-jwt-key-2026';

  constructor(private readonly tenancyService: TenancyService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token missing');
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, this.jwtSecret) as {
        sub: string;
        tenantId: string;
        role: string;
      };

      // Strict Validation: Ensure the tenant ID in the token matches the requested tenant ID in context
      const currentTenantId = this.tenancyService.getTenantId();
      if (!currentTenantId || currentTenantId !== payload.tenantId) {
        throw new UnauthorizedException('Cross-tenant action forbidden');
      }

      // Attach user payload to request for controllers
      request.user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
