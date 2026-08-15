import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Cron job that runs every 5 minutes to auto-verify active tasks configured with an endpoint
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleAutoVerificationCron() {
    this.logger.log('Starting automated task verification cron cycle...');
    const tasks = await this.prisma.task.findMany({
      where: {
        verificationEndpoint: { not: null },
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.PENDING] },
      },
    });

    for (const task of tasks) {
      try {
        await this.verifyTask(task.id);
      } catch (err) {
        this.logger.error(`Cron verification failed for task ${task.id}: ${err.message}`);
      }
    }
  }

  async verifyTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (!task.verificationEndpoint) {
      throw new BadRequestException('Task does not have an integration verification endpoint configured');
    }

    this.logger.log(`Executing verification for task ${task.id} (${task.title})...`);

    try {
      const url = task.verificationEndpoint;
      const method = task.verificationMethod || 'GET';
      const rules = task.verificationPayload; // JSON rule validation object

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Orchestrix-Verification-Engine/1.0',
        },
      };

      if (method === 'POST' && rules) {
        options.body = JSON.stringify(rules);
      }

      // Execute HTTP call
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Endpoint returned HTTP ${response.status}`);
      }

      const responseBody = await response.json();
      this.logger.log(`Task ${task.id} response received: ${JSON.stringify(responseBody)}`);

      // Validate JSON response rules
      const passed = this.validateRules(responseBody, rules);

      if (passed) {
        this.logger.log(`Task ${task.id} validation PASSED.`);
        await this.tasksService.updateStatus(task.id, TaskStatus.COMPLETED);
        return { success: true, message: 'Verification passed. Task marked as COMPLETED.', data: responseBody };
      } else {
        this.logger.log(`Task ${task.id} validation FAILED.`);
        await this.tasksService.updateStatus(task.id, TaskStatus.FAILED);
        return { success: false, message: 'Verification failed. Task marked as FAILED.', data: responseBody };
      }

    } catch (err) {
      this.logger.warn(`Task ${task.id} verification error: ${err.message}`);
      // Mark as review or fail if endpoint is down/returns errors
      await this.tasksService.updateStatus(task.id, TaskStatus.FAILED);
      return { success: false, error: err.message };
    }
  }

  private validateRules(response: any, rules: any): boolean {
    if (!rules || typeof rules !== 'object') {
      return true; // No rules defined, treat HTTP 200 as success
    }
    // Deep match: check if all properties in rules are identical in response
    for (const key of Object.keys(rules)) {
      if (response[key] !== rules[key]) {
        return false;
      }
    }
    return true;
  }
}
