/**
 * PFASP Negotiation System
 * 
 * State machine for schedule negotiation between agents.
 * 
 * Flow:
 * Request → Suggest → Negotiate → Confirm/Reject
 */

import { LocalMemory } from '../memory';
import { 
  AgentMessage, 
  MessageBuilder, 
  MessageParser,
  ScheduleRequestPayload,
  ScheduleSuggestPayload,
  ScheduleNegotiatePayload,
  ConfirmPayload,
  RejectPayload,
} from '../protocol';

/**
 * Negotiation states
 */
export type NegotiationState = 
  | 'initiated'      // Request sent
  | 'suggested'      // Suggestions provided
  | 'negotiating'    // Counter proposals
  | 'confirmed'      // Confirmed by both parties
  | 'rejected'       // Rejected
  | 'cancelled';     // Cancelled

/**
 * Negotiation session
 */
export interface NegotiationSession {
  id: string;
  state: NegotiationState;
  
  // Participants
  initiatorUserId: string;
  responderUserId: string;
  
  // Meeting details
  meeting: {
    title: string;
    description?: string;
    duration: number;
    proposedTimes: string[];
    agreedTime?: string;
  };
  
  // History
  messageIds: string[];
  history: {
    action: string;
    userId: string;
    timestamp: Date;
    details: Record<string, unknown>;
  }[];
  
  // Status
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // User confirmation status
  initiatorConfirmed: boolean;
  responderConfirmed: boolean;
}

/**
 * Negotiation Manager
 */
export class NegotiationManager {
  private sessions: Map<string, NegotiationSession> = new Map();
  private memory: LocalMemory;
  
  // Callback for user confirmation
  private confirmationCallback?: (
    session: NegotiationSession,
    action: 'accept' | 'reject' | 'counter'
  ) => Promise<boolean>;

  constructor(memory: LocalMemory) {
    this.memory = memory;
  }

  /**
   * Set callback for user confirmation
   */
  setConfirmationCallback(
    callback: (session: NegotiationSession, action: 'accept' | 'reject' | 'counter') => Promise<boolean>
  ): void {
    this.confirmationCallback = callback;
  }

  /**
   * Process incoming message and return response
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage | null> {
    const { type, payload } = message;

    switch (type) {
      case 'request':
        return this.handleRequest(message, payload as ScheduleRequestPayload);
      
      case 'suggest':
        return this.handleSuggest(message, payload as ScheduleSuggestPayload);
      
      case 'negotiate':
        return this.handleNegotiate(message, payload as ScheduleNegotiatePayload);
      
      case 'confirm':
        return this.handleConfirm(message, payload as ConfirmPayload);
      
      case 'reject':
        return this.handleReject(message, payload as RejectPayload);
      
      default:
        console.warn(`[Negotiation] Unknown message type: ${type}`);
        return null;
    }
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(
    message: AgentMessage, 
    payload: ScheduleRequestPayload
  ): Promise<AgentMessage> {
    const session = this.createSession(message, payload);
    
    // Update memory
    this.memory.updateRelationship(
      message.sender.userId,
      message.sender.userId
    );

    // Request user confirmation
    if (this.confirmationCallback) {
      const confirmed = await this.confirmationCallback(session, 'accept');
      if (confirmed) {
        session.state = 'suggested';
        // Generate suggestions based on availability
        const suggestions = this.generateSuggestions(session);
        
        return MessageBuilder.suggest(
          message.receiver as any,
          message.sender as any,
          {
            action: 'suggest_time',
            suggestions,
          }
        );
      } else {
        session.state = 'rejected';
        return MessageBuilder.reject(
          message.receiver as any,
          message.sender as any,
          {
            referenceMessageId: message.id,
            reason: 'User declined the request',
          }
        );
      }
    }

    // If no callback, auto-suggest
    session.state = 'suggested';
    const suggestions = this.generateSuggestions(session);
    
    return MessageBuilder.suggest(
      message.receiver as any,
      message.sender as any,
      {
        action: 'suggest_time',
        suggestions,
      }
    );
  }

  /**
   * Handle incoming suggestion
   */
  private async handleSuggest(
    message: AgentMessage,
    payload: ScheduleSuggestPayload
  ): Promise<AgentMessage> {
    // Find existing session
    const session = this.findSessionByReference(message);
    if (!session) {
      return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'failed');
    }

    session.state = 'negotiating';
    session.history.push({
      action: 'received_suggestion',
      userId: message.sender.userId,
      timestamp: new Date(),
      details: { suggestions: payload.suggestions },
    });

    return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'received');
  }

  /**
   * Handle negotiation
   */
  private async handleNegotiate(
    message: AgentMessage,
    payload: ScheduleNegotiatePayload
  ): Promise<AgentMessage> {
    const session = this.sessions.get(payload.referenceMessageId);
    if (!session) {
      return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'failed');
    }

    if (payload.action === 'accept_suggestion') {
      session.history.push({
        action: 'accept_suggestion',
        userId: message.sender.userId,
        timestamp: new Date(),
        details: payload as unknown as Record<string, unknown>,
      });

      // Mark both as confirmed
      if (message.sender.userId === session.initiatorUserId) {
        session.initiatorConfirmed = true;
      } else {
        session.responderConfirmed = true;
      }

      if (session.initiatorConfirmed && session.responderConfirmed) {
        session.state = 'confirmed';
        session.completedAt = new Date();
        
        // Save to memory
        this.memory.addNegotiation({
          id: session.id,
          peerUserId: session.responderUserId,
          peerName: session.responderUserId,
          status: 'accepted',
          proposedTimes: session.meeting.proposedTimes,
          finalTime: session.meeting.agreedTime,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
        });
      }

      return MessageBuilder.confirm(
        message.receiver as any,
        message.sender as any,
        {
          referenceMessageId: message.id,
          meetingId: session.id,
          confirmedTime: session.meeting.agreedTime || payload.proposal?.proposedTime || '',
          userConfirmed: true,
        }
      );
    }

    return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'processed');
  }

  /**
   * Handle confirmation
   */
  private handleConfirm(
    message: AgentMessage,
    payload: ConfirmPayload
  ): AgentMessage {
    const session = this.sessions.get(payload.meetingId);
    if (!session) {
      return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'failed');
    }

    if (message.sender.userId === session.initiatorUserId) {
      session.initiatorConfirmed = true;
    } else {
      session.responderConfirmed = true;
    }

    if (session.initiatorConfirmed && session.responderConfirmed) {
      session.state = 'confirmed';
      session.completedAt = new Date();
    }

    return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'received');
  }

  /**
   * Handle rejection
   */
  private handleReject(
    message: AgentMessage,
    payload: RejectPayload
  ): AgentMessage {
    const session = this.sessions.get(payload.referenceMessageId);
    if (session) {
      session.state = 'rejected';
      session.completedAt = new Date();
    }

    return MessageBuilder.ack(message.receiver as any, message.sender as any, message.id, 'received');
  }

  /**
   * Create a new negotiation session
   */
  private createSession(
    message: AgentMessage,
    payload: ScheduleRequestPayload
  ): NegotiationSession {
    const session: NegotiationSession = {
      id: `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      state: 'initiated',
      initiatorUserId: message.sender.userId,
      responderUserId: message.receiver.userId,
      meeting: {
        title: payload.meeting?.title || 'Meeting',
        description: payload.meeting?.description,
        duration: payload.meeting?.duration || 60,
        proposedTimes: payload.meeting?.preferredTimes || [],
      },
      messageIds: [message.id],
      history: [
        {
          action: 'request',
          userId: message.sender.userId,
          timestamp: new Date(),
          details: payload as unknown as Record<string, unknown>,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      initiatorConfirmed: false,
      responderConfirmed: false,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Find session by reference message
   */
  private findSessionByReference(message: AgentMessage): NegotiationSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.messageIds.includes(message.id)) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Generate time suggestions based on preferences
   */
  private generateSuggestions(session: NegotiationSession): { proposedTime: string; duration: number; reason?: string }[] {
    const suggestions: { proposedTime: string; duration: number; reason?: string }[] = [];
    const now = new Date();
    
    // Default: suggest next available slots
    for (let i = 1; i <= 3; i++) {
      const suggestionTime = new Date(now);
      suggestionTime.setDate(suggestionTime.getDate() + i);
      suggestionTime.setHours(10 + i, 0, 0, 0);
      
      suggestions.push({
        proposedTime: suggestionTime.toISOString(),
        duration: session.meeting.duration,
        reason: `Suggested time slot ${i}`,
      });
    }

    return suggestions;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): NegotiationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions for a user
   */
  getActiveSessions(userId: string): NegotiationSession[] {
    return Array.from(this.sessions.values()).filter(
      s => (s.initiatorUserId === userId || s.responderUserId === userId) &&
           !['confirmed', 'rejected', 'cancelled'].includes(s.state)
    );
  }

  /**
   * Cancel a session
   */
  cancelSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    if (session.initiatorUserId !== userId && session.responderUserId !== userId) {
      return false;
    }

    session.state = 'cancelled';
    session.completedAt = new Date();
    
    this.memory.addNegotiation({
      id: session.id,
      peerUserId: session.responderUserId,
      peerName: session.responderUserId,
      status: 'cancelled',
      proposedTimes: session.meeting.proposedTimes,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    });

    return true;
  }
}