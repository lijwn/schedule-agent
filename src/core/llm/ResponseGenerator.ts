/**
 * LLM-powered Response Generator
 * Generates natural language responses based on tool results
 */

import {
  LLMService,
  LLMMessage,
  LLMResponseResult,
} from '../../types/llm';

const RESPONSE_SYSTEM_PROMPT = `你是一个友好的日程管理助手。用户刚才执行了一个日程管理操作，你需要用自然、友好的中文回复他们。

要求：
1. 用口语化的中文回复，不要太正式
2. 根据操作结果给出适当的反馈
3. 如果操作成功，用积极的语气
4. 如果需要用户提供更多信息，提出清晰的问题
5. 保持回复简洁明了
6. 可以适当添加 emoji 让回复更生动`;

const RESPONSE_USER_PROMPT = `
用户的消息：{userMessage}
识别到的意图：{intent}
操作结果：{toolResult}
对话历史：{conversationHistory}

请生成回复：`;

/**
 * LLM-powered Response Generator
 */
export class LLMResponseGenerator {
  private llm: LLMService;

  constructor(llm: LLMService) {
    this.llm = llm;
  }

  /**
   * Generate a natural language response
   */
  async generate(request: {
    userMessage: string;
    intent: string;
    toolResult: unknown;
    conversationHistory?: LLMMessage[];
  }): Promise<LLMResponseResult> {
    const { userMessage, intent, toolResult, conversationHistory = [] } = request;

    // Build messages
    const messages: LLMMessage[] = [
      { role: 'system', content: RESPONSE_SYSTEM_PROMPT },
    ];

    // Add conversation history (last 5 messages)
    const recentHistory = conversationHistory.slice(-5);
    recentHistory.forEach((msg) => {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    });

    // Format tool result for display
    const formattedToolResult = this.formatToolResult(toolResult);

    // Add user prompt
    const userPrompt = RESPONSE_USER_PROMPT
      .replace('{userMessage}', userMessage)
      .replace('{intent}', intent)
      .replace('{toolResult}', formattedToolResult)
      .replace('{conversationHistory}', this.formatHistory(recentHistory));

    messages.push({ role: 'user', content: userPrompt });

    try {
      const response = await this.llm.complete({
        messages,
        temperature: 0.7,
        maxTokens: 500,
      });

      const content = response.content.trim();

      // Check if response asks for clarification
      const shouldAskClarification = this.detectClarificationNeed(content);

      return {
        response: content,
        shouldAskClarification,
        clarificationQuestion: shouldAskClarification ? content : undefined,
      };
    } catch (error) {
      console.error('[ResponseGenerator] LLM call failed, using fallback:', error);
      return this.fallbackGenerate(intent, toolResult);
    }
  }

  /**
   * Format tool result for inclusion in prompt
   */
  private formatToolResult(result: unknown): string {
    if (!result) return '无结果';

    const r = result as { message?: string; events?: unknown[]; event?: unknown };

    if (r.message) {
      return r.message;
    }

    if (r.events) {
      const events = r.events as Array<{ title: string; startTime: string; location?: string }>;
      if (events.length === 0) return '没有找到日程';
      return `找到 ${events.length} 个日程：\n${events.map((e, i) => `${i + 1}. ${e.title} (${e.startTime})`).join('\n')}`;
    }

    if (r.event) {
      return `日程详情：${JSON.stringify(r.event, null, 2)}`;
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format conversation history
   */
  private formatHistory(history: LLMMessage[]): string {
    if (history.length === 0) return '无对话历史';
    return history.map((m) => `${m.role}: ${m.content}`).join('\n');
  }

  /**
   * Detect if response is asking for clarification
   */
  private detectClarificationNeed(response: string): boolean {
    const clarificationPatterns = [
      /请提供/,
      /需要知道/,
      /请告诉我/,
      /能否告诉我/,
      /缺少/,
      /不完整/,
    ];
    return clarificationPatterns.some((p) => p.test(response));
  }

  /**
   * Fallback response generation
   */
  private fallbackGenerate(intent: string, toolResult: unknown): LLMResponseResult {
    const result = toolResult as { message?: string; events?: unknown[]; success?: boolean };

    let response = '';

    switch (intent) {
      case 'create-event':
        response = result?.message || '✅ 日程创建成功！';
        break;
      case 'update-event':
        response = result?.message || '✅ 日程已更新！';
        break;
      case 'delete-event':
        response = result?.message || '✅ 日程已删除！';
        break;
      case 'query-events':
        if (result?.events) {
          const events = result.events as Array<{ title: string }>;
          response = events.length > 0
            ? `📅 找到 ${events.length} 个日程:\n${events.map((e, i) => `${i + 1}. ${e.title}`).join('\n')}`
            : '📅 没有找到日程';
        } else {
          response = result?.message || '📅 这是你的日程列表';
        }
        break;
      case 'set-reminder':
        response = result?.message || '✅ 提醒已设置！';
        break;
      default:
        response = result?.message || '好的，我明白了！';
    }

    return {
      response,
      shouldAskClarification: false,
    };
  }
}