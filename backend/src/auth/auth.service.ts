import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'orchestrix-super-secret-jwt-key-2026';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyService: TenancyService,
  ) {}

  async signupTenant(companyName: string, email: string, password: string) {
    // 1. Check if email is already registered globally (or we check per tenant, but since it's a new tenant we can just create it)
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: companyName },
    });
    if (existingTenant) {
      throw new BadRequestException('A company with this name already exists');
    }

    // 2. Create the tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: companyName,
      },
    });

    // 3. Hash password and create the admin user under this tenant
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        passwordHash,
        role: 'ADMIN',
      },
    });

    return {
      tenant,
      user: { id: user.id, email: user.email, role: user.role },
      tokens: this.generateTokens(user.id, tenant.id, user.role),
    };
  }

  async signupUser(email: string, password: string, role: string = 'MEMBER') {
    const tenantId = this.tenancyService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Tenant context is missing');
    }

    // Check if email already registered in this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), tenantId },
    });
    if (existingUser) {
      throw new BadRequestException('User already registered under this tenant');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        passwordHash,
        role,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  async login(email: string, password: string) {
    const tenantId = this.tenancyService.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Tenant context is missing');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), tenantId },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      user: { id: user.id, email: user.email, role: user.role },
      tokens: this.generateTokens(user.id, tenantId, user.role),
    };
  }

  private generateTokens(userId: string, tenantId: string, role: string) {
    const accessToken = jwt.sign(
      { sub: userId, tenantId, role },
      this.jwtSecret,
      { expiresIn: '1d' },
    );
    const refreshToken = jwt.sign(
      { sub: userId, tenantId },
      this.jwtSecret,
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }
}
