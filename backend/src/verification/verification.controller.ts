import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { FeatureGateGuard } from '../tenancy/guards/feature-gate.guard';
import { RequireFeature } from '../tenancy/decorators/require-feature.decorator';

@Controller('verification')
@UseGuards(JwtAuthGuard, FeatureGateGuard)
@RequireFeature('enableVerification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(':taskId/trigger')
  async trigger(@Param('taskId') taskId: string) {
    return this.verificationService.verifyTask(taskId);
  }
}
