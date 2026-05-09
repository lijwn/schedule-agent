/**
 * LLM-powered Intent Parser
 * Uses LLM function calling to parse user intent
 */

import {
  LLMService,
  LLMMessage,
  LLMIntentResult,
  LLMFunction,
} from '../../types/llm';

const INTENT_SYSTEM_PROMPT = `你是一个日程管理助手，负责理解用户的意图。

用户输入可能是中文或英文，你需要识别以下意图：
- create-event: 创建新日程
- update-event: 修改现有日程
- delete-event: 删除日程
- query-events: 查询/查看日程
- set-reminder: 设置提醒

从用户输入中提取参数：
- title: 日程标题
- description: 日程描述
- startTime: 开始时间
- endTime: 结束时间
- location: 地点
- eventId: 日程ID（仅用于更新/删除/提醒）`;

// Function calling format for MiniMax/OpenAI compatible APIs
const INTENT_FUNCTION: LLMFunction = {
  name: 'parse_intent',
  description: 'Parse user intent for schedule management',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['create-event', 'update-event', 'delete-event', 'query-events', 'set-reminder'],
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
          startTime: { type: 'string', description: 'Start time' },
          endTime: { type: 'string', description: 'End time' },
          location: { type: 'string', description: 'Location' },
          eventId: { type: 'string', description: 'Event ID' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Attendees' },
        },
      },
      missingInfo: {
        type: 'array',
        items: { type: 'string' },
        description: 'Missing information needed',
      },
      reasoning: {
        type: 'string',
        description: 'Explanation of the intent detection',
      },
    },
    required: ['intent', 'confidence', 'parameters', 'missingInfo'],
  },
};

/**
 * LLM-powered Intent Parser with Function Calling
 */
export class LLMIntentParser {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Parse user intent using LLM function calling
   */
  async parse(userMessage: string): Promise<LLMIntentResult> {
    const messages: LLMMessage[] = [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `分析以下用户输入的意图："${userMessage}"`,
      },
    ];

    // Try with function calling first
    try {
      const response = await this.llm.complete({
        messages,
        functions: [INTENT_FUNCTION],
        temperature: 0.3,
        maxTokens: 1000,
      });

      console.log('[IntentParser] LLM response:', response);

      // Handle function call response
      if (response.functionCall) {
        try {
          const args = JSON.parse(response.functionCall.arguments);
          console.log('[IntentParser] Function call args:', args);
          return {
            intent: args.intent as LLMIntentResult['intent'],
            confidence: args.confidence || 0.9,
            parameters: args.parameters || {},
            missingInfo: args.missingInfo || [],
            reasoning: args.reasoning || '',
          };
        } catch (parseError) {
          console.error('[IntentParser] Failed to parse function arguments:', parseError);
        }
      }

      // If no function call, try to parse content as JSON
      if (response.content) {
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return this.normalizeResult(parsed);
          }
        } catch {
          // Fall through to fallback
        }
      }
    } catch (error) {
      console.error('[IntentParser] Function calling failed:', error);
    }

    // Final fallback to rule-based
    console.log('[IntentParser] Using fallback rule-based parsing');
    return this.fallbackParse(userMessage);
  }

  /**
   * Normalize LLM response to standard format
   */
  private normalizeResult(parsed: Record<string, unknown>): LLMIntentResult {
    return {
      intent: (parsed.intent as LLMIntentResult['intent']) || 'query-events',
      confidence: (parsed.confidence as number) || 0.5,
      parameters: (parsed.parameters as Record<string, unknown>) || {},
      missingInfo: (parsed.missingInfo as string[]) || [],
      reasoning: (parsed.reasoning as string) || '',
    };
  }

  /**
   * Fallback to simple keyword-based parsing
   */
  private fallbackParse(task: string): LLMIntentResult {
    const lowerTask = task.toLowerCase();
    let intent: LLMIntentResult['intent'] = 'query-events';
    const missingInfo: string[] = [];
    const parameters: LLMIntentResult['parameters'] = {};

    // Extract time
    const timeMatch = task.match(/(\d{1,2})[点时:]+(\d{1,2})?|((?:今天|明天|后天|周一|周二|周三|周四|周五|周六|周日)[^\s]{0,8})/);
    if (timeMatch) {
      parameters.startTime = timeMatch[0];
    }

    // Extract title
    const titleMatch = task.match(/["「]([^"」]+)["」]|(?:安排|创建|新建)(.+?)(?:会议|日程|在|$)/);
    if (titleMatch) {
      parameters.title = titleMatch[1] || titleMatch[2];
    }

    // Extract location
    const locationMatch = task.match(/在(\S+?)(?:召开|举行|进行|的|地点)/);
    if (locationMatch) {
      parameters.location = locationMatch[1];
    }

    // Detect intent
    if (/创建|新建|安排|添加|add|create/i.test(task)) {
      intent = 'create-event';
      if (!parameters.title) missingInfo.push('title');
      if (!parameters.startTime) missingInfo.push('startTime');
    } else if (/查询|查看|显示|列出|有哪些|我的日程/i.test(task)) {
      intent = 'query-events';
    } else if (/更新|修改|编辑|改|update|edit/i.test(task)) {
      intent = 'update-event';
      if (!parameters.eventId) missingInfo.push('eventId');
    } else if (/删除|取消|remove|delete/i.test(task)) {
      intent = 'delete-event';
      if (!parameters.eventId) missingInfo.push('eventId');
    } else if (/提醒|闹钟|reminder/i.test(task)) {
      intent = 'set-reminder';
      if (!parameters.eventId) missingInfo.push('eventId');
    }

    return {
      intent,
      confidence: missingInfo.length === 0 ? 0.9 : 0.5,
      parameters,
      missingInfo,
      reasoning: 'Fallback rule-based parsing',
    };
  }
}