import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly modelName = 'gemini-1.5-flash';

  constructor(private readonly tasksService: TasksService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY environment variable is not configured. Running in Mock fallback mode.');
    }
  }

  async generateAppraisal(performanceData: any): Promise<any> {
    const prompt = `
      You are an expert Enterprise Performance Analyst. Analyze the following employee performance dataset and generate a structured appraisal report.
      
      DATASET:
      ${JSON.stringify(performanceData, null, 2)}
      
      INSTRUCTIONS:
      Synthesize the numerical metrics, task outcomes, deadline compliance rates, and evaluator remarks.
      Return the output as a clean, single JSON object (DO NOT wrap in markdown blocks, just raw JSON) with the following keys:
      {
        "executiveSummary": "A professional paragraph summarizing overall performance.",
        "keyStrengths": ["Strength 1", "Strength 2", ...],
        "growthAreas": ["Growth Area 1", "Growth Area 2", ...],
        "recommendedActions": ["Action 1", "Action 2", ...],
        "ratingSynthesis": "A brief explanation of how their scores translate to corporate standing."
      }
    `;

    if (!this.genAI) {
      this.logger.log('Gemini API offline: Simulating AI Performance Appraisal report...');
      return this.generateMockAppraisal(performanceData);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      
      // Clean up markdown block formatting if the model returns it
      const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(jsonString);
    } catch (err) {
      this.logger.error(`Failed to generate LLM appraisal: ${err.message}`);
      return this.generateMockAppraisal(performanceData);
    }
  }

  async processSupportBotQuery(
    projectId: string,
    query: string,
    currentUser: { id: string; role: string; tenantId: string },
  ): Promise<any> {
    const prompt = `
      You are the Orchestrix Support Assistant. The user is asking a question or requesting support.
      
      USER QUERY: "${query}"
      
      INSTRUCTIONS:
      Determine if this query represents a request to raise a support ticket / issue because something is blocked or needs human intervention.
      Return a JSON response (raw JSON only) with:
      {
        "reply": "Your direct friendly chat response troubleshooting or responding to their request.",
        "raiseTicket": true/false,
        "ticketTitle": "Short descriptive ticket title (null if raiseTicket is false)",
        "ticketDescription": "Detailed ticket details (null if raiseTicket is false)",
        "priority": "LOW"/"MEDIUM"/"HIGH"/"CRITICAL" (null if raiseTicket is false)
      }
    `;

    let replyData: {
      reply: string;
      raiseTicket: boolean;
      ticketTitle: string | null;
      ticketDescription: string | null;
      priority: string;
    } = {
      reply: 'I am here to help you resolve issues on the platform.',
      raiseTicket: false,
      ticketTitle: null,
      ticketDescription: null,
      priority: 'LOW',
    };

    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        replyData = JSON.parse(jsonString);
      } catch (err) {
        this.logger.error(`Support bot processing failed: ${err.message}`);
      }
    } else {
      // Mock support ticket routing if user query mentions "broken", "issue", "bug", or "help"
      const needsTicket = /\b(bug|issue|broken|error|fail|help|ticket)\b/i.test(query);
      if (needsTicket) {
        replyData = {
          reply: 'I notice you are encountering an issue. Let me automatically raise a support ticket for you.',
          raiseTicket: true,
          ticketTitle: `Automated Support: ${query.slice(0, 30)}...`,
          ticketDescription: `User initiated request: "${query}"`,
          priority: 'MEDIUM',
        };
      } else {
        replyData.reply = `Hello! You asked: "${query}". I am currently running in offline developer mode, but I can troubleshoot and file tickets if you mention keywords like 'bug' or 'issue'.`;
      }
    }

    // If ticket is requested, automatically create an Issue task and route it
    if (replyData.raiseTicket && replyData.ticketTitle) {
      this.logger.log(`Auto-raising support ticket task for user ${currentUser.id} under project ${projectId}...`);
      
      // Spawn task with priority mapping
      const task = await this.tasksService.create(projectId, replyData.ticketTitle, {
        description: replyData.ticketDescription || `Raised via support: ${query}`,
        priority: replyData.priority as any,
        assigneeId: undefined, // Left unassigned or can be auto-routed to PM
      }, currentUser);

      return {
        reply: `${replyData.reply} (Support ticket task #${task.id} has been automatically created and routed to the project board)`,
        ticketId: task.id,
      };
    }

    return { reply: replyData.reply };
  }

  private generateMockAppraisal(data: any): any {
    const name = data.email ? data.email.split('@')[0] : 'Employee';
    const compliance = data.metrics?.deadlineComplianceRate || '100%';
    const rating = data.metrics?.averageTaskRating || '8.5';
    
    return {
      executiveSummary: `Based on the evaluated task data, ${name} shows solid execution stats with a deadline compliance rate of ${compliance} and an average performance evaluation grade of ${rating}/10.`,
      keyStrengths: [
        'Strong compliance with WBS deadlines and schedules.',
        'High execution quality score across peer evaluations.',
      ],
      growthAreas: [
        'Further delegation of minor tasks to team members.',
        'Proactive verification triggers for automated integrations.',
      ],
      recommendedActions: [
        'Recommend for leadership role on upcoming sprints.',
        'Encourage documenting APIs to support the integration module.',
      ],
      ratingSynthesis: `${name} is currently performing above standard benchmarks and has met all primary SLA parameters.`,
    };
  }
}
