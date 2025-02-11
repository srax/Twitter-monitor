import { config as dotenvConfig } from 'dotenv';
import { Config } from '../types';
import { GatewayIntentBits } from 'discord.js';
import path from 'path';
import fs from 'fs';

dotenvConfig();

const accountsPath = path.join(__dirname, 'accounts.json');
const accountsConfig = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));

export const config: Config = {
  ...accountsConfig,
  discord: {
    token: process.env.DISCORD_TOKEN!,
    channelId: process.env.CHANNEL_ID!
  }
};

export const DISCORD_OPTIONS = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
}; 