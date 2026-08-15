import { Module } from '@nestjs/common';
import { FreelancersService } from './freelancers.service';
import { FreelancersController } from './freelancers.controller';

@Module({
  providers: [FreelancersService],
  controllers: [FreelancersController],
  exports: [FreelancersService],
})
export class FreelancersModule {}
