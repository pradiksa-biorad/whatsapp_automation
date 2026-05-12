# WA Survey — EC2 Deployment Guide

## Prerequisites

- An AWS EC2 instance (Amazon Linux 2023 or Ubuntu 22.04+)
- Port **80** open in the Security Group inbound rules
- SSH access to the instance

---

## 1. Connect to EC2

```bash
ssh -i your-key.pem ec2-user@<YOUR_EC2_IP>
# or for Ubuntu:
ssh -i your-key.pem ubuntu@<YOUR_EC2_IP>
```

---

## 2. Install Docker

**Amazon Linux 2023:**
```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker
```

**Ubuntu 22.04+:**
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
newgrp docker
```

Verify:
```bash
docker --version
docker compose version
```

---

## 3. Upload the Project

**Option A — Git (recommended):**
```bash
git clone https://github.com/your-username/whatsapp-meal-hook.git
cd whatsapp-meal-hook
```

**Option B — SCP from your local machine:**
```bash
# Run this locally
scp -i your-key.pem -r /path/to/whatsapp-meal-hook ec2-user@<YOUR_EC2_IP>:~/
```

---

## 4. Configure Environment

```bash
cd whatsapp-meal-hook

# Generate a strong JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# Verify
cat .env
```

---

## 5. Build and Start

```bash
docker compose up -d --build
```

This will:
1. Build the React frontend
2. Package everything into a single Node.js container
3. Start the app on port 80
4. Mount `data/` and `auth_sessions/` as volumes so data persists across restarts

Check it's running:
```bash
docker compose ps
docker compose logs -f
```

Open `http://<YOUR_EC2_IP>` in your browser.

---

## 6. First-Time WhatsApp Login

1. Open `http://<YOUR_EC2_IP>` in your browser.
2. Click **"Sign in with WhatsApp"**.
3. Scan the QR code with your phone → **WhatsApp → Linked Devices → Link a Device**.
4. You're in. The auth session is saved in `auth_sessions/` — no re-scan needed after redeploys.

---

## Redeploying After Code Changes

```bash
git pull
docker compose up -d --build
```

Your database and WhatsApp sessions are in host-mounted volumes and are **not affected** by rebuilds.

---

## Useful Commands

```bash
# View live logs
docker compose logs -f

# Stop the app
docker compose down

# Restart without rebuilding
docker compose restart

# Open a shell inside the container
docker compose exec app sh

# Check SQLite data
docker compose exec app sh -c "ls data/"
```

---

## Optional: HTTPS with Let's Encrypt

For production, put an nginx reverse proxy in front with a free SSL certificate.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Point your domain's DNS A record to the EC2 IP, then:

```bash
sudo certbot --nginx -d yourdomain.com
```

Update `docker-compose.yml` to bind on `127.0.0.1:3001:3001` instead of `80:3001` and let nginx proxy to it.

---

## Security Checklist

- [ ] Security Group: only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) open inbound
- [ ] `JWT_SECRET` set to a random 32+ character string in `.env`
- [ ] Do **not** commit `.env` to git (it's in `.gitignore`)
- [ ] Rotate `JWT_SECRET` if the server is ever compromised (all users will need to re-login)
