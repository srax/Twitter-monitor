# Twitter Monitor

A high-performance Twitter monitoring system that tracks tweets from specified users in real-time and forwards them to Discord. Built with TypeScript and featuring proxy rotation, session management, and rate limit handling.

## Features

- **High-Frequency Polling**
  - 500ms polling interval
  - Batch processing of monitored users
  - Parallel tweet checking
  - Smart rate limit handling

- **Account Management**
  - Multiple Twitter account support
  - Session persistence
  - Automatic login retry
  - Cookie-based authentication

- **Proxy Support**
  - Proxy rotation
  - Rate limit tracking per proxy
  - Automatic proxy cooldown
  - Support for authenticated proxies

- **Discord Integration**
  - Real-time tweet notifications
  - Rich embeds with media
  - Engagement metrics display
  - Error reporting
  - Admin notifications

- **Performance Features**
  - Redis-based caching
  - Session persistence
  - Duplicate tweet detection
  - Error recovery

## Installation

1. Clone the repository:
```bash
git clone https://github.com/srax/Twitter-monitor.git
cd Twitter-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Configure your Twitter accounts and proxies in `src/config/accounts.json`:
```json
{
  "accounts": [
    {
      "username": "your_username",
      "password": "your_password"
    }
  ],
  "proxies": [
    {
      "url": "http://proxy.example.com:8080",
      "auth": {
        "username": "proxy_user",
        "password": "proxy_pass"
      }
    }
  ],
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
```

## Usage

1. Start the monitor in development mode:
```bash
npm run dev
```

2. Build and run in production:
```bash
npm run build
npm start
```

## Discord Commands

- `!a` - Add a Twitter handle to monitor
- `!d` - Remove a Twitter handle from monitoring
- `!list` - List all monitored handles
- `!da` - Remove all monitored handles

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
CHANNEL_ID=your_discord_channel_id

# Monitoring Configuration
MONITORING_INTERVAL=60000
MAX_RETRIES=3
```

### Monitoring Settings

- Polling Interval: 500ms
- Batch Size: 5 users
- Max Retries: 3
- Session Refresh: Every 24 hours
- Tweet Cache Duration: 1 hour

## Architecture

- **TwitterMonitor**: Core monitoring service
- **AccountManager**: Twitter account rotation and session management
- **ProxyManager**: Proxy rotation and rate limit handling
- **SessionManager**: Session persistence and cookie management
- **Storage**: User data persistence
- **RedisClient**: Caching and session storage

## Error Handling

- Rate limit detection and retry
- Session validation and refresh
- Proxy rotation on errors
- Admin notifications for critical errors
- Automatic account cooldown

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with TypeScript
- Uses Discord.js for Discord integration
- Uses Redis for caching and session management
- Implements proxy rotation for high-frequency monitoring 