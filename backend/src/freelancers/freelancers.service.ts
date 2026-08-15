import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class FreelancersService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'orchestrix-super-secret-jwt-key-2026';

  constructor(private readonly prisma: PrismaService) {}

  async createTest(
    projectId: string,
    testSchema: { id: string; question: string; options: string[]; correctAnswer: string }[],
    passingScore: number,
    currentUser: { role: string },
  ) {
    if (!['ADMIN', 'MANAGER'].includes(currentUser.role)) {
      throw new ForbiddenException('Only managers can configure freelancer assessments');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Upsert the test for this project
    const existingTest = await this.prisma.freelancerTest.findFirst({
      where: { projectId },
    });

    if (existingTest) {
      return this.prisma.freelancerTest.update({
        where: { id: existingTest.id },
        data: {
          testSchema: testSchema as any,
          passingScore,
        },
      });
    }

    return this.prisma.freelancerTest.create({
      data: {
        projectId,
        testSchema: testSchema as any,
        passingScore,
        tenantId: '',
      },
    });
  }

  async getPublicTest(projectId: string) {
    const test = await this.prisma.freelancerTest.findFirst({
      where: { projectId },
    });

    if (!test) {
      throw new NotFoundException('No onboarding test is configured for this project');
    }

    // Security: Strip out correct answers from the schema before exposing it to the public
    const schema = test.testSchema as { id: string; question: string; options: string[]; correctAnswer: string }[];
    const publicSchema = schema.map(({ id, question, options }) => ({
      id,
      question,
      options,
    }));

    return {
      testId: test.id,
      projectId: test.projectId,
      passingScore: test.passingScore,
      questions: publicSchema,
    };
  }

  async submitAssessment(
    projectId: string,
    email: string,
    password: string,
    answers: Record<string, string>,
  ) {
    // 1. Fetch project and the onboarding test
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const test = await this.prisma.freelancerTest.findFirst({
      where: { projectId },
    });
    if (!test) {
      throw new NotFoundException('No onboarding test is configured for this project');
    }

    // 2. Grade the answers
    const schema = test.testSchema as { id: string; question: string; options: string[]; correctAnswer: string }[];
    let correctCount = 0;
    
    schema.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const scorePercentage = (correctCount / schema.length) * 100;
    const passed = scorePercentage >= test.passingScore;

    if (!passed) {
      return {
        passed: false,
        score: `${scorePercentage.toFixed(2)}%`,
        passingRequired: `${test.passingScore}%`,
        message: 'Assessment failed. You did not meet the passing score requirement.',
      };
    }

    // 3. Candidate Passed: Provision user under the project's tenant with FREELANCER role
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), tenantId: project.tenantId },
    });

    let user;
    if (existingUser) {
      user = existingUser;
      // Upgrade role to Freelancer if they were a guest
      if (user.role === 'MEMBER' || user.role === 'FREELANCER') {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { role: 'FREELANCER' },
        });
      }
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await this.prisma.user.create({
        data: {
          tenantId: project.tenantId,
          email: email.toLowerCase(),
          passwordHash,
          role: 'FREELANCER',
        },
      });
    }

    // 4. Generate access tokens immediately
    const accessToken = jwt.sign(
      { sub: user.id, tenantId: project.tenantId, role: user.role },
      this.jwtSecret,
      { expiresIn: '1d' },
    );

    return {
      passed: true,
      score: `${scorePercentage.toFixed(2)}%`,
      user: { id: user.id, email: user.email, role: user.role },
      token: accessToken,
      message: 'Assessment passed! Your freelancer workspace has been provisioned.',
    };
  }
}
