/**
 * Core type definitions for the multi-agent scheduling system.
 * This defines the communication protocol between agents.
 */

// Agent identification
export interface AgentId {
  type: AgentType;
  instanceId: string;
}

export type AgentType = 
  | 'schedule-manager'  // Main orchestrator agent
  | 'calendar'          // Calendar CRUD operations
  | 'reminder'          // Reminder/notification agent
  | 'weather'           // Weather information agent
  | 'custom';           // User-defined agent

// Message types for agent communication
export type MessageRole = 'user' | 'assistant' | 'agent' | 'system';

export interface AgentMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  agentId?: AgentId;  // Which agent sent this message
  metadata?: Record<string, unknown>;
}

// Request/Response types for agent dispatching
export interface AgentRequest {
  id: string;
  task: string;                    // Natural language task description
  agentType: AgentType;            // Which type of agent to dispatch to
  context?: Record<string, unknown>;  // Additional context
  userId?: string;
}

export interface AgentResponse {
  requestId: string;
  success: boolean;
  result?: unknown;                // The actual result from the agent
  error?: string;                  // Error message if failed
  agentId: AgentId;                // Which agent handled this
  metadata?: Record<string, unknown>;
}

// Calendar-specific types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  reminder?: ReminderConfig;
}

export interface ReminderConfig {
  enabled: boolean;
  minutesBefore: number;
  method: 'notification' | 'email' | 'sms';
}

export interface CreateEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  reminder?: ReminderConfig;
}

export interface QueryEventsParams {
  startDate?: Date;
  endDate?: Date;
  keyword?: string;
}

// Task intent classification
export type ScheduleIntent = 
  | 'create-event'
  | 'update-event'
  | 'delete-event'
  | 'query-events'
  | 'set-reminder'
  | 'unknown';

export interface ParsedIntent {
  intent: ScheduleIntent;
  confidence: number;
  extractedParams: Record<string, unknown>;
  missingInfo: string[];
}

// Orchestrator configuration
export interface OrchestratorConfig {
  agents: RegisteredAgent[];
  defaultTimeout: number;  // ms
  maxRetries: number;
}

export interface RegisteredAgent {
  type: AgentType;
  instance: BaseAgent;
  capabilities: string[];
  enabled: boolean;
}

// Base agent interface
export interface BaseAgent {
  readonly id: AgentId;
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  
  // Handle incoming requests
  handle(request: AgentRequest): Promise<AgentResponse>;
  
  // Get capabilities
  getCapabilities(): string[];
  
  // Health check
  healthCheck(): Promise<boolean>;
}