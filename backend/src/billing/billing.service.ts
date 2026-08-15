import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleStripeWebhook(stripeEvent: any) {
    const { type, data } = stripeEvent;
    this.logger.log(`Received Stripe Webhook Event: "${type}"`);

    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = data.object;
        const stripeCustomerId = subscription.customer as string;
        const status = subscription.status as string; // e.g., 'active', 'past_due'

        // Resolve Tenant by Stripe Customer ID
        const tenant = await this.prisma.tenant.findFirst({
          where: { stripeCustomerId },
        });

        if (tenant) {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: status.toUpperCase(),
            },
          });
          this.logger.log(`Tenant ${tenant.id} subscription status updated to: "${status.toUpperCase()}"`);
        } else {
          this.logger.warn(`Stripe customer ID "${stripeCustomerId}" does not match any registered Tenant.`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = data.object;
        const stripeCustomerId = subscription.customer as string;

        const tenant = await this.prisma.tenant.findFirst({
          where: { stripeCustomerId },
        });

        if (tenant) {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: 'CANCELLED',
            },
          });
          this.logger.log(`Tenant ${tenant.id} subscription was CANCELLED.`);
        }
        break;
      }

      default:
        this.logger.log(`Stripe event "${type}" not handled.`);
    }

    return { received: true };
  }
}
