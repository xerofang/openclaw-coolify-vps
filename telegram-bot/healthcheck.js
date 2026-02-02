import { promises as fs } from 'fs';

const HEALTH_FILE = '/tmp/bot_health';

async function check() {
  try {
    const data = await fs.readFile(HEALTH_FILE, 'utf8');
    const health = JSON.parse(data);
    const age = Date.now() - new Date(health.timestamp).getTime();

    if (age < 60000 && health.status === 'healthy') {
      console.log('OK');
      process.exit(0);
    }
  } catch (e) {}

  console.log('UNHEALTHY');
  process.exit(1);
}

check();
