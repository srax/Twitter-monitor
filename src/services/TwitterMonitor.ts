import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { Scraper } from 'agent-twitter-client';
import { Storage } from './Storage';
import { RedisClient } from './RedisClient';
import { ProxyManager } from '../utils/proxyManager';
import { AccountManager } from '../utils/accountManager';
import { Config, MonitoredUser } from '../types';

interface Tweet {
  id: string;
  username: string;
  text: string;
  time: string;
  images?: Array<{ url: string }>;
  metrics?: {
    likes?: number;
    retweets?: number;
    replies?: number;
  };
}

interface MonitoringStats {
  totalChecks: number;
  newTweets: number;
  errors: number;
  lastError?: string;
  startTime: number;
}

export class TwitterMonitor {
  private accountManager: AccountManager;
  private proxyManager: ProxyManager;
  private redis: RedisClient;
  private checkInterval: NodeJS.Timeout | null = null;
  private sessionRefreshInterval: NodeJS.Timeout | null = null;
  private stats: MonitoringStats;
  private readonly POLLING_INTERVAL = 500; // 500ms between checks
  private readonly BATCH_SIZE = 5; // Number of users to check in parallel
  private readonly MAX_RETRIES = 3;
  private isProcessing = false;

  constructor(
    private config: Config,
    private storage: Storage,
    private discord: Client,
    redisClient: RedisClient
  ) {
    this.redis = redisClient;
    this.proxyManager = new ProxyManager(config.proxies);
    this.accountManager = new AccountManager(config.accounts, this.proxyManager, redisClient);
    this.stats = {
      totalChecks: 0,
      newTweets: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  async initialize(): Promise<void> {
    await this.startMonitoring();
    this.startSessionRefresh();
  }

  private startSessionRefresh(): void {
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval);
    }

    this.sessionRefreshInterval = setInterval(async () => {
      try {
        await this.accountManager.refreshSessions();
      } catch (error) {
        console.error('Error refreshing sessions:', error instanceof Error ? error.message : 'Unknown error');
      }
    }, this.config.monitoring.sessionRefreshInterval);
  }

  private async startMonitoring(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        await this.checkNewTweetsInBatches();
      } catch (error) {
        console.error('Error in monitoring cycle:', error instanceof Error ? error.message : 'Unknown error');
        this.stats.errors++;
        this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
      } finally {
        this.isProcessing = false;
      }
    }, this.POLLING_INTERVAL);
  }

  private async checkNewTweetsInBatches(): Promise<void> {
    const users = this.storage.getUsers();
    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE);
      await Promise.all(batch.map(user => this.checkUserWithRetry(user)));
    }
  }

  private async checkUserWithRetry(user: MonitoredUser, retryCount = 0): Promise<void> {
    try {
      const scraper = await this.accountManager.getNextScraper();
      const latestTweet = await scraper.getLatestTweet(user.handle) as Tweet | null;
      this.stats.totalChecks++;

      if (!latestTweet || latestTweet.id === user.lastTweetId) return;

      const cachedTweet = await this.redis.getTweet(latestTweet.id);
      if (cachedTweet) return;

      await this.handleNewTweet(user, latestTweet);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        if (retryCount < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.checkUserWithRetry(user, retryCount + 1);
        }
      }

      this.handleError(errorMessage, user);
    }
  }

  private async handleNewTweet(user: MonitoredUser, tweet: Tweet): Promise<void> {
    try {
      await this.redis.cacheTweet(tweet);
      await this.storage.updateLastTweet(user.handle, tweet.id);
      await this.postTweetToDiscord(tweet);
      this.stats.newTweets++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error handling new tweet for ${user.handle}:`, errorMessage);
      this.stats.errors++;
      this.stats.lastError = errorMessage;
    }
  }

  private async postTweetToDiscord(tweet: Tweet): Promise<void> {
    const channel = this.discord.channels.cache.get(this.config.discord.channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: tweet.username,
        url: `https://twitter.com/${tweet.username}`
      })
      .setDescription(tweet.text)
      .setTimestamp(new Date(tweet.time))
      .setColor('#1DA1F2');

    if (tweet.images?.[0]) {
      embed.setImage(tweet.images[0].url);
    }

    if (tweet.metrics) {
      const metrics = [];
      if (tweet.metrics.likes) metrics.push(`❤️ ${tweet.metrics.likes}`);
      if (tweet.metrics.retweets) metrics.push(`🔄 ${tweet.metrics.retweets}`);
      if (tweet.metrics.replies) metrics.push(`💬 ${tweet.metrics.replies}`);
      
      if (metrics.length > 0) {
        embed.addFields({ name: 'Engagement', value: metrics.join(' | ') });
      }
    }

    embed.addFields({ 
      name: 'Link', 
      value: `[View Tweet](https://twitter.com/${tweet.username}/status/${tweet.id})`
    });

    await channel.send({ embeds: [embed] });
  }

  private handleError(errorMessage: string, user: MonitoredUser): void {
    this.stats.errors++;
    this.stats.lastError = errorMessage;
    console.error(`Error checking tweets for ${user.handle}:`, errorMessage);

    if (errorMessage.includes('blocked') || errorMessage.includes('unauthorized')) {
      this.notifyAdminOfError(user.handle, errorMessage).catch(console.error);
    }
  }

  private async notifyAdminOfError(handle: string, errorMessage: string): Promise<void> {
    const channel = this.discord.channels.cache.get(this.config.discord.channelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Monitoring Error')
      .setDescription(`Error monitoring @${handle}`)
      .addFields({ name: 'Error', value: errorMessage })
      .setColor('#FF0000')
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  getStats(): MonitoringStats & { uptime: number } {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime
    };
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval);
      this.sessionRefreshInterval = null;
    }
  }
} 