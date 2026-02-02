/**
 * OpenClaw Telegram Bot - VPS/Coolify Version
 *
 * Enhanced for VPS deployment with:
 * - Redis session storage
 * - Webhook support (optional)
 * - Better error recovery
 * - Coolify health reporting
 */

import { Telegraf, Markup, session } from 'telegraf';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import axios from 'axios';
import Redis from 'ioredis';

// Configure logging for VPS
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Validate environment
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Redis connection (optional, for session persistence)
let redis = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL);
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn('Redis connection failed, using in-memory sessions');
  }
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID);
const ALLOWED_CHATS = process.env.TELEGRAM_ALLOWED_CHATS
  ? process.env.TELEGRAM_ALLOWED_CHATS.split(',').map(id => parseInt(id.trim()))
  : [ADMIN_ID];

const APPROVAL_QUEUE_PATH = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';
const DATA_PATH = process.env.DATA_PATH || '/data';

// Health file for Coolify monitoring
const HEALTH_FILE = '/tmp/bot_health';
let lastActivity = Date.now();

async function updateHealth() {
  lastActivity = Date.now();
  try {
    await fs.writeFile(HEALTH_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime()
    }));
  } catch (error) {
    logger.error('Failed to update health file:', error);
  }
}

// Session middleware (Redis or in-memory)
if (redis) {
  bot.use(session({
    store: {
      async get(key) {
        const data = await redis.get(`session:${key}`);
        return data ? JSON.parse(data) : undefined;
      },
      async set(key, value) {
        await redis.set(`session:${key}`, JSON.stringify(value), 'EX', 86400);
      },
      async delete(key) {
        await redis.del(`session:${key}`);
      }
    }
  }));
} else {
  bot.use(session());
}

// Auth middleware
const authMiddleware = async (ctx, next) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!ALLOWED_CHATS.includes(userId) && !ALLOWED_CHATS.includes(chatId)) {
    logger.warn(`Unauthorized access from user ${userId}`);
    return ctx.reply('⛔ Unauthorized');
  }

  updateHealth();
  return next();
};

bot.use(authMiddleware);

// Error handler
bot.catch((err, ctx) => {
  logger.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
});

// Commands
bot.start(async (ctx) => {
  await ctx.reply(
    `🤖 *OpenClaw Bot (VPS)*\n\n` +
    `Running on: ${process.env.HOSTNAME || 'VPS'}\n\n` +
    `Commands:\n` +
    `/research <topic>` - Research a topic\n` +
    `/market <query>` - Market analysis\n` +
    `/create post <desc>` - Create Instagram post\n` +
    `/pending` - View pending approvals\n` +
    `/status` - System status\n` +
    `/help` - Full command list`,
    { parse_mode: 'Markdown' }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    `📚 *Full Command List*\n\n` +
    `*Research:*\n` +
    `/research <topic>` - Deep research\n` +
    `/market <query>` - Market analysis\n` +
    `/learn <url>` - Learn from source\n\n` +
    `*Content:*\n` +
    `/create post <description>` - Create post\n` +
    `/create image <description>` - Generate image\n\n` +
    `*Instagram:*\n` +
    `/pending` - View queue\n` +
    `/approve <id>` - Approve post\n` +
    `/reject <id>` - Reject post\n\n` +
    `*System:*\n` +
    `/status` - Health check\n` +
    `/logs` - Recent logs (admin)`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('research', async (ctx) => {
  const topic = ctx.message.text.replace('/research', '').trim();
  if (!topic) {
    return ctx.reply('Usage: `/research <topic>`', { parse_mode: 'Markdown' });
  }

  await ctx.reply(`🔍 Researching: *${topic}*...`, { parse_mode: 'Markdown' });

  try {
    const result = await callClaude({
      prompt: `Research the following topic thoroughly and provide a comprehensive summary with key insights: ${topic}`,
      maxTokens: 2000
    });

    await ctx.reply(
      `📊 *Research: ${topic}*\n\n${result.substring(0, 4000)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Research error:', error);
    await ctx.reply('❌ Research failed. Check logs for details.');
  }
});

bot.command('market', async (ctx) => {
  const query = ctx.message.text.replace('/market', '').trim();
  if (!query) {
    return ctx.reply('Usage: `/market <query>`', { parse_mode: 'Markdown' });
  }

  await ctx.reply(`📈 Analyzing: *${query}*...`, { parse_mode: 'Markdown' });

  try {
    const result = await callClaude({
      prompt: `Provide a market analysis for: ${query}. Include trends, opportunities, and recommendations based on publicly available data.`,
      maxTokens: 2000
    });

    await ctx.reply(
      `📊 *Market Analysis: ${query}*\n\n${result.substring(0, 4000)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Market analysis error:', error);
    await ctx.reply('❌ Analysis failed.');
  }
});

bot.command('create', async (ctx) => {
  const args = ctx.message.text.replace('/create', '').trim().split(' ');
  const contentType = args[0]?.toLowerCase();
  const description = args.slice(1).join(' ');

  if (!contentType || !description) {
    return ctx.reply(
      'Usage:\n`/create post <description>`\n`/create image <description>`',
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply(`🎨 Creating ${contentType}...`, { parse_mode: 'Markdown' });

  try {
    let content, imagePath;

    if (contentType === 'post') {
      content = await callClaude({
        prompt: `Create an engaging Instagram post caption for: ${description}. Include relevant hashtags. Keep it under 2200 characters.`,
        maxTokens: 500
      });
    }

    if (contentType === 'image' || contentType === 'post') {
      if (process.env.FREEPIK_API_KEY) {
        imagePath = await generateImage(description);
      }
    }

    const approvalId = await addToApprovalQueue({
      type: contentType,
      description,
      content,
      imagePath,
      createdAt: new Date().toISOString(),
      requestedBy: ctx.from.id
    });

    await ctx.reply(
      `✅ Created and queued for approval!\n\n` +
      `*ID:* \`${approvalId}\`\n` +
      `*Content:*\n${content?.substring(0, 500) || 'Image only'}...\n\n` +
      `Use /pending to review.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Create error:', error);
    await ctx.reply('❌ Creation failed.');
  }
});

bot.command('pending', async (ctx) => {
  const queue = await getApprovalQueue();
  const pending = queue.filter(item => item.status === 'pending');

  if (pending.length === 0) {
    return ctx.reply('✅ No pending items.');
  }

  for (const item of pending.slice(0, 5)) {
    await ctx.reply(
      `📋 *Pending: ${item.id}*\n` +
      `Type: ${item.type}\n` +
      `Description: ${item.description}\n` +
      `Created: ${new Date(item.createdAt).toLocaleString()}\n\n` +
      `Preview:\n${item.content?.substring(0, 300) || 'N/A'}...`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_${item.id}`),
            Markup.button.callback('❌ Reject', `reject_${item.id}`)
          ]
        ])
      }
    );
  }
});

bot.action(/^approve_(.+)$/, async (ctx) => {
  const itemId = ctx.match[1];
  try {
    await updateApprovalStatus(itemId, 'approved');
    await ctx.answerCbQuery('✅ Approved!');
    await ctx.editMessageText(`✅ Approved: \`${itemId}\``, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.answerCbQuery('❌ Error');
  }
});

bot.action(/^reject_(.+)$/, async (ctx) => {
  const itemId = ctx.match[1];
  try {
    await updateApprovalStatus(itemId, 'rejected');
    await ctx.answerCbQuery('❌ Rejected');
    await ctx.editMessageText(`❌ Rejected: \`${itemId}\``, { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.answerCbQuery('❌ Error');
  }
});

bot.command('status', async (ctx) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const status = {
    bot: '✅ Running',
    uptime: `${hours}h ${minutes}m`,
    claude: process.env.ANTHROPIC_API_KEY ? '✅' : '❌',
    instagram: process.env.INSTAGRAM_ACCESS_TOKEN ? '✅' : '⚠️',
    freepik: process.env.FREEPIK_API_KEY ? '✅' : '⚠️',
    redis: redis?.status === 'ready' ? '✅' : '⚠️',
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  };

  await ctx.reply(
    `🖥️ *System Status*\n\n` +
    `Bot: ${status.bot}\n` +
    `Uptime: ${status.uptime}\n` +
    `Memory: ${status.memory}\n\n` +
    `*Services:*\n` +
    `Claude AI: ${status.claude}\n` +
    `Instagram: ${status.instagram}\n` +
    `Freepik: ${status.freepik}\n` +
    `Redis: ${status.redis}`,
    { parse_mode: 'Markdown' }
  );
});

// Helper functions

async function callClaude({ prompt, maxTokens = 1000 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  return response.data.content[0].text;
}

async function generateImage(prompt) {
  if (!process.env.FREEPIK_API_KEY) {
    return null;
  }

  try {
    const response = await axios.post(
      'https://api.freepik.com/v1/ai/text-to-image',
      {
        prompt,
        num_images: 1,
        image: { size: 'square_1_1' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-freepik-api-key': process.env.FREEPIK_API_KEY
        }
      }
    );

    return response.data.data?.[0]?.url;
  } catch (error) {
    logger.error('Image generation failed:', error);
    return null;
  }
}

async function addToApprovalQueue(item) {
  const id = uuidv4().substring(0, 8);
  const queueItem = { id, ...item, status: 'pending' };

  const filePath = path.join(APPROVAL_QUEUE_PATH, 'pending', `${id}.json`);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(queueItem, null, 2));
  } catch (error) {
    logger.error('Failed to save to queue:', error);
    throw error;
  }

  return id;
}

async function getApprovalQueue() {
  try {
    const pendingDir = path.join(APPROVAL_QUEUE_PATH, 'pending');
    await fs.mkdir(pendingDir, { recursive: true });
    const files = await fs.readdir(pendingDir);

    const items = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(pendingDir, file), 'utf8');
        items.push(JSON.parse(content));
      }
    }

    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    logger.error('Error reading queue:', error);
    return [];
  }
}

async function updateApprovalStatus(itemId, status) {
  const pendingPath = path.join(APPROVAL_QUEUE_PATH, 'pending', `${itemId}.json`);
  const processedPath = path.join(APPROVAL_QUEUE_PATH, 'processed', `${itemId}.json`);

  const content = await fs.readFile(pendingPath, 'utf8');
  const item = JSON.parse(content);
  item.status = status;
  item.processedAt = new Date().toISOString();

  await fs.mkdir(path.dirname(processedPath), { recursive: true });
  await fs.writeFile(processedPath, JSON.stringify(item, null, 2));
  await fs.unlink(pendingPath);
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  bot.stop(signal);
  if (redis) await redis.quit();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Start bot
logger.info('Starting Telegram bot...');
updateHealth();

bot.launch()
  .then(() => {
    logger.info('Bot started successfully');
    // Periodic health update
    setInterval(updateHealth, 30000);
  })
  .catch((err) => {
    logger.error('Failed to start:', err);
    process.exit(1);
  });
