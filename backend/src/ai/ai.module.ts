import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { TasksModule } from '../tasks/tasks.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [TasksModule, EvaluationsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
