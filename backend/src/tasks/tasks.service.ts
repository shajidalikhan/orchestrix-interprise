import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskPriority, TaskPermissionType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    projectId: string,
    title: string,
    payload: {
      description?: string;
      parentId?: string;
      priority?: TaskPriority;
      deadline?: string;
      assigneeId?: string;
      evaluatorId?: string;
      verificationEndpoint?: string;
      verificationMethod?: string;
      verificationPayload?: any;
    },
    currentUser: { id: string; role: string; tenantId: string },
  ) {
    // 1. Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 2. Enforce RBAC / Task Permission check for child creation
    if (payload.parentId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: payload.parentId },
        include: { permissions: true },
      });

      if (!parentTask) {
        throw new NotFoundException('Parent task not found');
      }

      // Check if user has permission on the parent task
      const userPermission = parentTask.permissions.find(p => p.userId === currentUser.id);
      
      const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(currentUser.role);
      
      if (!isManagerOrAdmin) {
        if (!userPermission) {
          throw new ForbiddenException('You do not have access to this parent task');
        }

        if (userPermission.permission === TaskPermissionType.EXECUTE) {
          throw new ForbiddenException('You are in Strict Task Mode (cannot create subtasks)');
        }

        if (userPermission.permission === TaskPermissionType.BREAKDOWN) {
          // Self-Breakdown Mode: Assignee must assign the subtask to themselves only
          if (payload.assigneeId && payload.assigneeId !== currentUser.id) {
            throw new ForbiddenException('In Self-Breakdown Mode, subtasks must be assigned to yourself');
          }
          payload.assigneeId = currentUser.id; // Override to self
        }
      }
    } else {
      // Top-level task: Only project managers/admins can create
      const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(currentUser.role);
      if (!isManagerOrAdmin) {
        throw new ForbiddenException('Only managers or administrators can create top-level tasks');
      }
    }

    // 3. Create the task
    const task = await this.prisma.task.create({
      data: {
        projectId,
        title,
        description: payload.description,
        parentId: payload.parentId,
        priority: payload.priority || TaskPriority.MEDIUM,
        deadline: payload.deadline ? new Date(payload.deadline) : null,
        assigneeId: payload.assigneeId,
        evaluatorId: payload.evaluatorId,
        verificationEndpoint: payload.verificationEndpoint,
        verificationMethod: payload.verificationMethod,
        verificationPayload: payload.verificationPayload,
        tenantId: '',
      },
    });

    // 4. Default permission provisioning for the assignee
    if (payload.assigneeId) {
      const isSelfSubtask = payload.parentId && payload.assigneeId === currentUser.id;
      await this.prisma.taskPermission.create({
        data: {
          taskId: task.id,
          userId: payload.assigneeId,
          // If a manager assigns it, default to EXECUTE. If it's a self-subtask, inherit BREAKDOWN.
          permission: isSelfSubtask ? TaskPermissionType.BREAKDOWN : TaskPermissionType.EXECUTE,
        },
      });
    }

    // 5. Trigger progress rollup bubble up to parent if we created a subtask
    if (payload.parentId) {
      await this.bubbleUpProgress(payload.parentId);
    }

    this.eventEmitter.emit('task.created', task);

    return task;
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    progress?: number,
    currentUser?: { id: string; role: string }
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { subtasks: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verification check: if task has child tasks, the status/progress is governed by rollup, not manual updates
    if (task.subtasks.length > 0) {
      throw new BadRequestException('Cannot manually update progress on a parent task containing subtasks');
    }

    // Set progress default based on status if not manually provided
    let finalProgress = progress !== undefined ? progress : task.progress;
    if (status === TaskStatus.COMPLETED) {
      finalProgress = 100;
    } else if (status === TaskStatus.PENDING && progress === undefined) {
      finalProgress = 0;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        progress: finalProgress,
      },
    });

    // Bubble up progress rollup
    if (task.parentId) {
      await this.bubbleUpProgress(task.parentId);
    }

    this.eventEmitter.emit('task.status_changed', updatedTask);

    return updatedTask;
  }

  async assignPermission(
    taskId: string,
    userId: string,
    permission: TaskPermissionType,
    currentUser: { role: string }
  ) {
    if (!['ADMIN', 'MANAGER'].includes(currentUser.role)) {
      throw new ForbiddenException('Only managers can update task permissions');
    }

    return this.prisma.taskPermission.upsert({
      where: {
        taskId_userId: { taskId, userId },
      },
      create: { taskId, userId, permission },
      update: { permission },
    });
  }

  async getTree(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, email: true, role: true } },
        evaluator: { select: { id: true, email: true, role: true } },
        permissions: true,
      },
    });

    // Build the tree dynamically
    const taskMap = new Map<string, any>();
    tasks.forEach(t => taskMap.set(t.id, { ...t, subtasks: [] }));
    
    const rootTasks: any[] = [];
    tasks.forEach(t => {
      const taskNode = taskMap.get(t.id);
      if (t.parentId) {
        const parentNode = taskMap.get(t.parentId);
        if (parentNode) {
          parentNode.subtasks.push(taskNode);
        } else {
          // If parent is missing (e.g. from deletion scope error), treat as root
          rootTasks.push(taskNode);
        }
      } else {
        rootTasks.push(taskNode);
      }
    });

    return rootTasks;
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, email: true } },
        evaluator: { select: { id: true, email: true } },
        permissions: true,
        subtasks: true,
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  // Recursive rollup calculator
  private async bubbleUpProgress(parentId: string) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentId },
      include: { subtasks: true },
    });

    if (!parent) return;

    const childTasks = parent.subtasks;
    if (childTasks.length === 0) return;

    // Average child progress rollup
    const totalProgress = childTasks.reduce((sum, task) => sum + task.progress, 0);
    const avgProgress = parseFloat((totalProgress / childTasks.length).toFixed(2));

    // Resolve parent task status based on children status
    let resolvedStatus: TaskStatus = TaskStatus.PENDING;
    const allCompleted = childTasks.every(t => t.status === TaskStatus.COMPLETED);
    const anyInProgress = childTasks.some(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.REVIEW || t.progress > 0);
    const anyFailed = childTasks.some(t => t.status === TaskStatus.FAILED);

    if (allCompleted) {
      resolvedStatus = TaskStatus.COMPLETED;
    } else if (anyFailed) {
      resolvedStatus = TaskStatus.FAILED;
    } else if (anyInProgress) {
      resolvedStatus = TaskStatus.IN_PROGRESS;
    }

    await this.prisma.task.update({
      where: { id: parentId },
      data: {
        progress: avgProgress,
        status: resolvedStatus,
      },
    });

    // Bubble up to grandparent
    if (parent.parentId) {
      await this.bubbleUpProgress(parent.parentId);
    }
  }
}
