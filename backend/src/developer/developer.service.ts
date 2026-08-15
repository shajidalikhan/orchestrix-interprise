import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class DeveloperService {
  private readonly logger = new Logger(DeveloperService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createApiKey(name: string, scopes: string[], currentUser: { role: string }) {
    if (!['ADMIN', 'MANAGER'].includes(currentUser.role)) {
      throw new ForbiddenException('Only administrators can generate developer API keys');
    }

    // Generate secure random key
    const rawKey = 'orch_live_' + crypto.randomBytes(24).toString('hex');
    // Hash key for secure storage
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKeyRecord = await (this.prisma as any).apiKey.create({
      data: {
        name,
        keyHash,
        scopes,
        isActive: true,
      },
    });

    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      scopes: apiKeyRecord.scopes,
      plainApiKey: rawKey, // Displayed ONLY ONCE to user
      message: 'Store this key securely. It will not be shown again.',
    };
  }

  async validateApiKey(rawKey: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyRecord = await (this.prisma as any).apiKey.findUnique({
      where: { keyHash, isActive: true },
    });

    if (!keyRecord) {
      return null;
    }

    return {
      tenantId: keyRecord.tenantId,
      scopes: keyRecord.scopes,
    };
  }

  async registerWebhook(targetUrl: string, events: string[]) {
    // Generate secure webhook secret for signature check
    const secretToken = 'whsec_' + crypto.randomBytes(20).toString('hex');
    
    return this.prisma.webhookSubscription.create({
      data: {
        targetUrl,
        events,
        secretToken,
        isActive: true,
        tenantId: '', // Overridden at runtime by query extensions
      },
    });
  }

  async triggerWebhookEvent(tenantId: string, event: string, payload: any) {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        tenantId,
        events: { has: event },
        isActive: true,
      },
    });

    this.logger.log(`Dispatching webhook event "${event}" to ${subscriptions.length} subscribers...`);

    for (const sub of subscriptions) {
      // Async dispatch in background (fire and forget with error handling)
      this.dispatchWebhook(sub.targetUrl, sub.secretToken, event, payload).catch(err => {
        this.logger.error(`Webhook delivery failure to ${sub.targetUrl}: ${err.message}`);
      });
    }
  }

  private async dispatchWebhook(targetUrl: string, secret: string, event: string, payload: any) {
    const bodyString = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Generate SHA-256 HMAC signature
    const signature = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Orchestrix-Event': event,
        'X-Orchestrix-Signature': signature,
        'User-Agent': 'Orchestrix-Webhooks/1.0',
      },
      body: bodyString,
    });

    if (!response.ok) {
      throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
    }
  }

  @OnEvent('task.created')
  async handleTaskCreatedEvent(task: any) {
    this.logger.log(`Task created event captured: ${task.id}`);
    await this.triggerWebhookEvent(task.tenantId, 'task.created', task);
  }

  @OnEvent('task.status_changed')
  async handleTaskStatusChangedEvent(task: any) {
    this.logger.log(`Task status changed event captured: ${task.id} (Status: ${task.status})`);
    
    // Trigger outbound webhooks
    await this.triggerWebhookEvent(task.tenantId, 'task.status_changed', task);

    // Dynamic Out-of-the-box Slack integration mock check
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      await this.dispatchSlackNotification(slackUrl, `Task "${task.title}" status updated to: *${task.status}* (${task.progress}%)`);
    }
  }

  @OnEvent('evaluation.published')
  async handleEvaluationPublishedEvent(evaluation: any) {
    this.logger.log(`Evaluation published event captured: ${evaluation.id}`);
    await this.triggerWebhookEvent(evaluation.tenantId, 'evaluation.published', evaluation);
  }

  private async dispatchSlackNotification(url: string, text: string) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      this.logger.log('Slack notification dispatched successfully.');
    } catch (err) {
      this.logger.error(`Slack notification dispatch failed: ${err.message}`);
    }
  }
}
