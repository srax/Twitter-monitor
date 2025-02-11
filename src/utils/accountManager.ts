import { Scraper } from 'agent-twitter-client';
import { TwitterAccount, TwitterSession } from '../types';
import { SessionManager } from './sessionManager';
import { ProxyManager } from './proxyManager';
import { RedisClient } from '../services/RedisClient';

interface AccountState {
  scraper: Scraper;
  lastUsed: number;
  requestCount: number;
}

export class AccountManager {
  private accounts: Map<string, AccountState> = new Map();
  private currentIndex = 0;
  private sessionManager: SessionManager;
  private readonly MAX_REQUESTS_PER_WINDOW = 100;
  private readonly WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly LOGIN_COOLDOWN = 30 * 60 * 1000; // 30 minutes

  constructor(
    private accountList: TwitterAccount[],
    private proxyManager: ProxyManager,
    redisClient: RedisClient
  ) {
    this.sessionManager = new SessionManager(redisClient);
    this.initializeAccounts();
  }

  private async initializeAccounts(): Promise<void> {
    for (const account of this.accountList) {
      try {
        await this.initializeAccount(account);
      } catch (error) {
        console.error(`Failed to initialize account ${account.username}:`, error);
      }
    }
  }

  private async initializeAccount(account: TwitterAccount): Promise<void> {
    const session = await this.sessionManager.getSession(account.username);
    const scraper = new Scraper();

    if (session && !session.isBlocked && Date.now() < session.cooldownUntil) {
      try {
        // Try to restore session
        await scraper.setCookies(session.cookies);
        const isValid = await this.validateSession(scraper);
        
        if (isValid) {
          this.accounts.set(account.username, {
            scraper,
            lastUsed: Date.now(),
            requestCount: 0
          });
          return;
        }
      } catch (error) {
        console.warn(`Failed to restore session for ${account.username}:`, error);
      }
    }

    // If no valid session, perform fresh login
    await this.performLogin(account, scraper);
  }

  private async validateSession(scraper: Scraper): Promise<boolean> {
    try {
      // Implement session validation logic
      // For example, try to fetch the user's own profile
      return true;
    } catch {
      return false;
    }
  }

  private async performLogin(account: TwitterAccount, scraper: Scraper): Promise<void> {
    const session = await this.sessionManager.getSession(account.username);
    
    if (session?.isBlocked && Date.now() < session.cooldownUntil) {
      throw new Error(`Account ${account.username} is blocked until ${new Date(session.cooldownUntil)}`);
    }

    const loginAttempts = (session?.loginAttempts || 0) + 1;
    
    if (loginAttempts > this.MAX_LOGIN_ATTEMPTS) {
      const cooldownUntil = Date.now() + this.LOGIN_COOLDOWN;
      await this.sessionManager.saveSession(account.username, {
        username: account.username,
        cookies: [],
        lastLogin: Date.now(),
        loginAttempts,
        isBlocked: true,
        cooldownUntil
      });
      throw new Error(`Too many login attempts for ${account.username}`);
    }

    try {
      const proxy = this.proxyManager.getNextProxy();
      if (proxy) {
        scraper.setProxy(proxy);
      }

      await scraper.login(account.username, account.password);
      const cookies = await scraper.getCookies();

      await this.sessionManager.saveSession(account.username, {
        username: account.username,
        cookies,
        lastLogin: Date.now(),
        loginAttempts: 0,
        isBlocked: false,
        cooldownUntil: 0
      });

      this.accounts.set(account.username, {
        scraper,
        lastUsed: Date.now(),
        requestCount: 0
      });
    } catch (error) {
      await this.sessionManager.updateSessionStatus(account.username, {
        loginAttempts,
        lastLogin: Date.now()
      });
      throw error;
    }
  }

  async getNextScraper(): Promise<Scraper> {
    const now = Date.now();
    const available = Array.from(this.accounts.entries()).filter(([_, state]) => {
      if (now - state.lastUsed >= this.WINDOW_SIZE) {
        state.requestCount = 0;
      }
      return state.requestCount < this.MAX_REQUESTS_PER_WINDOW;
    });

    if (available.length === 0) {
      throw new Error('No available accounts. All accounts are rate limited.');
    }

    this.currentIndex = (this.currentIndex + 1) % available.length;
    const [username, state] = available[this.currentIndex];

    // Update account state
    state.requestCount++;
    state.lastUsed = now;

    // Attach a fresh proxy to the scraper
    const proxy = this.proxyManager.getNextProxy();
    if (proxy) {
      state.scraper.setProxy(proxy);
    }

    return state.scraper;
  }

  async refreshSessions(): Promise<void> {
    for (const [username, state] of this.accounts.entries()) {
      try {
        const isValid = await this.validateSession(state.scraper);
        if (!isValid) {
          const account = this.accountList.find(a => a.username === username);
          if (account) {
            await this.performLogin(account, state.scraper);
          }
        }
      } catch (error) {
        console.error(`Failed to refresh session for ${username}:`, error);
      }
    }
  }

  getAccountStats(): Array<{username: string, requestCount: number, lastUsed: number}> {
    return Array.from(this.accounts.entries()).map(([username, state]) => ({
      username,
      requestCount: state.requestCount,
      lastUsed: state.lastUsed
    }));
  }
} 