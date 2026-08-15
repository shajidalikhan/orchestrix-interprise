import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(userId: string, token: string, platform: string) {
    if (!token || !platform) {
      throw new BadRequestException('Token and platform are required');
    }

    return this.prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: platform.toLowerCase(),
        tenantId: '',
      },
      update: {
        userId,
        platform: platform.toLowerCase(),
      },
    });
  }

  async getDeltaTasks(projectId: string, lastSyncTimestamp?: string) {
    if (!projectId) {
      throw new BadRequestException('projectId parameter is required');
    }

    const whereClause: any = { projectId };

    if (lastSyncTimestamp) {
      const syncDate = new Date(lastSyncTimestamp);
      if (isNaN(syncDate.getTime())) {
        throw new BadRequestException('Invalid lastSyncTimestamp date format');
      }
      whereClause.updatedAt = { gt: syncDate };
    }

    const tasks = await this.prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, email: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    this.logger.log(
      `Sync: returning ${tasks.length} delta tasks for project ${projectId} since timestamp "${lastSyncTimestamp || 'epoch'}"`,
    );

    return {
      syncTimestamp: new Date().toISOString(),
      tasks,
    };
  }

  // Helper method to simulate native mobile push dispatch (FCM / APNs)
  async sendPushNotification(userId: string, title: string, body: string) {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
    });

    if (devices.length === 0) {
      this.logger.log(`Push Notification: No registered devices for user ${userId}. Skipping push.`);
      return;
    }

    this.logger.log(`Dispatching push alerts to ${devices.length} devices for user ${userId}...`);
    for (const device of devices) {
      this.logger.log(
        `[FCM/APNs Push] Sent to user ${userId} on ${device.platform.toUpperCase()} (Token: ${device.token.slice(0, 10)}...): "${title} - ${body}"`,
      );
    }
  }

  @OnEvent('task.created')
  async handleTaskCreated(task: any) {
    if (task.assigneeId) {
      await this.sendPushNotification(
        task.assigneeId,
        'New Task Assigned',
        `You have been assigned to task: "${task.title}"`
      );
    }
  }

  @OnEvent('task.status_changed')
  async handleTaskStatusChanged(task: any) {
    if (task.status === 'REVIEW' && task.evaluatorId) {
      await this.sendPushNotification(
        task.evaluatorId,
        'Task Ready for Evaluation',
        `Task "${task.title}" is ready for your evaluation.`
      );
    }
    if ((task.status === 'COMPLETED' || task.status === 'FAILED') && task.assigneeId) {
      await this.sendPushNotification(
        task.assigneeId,
        'Task Status Update',
        `Your task "${task.title}" is marked as ${task.status}.`
      );
    }
  }

  @OnEvent('evaluation.published')
  async handleEvaluationPublished(evaluation: any) {
    const task = await this.prisma.task.findUnique({
      where: { id: evaluation.taskId }
    });
    if (task && task.assigneeId) {
      await this.sendPushNotification(
        task.assigneeId,
        'Evaluation Published',
        `Your task "${task.title}" has been graded.`
      );
    }
  }
}
