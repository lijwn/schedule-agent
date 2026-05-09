/**
 * PFASP Agent Discovery Service
 * 
 * Manages Agent Directory - a registry of available agents.
 * 
 * In MVP, this is a centralized stub. Future versions will be decentralized.
 * 
 * Platform only stores:
 * - Agent ID
 * - Function type
 * - Online status
 * - Public key
 * 
 * Platform does NOT store:
 * - User private memories
 * - Agent decision logic
 * - Long-term context
 */

import { AgentCard, CapabilityType, AgentType } from '../protocol';
import { UserIdentity } from '../identity';

/**
 * Agent registration request
 */
export interface RegisterAgentRequest {
  userId: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: CapabilityType[];
  publicKey?: string;
  endpoint?: string;
}

/**
 * Agent Discovery Service
 */
export class AgentDiscoveryService {
  // In-memory registry (in production, this would be in database)
  private agents: Map<string, AgentCard> = new Map();
  
  // User ID to agent mapping
  private userAgents: Map<string, string[]> = new Map();

  /**
   * Register a new agent
   */
  registerAgent(request: RegisterAgentRequest): AgentCard {
    const agentId = `agent_${request.userId}_${request.type}_${Date.now()}`;
    
    const card: AgentCard = {
      id: agentId,
      ownerUserId: request.userId,
      type: request.type,
      name: request.name,
      description: request.description,
      capabilities: request.capabilities,
      publicKey: request.publicKey,
      endpoint: request.endpoint,
      onlineStatus: 'online',
      lastSeen: new Date(),
    };

    this.agents.set(agentId, card);
    
    // Map user to agent
    const userAgentList = this.userAgents.get(request.userId) || [];
    userAgentList.push(agentId);
    this.userAgents.set(request.userId, userAgentList);

    console.log(`[Discovery] Registered agent: ${agentId} for user: ${request.userId}`);
    
    return card;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Remove from user mapping
    const userAgentList = this.userAgents.get(agent.ownerUserId);
    if (userAgentList) {
      const index = userAgentList.indexOf(agentId);
      if (index > -1) {
        userAgentList.splice(index, 1);
      }
    }

    this.agents.delete(agentId);
    console.log(`[Discovery] Unregistered agent: ${agentId}`);
    
    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentCard | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by user ID
   */
  getAgentsByUser(userId: string): AgentCard[] {
    const agentIds = this.userAgents.get(userId) || [];
    return agentIds.map(id => this.agents.get(id)).filter((a): a is AgentCard => !!a);
  }

  /**
   * Search agents by capability
   */
  searchByCapability(capability: CapabilityType): AgentCard[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.includes(capability) && agent.onlineStatus === 'online'
    );
  }

  /**
   * Search agents by type
   */
  searchByType(type: AgentType): AgentCard[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.type === type && agent.onlineStatus === 'online'
    );
  }

  /**
   * Search agents by name/description keyword
   */
  search(keyword: string): AgentCard[] {
    const lower = keyword.toLowerCase();
    return Array.from(this.agents.values()).filter(agent =>
      agent.onlineStatus === 'online' && (
        agent.name.toLowerCase().includes(lower) ||
        agent.description.toLowerCase().includes(lower)
      )
    );
  }

  /**
   * Update online status
   */
  updateStatus(agentId: string, status: 'online' | 'offline' | 'away'): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.onlineStatus = status;
    agent.lastSeen = new Date();
    return true;
  }

  /**
   * Get all online agents
   */
  getOnlineAgents(): AgentCard[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.onlineStatus === 'online'
    );
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Heartbeat - agent reports it's still alive
   */
  heartbeat(agentId: string): boolean {
    return this.updateStatus(agentId, 'online');
  }
}

// Global instance
let discoveryService: AgentDiscoveryService | null = null;

export function getDiscoveryService(): AgentDiscoveryService {
  if (!discoveryService) {
    discoveryService = new AgentDiscoveryService();
  }
  return discoveryService;
}