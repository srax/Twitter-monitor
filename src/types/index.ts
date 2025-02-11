export interface TwitterAccount {
  username: string;
  password: string;
}

export interface TwitterSession {
  username: string;
  cookies: string[];
  lastLogin: number;
  loginAttempts: number;
  isBlocked: boolean;
  cooldownUntil: number;
}

export interface MonitoredUser {
  handle: string;
  lastTweetId: string;
  lastCheckTime: number;
}

export interface ProxyConfig {
  url: string;
  auth?: {
    username: string;
    password: string;
  };
}

export interface Config {
  accounts: TwitterAccount[];
  proxies: ProxyConfig[];
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  discord: {
    token: string;
    channelId: string;
  };
  monitoring: {
    interval: number;
    maxRetries: number;
    proxyRotationInterval: number;
    sessionRefreshInterval: number;
    maxLoginAttempts: number;
    loginCooldownDuration: number;
  };
}

export interface Proxy {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface AccountsConfig {
  accounts: TwitterAccount[];
  proxies: Proxy[];
}

export interface MonitoringConfig {
  interval: number;
  maxRetries: number;
  proxyRotationInterval: number;
}

export interface StorageConfig {
  path: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
} 