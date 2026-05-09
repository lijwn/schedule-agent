/**
 * Base Agent class - all agents inherit from this.
 * Provides common functionality for agent identification, messaging, and lifecycle.
 */

import {
  AgentId,
  AgentType,
  AgentRequest,
  AgentResponse,
  BaseAgent,
} from '../types';

/**
 * Abstract base class for all agents in the system.
 * Each agent must implement the handle() method to process requests.
 */
export abstract class Agent implements BaseAgent {
  protected readonly _id: AgentId;
  protected readonly _type: AgentType;
  protected readonly _name: string;
  protected readonly _description: string;
  protected _capabilities: string[] = [];

  constructor(
    type: AgentType,
    name: string,
    description: string,
    instanceId?: string
  ) {
    this._type = type;
    this._name = name;
    this._description = description;
    this._id = {
      type,
      instanceId: instanceId || this.generateInstanceId(),
    };
  }

  // Readonly properties
  get id(): AgentId {
    return this._id;
  }

  get type(): AgentType {
    return this._type;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  /**
   * Generate a unique instance ID for this agent
   */
  protected generateInstanceId(): string {
    return `${this._type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle an incoming request.
   * Each agent must implement this to process specific types of tasks.
   */
  abstract handle(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Get the capabilities of this agent
   */
  getCapabilities(): string[] {
    return [...this._capabilities];
  }

  /**
   * Health check - returns true if agent is operational
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  /**
   * Create a successful response
   */
  protected createSuccessResponse(
    requestId: string,
    result: unknown,
    metadata?: Record<string, unknown>
  ): AgentResponse {
    return {
      requestId,
      success: true,
      result,
      agentId: this._id,
      metadata,
    };
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(
    requestId: string,
    error: string,
    metadata?: Record<string, unknown>
  ): AgentResponse {
    return {
      requestId,
      success: false,
      error,
      agentId: this._id,
      metadata,
    };
  }

  /**
   * Generate a unique request ID
   */
  protected generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}