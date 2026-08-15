import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class SuperadminController {
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('companies')
  async getCompanies() {
    return this.superadminService.getCompanies();
  }

  @Put('companies/:id/features')
  async updateCompanyFeatures(
    @Param('id') id: string,
    @Body() payload: {
      maxUsers?: number;
      enableAi?: boolean;
      enableVerification?: boolean;
      enableIntegrations?: boolean;
      enableMobileSync?: boolean;
      subscriptionStatus?: string;
    },
  ) {
    return this.superadminService.updateCompanyFeatures(id, payload);
  }

  @Get('analytics')
  async getSystemStats() {
    return this.superadminService.getSystemStats();
  }
}
