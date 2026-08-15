import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiKeyAuthGuard } from './guards/api-key.guard';
import { ApiScopes } from './decorators/api-scopes.decorator';

import { FeatureGateGuard } from '../tenancy/guards/feature-gate.guard';
import { RequireFeature } from '../tenancy/decorators/require-feature.decorator';

@Controller('developer')
@UseGuards(FeatureGateGuard)
@RequireFeature('enableIntegrations')
export class DeveloperController {
  constructor(
    private readonly developerService: DeveloperService,
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly evaluationsService: EvaluationsService,
  ) {}

  // 1. Manage Integration Keys (Admin console)
  @Post('keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createApiKey(
    @Body('name') name: string,
    @Body('scopes') scopes: string[],
    @CurrentUser() user: any,
  ) {
    return this.developerService.createApiKey(name, scopes, user);
  }

  // 2. Manage Webhook Registrations
  @Post('webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async registerWebhook(
    @Body('targetUrl') targetUrl: string,
    @Body('events') events: string[],
  ) {
    return this.developerService.registerWebhook(targetUrl, events);
  }

  // 3. Scoped REST Integration Exports for Third-Party Applications (Auth via API Key)
  @Get('export/projects')
  @UseGuards(ApiKeyAuthGuard)
  @ApiScopes('read:projects')
  async exportProjects() {
    return this.projectsService.findAll();
  }

  @Get('export/tasks')
  @UseGuards(ApiKeyAuthGuard)
  @ApiScopes('read:tasks')
  async exportTasks(@Query('projectId') projectId: string) {
    return this.tasksService.getTree(projectId);
  }

  @Get('export/evaluations/employee')
  @UseGuards(ApiKeyAuthGuard)
  @ApiScopes('read:evaluations')
  async exportEmployeeEvaluations(@Query('userId') userId: string) {
    return this.evaluationsService.getEmployeePerformanceReport(userId);
  }

  @Get('export/evaluations/department')
  @UseGuards(ApiKeyAuthGuard)
  @ApiScopes('read:evaluations')
  async exportDepartmentEvaluations(@Query('department') department: string) {
    return this.evaluationsService.getDepartmentPerformanceReport(department);
  }
}
