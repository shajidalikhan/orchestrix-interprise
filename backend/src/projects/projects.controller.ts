import { Controller, Post, Body, Put, Param, Get, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body('name') name: string) {
    return this.projectsService.create(name);
  }

  @Put(':id/matrix')
  @Roles('ADMIN', 'MANAGER')
  async updateMatrix(
    @Param('id') id: string,
    @Body('matrixConfig') matrixConfig: { criteria: string; weight: number }[],
  ) {
    return this.projectsService.updateMatrix(id, matrixConfig);
  }

  @Get()
  async findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }
}
