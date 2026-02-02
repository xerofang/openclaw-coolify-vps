# OpenClaw - Coolify VPS Deployment

Deploy OpenClaw on your VPS using [Coolify](https://coolify.io/), the open-source PaaS alternative to Heroku/Vercel.

## 📋 Prerequisites

- VPS with Ubuntu 20.04/22.04/24.04 LTS (2+ CPU cores, 4GB+ RAM recommended)
- Domain name pointed to your VPS (optional, for HTTPS dashboard)
- Coolify installed on your VPS

## 🚀 Quick Start

### 1. Install Coolify on Your VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Coolify (one command)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation, access Coolify at: `http://your-vps-ip:8000`

### 2. Deploy OpenClaw via Coolify

**Option A: Deploy from Git Repository**

1. Push this folder to your Git repository (GitHub, GitLab, etc.)
2. In Coolify dashboard:
   - Click **+ New** → **Application** → **Docker Compose**
   - Connect your Git repository
   - Select the repository containing this code
   - Coolify will detect `docker-compose.yml` automatically

**Option B: Deploy Manually**

1. In Coolify dashboard: **+ New** → **Application** → **Docker Compose**
2. Choose "Empty" and paste the contents of `docker-compose.yml`
3. Add environment variables in the **Environment Variables** tab

### 3. Configure Environment Variables

In Coolify's **Environment Variables** section, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | From @BotFather |
| `TELEGRAM_ADMIN_ID` | ✅ | Your Telegram user ID |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `INSTAGRAM_ACCESS_TOKEN` | For posting | Instagram Graph API token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | For posting | Instagram account ID |
| `FREEPIK_API_KEY` | For images | Freepik API key |
| `DASHBOARD_DOMAIN` | Optional | Domain for web dashboard |
| `DASHBOARD_AUTH_TOKEN` | Optional | Dashboard access token |

### 4. Configure Domain (Optional)

For HTTPS access to the dashboard:

1. In Coolify, go to your application → **Domains**
2. Add your domain (e.g., `openclaw.yourdomain.com`)
3. Coolify automatically provisions SSL via Let's Encrypt

### 5. Deploy

Click **Deploy** in Coolify. Monitor the build logs for any issues.

## 📁 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Your VPS                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Coolify                               │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐           │ │
│  │  │  Traefik  │  │  Coolify  │  │   Your    │           │ │
│  │  │  (Proxy)  │  │    UI     │  │  OpenClaw │           │ │
│  │  └─────┬─────┘  └───────────┘  └─────┬─────┘           │ │
│  │        │                              │                  │ │
│  │        │    ┌─────────────────────────┼──────┐          │ │
│  │        │    │      OpenClaw Stack     │      │          │ │
│  │        │    │  ┌─────────┐  ┌─────────┴───┐  │          │ │
│  │        └────┼──│Dashboard│  │   Telegram  │  │          │ │
│  │             │  │  :3000   │  │     Bot     │  │          │ │
│  │             │  └─────────┘  └─────────────┘  │          │ │
│  │             │  ┌─────────┐  ┌─────────────┐  │          │ │
│  │             │  │OpenClaw │  │  Instagram  │  │          │ │
│  │             │  │  Main   │  │   Service   │  │          │ │
│  │             │  └─────────┘  └─────────────┘  │          │ │
│  │             │  ┌─────────┐                   │          │ │
│  │             │  │  Redis  │  (Optional)       │          │ │
│  │             │  └─────────┘                   │          │ │
│  │             └────────────────────────────────┘          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 🔧 Services

| Service | Port | Description |
|---------|------|-------------|
| `openclaw` | - | Main OpenClaw engine |
| `telegram-bot` | - | Telegram interface |
| `instagram-service` | - | Instagram posting |
| `dashboard` | 3000 | Web dashboard (optional) |
| `redis` | 6379 | Cache (optional) |

## 💬 Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/research <topic>` | Research any topic |
| `/market <query>` | Market analysis |
| `/create post <desc>` | Create Instagram post |
| `/pending` | View approval queue |
| `/approve <id>` | Approve a post |
| `/reject <id>` | Reject a post |
| `/status` | System health |

## 📊 Monitoring

### Via Coolify UI
- View container logs
- Monitor resource usage
- Check health status
- Restart services

### Via Telegram
Send `/status` to see:
- Uptime
- Memory usage
- Service connections

### Via Dashboard
Access `https://your-domain.com?token=YOUR_AUTH_TOKEN` for:
- Approval queue view
- Statistics

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| Non-root containers | All services run as unprivileged users |
| No privileged mode | Containers cannot access host kernel |
| Resource limits | CPU/memory limits prevent abuse |
| Health checks | Automatic restart on failure |
| HTTPS | Automatic SSL via Coolify/Traefik |
| Auth tokens | Dashboard protected by token |

## 🛠 Maintenance

### View Logs
```bash
# Via Coolify UI: Click on service → Logs

# Or via SSH:
docker logs openclaw-telegram -f
```

### Restart Services
In Coolify: Click **Restart** on your application

### Update
1. Push changes to your Git repository
2. In Coolify: Click **Redeploy**

### Backup
Coolify supports automatic backups to S3-compatible storage.
Configure in Coolify → Settings → Backups

## ⚠️ Troubleshooting

### Bot Not Responding
1. Check Coolify logs for the telegram-bot service
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Ensure bot is not blocked by Telegram

### Instagram Posting Fails
1. Check instagram-service logs
2. Verify token hasn't expired (refresh every 60 days)
3. Ensure image URL is publicly accessible

### Dashboard Not Loading
1. Check if domain DNS is pointing to VPS
2. Verify Traefik is routing correctly
3. Check `DASHBOARD_AUTH_TOKEN` if getting 401

### Out of Memory
1. In Coolify, increase container memory limits
2. Consider upgrading VPS
3. Disable unused services (Redis, Dashboard)

## 📚 Additional Resources

- [Coolify Documentation](https://coolify.io/docs/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Claude API](https://docs.anthropic.com/)
- [Freepik API](https://www.freepik.com/api)

## 📄 License

MIT License - Use at your own risk.

---

**Sources:**
- [Coolify Installation Guide](https://coolify.io/docs/get-started/installation)
- [Coolify GitHub Repository](https://github.com/coollabsio/coolify)
- [Coolify Docker Compose Docs](https://coolify.io/docs/knowledge-base/docker/compose)
