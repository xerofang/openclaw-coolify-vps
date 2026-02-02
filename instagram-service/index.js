/**
 * Instagram Posting Service - VPS Version
 */

import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import cron from 'node-cron';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const APPROVAL_QUEUE_PATH = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';
const MAX_POSTS_PER_DAY = parseInt(process.env.MAX_POSTS_PER_DAY || '10');
const HEALTH_FILE = '/tmp/instagram_health';

let dailyPostCount = 0;
let lastResetDate = new Date().toDateString();

async function updateHealth() {
  try {
    await fs.writeFile(HEALTH_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'healthy',
      postsToday: dailyPostCount
    }));
  } catch (e) {}
}

async function postToInstagram(imageUrl, caption) {
  const { INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID } = process.env;

  if (!INSTAGRAM_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error('Instagram credentials not configured');
  }

  const baseUrl = 'https://graph.facebook.com/v18.0';

  // Create media container
  const containerRes = await axios.post(
    `${baseUrl}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
    {
      image_url: imageUrl,
      caption: caption,
      access_token: INSTAGRAM_ACCESS_TOKEN
    }
  );

  const containerId = containerRes.data.id;
  logger.info(`Created container: ${containerId}`);

  // Wait for processing
  await new Promise(r => setTimeout(r, 5000));

  // Publish
  const publishRes = await axios.post(
    `${baseUrl}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
    {
      creation_id: containerId,
      access_token: INSTAGRAM_ACCESS_TOKEN
    }
  );

  logger.info(`Published: ${publishRes.data.id}`);
  return publishRes.data.id;
}

async function processQueue() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyPostCount = 0;
    lastResetDate = today;
  }

  if (dailyPostCount >= MAX_POSTS_PER_DAY) {
    logger.info('Daily limit reached');
    return;
  }

  const processedDir = path.join(APPROVAL_QUEUE_PATH, 'processed');

  try {
    await fs.mkdir(processedDir, { recursive: true });
    const files = await fs.readdir(processedDir);

    for (const file of files) {
      if (!file.endsWith('.json') || dailyPostCount >= MAX_POSTS_PER_DAY) continue;

      const filePath = path.join(processedDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const item = JSON.parse(content);

      if (item.status !== 'approved' || item.posted) continue;

      try {
        if (item.imagePath) {
          await postToInstagram(item.imagePath, item.content || item.description);
          item.posted = true;
          item.postedAt = new Date().toISOString();
          dailyPostCount++;
          logger.info(`Posted ${item.id}`);
        } else {
          logger.warn(`No image for ${item.id}`);
        }
      } catch (error) {
        item.postError = error.message;
        logger.error(`Failed ${item.id}:`, error.message);
      }

      await fs.writeFile(filePath, JSON.stringify(item, null, 2));
    }
  } catch (error) {
    logger.error('Queue processing error:', error);
  }
}

// Process every 5 minutes
cron.schedule('*/5 * * * *', processQueue);

// Health update every 30 seconds
cron.schedule('*/30 * * * * *', updateHealth);

logger.info('Instagram service started');
updateHealth();
processQueue();

// Keep alive
setInterval(() => {}, 60000);
