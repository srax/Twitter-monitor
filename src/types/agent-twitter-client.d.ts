declare module 'agent-twitter-client' {
  export class Scraper {
    constructor(options?: any);
    
    login(username: string, password: string): Promise<void>;
    setCookies(cookies: string[]): Promise<void>;
    getCookies(): Promise<string[]>;
    setProxy(proxyAgent: any): void;
    getLatestTweet(handle: string): Promise<{
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
    } | null>;
  }
} 