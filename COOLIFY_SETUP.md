# Coolify Setup Guide

Step-by-step guide to install Coolify on your VPS and deploy OpenClaw.

## 1️⃣ VPS Requirements

### Minimum Specs
- **CPU:** 2 cores
- **RAM:** 4GB (8GB recommended)
- **Storage:** 30GB SSD
- **OS:** Ubuntu 20.04, 22.04, or 24.04 LTS

### Recommended Providers
- DigitalOcean ($24/month for 4GB)
- Hetzner ($4.50/month for 4GB - best value)
- Vultr ($24/month for 4GB)
- Linode ($24/month for 4GB)

## 2️⃣ Initial VPS Setup

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install basic tools
apt install -y curl wget git

# Configure firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp  # Coolify UI
ufw enable
```

## 3️⃣ Install Coolify

```bash
# One-command installation
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This installs:
- Docker & Docker Compose
- Coolify application
- Traefik reverse proxy
- PostgreSQL database

After ~5 minutes, access: `http://your-vps-ip:8000`

### First-Time Setup

1. Create admin account
2. Register your server (it auto-detects localhost)
3. Configure SSH keys if using remote servers

## 4️⃣ Deploy OpenClaw

### Method A: From GitHub

1. **Push Code to GitHub**
   ```bash
   # On your local machine
   cd openclaw-coolify-vps
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/openclaw-vps.git
   git push -u origin main
   ```

2. **Connect GitHub in Coolify**
   - Go to Coolify → Sources → Add GitHub App
   - Authorize Coolify to access your repositories

3. **Create Application**
   - Click **+ New** → **Application**
   - Select **Docker Compose**
   - Choose your GitHub repository
   - Select the branch (main)
   - Coolify detects `docker-compose.yml` automatically

### Method B: Direct Paste

1. Click **+ New** → **Application** → **Docker Compose**
2. Select **Empty Docker Compose**
3. Paste the contents of `docker-compose.yml`
4. Click **Save**

## 5️⃣ Configure Environment Variables

In Coolify, go to your application → **Environment Variables**

### Required Variables

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrs
TELEGRAM_ADMIN_ID=123456789
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### Instagram Variables (for posting)

```env
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400000000
FREEPIK_API_KEY=your_freepik_key
```

### Dashboard Variables (optional)

```env
DASHBOARD_DOMAIN=openclaw.yourdomain.com
DASHBOARD_AUTH_TOKEN=generate_random_32_char_string
```

Generate auth token:
```bash
openssl rand -hex 32
```

## 6️⃣ Configure Domain (Optional)

### Point DNS to VPS

In your domain registrar (Cloudflare, Namecheap, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | openclaw | your-vps-ip | Auto |

### Add Domain in Coolify

1. Go to your application → **Domains**
2. Click **+ Add**
3. Enter: `openclaw.yourdomain.com`
4. Enable **HTTPS** (automatic Let's Encrypt)
5. Save

## 7️⃣ Deploy

1. Click **Deploy** button
2. Monitor build logs
3. Wait for all services to show "Running"

### Verify Deployment

1. **Telegram Bot:** Send `/status` to your bot
2. **Dashboard:** Visit `https://openclaw.yourdomain.com?token=YOUR_TOKEN`
3. **Logs:** Check each service in Coolify UI

## 8️⃣ Post-Deployment

### Enable Auto-Deploy (GitOps)

1. Go to application → **Webhooks**
2. Copy the webhook URL
3. In GitHub → Settings → Webhooks → Add webhook
4. Paste URL, select "Push events"
5. Now pushes to main auto-deploy!

### Configure Backups

1. Go to Coolify → **Settings** → **Backups**
2. Add S3-compatible storage (AWS S3, Backblaze B2, MinIO)
3. Set backup schedule
4. Enable for your application volumes

### Set Up Monitoring

Coolify provides basic monitoring. For advanced:

1. **Uptime Kuma** (free, self-hosted)
   - Deploy via Coolify one-click
   - Monitor your Telegram bot webhook
   - Get alerts on downtime

2. **Telegram Alerts**
   - Your bot's `/status` command
   - Set up cron to alert on failures

## 🔧 Coolify Tips

### Resource Allocation

In docker-compose.yml, adjust limits based on your VPS:

| VPS RAM | OpenClaw | Telegram | Instagram | Dashboard | Redis |
|---------|----------|----------|-----------|-----------|-------|
| 4GB | 2GB | 512MB | 512MB | 256MB | 256MB |
| 8GB | 4GB | 1GB | 512MB | 256MB | 512MB |
| 16GB | 8GB | 2GB | 1GB | 512MB | 1GB |

### Multiple Environments

Create separate applications in Coolify:
- `openclaw-production` - Main bot
- `openclaw-staging` - Testing

Use different `TELEGRAM_BOT_TOKEN` for each.

### Logs & Debugging

```bash
# SSH into VPS
ssh root@your-vps-ip

# View all OpenClaw logs
docker logs openclaw-main -f
docker logs openclaw-telegram -f
docker logs openclaw-instagram -f

# Enter container for debugging
docker exec -it openclaw-telegram sh
```

## ❓ Common Issues

### "Port 8000 already in use"
```bash
# Find process
lsof -i :8000
# Kill it or change Coolify port
```

### "Cannot connect to Docker"
```bash
# Restart Docker
systemctl restart docker
# Reinstall Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### "SSL certificate failed"
- Ensure DNS is propagated (check with `dig openclaw.yourdomain.com`)
- Wait 5-10 minutes for Let's Encrypt
- Check Traefik logs in Coolify

### "Out of disk space"
```bash
# Clean Docker
docker system prune -a
# Check usage
df -h
```

---

## 📚 Resources

- [Coolify Docs](https://coolify.io/docs/)
- [Coolify Discord](https://discord.gg/coolify)
- [Docker Compose Reference](https://docs.docker.com/compose/)
