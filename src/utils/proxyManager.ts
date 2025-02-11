import { ProxyAgent } from 'undici';
import { ProxyConfig } from '../types';

interface ProxyState {
  agent: ProxyAgent;
  requestCount: number;
  lastUsed: number;
  isBlocked: boolean;
  cooldownUntil: number;
}

export class ProxyManager {
  private proxies: Map<string, ProxyState> = new Map();
  private currentIndex = 0;
  private readonly MAX_REQUESTS_PER_WINDOW = 300; // Twitter's approximate limit
  private readonly WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes cooldown

  constructor(proxyConfigs: ProxyConfig[]) {
    this.initializeProxies(proxyConfigs);
  }

  private initializeProxies(configs: ProxyConfig[]): void {
    for (const config of configs) {
      const agent = new ProxyAgent({
        uri: config.url,
        auth: config.auth ? `${config.auth.username}:${config.auth.password}` : undefined
      });

      this.proxies.set(config.url, {
        agent,
        requestCount: 0,
        lastUsed: 0,
        isBlocked: false,
        cooldownUntil: 0
      });
    }
  }

  getNextProxy(): ProxyAgent | null {
    const now = Date.now();
    const available = Array.from(this.proxies.entries()).filter(([_, state]) => {
      // Reset counters if window has passed
      if (now - state.lastUsed >= this.WINDOW_SIZE) {
        state.requestCount = 0;
        state.isBlocked = false;
        state.cooldownUntil = 0;
      }

      // Check if proxy is available
      return !state.isBlocked && 
             state.requestCount < this.MAX_REQUESTS_PER_WINDOW &&
             now >= state.cooldownUntil;
    });

    if (available.length === 0) {
      console.warn('No proxies available. All proxies are either blocked or in cooldown.');
      return null;
    }

    // Round-robin selection from available proxies
    this.currentIndex = (this.currentIndex + 1) % available.length;
    const [url, state] = available[this.currentIndex];

    // Update proxy state
    state.requestCount++;
    state.lastUsed = now;

    // If reaching request limit, set cooldown
    if (state.requestCount >= this.MAX_REQUESTS_PER_WINDOW) {
      state.cooldownUntil = now + this.COOLDOWN_DURATION;
    }

    return state.agent;
  }

  markProxyBlocked(proxyUrl: string): void {
    const state = this.proxies.get(proxyUrl);
    if (state) {
      state.isBlocked = true;
      state.cooldownUntil = Date.now() + this.COOLDOWN_DURATION;
      console.warn(`Proxy ${proxyUrl} marked as blocked. Will retry after ${this.COOLDOWN_DURATION/1000} seconds`);
    }
  }

  getProxyStats(): Array<{url: string, stats: Omit<ProxyState, 'agent'>}> {
    return Array.from(this.proxies.entries()).map(([url, state]) => ({
      url,
      stats: {
        requestCount: state.requestCount,
        lastUsed: state.lastUsed,
        isBlocked: state.isBlocked,
        cooldownUntil: state.cooldownUntil
      }
    }));
  }

  resetProxy(proxyUrl: string): void {
    const state = this.proxies.get(proxyUrl);
    if (state) {
      state.requestCount = 0;
      state.isBlocked = false;
      state.cooldownUntil = 0;
      console.log(`Reset proxy ${proxyUrl}`);
    }
  }
} 