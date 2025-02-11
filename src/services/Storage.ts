import fs from 'fs/promises';
import path from 'path';
import { MonitoredUser } from '../types';

export class Storage {
  private users: MonitoredUser[] = [];
  private readonly filePath = path.join(__dirname, '../../data/users.json');

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.users = JSON.parse(data);
    } catch {
      this.users = [];
      await this.save();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.users, null, 2));
  }

  async addUser(handle: string): Promise<void> {
    if (this.users.find(u => u.handle === handle)) {
      throw new Error('User already monitored');
    }
    
    this.users.push({
      handle,
      lastTweetId: '',
      lastCheckTime: Date.now()
    });
    
    await this.save();
  }

  async removeUser(handle: string): Promise<void> {
    const index = this.users.findIndex(u => u.handle === handle);
    if (index === -1) throw new Error('User not found');
    
    this.users.splice(index, 1);
    await this.save();
  }

  async removeAllUsers(): Promise<void> {
    this.users = [];
    await this.save();
  }

  getUsers(): MonitoredUser[] {
    return [...this.users];
  }

  async updateLastTweet(handle: string, tweetId: string): Promise<void> {
    const user = this.users.find(u => u.handle === handle);
    if (!user) return;
    
    user.lastTweetId = tweetId;
    user.lastCheckTime = Date.now();
    await this.save();
  }
} 