import { RedisClient } from '../services/RedisClient';
import { TwitterSession } from '../types';

export class SessionManager {
  private readonly SESSION_PREFIX = 'twitter:session:';
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(private redis: RedisClient) {}

  async saveSession(username: string, session: TwitterSession): Promise<void> {
    const key = this.getSessionKey(username);
    await this.redis.client.setex(
      key,
      this.SESSION_TTL,
      JSON.stringify(session)
    );
  }

  async getSession(username: string): Promise<TwitterSession | null> {
    const key = this.getSessionKey(username);
    const data = await this.redis.client.get(key);
    if (!data) return null;

    try {
      return JSON.parse(data) as TwitterSession;
    } catch {
      return null;
    }
  }

  async updateSessionStatus(
    username: string,
    updates: Partial<TwitterSession>
  ): Promise<void> {
    const session = await this.getSession(username);
    if (!session) return;

    const updatedSession = { ...session, ...updates };
    await this.saveSession(username, updatedSession);
  }

  async removeSession(username: string): Promise<void> {
    const key = this.getSessionKey(username);
    await this.redis.client.del(key);
  }

  async getAllSessions(): Promise<TwitterSession[]> {
    const keys = await this.redis.client.keys(`${this.SESSION_PREFIX}*`);
    if (keys.length === 0) return [];

    const sessions = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.client.get(key);
        if (!data) return null;
        try {
          return JSON.parse(data) as TwitterSession;
        } catch {
          return null;
        }
      })
    );

    return sessions.filter((s): s is TwitterSession => s !== null);
  }

  private getSessionKey(username: string): string {
    return `${this.SESSION_PREFIX}${username}`;
  }
} 