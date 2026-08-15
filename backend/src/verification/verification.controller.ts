import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(':taskId/trigger')
  async trigger(@Param('taskId') taskId: string) {
    return this.verificationService.verifyTask(taskId);
  }
}
