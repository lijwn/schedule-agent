/**
 * OpenAI LLM Provider Implementation
 */

import OpenAI from 'openai';
import {
  LLMService,
  LLMConfig,
  LLMMessage,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '../../types/llm';

/**
 * OpenAI LLM Service
 */
export class OpenAILLM implements LLMService {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    // Set defaults first, then override with provided config
    this.config = {
      provider: config.provider,
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: this.config.baseUrl || process.env.OPENAI_BASE_URL,
    });
  }

  /**
   * Generate a completion
   */
  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Transform functions to vLLM/OpenAI v4 compatible format
    const tools = request.functions?.map(fn => ({
      type: 'function' as const,
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.maxTokens ?? this.config.maxTokens,
      tools: tools as any,
    });

    const choice = response.choices[0];

    if (!choice) {
      throw new Error('No completion choice returned');
    }

    const message = choice.message;

    // Handle function calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      // Handle different tool call types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const funcObj = toolCall as any;
      const func = funcObj.function || {};
      
      return {
        content: message.content || '',
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        finishReason: 'function_call',
        functionCall: {
          name: func.name || '',
          arguments: func.arguments || '',
        },
      };
    }

    return {
      content: message.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      finishReason: (choice.finish_reason as 'stop' | 'length') || 'stop',
    };
  }

  /**
   * Check if the service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the configured model
   */
  getModel(): string {
    return this.config.model;
  }
}

/**
 * Factory function to create LLM service
 */
export function createLLMService(config: LLMConfig): LLMService {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLM(config);
    // Add more providers here (anthropic, ollama, etc.)
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Create OpenAI LLM service with environment variables
 */
export function createOpenAILLMFromEnv(): LLMService {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAILLM({
    provider: 'openai',
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
  });
}