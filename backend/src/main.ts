import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for cross-origin frontend requests
  app.enableCors();
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[NestJS] Application is running on: http://localhost:${port}`);
}
bootstrap();
