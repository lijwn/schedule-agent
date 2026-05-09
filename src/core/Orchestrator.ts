/**
 * Orchestrator - The core component that manages agent registration and task dispatching.
 * Acts as the message broker between the main agent and sub-agents.
 */

import {
  AgentId,
  AgentType,
  AgentRequest,
  AgentResponse,
  AgentMessage,
  OrchestratorConfig,
  RegisteredAgent,
  BaseAgent,
} from '../types';
import { Agent } from './Agent';

/**
 * Orchestrator manages all registered agents and handles task dispatching.
 * It provides:
 * - Agent registration/deregistration
 * - Task routing to appropriate agents
 * - Response aggregation
 * - Error handling and retries
 */
export class Orchestrator {
  private agents: Map<AgentType, Agent> = new Map();
  private config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      defaultTimeout: config?.defaultTimeout || 30000,
      maxRetries: config?.maxRetries || 3,
      agents: [],
    };
  }

  /**
   * Register an agent with the orchestrator
   */
  register(agent: Agent): void {
    if (this.agents.has(agent.type)) {
      console.warn(`[Orchestrator] Agent type '${agent.type}' already registered. Replacing.`);
    }
    this.agents.set(agent.type, agent);
    console.log(`[Orchestrator] Registered agent: ${agent.name} (${agent.type})`);
  }

  /**
   * Unregister an agent by type
   */
  unregister(agentType: AgentType): boolean {
    const removed = this.agents.delete(agentType);
    if (removed) {
      console.log(`[Orchestrator] Unregistered agent: ${agentType}`);
    }
    return removed;
  }

  /**
   * Get an agent by type
   */
  getAgent(agentType: AgentType): Agent | undefined {
    return this.agents.get(agentType);
  }

  /**
   * Get all registered agent types
   */
  getRegisteredTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Dispatch a task to the appropriate agent
   */
  async dispatch(request: AgentRequest): Promise<AgentResponse> {
    const agent = this.agents.get(request.agentType);

    if (!agent) {
      return {
        requestId: request.id,
        success: false,
        error: `No agent registered for type: ${request.agentType}`,
        agentId: { type: 'custom', instanceId: 'orchestrator' },
      };
    }

    console.log(`[Orchestrator] Dispatching task to ${agent.name}: ${request.task}`);

    try {
      // Execute with timeout
      const response = await this.executeWithTimeout(agent, request);
      console.log(`[Orchestrator] Task completed: ${response.success}`);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator] Task failed: ${errorMessage}`);
      return {
        requestId: request.id,
        success: false,
        error: errorMessage,
        agentId: { type: 'custom', instanceId: 'orchestrator' },
      };
    }
  }

  /**
   * Execute a request with timeout
   */
  private async executeWithTimeout(agent: Agent, request: AgentRequest): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent ${agent.name} timed out after ${this.config.defaultTimeout}ms`));
      }, this.config.defaultTimeout);

      agent
        .handle(request)
        .then((response) => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Dispatch to multiple agents and aggregate results
   */
  async dispatchMultiple(requests: AgentRequest[]): Promise<AgentResponse[]> {
    const promises = requests.map((req) => this.dispatch(req));
    return Promise.all(promises);
  }

  /**
   * Health check - verify all agents are operational
   */
  async healthCheck(): Promise<Record<AgentType, boolean>> {
    const results: Record<AgentType, boolean> = {} as Record<AgentType, boolean>;

    for (const [type, agent] of this.agents) {
      try {
        results[type] = await agent.healthCheck();
      } catch {
        results[type] = false;
      }
    }

    return results;
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(agentType: AgentType): string[] {
    const agent = this.agents.get(agentType);
    return agent?.getCapabilities() || [];
  }

  /**
   * List all agents and their capabilities
   */
  listAgents(): { type: AgentType; name: string; capabilities: string[] }[] {
    const list: { type: AgentType; name: string; capabilities: string[] }[] = [];

    for (const [type, agent] of this.agents) {
      list.push({
        type,
        name: agent.name,
        capabilities: agent.getCapabilities(),
      });
    }

    return list;
  }
}

/**
 * Global orchestrator instance
 */
let globalOrchestrator: Orchestrator | null = null;

/**
 * Get or create the global orchestrator instance
 */
export function getOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new Orchestrator(config);
  }
  return globalOrchestrator;
}

/**
 * Reset the global orchestrator (useful for testing)
 */
export function resetOrchestrator(): void {
  globalOrchestrator = null;
}