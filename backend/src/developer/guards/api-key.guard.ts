import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DeveloperService } from '../developer.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly developerService: DeveloperService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API Key missing');
    }

    const payload = await this.developerService.validateApiKey(apiKey);
    if (!payload) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    // Check scope requirements if annotated on the handler
    const requiredScopes = this.reflector.getAllAndOverride<string[]>('api_scopes', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredScopes && requiredScopes.length > 0) {
      const hasScope = requiredScopes.every(scope => payload.scopes.includes(scope));
      if (!hasScope) {
        throw new ForbiddenException(`Insufficient API Key scope. Required: ${requiredScopes.join(', ')}`);
      }
    }

    // Inject developer context into request
    request.user = {
      tenantId: payload.tenantId,
      isApiKey: true,
      scopes: payload.scopes,
    };

    return true;
  }
}
