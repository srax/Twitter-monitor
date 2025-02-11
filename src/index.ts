import { Client } from 'discord.js';
import { Storage } from './services/Storage';
import { TwitterMonitor } from './services/TwitterMonitor';
import { config, DISCORD_OPTIONS } from './config/config';

const client = new Client(DISCORD_OPTIONS);
const storage = new Storage();
const monitor = new TwitterMonitor(storage, client);

client.on('ready', async () => {
  console.log(`Logged in as ${client.user!.tag}`);
  await storage.load();
  await monitor.initialize();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  try {
    if (content === '!a') {
      await message.reply('Enter Twitter handle to monitor (without @):');
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 30000
      });
      
      const handle = collected.first()?.content.replace('@', '');
      if (handle) {
        await storage.addUser(handle);
        await message.reply(`Now monitoring @${handle}`);
      }
    }
    else if (content === '!d') {
      await message.reply('Enter handle to remove:');
      const collected = await message.channel.awaitMessages({
        filter: m => m.author.id === message.author.id,
        max: 1,
        time: 30000
      });
      
      const handle = collected.first()?.content.replace('@', '');
      if (handle) {
        await storage.removeUser(handle);
        await message.reply(`Stopped monitoring @${handle}`);
      }
    }
    else if (content === '!list') {
      const users = storage.getUsers();
      const userList = users.length > 0 
        ? users.map(u => `@${u.handle}`).join('\n')
        : 'No monitored users';
      await message.reply(`Monitoring:\n${userList}`);
    }
    else if (content === '!da') {
      await storage.removeAllUsers();
      await message.reply('Removed all monitored users');
    }
  } catch (error: any) {
    await message.reply(`Error: ${error.message}`);
  }
});

client.login(config.discord.token); 