/**
 * PFASP User Identity System
 * 
 * Implements basic identity for MVP:
 * - Phone number based identity
 * - Device ID tracking
 * - Simple OTP authentication
 */

import * as crypto from 'crypto';

/**
 * User identity representation
 */
export interface UserIdentity {
  id: string;
  phoneNumber?: string;  // E.164 format
  deviceId: string;
  displayName?: string;
  publicKey?: string;
  createdAt: Date;
  lastActiveAt: Date;
}

/**
 * Authentication session
 */
export interface AuthSession {
  userId: string;
  sessionToken: string;
  deviceId: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * OTP for authentication
 */
export interface OTP {
  code: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
  used: boolean;
}

/**
 * Generate a unique user ID based on phone + device
 */
export function generateUserId(phoneNumber: string, deviceId: string): string {
  const raw = `${phoneNumber}:${deviceId}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Generate device ID (in production, this would come from the device)
 */
export function generateDeviceId(): string {
  return `device_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Verify OTP
 */
export function verifyOTP(generated: string, provided: string, expiresAt: Date): boolean {
  if (generated !== provided) return false;
  if (new Date() > expiresAt) return false;
  return true;
}

/**
 * Generate session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Identity Manager - handles user identity operations
 */
export class IdentityManager {
  private identities: Map<string, UserIdentity> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private otps: Map<string, OTP> = new Map();

  /**
   * Register a new user identity
   */
  register(phoneNumber: string, deviceId: string, displayName?: string): UserIdentity {
    const id = generateUserId(phoneNumber, deviceId);
    
    const identity: UserIdentity = {
      id,
      phoneNumber,
      deviceId,
      displayName: displayName || `User_${id.substring(0, 6)}`,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.identities.set(id, identity);
    console.log(`[Identity] Registered new user: ${id}`);
    
    return identity;
  }

  /**
   * Get identity by ID
   */
  getIdentity(userId: string): UserIdentity | undefined {
    return this.identities.get(userId);
  }

  /**
   * Get identity by phone + device
   */
  getIdentityByPhoneAndDevice(phoneNumber: string, deviceId: string): UserIdentity | undefined {
    const id = generateUserId(phoneNumber, deviceId);
    return this.identities.get(id);
  }

  /**
   * Create OTP for authentication
   */
  createOTP(userId: string, deviceId: string): OTP {
    const otp = generateOTP();
    const otpRecord: OTP = {
      code: otp,
      userId,
      deviceId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),  // 5 minutes
      used: false,
    };
    
    const key = `${userId}:${Date.now()}`;
    this.otps.set(key, otpRecord);
    
    return otpRecord;
  }

  /**
   * Verify OTP and create session
   */
  verifyOTPAndCreateSession(userId: string, deviceId: string, code: string): AuthSession | null {
    // Find matching OTP
    for (const [key, otp] of this.otps) {
      if (otp.userId === userId && !otp.used) {
        if (verifyOTP(otp.code, code, otp.expiresAt)) {
          // Mark OTP as used
          otp.used = true;
          
          // Create session
          return this.createSession(userId, deviceId);
        }
      }
    }
    return null;
  }

  /**
   * Create authentication session
   */
  createSession(userId: string, deviceId: string): AuthSession {
    const session: AuthSession = {
      userId,
      sessionToken: generateSessionToken(),
      deviceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  // 7 days
      createdAt: new Date(),
    };
    
    this.sessions.set(session.sessionToken, session);
    return session;
  }

  /**
   * Validate session
   */
  validateSession(token: string): AuthSession | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (new Date() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  /**
   * Revoke session
   */
  revokeSession(token: string): boolean {
    return this.sessions.delete(token);
  }

  /**
   * Update last active time
   */
  updateLastActive(userId: string): void {
    const identity = this.identities.get(userId);
    if (identity) {
      identity.lastActiveAt = new Date();
    }
  }

  /**
   * List all registered users (for demo)
   */
  listUsers(): UserIdentity[] {
    return Array.from(this.identities.values());
  }
}

// Global identity manager instance
let identityManager: IdentityManager | null = null;

export function getIdentityManager(): IdentityManager {
  if (!identityManager) {
    identityManager = new IdentityManager();
  }
  return identityManager;
}