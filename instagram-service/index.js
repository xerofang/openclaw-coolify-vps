import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import cron from 'node-cron';

const QUEUE_PATH = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';
const MAX_POSTS = parseInt(process.env.MAX_POSTS_PER_DAY || '10');
const HEALTH_FILE = '/tmp/instagram_health';

let dailyCount = 0, lastReset = new Date().toDateString();

const updateHealth = async () => {
  await fs.writeFile(HEALTH_FILE, JSON.stringify({ ts: Date.now(), ok: true })).catch(() => {});
};

async function postToInstagram(imageUrl, caption) {
  const { INSTAGRAM_ACCESS_TOKEN: token, INSTAGRAM_BUSINESS_ACCOUNT_ID: acct } = process.env;
  if (!token || !acct) throw new Error('No Instagram credentials');
  const base = 'https://graph.facebook.com/v18.0';
  const container = await axios.post(`${base}/${acct}/media`, { image_url: imageUrl, caption, access_token: token });
  await new Promise(r => setTimeout(r, 5000));
  return axios.post(`${base}/${acct}/media_publish`, { creation_id: container.data.id, access_token: token });
}

async function processQueue() {
  const today = new Date().toDateString();
  if (today !== lastReset) { dailyCount = 0; lastReset = today; }
  if (dailyCount >= MAX_POSTS) return;

  const dir = path.join(QUEUE_PATH, 'processed');
  try {
    await fs.mkdir(dir, { recursive: true });
    for (const f of (await fs.readdir(dir)).filter(x => x.endsWith('.json'))) {
      if (dailyCount >= MAX_POSTS) break;
      const fp = path.join(dir, f);
      const item = JSON.parse(await fs.readFile(fp, 'utf8'));
      if (item.status !== 'approved' || item.posted) continue;
      try {
        if (item.imagePath) {
          await postToInstagram(item.imagePath, item.content || item.description);
          item.posted = true;
          item.postedAt = new Date().toISOString();
          dailyCount++;
          console.log(`Posted ${item.id}`);
        }
      } catch (e) { item.postError = e.message; console.error(`Failed ${item.id}:`, e.message); }
      await fs.writeFile(fp, JSON.stringify(item, null, 2));
    }
  } catch (e) { console.error('Queue error:', e); }
}

cron.schedule('*/5 * * * *', processQueue);
cron.schedule('*/30 * * * * *', updateHealth);

console.log('Instagram service started');
updateHealth();
processQueue();
setInterval(() => {}, 60000);
