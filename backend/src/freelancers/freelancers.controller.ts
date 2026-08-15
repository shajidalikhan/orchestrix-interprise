import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { FreelancersService } from './freelancers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('freelancers')
export class FreelancersController {
  constructor(private readonly freelancersService: FreelancersService) {}

  @Post('project/:projectId/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async createTest(
    @Param('projectId') projectId: string,
    @Body('testSchema') testSchema: any[],
    @Body('passingScore') passingScore: number,
    @CurrentUser() user: any,
  ) {
    return this.freelancersService.createTest(projectId, testSchema, passingScore, user);
  }

  @Get('project/:projectId/test/public')
  async getPublicTest(@Param('projectId') projectId: string) {
    return this.freelancersService.getPublicTest(projectId);
  }

  @Post('project/:projectId/onboard')
  async onboard(
    @Param('projectId') projectId: string,
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('answers') answers: Record<string, string>,
  ) {
    return this.freelancersService.submitAssessment(projectId, email, password, answers);
  }
}
