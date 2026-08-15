import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { FeatureGateGuard } from '../tenancy/guards/feature-gate.guard';
import { RequireFeature } from '../tenancy/decorators/require-feature.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGateGuard)
@RequireFeature('enableAi')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly evaluationsService: EvaluationsService,
  ) {}

  @Post('appraisal/employee/:userId')
  @Roles('ADMIN', 'MANAGER')
  async generateAppraisal(@Param('userId') userId: string) {
    // 1. Gather raw employee stats
    const reportData = await this.evaluationsService.getEmployeePerformanceReport(userId);
    // 2. Synthesize using AI
    return this.aiService.generateAppraisal(reportData);
  }

  @Post('support/project/:projectId')
  async askSupportBot(
    @Param('projectId') projectId: string,
    @Body('query') query: string,
    @CurrentUser() user: any,
  ) {
    return this.aiService.processSupportBotQuery(projectId, query, user);
  }
}
