import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('stripe-webhook')
  @HttpCode(200)
  async handleStripeWebhook(@Body() stripeEvent: any) {
    return this.billingService.handleStripeWebhook(stripeEvent);
  }
}
