import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenancyService } from './tenancy.service';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private readonly prisma: PrismaClient;

  constructor(private readonly tenancyService: TenancyService) {
    let connectionString = process.env.DATABASE_URL;
    if (connectionString && connectionString.startsWith('prisma+postgres://')) {
      connectionString = 'postgres://postgres:postgres@localhost:51214/template1';
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId = req.headers['x-tenant-id'] as string;

    // 1. Resolve tenantId from Bearer JWT Token
    const authHeader = req.headers.authorization;
    if (!tenantId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.decode(token) as { tenantId?: string };
        if (decoded?.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch (err) {
        // Guard will handle JWT signature verification errors
      }
    }

    // 2. Resolve tenantId from Integration API Keys
    const apiKeyHeader = req.headers['x-api-key'] as string;
    if (!tenantId && apiKeyHeader) {
      try {
        const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
        const keyRecord = await (this.prisma as any).apiKey.findUnique({
          where: { keyHash, isActive: true },
          select: { tenantId: true },
        });
        if (keyRecord) {
          tenantId = keyRecord.tenantId;
        }
      } catch (err) {
        // Guard will handle key validation errors
      }
    }

    if (tenantId) {
      this.tenancyService.runWithTenant(tenantId, () => {
        next();
      });
    } else {
      next();
    }
  }
}
