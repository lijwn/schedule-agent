/**
 * Calendar Agent - Handles all calendar-related operations.
 * Provides CRUD functionality for calendar events.
 */

import {
  AgentRequest,
  AgentResponse,
  CalendarEvent,
  CreateEventParams,
  QueryEventsParams,
} from '../types';
import { Agent } from '../core/Agent';

/**
 * Calendar Agent - In-memory implementation for demonstration.
 * In production, this would integrate with Google Calendar, Outlook, etc.
 */
export class CalendarAgent extends Agent {
  private events: Map<string, CalendarEvent> = new Map();

  constructor() {
    super(
      'calendar',
      'Calendar Agent',
      'Handles calendar CRUD operations: create, read, update, delete events',
      'calendar-main'
    );

    this._capabilities = [
      'create-event',
      'update-event',
      'delete-event',
      'query-events',
      'get-event-by-id',
    ];

    // Add some sample events for demonstration
    this.initializeSampleEvents();
  }

  /**
   * Initialize sample events for demonstration
   */
  private initializeSampleEvents(): void {
    const sampleEvents: CalendarEvent[] = [
      {
        id: 'evt-001',
        title: 'Team Standup',
        description: 'Daily team standup meeting',
        startTime: this.getTodayAt(9, 0),
        endTime: this.getTodayAt(9, 30),
        location: 'Conference Room A',
      },
      {
        id: 'evt-002',
        title: 'Project Review',
        description: 'Q1 project review meeting',
        startTime: this.getTodayAt(14, 0),
        endTime: this.getTodayAt(15, 0),
        location: 'Meeting Room B',
        attendees: ['alice@example.com', 'bob@example.com'],
        reminder: {
          enabled: true,
          minutesBefore: 15,
          method: 'notification',
        },
      },
    ];

    sampleEvents.forEach((evt) => this.events.set(evt.id, evt));
  }

  /**
   * Helper to get today's date at specific time
   */
  private getTodayAt(hours: number, minutes: number): Date {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Handle incoming requests - dispatch to appropriate handler
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const task = request.task.toLowerCase();

    try {
      // Parse the task to determine action
      if (this.isCreateEvent(task)) {
        return await this.handleCreateEvent(request);
      } else if (this.isQueryEvents(task)) {
        return await this.handleQueryEvents(request);
      } else if (this.isUpdateEvent(task)) {
        return await this.handleUpdateEvent(request);
      } else if (this.isDeleteEvent(task)) {
        return await this.handleDeleteEvent(request);
      } else if (this.isGetEvent(task)) {
        return await this.handleGetEvent(request);
      } else {
        // Default: return all events
        return await this.handleQueryEvents(request);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(request.id, `Calendar operation failed: ${errorMessage}`);
    }
  }

  /**
   * Determine if task is creating an event
   */
  private isCreateEvent(task: string): boolean {
    const indicators = ['创建', '新建', '安排', '添加', 'add', 'create', 'new event'];
    return indicators.some((ind) => task.includes(ind));
  }

  /**
   * Determine if task is querying events
   */
  private isQueryEvents(task: string): boolean {
    const indicators = ['查询', '查看', '显示', '列出', '有哪些', 'query', 'list', 'show', 'get'];
    return indicators.some((ind) => task.includes(ind));
  }

  /**
   * Determine if task is updating an event
   */
  private isUpdateEvent(task: string): boolean {
    const indicators = ['更新', '修改', '编辑', '改', 'update', 'edit', 'modify'];
    return indicators.some((ind) => task.includes(ind));
  }

  /**
   * Determine if task is deleting an event
   */
  private isDeleteEvent(task: string): boolean {
    const indicators = ['删除', '取消', 'remove', 'delete'];
    return indicators.some((ind) => task.includes(ind));
  }

  /**
   * Determine if task is getting a specific event
   */
  private isGetEvent(task: string): boolean {
    const indicators = ['详情', '详细信息', 'details'];
    return indicators.some((ind) => task.includes(ind));
  }

  /**
   * Handle create event request
   */
  private async handleCreateEvent(request: AgentRequest): Promise<AgentResponse> {
    // Extract event details from task or context
    const params = this.extractEventParams(request.task);
    
    if (!params.title) {
      return this.createErrorResponse(
        request.id,
        'Cannot create event: missing title. Please provide an event title.'
      );
    }

    if (!params.startTime) {
      return this.createErrorResponse(
        request.id,
        'Cannot create event: missing start time. Please provide a start time.'
      );
    }

    const event: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: params.title,
      description: params.description,
      startTime: params.startTime,
      endTime: params.endTime,
      location: params.location,
      attendees: params.attendees,
      reminder: params.reminder,
    };

    this.events.set(event.id, event);

    return this.createSuccessResponse(request.id, {
      message: `Event "${event.title}" created successfully`,
      event,
    });
  }

  /**
   * Handle query events request
   */
  private async handleQueryEvents(request: AgentRequest): Promise<AgentResponse> {
    const allEvents = Array.from(this.events.values());
    
    // Sort by start time
    allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Format events for display
    const formattedEvents = allEvents.map((evt) => ({
      id: evt.id,
      title: evt.title,
      startTime: evt.startTime.toLocaleString('zh-CN'),
      endTime: evt.endTime?.toLocaleString('zh-CN') || 'N/A',
      location: evt.location || 'N/A',
    }));

    return this.createSuccessResponse(request.id, {
      message: `Found ${allEvents.length} event(s)`,
      events: formattedEvents,
      total: allEvents.length,
    });
  }

  /**
   * Handle update event request
   */
  private async handleUpdateEvent(request: AgentRequest): Promise<AgentResponse> {
    const eventId = this.extractEventId(request.task);
    
    if (!eventId) {
      return this.createErrorResponse(
        request.id,
        'Cannot update event: please specify which event to update (provide event ID).'
      );
    }

    const event = this.events.get(eventId);
    if (!event) {
      return this.createErrorResponse(
        request.id,
        `Event with ID "${eventId}" not found.`
      );
    }

    // Extract updated fields
    const updates = this.extractEventParams(request.task);
    
    // Apply updates
    if (updates.title) event.title = updates.title;
    if (updates.description) event.description = updates.description;
    if (updates.startTime) event.startTime = updates.startTime;
    if (updates.endTime) event.endTime = updates.endTime;
    if (updates.location) event.location = updates.location;

    this.events.set(eventId, event);

    return this.createSuccessResponse(request.id, {
      message: `Event "${event.title}" updated successfully`,
      event,
    });
  }

  /**
   * Handle delete event request
   */
  private async handleDeleteEvent(request: AgentRequest): Promise<AgentResponse> {
    const eventId = this.extractEventId(request.task);
    
    if (!eventId) {
      return this.createErrorResponse(
        request.id,
        'Cannot delete event: please specify which event to delete (provide event ID).'
      );
    }

    const event = this.events.get(eventId);
    if (!event) {
      return this.createErrorResponse(
        request.id,
        `Event with ID "${eventId}" not found.`
      );
    }

    this.events.delete(eventId);

    return this.createSuccessResponse(request.id, {
      message: `Event "${event.title}" deleted successfully`,
      deletedEventId: eventId,
    });
  }

  /**
   * Handle get specific event request
   */
  private async handleGetEvent(request: AgentRequest): Promise<AgentResponse> {
    const eventId = this.extractEventId(request.task);
    
    if (!eventId) {
      return this.createErrorResponse(
        request.id,
        'Cannot get event details: please specify which event (provide event ID).'
      );
    }

    const event = this.events.get(eventId);
    if (!event) {
      return this.createErrorResponse(
        request.id,
        `Event with ID "${eventId}" not found.`
      );
    }

    return this.createSuccessResponse(request.id, {
      event,
    });
  }

  /**
   * Extract event parameters from task string
   * Simple NLP for demonstration - in production, use proper NLP/LLM
   */
  private extractEventParams(task: string): Partial<CreateEventParams> {
    const params: Partial<CreateEventParams> = {};

    // Extract title - look for patterns like "会议" or quoted strings
    const titleMatch = task.match(/["「]([^"」]+)["」]|(\S+(?=的|在|用))|日程|会议|约会|事件/);
    if (titleMatch) {
      params.title = titleMatch[1] || titleMatch[2] || titleMatch[0];
    }

    // Extract time - look for date/time patterns
    const timePatterns = [
      /(\d{1,2})[时分]/,
      /(今天|明天|后天|周一|周二|周三|周四|周五|周六|周日)/,
      /(\d{1,2})\/(\d{1,2})/,
    ];

    for (const pattern of timePatterns) {
      const match = task.match(pattern);
      if (match) {
        // Simple date parsing - in production, use a proper date parser
        const now = new Date();
        if (match[1] === '今天') {
          params.startTime = now;
        } else if (match[1] === '明天') {
          params.startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (/^\d+$/.test(match[1])) {
          params.startTime = this.getTodayAt(parseInt(match[1]), 0);
        }
        break;
      }
    }

    // Extract location
    const locationMatch = task.match(/在(\S+)/);
    if (locationMatch) {
      params.location = locationMatch[1];
    }

    return params;
  }

  /**
   * Extract event ID from task string
   */
  private extractEventId(task: string): string | null {
    // Look for event ID patterns
    const idMatch = task.match(/evt-\d+|ID[：:]?(\S+)|编号(\S+)/i);
    if (idMatch) {
      return idMatch[1] || idMatch[0];
    }
    return null;
  }
}