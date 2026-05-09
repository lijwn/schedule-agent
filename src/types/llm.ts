/**
 * LLM Service Types - Interface for LLM providers
 */

export type LLMProvider = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  functions?: LLMFunction[];
}

export interface LLMFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'function_call';
  functionCall?: {
    name: string;
    arguments: string;
  };
}

export interface LLMService {
  /**
   * Generate a completion
   */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

  /**
   * Check if the service is available
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Intent parsing result from LLM
 */
export interface LLMIntentResult {
  intent: 'create-event' | 'update-event' | 'delete-event' | 'query-events' | 'set-reminder' | 'unknown';
  confidence: number;
  parameters: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    eventId?: string;
    attendees?: string[];
  };
  missingInfo: string[];
  reasoning: string;
}

/**
 * Response generation prompt
 */
export interface LLMResponseRequest {
  userMessage: string;
  intent: string;
  toolResult: unknown;
  conversationHistory: LLMMessage[];
}

export interface LLMResponseResult {
  response: string;
  shouldAskClarification: boolean;
  clarificationQuestion?: string;
}