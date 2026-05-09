/**
 * PFASP Agent Communication Protocol
 * 
 * Defines the JSON message format for agent-to-agent communication.
 * 
 * Protocol Version: 1.0
 * Transport: WebSocket + JSON
 */

import { AgentId, AgentType } from '../types';

// Re-export for convenience
export { AgentId, AgentType } from '../types';

/**
 * Message types in the protocol
 */
export type MessageType = 
  | 'request'      // Request action
  | 'suggest'      // Suggestion
  | 'negotiate'    // Negotiation
  | 'confirm'      // Confirm action
  | 'reject'       // Reject action
  | 'response'     // Response to request
  | 'notify'       // Notification
  | 'ack';         // Acknowledgment

/**
 * Agent capability types
 */
export type CapabilityType = 
  | 'schedule:read'
  | 'schedule:write'
  | 'schedule:negotiate'
  | 'calendar:query'
  | 'reminder:set';

/**
 * Agent card - public information about an agent
 */
export interface AgentCard {
  id: string;
  ownerUserId: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: CapabilityType[];
  publicKey?: string;
  endpoint?: string;
  onlineStatus: 'online' | 'offline' | 'away';
  lastSeen: Date;
}

/**
 * Protocol message envelope
 */
export interface AgentMessage {
  // Header
  id: string;
  type: MessageType;
  version: string;
  timestamp: Date;
  
  // Sender
  sender: {
    agentId: string;
    userId: string;
    deviceId: string;
  };
  
  // Receiver
  receiver: {
    agentId?: string;
    userId: string;
  };
  
  // Payload
  payload: MessagePayload;
  
  // Security
  signature?: string;
  nonce?: string;
}

/**
 * Payload for different message types
 */
export type MessagePayload = 
  | ScheduleRequestPayload
  | ScheduleSuggestPayload
  | ScheduleNegotiatePayload
  | ConfirmPayload
  | RejectPayload
  | ResponsePayload
  | NotificationPayload;

/**
 * Schedule request payload
 */
export interface ScheduleRequestPayload {
  action: 'request_meeting' | 'query_availability' | 'cancel_meeting';
  meeting?: {
    title: string;
    description?: string;
    duration?: number;  // minutes
    preferredTimes?: string[];  // ISO datetime strings
    deadline?: string;
  };
  requesterNotes?: string;
}

/**
 * Schedule suggestion payload
 */
export interface ScheduleSuggestPayload {
  action: 'suggest_time' | 'suggest_alternatives';
  suggestions: {
    proposedTime: string;
    duration: number;
    reason?: string;
  }[];
  counterOffer?: boolean;
}

/**
 * Schedule negotiate payload
 */
export interface ScheduleNegotiatePayload {
  action: 'accept_suggestion' | 'counter_propose' | 'compromise';
  referenceMessageId: string;
  meetingId?: string;
  proposal?: {
    proposedTime: string;
    duration: number;
  };
  reasoning?: string;
}

/**
 * Confirm payload
 */
export interface ConfirmPayload {
  referenceMessageId: string;
  meetingId: string;
  confirmedTime: string;
  userConfirmed: boolean;
  notes?: string;
}

/**
 * Reject payload
 */
export interface RejectPayload {
  referenceMessageId: string;
  reason: string;
  alternativeSuggestion?: {
    proposedTime: string;
    duration: number;
  };
}

/**
 * Response payload
 */
export interface ResponsePayload {
  status: 'success' | 'failure' | 'pending';
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: 'reminder' | 'update' | 'cancellation' | 'status_change';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Message builder utility
 */
export class MessageBuilder {
  /**
   * Create a new message
   */
  static create(
    type: MessageType,
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: MessagePayload
  ): AgentMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      version: '1.0',
      timestamp: new Date(),
      sender,
      receiver,
      payload,
    };
  }

  /**
   * Create a request message
   */
  static request(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: ScheduleRequestPayload
  ): AgentMessage {
    return this.create('request', sender, receiver, payload);
  }

  /**
   * Create a suggestion message
   */
  static suggest(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: ScheduleSuggestPayload
  ): AgentMessage {
    return this.create('suggest', sender, receiver, payload);
  }

  /**
   * Create a negotiate message
   */
  static negotiate(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: ScheduleNegotiatePayload
  ): AgentMessage {
    return this.create('negotiate', sender, receiver, payload);
  }

  /**
   * Create a confirm message
   */
  static confirm(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: ConfirmPayload
  ): AgentMessage {
    return this.create('confirm', sender, receiver, payload);
  }

  /**
   * Create a reject message
   */
  static reject(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    payload: RejectPayload
  ): AgentMessage {
    return this.create('reject', sender, receiver, payload);
  }

  /**
   * Create an acknowledgment
   */
  static ack(
    sender: AgentMessage['sender'],
    receiver: AgentMessage['receiver'],
    originalMessageId: string,
    status: 'received' | 'processed' | 'failed'
  ): AgentMessage {
    return this.create('ack', sender, receiver, {
      status: 'success',
      metadata: {
        originalMessageId,
        ackStatus: status,
      },
    } as ResponsePayload);
  }
}

/**
 * Message parser utility
 */
export class MessageParser {
  /**
   * Parse a JSON string to message
   */
  static parse(json: string): AgentMessage | null {
    try {
      const parsed = JSON.parse(json);
      
      // Validate required fields
      if (!parsed.id || !parsed.type || !parsed.sender || !parsed.receiver || !parsed.payload) {
        console.error('[Protocol] Missing required fields');
        return null;
      }
      
      // Parse timestamp
      parsed.timestamp = new Date(parsed.timestamp);
      
      return parsed as AgentMessage;
    } catch (error) {
      console.error('[Protocol] Failed to parse message:', error);
      return null;
    }
  }

  /**
   * Serialize message to JSON
   */
  static serialize(message: AgentMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Validate message structure
   */
  static validate(message: AgentMessage): { valid: boolean; error?: string } {
    if (!message.id) return { valid: false, error: 'Missing message ID' };
    if (!message.type) return { valid: false, error: 'Missing message type' };
    if (!message.sender?.agentId) return { valid: false, error: 'Missing sender agent ID' };
    if (!message.sender?.userId) return { valid: false, error: 'Missing sender user ID' };
    if (!message.receiver?.userId) return { valid: false, error: 'Missing receiver user ID' };
    if (!message.payload) return { valid: false, error: 'Missing payload' };
    
    return { valid: true };
  }
}