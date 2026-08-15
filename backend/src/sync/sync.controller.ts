import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('devices')
  async registerDevice(
    @Body('token') token: string,
    @Body('platform') platform: string,
    @CurrentUser() user: any,
  ) {
    return this.syncService.registerDevice(user.id, token, platform);
  }

  @Get('tasks')
  async getDeltaTasks(
    @Query('projectId') projectId: string,
    @Query('lastSyncTimestamp') lastSyncTimestamp?: string,
  ) {
    return this.syncService.getDeltaTasks(projectId, lastSyncTimestamp);
  }
}
