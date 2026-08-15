import { Controller, Post, Body, Param, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('task/:taskId')
  async evaluateTask(
    @Param('taskId') taskId: string,
    @Body('scores') scores: Record<string, number>,
    @Body('remarks') remarks: string,
    @CurrentUser() user: any,
  ) {
    return this.evaluationsService.evaluateTask(taskId, scores, remarks, user);
  }

  @Get('report/employee/:userId')
  async getEmployeeReport(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(user.role);
    if (!isManagerOrAdmin && user.id !== userId) {
      throw new ForbiddenException('You can only view your own performance report');
    }
    return this.evaluationsService.getEmployeePerformanceReport(userId);
  }

  @Get('report/department/:roleGroup')
  @Roles('ADMIN', 'MANAGER')
  async getDepartmentReport(@Param('roleGroup') roleGroup: string) {
    return this.evaluationsService.getDepartmentPerformanceReport(roleGroup);
  }
}
