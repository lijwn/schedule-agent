/**
 * LLM-powered Intent Parser
 * Uses LLM to parse user intent from natural language
 */

import {
  LLMService,
  LLMMessage,
  LLMIntentResult,
  LLMFunction,
} from '../../types/llm';
import { ScheduleIntent } from '../../types';

const INTENT_SYSTEM_PROMPT = `你是一个日程管理助手，负责理解用户的意图。

用户的输入可能是中文或英文，你需要识别以下意图：
- create-event: 创建新日程
- update-event: 修改现有日程
- delete-event: 删除日程
- query-events: 查询/查看日程
- set-reminder: 设置提醒

从用户输入中提取以下参数：
- title: 日程标题
- description: 日程描述
- startTime: 开始时间
- endTime: 结束时间
- location: 地点
- eventId: 日程ID（仅用于更新/删除/提醒）

请用JSON格式返回结果。`;

const INTENT_FUNCTION: LLMFunction = {
  name: 'parse_intent',
  description: 'Parse user intent for schedule management',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['create-event', 'update-event', 'delete-event', 'query-events', 'set-reminder', 'unknown'],
        description: 'The detected user intent',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score for the intent (0-1)',
      },
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description' },
          startTime: { type: 'string', description: 'Start time (ISO 8601 or natural language)' },
          endTime: { type: 'string', description: 'End time (ISO 8601 or natural language)' },
          location: { type: 'string', description: 'Location' },
          eventId: { type: 'string', description: 'Event ID for update/delete/reminder' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Attendees' },
        },
      },
      missingInfo: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of missing information needed',
      },
      reasoning: {
        type: 'string',
        description: 'Explanation of the intent detection',
      },
    },
    required: ['intent', 'confidence', 'parameters', 'missingInfo', 'reasoning'],
  },
};

/**
 * LLM-powered Intent Parser
 */
export class LLMIntentParser {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Parse user intent using LLM
   */
  async parse(userMessage: string): Promise<LLMIntentResult> {
    const messages: LLMMessage[] = [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请分析以下用户输入的意图：\n\n"${userMessage}"`,
      },
    ];

    try {
      const response = await this.llm.complete({
        messages,
        functions: [INTENT_FUNCTION],
        temperature: 0.3,
      });

      // Handle function call response
      if (response.functionCall) {
        const args = JSON.parse(response.functionCall.arguments);
        return {
          intent: args.intent as LLMIntentResult['intent'],
          confidence: args.confidence,
          parameters: args.parameters || {},
          missingInfo: args.missingInfo || [],
          reasoning: args.reasoning || '',
        };
      }

      // Fallback: try to parse as JSON
      try {
        const parsed = JSON.parse(response.content);
        return {
          intent: parsed.intent as LLMIntentResult['intent'],
          confidence: parsed.confidence || 0.5,
          parameters: parsed.parameters || {},
          missingInfo: parsed.missingInfo || [],
          reasoning: parsed.reasoning || '',
        };
      } catch {
        // If JSON parsing fails, use fallback
        return this.fallbackParse(userMessage);
      }
    } catch (error) {
      console.error('[IntentParser] LLM call failed, using fallback:', error);
      return this.fallbackParse(userMessage);
    }
  }

  /**
   * Fallback to simple keyword-based parsing
   */
  private fallbackParse(task: string): LLMIntentResult {
    const lowerTask = task.toLowerCase();
    let intent: LLMIntentResult['intent'] = 'unknown';
    const missingInfo: string[] = [];
    const parameters: LLMIntentResult['parameters'] = {};

    // Detect create event
    if (/创建|新建|安排|添加|add|create|新建日程/i.test(task)) {
      intent = 'create-event';
      if (!parameters.title) missingInfo.push('title');
      if (!parameters.startTime) missingInfo.push('startTime');
    }
    // Detect query events
    else if (/查询|查看|显示|列出|有哪些|query|list|show|我的日程/i.test(task)) {
      intent = 'query-events';
    }
    // Detect update event
    else if (/更新|修改|编辑|改|update|edit|修改日程/i.test(task)) {
      intent = 'update-event';
      if (!parameters.eventId) missingInfo.push('eventId');
    }
    // Detect delete event
    else if (/删除|取消|remove|delete|删除日程/i.test(task)) {
      intent = 'delete-event';
      if (!parameters.eventId) missingInfo.push('eventId');
    }
    // Detect reminder
    else if (/提醒|闹钟|reminder|提醒我/i.test(task)) {
      intent = 'set-reminder';
      if (!parameters.eventId) missingInfo.push('eventId');
    }

    // Default to query if unknown
    if (intent === 'unknown') {
      intent = 'query-events';
    }

    return {
      intent,
      confidence: missingInfo.length === 0 ? 0.9 : 0.5,
      parameters,
      missingInfo,
      reasoning: 'Fallback rule-based parsing used due to LLM failure',
    };
  }
}