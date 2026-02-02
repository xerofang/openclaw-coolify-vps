import { Telegraf, Markup } from 'telegraf';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID);
const ALLOWED = process.env.TELEGRAM_ALLOWED_CHATS?.split(',').map(Number) || [ADMIN_ID];
const QUEUE_PATH = process.env.APPROVAL_QUEUE_PATH || '/approval-queue';
const HEALTH_FILE = '/tmp/bot_health';

const updateHealth = async () => {
  await fs.writeFile(HEALTH_FILE, JSON.stringify({ ts: Date.now(), ok: true })).catch(() => {});
};

bot.use(async (ctx, next) => {
  if (!ALLOWED.includes(ctx.from?.id)) return ctx.reply('⛔ Unauthorized');
  updateHealth();
  return next();
});

bot.start(ctx => ctx.reply(`🤖 *OpenClaw Bot*\n\n/research <topic>\n/market <query>\n/create post <desc>\n/pending\n/status`, { parse_mode: 'Markdown' }));
bot.help(ctx => ctx.reply(`/research, /market, /create, /pending, /approve, /reject, /status`));

bot.command('research', async ctx => {
  const topic = ctx.message.text.replace('/research', '').trim();
  if (!topic) return ctx.reply('Usage: /research <topic>');
  await ctx.reply(`🔍 Researching: *${topic}*...`, { parse_mode: 'Markdown' });
  try {
    const r = await callClaude(`Research: ${topic}`);
    await ctx.reply(`📊 *${topic}*\n\n${r.substring(0, 4000)}`, { parse_mode: 'Markdown' });
  } catch (e) { await ctx.reply('❌ Failed'); }
});

bot.command('market', async ctx => {
  const q = ctx.message.text.replace('/market', '').trim();
  if (!q) return ctx.reply('Usage: /market <query>');
  await ctx.reply(`📈 Analyzing...`);
  try {
    const r = await callClaude(`Market analysis: ${q}`);
    await ctx.reply(`📊 *${q}*\n\n${r.substring(0, 4000)}`, { parse_mode: 'Markdown' });
  } catch (e) { await ctx.reply('❌ Failed'); }
});

bot.command('create', async ctx => {
  const args = ctx.message.text.replace('/create', '').trim().split(' ');
  const type = args[0], desc = args.slice(1).join(' ');
  if (!type || !desc) return ctx.reply('Usage: /create post <description>');
  await ctx.reply(`🎨 Creating...`);
  try {
    const content = await callClaude(`Instagram caption for: ${desc}`);
    const id = uuidv4().substring(0, 8);
    await fs.mkdir(path.join(QUEUE_PATH, 'pending'), { recursive: true });
    await fs.writeFile(path.join(QUEUE_PATH, 'pending', `${id}.json`), JSON.stringify({ id, type, description: desc, content, status: 'pending', createdAt: new Date().toISOString(), requestedBy: ctx.from.id }, null, 2));
    await ctx.reply(`✅ Queued: \`${id}\`\n\n${content.substring(0, 500)}...`, { parse_mode: 'Markdown' });
  } catch (e) { await ctx.reply('❌ Failed'); }
});

bot.command('pending', async ctx => {
  try {
    const dir = path.join(QUEUE_PATH, 'pending');
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const items = [];
    for (const f of files.filter(x => x.endsWith('.json'))) {
      items.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')));
    }
    if (!items.length) return ctx.reply('✅ No pending items');
    for (const item of items.slice(0, 5)) {
      await ctx.reply(`📋 *${item.id}*\n${item.description}\n\n${item.content?.substring(0, 300) || ''}...`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('✅ Approve', `approve_${item.id}`), Markup.button.callback('❌ Reject', `reject_${item.id}`)]])
      });
    }
  } catch (e) { await ctx.reply('❌ Error'); }
});

bot.action(/^approve_(.+)$/, async ctx => {
  const id = ctx.match[1];
  try {
    await moveItem(id, 'approved');
    await ctx.answerCbQuery('✅ Approved');
    await ctx.editMessageText(`✅ Approved: ${id}`);
  } catch (e) { await ctx.answerCbQuery('❌ Error'); }
});

bot.action(/^reject_(.+)$/, async ctx => {
  const id = ctx.match[1];
  try {
    await moveItem(id, 'rejected');
    await ctx.answerCbQuery('❌ Rejected');
    await ctx.editMessageText(`❌ Rejected: ${id}`);
  } catch (e) { await ctx.answerCbQuery('❌ Error'); }
});

bot.command('status', async ctx => {
  const up = process.uptime();
  await ctx.reply(`🖥️ *Status*\nUptime: ${Math.floor(up/3600)}h ${Math.floor((up%3600)/60)}m\nMemory: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB\nClaude: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌'}`, { parse_mode: 'Markdown' });
});

async function callClaude(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No API key');
  const r = await axios.post('https://api.anthropic.com/v1/messages', { model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }, { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
  return r.data.content[0].text;
}

async function moveItem(id, status) {
  const src = path.join(QUEUE_PATH, 'pending', `${id}.json`);
  const dst = path.join(QUEUE_PATH, 'processed', `${id}.json`);
  const item = JSON.parse(await fs.readFile(src, 'utf8'));
  item.status = status;
  item.processedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.writeFile(dst, JSON.stringify(item, null, 2));
  await fs.unlink(src);
}

bot.catch((err, ctx) => console.error('Bot error:', err));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('Starting bot...');
updateHealth();
setInterval(updateHealth, 30000);
bot.launch().then(() => console.log('Bot running'));
