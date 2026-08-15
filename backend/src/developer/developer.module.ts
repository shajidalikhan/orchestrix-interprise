import { Module } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { DeveloperController } from './developer.controller';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [ProjectsModule, TasksModule, EvaluationsModule],
  providers: [DeveloperService],
  controllers: [DeveloperController],
  exports: [DeveloperService],
})
export class DeveloperModule {}
