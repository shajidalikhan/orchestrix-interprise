import { Controller, Post, Body, Put, Param, Get, UseGuards, Request } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaskStatus, TaskPriority, TaskPermissionType } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('project/:projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body('title') title: string,
    @Body() payload: {
      description?: string;
      parentId?: string;
      priority?: TaskPriority;
      deadline?: string;
      assigneeId?: string;
      evaluatorId?: string;
      verificationEndpoint?: string;
      verificationMethod?: string;
      verificationPayload?: any;
    },
    @CurrentUser() user: any,
  ) {
    return this.tasksService.create(projectId, title, payload, user);
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
    @Body('progress') progress?: number,
    @CurrentUser() user?: any,
  ) {
    return this.tasksService.updateStatus(id, status, progress, user);
  }

  @Put(':id/permission')
  async assignPermission(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('permission') permission: TaskPermissionType,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.assignPermission(id, userId, permission, user);
  }

  @Get('project/:projectId')
  async getTree(@Param('projectId') projectId: string) {
    return this.tasksService.getTree(projectId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }
}
