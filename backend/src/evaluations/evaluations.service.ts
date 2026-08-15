import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async evaluateTask(
    taskId: string,
    scores: Record<string, number>,
    remarks: string,
    currentUser: { id: string; role: string },
  ) {
    // 1. Fetch task and project context
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // 2. Validate authorization (only assigned evaluator or project manager)
    const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(currentUser.role);
    if (!isManagerOrAdmin && task.evaluatorId !== currentUser.id) {
      throw new ForbiddenException('Only the designated evaluator or project manager can submit evaluations');
    }

    // 3. Validate scores match project matrix criteria configuration
    const matrixConfig = task.project.matrixConfig as { criteria: string; weight: number }[] | null;
    if (matrixConfig) {
      const criteriaList = matrixConfig.map(m => m.criteria);
      
      // Ensure all criteria are present and scores are numerical values between 1 and 10
      for (const criteria of criteriaList) {
        const score = scores[criteria];
        if (score === undefined || typeof score !== 'number' || score < 1 || score > 10) {
          throw new BadRequestException(
            `Evaluation scorecard must contain valid numeric scores between 1 and 10 for: "${criteria}"`,
          );
        }
      }
    }

    // 4. Create the evaluation record
    const evaluation = await this.prisma.evaluation.create({
      data: {
        taskId,
        evaluatorId: currentUser.id,
        scores: scores as any,
        remarks,
        tenantId: '',
      },
    });

    // 5. Optionally mark the task as COMPLETED if it wasn't already
    if (task.status !== TaskStatus.COMPLETED) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED },
      });
    }

    this.eventEmitter.emit('evaluation.published', {
      ...evaluation,
      tenantId: task.tenantId,
    });

    return evaluation;
  }

  async getEmployeePerformanceReport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. Fetch all assigned tasks
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: userId },
      include: { evaluations: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const failedTasks = tasks.filter(t => t.status === TaskStatus.FAILED);
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);

    // 2. Calculate average evaluation score (on a 10-point scale)
    let totalScoreSum = 0;
    let totalScoreCount = 0;
    tasks.forEach(t => {
      t.evaluations.forEach(evalRecord => {
        const scores = evalRecord.scores as Record<string, number>;
        if (scores && typeof scores === 'object') {
          const values = Object.values(scores);
          if (values.length > 0) {
            const sum = values.reduce((s, val) => s + val, 0);
            totalScoreSum += sum / values.length;
            totalScoreCount++;
          }
        }
      });
    });

    const averageRating = totalScoreCount > 0 ? parseFloat((totalScoreSum / totalScoreCount).toFixed(2)) : null;

    // 3. Calculate deadline compliance rate (SLA met / missed)
    const tasksWithDeadlines = completedTasks.filter(t => t.deadline !== null);
    const complianceMet = tasksWithDeadlines.filter(t => {
      // If task updated timestamp is before or matches deadline, SLA met
      return t.updatedAt <= t.deadline!;
    }).length;

    const complianceRate = tasksWithDeadlines.length > 0 
      ? parseFloat(((complianceMet / tasksWithDeadlines.length) * 100).toFixed(2)) 
      : 100.0; // 100% compliance if no deadlines set

    return {
      userId,
      email: user.email,
      role: user.role,
      metrics: {
        totalTasksAssigned: totalTasks,
        completedCount: completedTasks.length,
        failedCount: failedTasks.length,
        inProgressCount: inProgressTasks.length,
        averageTaskRating: averageRating,
        deadlineComplianceRate: `${complianceRate}%`,
        rawCompliancePercentage: complianceRate,
      },
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        priority: t.priority,
        deadline: t.deadline,
        completedAt: t.status === TaskStatus.COMPLETED ? t.updatedAt : null,
      })),
    };
  }

  async getDepartmentPerformanceReport(roleGroup: string) {
    // Collect all users belonging to this group/role (e.g. MEMBERS or custom classifications)
    const users = await this.prisma.user.findMany({
      where: { role: roleGroup },
    });

    const userReports: any[] = [];
    let groupTotalTasks = 0;
    let groupCompletedTasks = 0;
    let groupRatingSum = 0;
    let groupRatingCount = 0;

    for (const user of users) {
      const report = await this.getEmployeePerformanceReport(user.id);
      userReports.push(report);

      groupTotalTasks += report.metrics.totalTasksAssigned;
      groupCompletedTasks += report.metrics.completedCount;

      if (report.metrics.averageTaskRating !== null) {
        groupRatingSum += report.metrics.averageTaskRating;
        groupRatingCount++;
      }
    }

    const groupAvgRating = groupRatingCount > 0 ? parseFloat((groupRatingSum / groupRatingCount).toFixed(2)) : null;
    const groupCompletionRate = groupTotalTasks > 0 ? parseFloat(((groupCompletedTasks / groupTotalTasks) * 100).toFixed(2)) : 100;

    return {
      department: roleGroup,
      headcount: users.length,
      metrics: {
        totalTasks: groupTotalTasks,
        completedTasks: groupCompletedTasks,
        completionRate: `${groupCompletionRate}%`,
        averageRating: groupAvgRating,
      },
      employeeBreakdown: userReports,
    };
  }
}
