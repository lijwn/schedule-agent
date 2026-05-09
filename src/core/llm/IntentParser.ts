/**
 * LLM-powered Intent Parser
 * Uses LLM to parse user intent from natural language
 */

import {
  LLMService,
  LLMMessage,
  LLMIntentResult,
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
- startTime: 开始时间 (如 "明天下午3点")
- endTime: 结束时间
- location: 地点
- eventId: 日程ID（仅用于更新/删除/提醒）

重要：请直接返回JSON格式，不要有任何其他内容。格式如下：
{"intent": "意图", "confidence": 0.9, "parameters": {"title": "标题", "startTime": "时间"}, "missingInfo": [], "reasoning": "解释"}`;

/**
 * LLM-powered Intent Parser (no function calling)
 */
export class LLMIntentParser {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Parse user intent using LLM (without function calling)
   */
  async parse(userMessage: string): Promise<LLMIntentResult> {
    const messages: LLMMessage[] = [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请分析以下用户输入的意图：\n\n"${userMessage}"\n\n直接返回JSON，不要其他内容。`,
      },
    ];

    try {
      // Don't use functions - some APIs don't support it
      const response = await this.llm.complete({
        messages,
        temperature: 0.3,
        maxTokens: 500,
      });

      // Try to parse the response as JSON
      const content = response.content.trim();
      
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent as LLMIntentResult['intent'],
          confidence: parsed.confidence || 0.5,
          parameters: parsed.parameters || {},
          missingInfo: parsed.missingInfo || [],
          reasoning: parsed.reasoning || '',
        };
      }

      // If JSON parsing fails, use fallback
      console.warn('[IntentParser] Failed to parse LLM response as JSON, using fallback');
      return this.fallbackParse(userMessage);
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

    // Extract time patterns
    const timeMatch = task.match(/(\d{1,2})[点时:]+(\d{1,2})?|((?:今天|明天|后天|周一|周二|周三|周四|周五|周六|周日|周[一二三四五六日])[上下午]?[^\s]{0,5})/);
    if (timeMatch) {
      parameters.startTime = timeMatch[0];
    }

    // Extract title (between quotes or after specific patterns)
    const titleMatch = task.match(/["「]([^"」]+)["」]|(?:安排|创建|新建)(.+?)(?:会议|日程|在|$)/);
    if (titleMatch) {
      parameters.title = titleMatch[1] || titleMatch[2];
    }

    // Extract location
    const locationMatch = task.match(/在(\S+?)(?:召开|举行|进行|的|召开)/);
    if (locationMatch) {
      parameters.location = locationMatch[1];
    }

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