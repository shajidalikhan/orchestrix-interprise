import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string) {
    if (!name) {
      throw new BadRequestException('Project name is required');
    }
    return this.prisma.project.create({
      data: {
        name,
        status: ProjectStatus.DRAFT,
        tenantId: '',
      },
    });
  }

  async updateMatrix(projectId: string, matrixConfig: { criteria: string; weight: number }[]) {
    // Validate that the weights sum up to exactly 100%
    const totalWeight = matrixConfig.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(`Evaluation weights must total exactly 100%. Received: ${totalWeight}%`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        matrixConfig: matrixConfig as any, // Store as JSONB
        status: ProjectStatus.ACTIVE,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          where: { parentId: null }, // Fetch only top-level tasks; children fetched recursively or on-demand
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
