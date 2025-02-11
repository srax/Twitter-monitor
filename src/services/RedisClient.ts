import Redis from 'ioredis';
import { config } from '../config/config';

export class RedisClient {
  private client: Redis;

  constructor() {
    this.client = new Redis(config.redis);
  }

  async cacheTweet(tweet: any): Promise<void> {
    const key = `tweet:${tweet.id}`;
    await this.client.setex(key, 3600, JSON.stringify(tweet));
  }

  async getTweet(tweetId: string): Promise<any | null> {
    const tweet = await this.client.get(`tweet:${tweetId}`);
    return tweet ? JSON.parse(tweet) : null;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
} 