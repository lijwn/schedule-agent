/**
 * Schedule Manager Agent - The main orchestrator agent.
 * Receives user chat requests and dispatches to appropriate sub-agents.
 */

import {
  AgentRequest,
  AgentResponse,
  AgentType,
  ParsedIntent,
  ScheduleIntent,
  AgentMessage,
} from '../types';
import { Agent } from '../core/Agent';
import { Orchestrator } from '../core/Orchestrator';
import { CalendarAgent } from './CalendarAgent';

/**
 * Schedule Manager Agent - Main entry point for schedule management.
 * Acts as a natural language interface that:
 * 1. Parses user intent from chat messages
 * 2. Dispatches tasks to appropriate sub-agents
 * 3. Aggregates and formats responses for the user
 */
export class ScheduleManagerAgent extends Agent {
  private orchestrator: Orchestrator;
  private conversationHistory: AgentMessage[] = [];

  constructor(orchestrator: Orchestrator) {
    super(
      'schedule-manager',
      'Schedule Manager Agent',
      'Main orchestrator for schedule management. Handles natural language requests and coordinates sub-agents.',
      'schedule-manager-main'
    );

    this.orchestrator = orchestrator;
    this._capabilities = [
      'intent-classification',
      'agent-dispatching',
      'natural-language-understanding',
      'response-aggregation',
    ];

    // Add system message
    this.conversationHistory.push({
      id: 'sys-init',
      role: 'system',
      content: 'Schedule Manager Agent initialized. I can help you manage your calendar, schedule meetings, and set reminders.',
      timestamp: new Date(),
    });
  }

  /**
   * Handle incoming user request
   * Main entry point for chat-based interaction
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    // Add user message to history
    this.addToHistory({
      id: `msg-${Date.now()}`,
      role: 'user',
      content: request.task,
      timestamp: new Date(),
    });

    try {
      // Step 1: Parse user intent
      const intent = this.parseIntent(request.task);
      console.log(`[ScheduleManager] Detected intent: ${intent.intent} (confidence: ${intent.intent})`);

      // Step 2: If confidence is low, ask for clarification
      if (intent.intent === 'unknown' || intent.missingInfo.length > 0) {
        return this.handleClarification(request, intent);
      }

      // Step 3: Dispatch to appropriate sub-agent
      const response = await this.dispatchToSubAgent(request, intent);

      // Step 4: Add response to history
      this.addToHistory({
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: this.formatResponse(response),
        timestamp: new Date(),
        agentId: this.id,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(request.id, `Failed to process request: ${errorMessage}`);
    }
  }

  /**
   * Parse user intent from natural language
   * Simple rule-based parsing - can be enhanced with LLM
   */
  private parseIntent(task: string): ParsedIntent {
    const lowerTask = task.toLowerCase();
    const params: Record<string, unknown> = {};
    const missingInfo: string[] = [];

    let intent: ScheduleIntent = 'unknown';

    // Detect create event intent
    if (this.matchesAny(lowerTask, ['创建', '新建', '安排', '添加', 'add', 'create', '新建日程'])) {
      intent = 'create-event';
      params.title = this.extractTitle(task);
      params.time = this.extractTime(task);
      params.location = this.extractLocation(task);
      
      if (!params.title) missingInfo.push('event title');
      if (!params.time) missingInfo.push('time');
    }

    // Detect query events intent
    else if (this.matchesAny(lowerTask, ['查询', '查看', '显示', '列出', '有哪些', 'query', 'list', 'show', '我的日程'])) {
      intent = 'query-events';
    }

    // Detect update event intent
    else if (this.matchesAny(lowerTask, ['更新', '修改', '编辑', '改', 'update', 'edit', '修改日程'])) {
      intent = 'update-event';
      params.eventId = this.extractEventId(task);
      if (!params.eventId) missingInfo.push('event ID to update');
    }

    // Detect delete event intent
    else if (this.matchesAny(lowerTask, ['删除', '取消', 'remove', 'delete', '删除日程'])) {
      intent = 'delete-event';
      params.eventId = this.extractEventId(task);
      if (!params.eventId) missingInfo.push('event ID to delete');
    }

    // Detect reminder intent
    else if (this.matchesAny(lowerTask, ['提醒', '闹钟', 'reminder', '提醒我'])) {
      intent = 'set-reminder';
      params.eventId = this.extractEventId(task);
      if (!params.eventId) missingInfo.push('event ID for reminder');
    }

    // Default to query if unclear
    if (intent === 'unknown') {
      intent = 'query-events';
    }

    return {
      intent,
      confidence: missingInfo.length === 0 ? 0.9 : 0.5,
      extractedParams: params,
      missingInfo,
    };
  }

  /**
   * Check if task matches any of the keywords
   */
  private matchesAny(task: string, keywords: string[]): boolean {
    return keywords.some((kw) => task.includes(kw));
  }

  /**
   * Extract title from task string
   */
  private extractTitle(task: string): string | null {
    // Look for quoted strings
    const quotedMatch = task.match(/["「]([^"」]+)["」]/);
    if (quotedMatch) return quotedMatch[1];

    // Look for common patterns like "安排XX会议"
    const patternMatch = task.match(/(?:安排|创建|新建)(.+?)(?:会议|约会|日程|在)/);
    if (patternMatch) return patternMatch[1].trim();

    return null;
  }

  /**
   * Extract time from task string
   */
  private extractTime(task: string): string | null {
    // Simple time extraction patterns
    const timePatterns = [
      /(\d{1,2})[点时](\d{1,2})?/,
      /(今天|明天|后天|周一|周二|周三|周四|周五|周六|周日)/,
    ];

    for (const pattern of timePatterns) {
      const match = task.match(pattern);
      if (match) return match[0];
    }

    return null;
  }

  /**
   * Extract location from task string
   */
  private extractLocation(task: string): string | null {
    const locationMatch = task.match(/在(\S+?)(?:召开|举行|进行|的)/);
    return locationMatch ? locationMatch[1] : null;
  }

  /**
   * Extract event ID from task string
   */
  private extractEventId(task: string): string | null {
    const idMatch = task.match(/(?:evt-|ID[：:]?|#)(\S+)/i);
    return idMatch ? idMatch[1] : null;
  }

  /**
   * Dispatch to appropriate sub-agent based on intent
   */
  private async dispatchToSubAgent(request: AgentRequest, intent: ParsedIntent): Promise<AgentResponse> {
    let targetAgentType: AgentType;

    // Map intent to agent type
    switch (intent.intent) {
      case 'create-event':
      case 'update-event':
      case 'delete-event':
      case 'query-events':
      case 'set-reminder':
        targetAgentType = 'calendar';
        break;
      default:
        targetAgentType = 'calendar';  // Default to calendar agent
    }

    // Create sub-request
    const subRequest: AgentRequest = {
      id: this.generateRequestId(),
      task: request.task,
      agentType: targetAgentType,
      context: intent.extractedParams,
      userId: request.userId,
    };

    // Dispatch and get response
    const response = await this.orchestrator.dispatch(subRequest);

    return response;
  }

  /**
   * Handle clarification when intent is unclear
   */
  private handleClarification(request: AgentRequest, intent: ParsedIntent): AgentResponse {
    let clarificationMessage = '我理解你想进行日程管理。';

    if (intent.missingInfo.length > 0) {
      clarificationMessage += `但是我需要更多信息：\n`;
      intent.missingInfo.forEach((info, index) => {
        clarificationMessage += `${index + 1}. ${this.translateMissingInfo(info)}\n`;
      });
    } else {
      clarificationMessage += '请告诉我你想做什么？例如：\n';
      clarificationMessage += '- "查看我的日程" - 查看所有日程\n';
      clarificationMessage += '- "安排明天下午3点会议" - 创建新日程\n';
    }

    return this.createSuccessResponse(request.id, {
      message: clarificationMessage,
      requiresClarification: true,
      intent,
    });
  }

  /**
   * Translate missing info to Chinese
   */
  private translateMissingInfo(info: string): string {
    const translations: Record<string, string> = {
      'event title': '日程标题',
      'time': '具体时间',
      'event ID to update': '要更新的日程ID',
      'event ID to delete': '要删除的日程ID',
      'event ID for reminder': '要设置提醒的日程ID',
    };
    return translations[info] || info;
  }

  /**
   * Format response for user display
   */
  private formatResponse(response: AgentResponse): string {
    if (!response.success) {
      return `❌ 错误: ${response.error}`;
    }

    const result = response.result as Record<string, unknown>;
    if (!result) return '操作完成';

    // Format based on result type
    if (result.message) {
      return result.message as string;
    }

    if (result.events) {
      const events = result.events as Array<Record<string, unknown>>;
      if (events.length === 0) return '没有找到日程';
      
      let formatted = `📅 您共有 ${events.length} 个日程:\n\n`;
      events.forEach((evt, index) => {
        formatted += `${index + 1}. ${evt.title}\n`;
        formatted += `   时间: ${evt.startTime}\n`;
        if (evt.location !== 'N/A') {
          formatted += `   地点: ${evt.location}\n`;
        }
        formatted += '\n';
      });
      return formatted;
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Add message to conversation history
   */
  private addToHistory(message: AgentMessage): void {
    this.conversationHistory.push(message);
    // Keep only last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): AgentMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = this.conversationHistory.filter(
      (msg) => msg.role === 'system'
    );
  }
}