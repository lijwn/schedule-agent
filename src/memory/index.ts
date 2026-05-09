/**
 * PFASP Local Memory System
 * 
 * SQLite-based local storage for:
 * - Negotiation history
 * - User preferences
 * - Relationship history
 * - Trust status
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MemoryConfig {
  dbPath?: string;
}

/**
 * Memory entry types
 */
export type MemoryType = 
  | 'negotiation_history'
  | 'user_preference'
  | 'relationship'
  | 'trust_status'
  | 'schedule_item';

/**
 * Base memory entry
 */
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  userId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Negotiation history entry
 */
export interface NegotiationHistory {
  id: string;
  peerUserId: string;
  peerName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  proposedTimes: string[];
  finalTime?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * User preference
 */
export interface UserPreference {
  key: string;
  value: unknown;
  updatedAt: Date;
}

/**
 * Relationship entry
 */
export interface Relationship {
  peerUserId: string;
  peerName: string;
  trustLevel: 'trusted' | 'untrusted' | 'unknown';
  interactionCount: number;
  lastInteractionAt: Date;
  notes?: string;
}

/**
 * Trust status
 */
export interface TrustStatus {
  peerUserId: string;
  isTrusted: boolean;
  reason?: string;
  updatedAt: Date;
}

/**
 * Local Memory System - SQLite based
 * 
 * In production, this would use better-sqlite3 or sqlite3 package.
 * For now, we use a JSON file-based approach for simplicity.
 */
export class LocalMemory {
  private dataPath: string;
  private memories: Map<string, MemoryEntry> = new Map();
  
  // In-memory stores
  private negotiations: Map<string, NegotiationHistory> = new Map();
  private preferences: Map<string, UserPreference> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private trustStatuses: Map<string, TrustStatus> = new Map();
  private userId: string = '';

  constructor(config?: MemoryConfig) {
    this.dataPath = config?.dbPath || path.join(process.cwd(), 'data');
    this.ensureDataDir();
  }

  /**
   * Set the current user ID
   */
  setUser(userId: string): void {
    this.userId = userId;
    this.load();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load data from disk
   */
  private load(): void {
    if (!this.userId) return;
    
    const userDir = path.join(this.dataPath, this.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Load negotiations
    const negFile = path.join(userDir, 'negotiations.json');
    if (fs.existsSync(negFile)) {
      const data = JSON.parse(fs.readFileSync(negFile, 'utf-8'));
      this.negotiations = new Map(data);
    }

    // Load preferences
    const prefFile = path.join(userDir, 'preferences.json');
    if (fs.existsSync(prefFile)) {
      const data = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
      this.preferences = new Map(data);
    }

    // Load relationships
    const relFile = path.join(userDir, 'relationships.json');
    if (fs.existsSync(relFile)) {
      const data = JSON.parse(fs.readFileSync(relFile, 'utf-8'));
      this.relationships = new Map(data);
    }

    // Load trust statuses
    const trustFile = path.join(userDir, 'trust.json');
    if (fs.existsSync(trustFile)) {
      const data = JSON.parse(fs.readFileSync(trustFile, 'utf-8'));
      this.trustStatuses = new Map(data);
    }

    console.log(`[Memory] Loaded data for user: ${this.userId}`);
  }

  /**
   * Save data to disk
   */
  private save(): void {
    if (!this.userId) return;
    
    const userDir = path.join(this.dataPath, this.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // Save negotiations
    fs.writeFileSync(
      path.join(userDir, 'negotiations.json'),
      JSON.stringify(Array.from(this.negotiations.entries()), null, 2)
    );

    // Save preferences
    fs.writeFileSync(
      path.join(userDir, 'preferences.json'),
      JSON.stringify(Array.from(this.preferences.entries()), null, 2)
    );

    // Save relationships
    fs.writeFileSync(
      path.join(userDir, 'relationships.json'),
      JSON.stringify(Array.from(this.relationships.entries()), null, 2)
    );

    // Save trust statuses
    fs.writeFileSync(
      path.join(userDir, 'trust.json'),
      JSON.stringify(Array.from(this.trustStatuses.entries()), null, 2)
    );
  }

  // ==================== Negotiations ====================

  /**
   * Add negotiation history
   */
  addNegotiation(negotiation: NegotiationHistory): void {
    this.negotiations.set(negotiation.id, negotiation);
    this.save();
  }

  /**
   * Get negotiation by ID
   */
  getNegotiation(id: string): NegotiationHistory | undefined {
    return this.negotiations.get(id);
  }

  /**
   * Get all negotiations with a peer
   */
  getNegotiationsWithPeer(peerUserId: string): NegotiationHistory[] {
    return Array.from(this.negotiations.values())
      .filter(n => n.peerUserId === peerUserId);
  }

  /**
   * Update negotiation
   */
  updateNegotiation(id: string, updates: Partial<NegotiationHistory>): void {
    const existing = this.negotiations.get(id);
    if (existing) {
      this.negotiations.set(id, { ...existing, ...updates });
      this.save();
    }
  }

  // ==================== Preferences ====================

  /**
   * Set user preference
   */
  setPreference(key: string, value: unknown): void {
    this.preferences.set(key, {
      key,
      value,
      updatedAt: new Date(),
    });
    this.save();
  }

  /**
   * Get user preference
   */
  getPreference(key: string): UserPreference | undefined {
    return this.preferences.get(key);
  }

  /**
   * Get all preferences
   */
  getAllPreferences(): UserPreference[] {
    return Array.from(this.preferences.values());
  }

  // ==================== Relationships ====================

  /**
   * Add or update relationship
   */
  updateRelationship(peerUserId: string, peerName: string): void {
    const existing = this.relationships.get(peerUserId);
    
    if (existing) {
      existing.interactionCount++;
      existing.lastInteractionAt = new Date();
      if (peerName) existing.peerName = peerName;
    } else {
      this.relationships.set(peerUserId, {
        peerUserId,
        peerName,
        trustLevel: 'unknown',
        interactionCount: 1,
        lastInteractionAt: new Date(),
      });
    }
    
    this.save();
  }

  /**
   * Get relationship with peer
   */
  getRelationship(peerUserId: string): Relationship | undefined {
    return this.relationships.get(peerUserId);
  }

  /**
   * Get all relationships
   */
  getAllRelationships(): Relationship[] {
    return Array.from(this.relationships.values());
  }

  // ==================== Trust ====================

  /**
   * Set trust status
   */
  setTrustStatus(peerUserId: string, isTrusted: boolean, reason?: string): void {
    this.trustStatuses.set(peerUserId, {
      peerUserId,
      isTrusted,
      reason,
      updatedAt: new Date(),
    });
    this.save();
  }

  /**
   * Get trust status
   */
  getTrustStatus(peerUserId: string): TrustStatus | undefined {
    return this.trustStatuses.get(peerUserId);
  }

  /**
   * Check if peer is trusted
   */
  isPeerTrusted(peerUserId: string): boolean {
    const trust = this.trustStatuses.get(peerUserId);
    return trust?.isTrusted ?? false;
  }

  // ==================== Utility ====================

  /**
   * Clear all data for this user
   */
  clearAll(): void {
    this.negotiations.clear();
    this.preferences.clear();
    this.relationships.clear();
    this.trustStatuses.clear();
    this.save();
  }

  /**
   * Export all data
   */
  exportAll(): {
    negotiations: NegotiationHistory[];
    preferences: UserPreference[];
    relationships: Relationship[];
    trustStatuses: TrustStatus[];
  } {
    return {
      negotiations: Array.from(this.negotiations.values()),
      preferences: Array.from(this.preferences.values()),
      relationships: Array.from(this.relationships.values()),
      trustStatuses: Array.from(this.trustStatuses.values()),
    };
  }
}

// Global memory instance
let localMemory: LocalMemory | null = null;

export function getLocalMemory(config?: MemoryConfig): LocalMemory {
  if (!localMemory) {
    localMemory = new LocalMemory(config);
  }
  return localMemory;
}