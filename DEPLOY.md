# Deploying 50bvd.com on the home server

- **Production**: static files served by **Apache** on the host (`/var/www/50bvd.com`), HTTPS via Let's Encrypt.
- **Preprod**: an **Apache httpd container** (same rules as production, `noindex`, no analytics/comments), listening on `127.0.0.1:8081`.
- Jekyll only runs **inside Docker** at build time — no Ruby and no WEBrick on the server.

```
Internet ──▶ router :80/:443 ──▶ home server ── Apache (host) ──▶ /var/www/50bvd.com   (prod)
                                              └─ Docker 127.0.0.1:8081 ─▶ httpd container (preprod)
```

---

## 1. One-time setup

### Network

1. **DNS**: `A` record `50bvd.com` (and `www`) → your home public IP.
   If your ISP changes that IP, use a DynDNS client (e.g. `ddclient`) or your registrar's API.
2. **Router**: forward TCP **80** and **443** to the server's LAN IP. Nothing else.
3. Give the server a **fixed LAN IP** (DHCP reservation in the router).

### Packages (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install -y git rsync apache2 certbot python3-certbot-apache
# Docker: https://docs.docker.com/engine/install/  (includes buildx + compose)
sudo usermod -aG docker "$USER"   # then log out / in
```

### Sources

```bash
sudo mkdir -p /opt/50bvd && sudo chown "$USER" /opt/50bvd
git clone --branch site/perso https://github.com/50bvd/jekyll-infops-theme.git /opt/50bvd
cd /opt/50bvd
```

### Apache

```bash
sudo a2enmod headers deflate expires rewrite ssl http2
sudo mkdir -p /etc/apache2/infops
sudo cp apache/security-headers.conf apache/site-common.conf /etc/apache2/infops/
sudo mkdir -p /var/www/50bvd.com
```

Get the certificate **before** enabling the HTTPS vhost (it references the certificate files):

```bash
sudo certbot certonly --webroot -w /var/www/html -d 50bvd.com -d www.50bvd.com
sudo cp apache/50bvd.com.conf /etc/apache2/sites-available/
sudo a2dissite 000-default
sudo a2ensite 50bvd.com
sudo apachectl configtest && sudo systemctl reload apache2
```

Renewal is automatic (`systemctl list-timers | grep certbot`).

---

## 2. Deploy

```bash
cd /opt/50bvd
./scripts/deploy.sh preprod   # 1. check the preprod
./scripts/deploy.sh prod      # 2. publish to https://50bvd.com
./scripts/deploy.sh all       # or both at once
```

The script pulls the latest `site/perso`, builds the site in Docker, syncs it to `/var/www/50bvd.com` and reloads Apache gracefully (no downtime). If the build fails, nothing is published.

---

## 3. Viewing the preprod

It only listens on the server itself (`127.0.0.1:8081`). From your PC:

```bash
ssh -L 8081:127.0.0.1:8081 you@server-lan-ip
# then open http://localhost:8081
```

To reach it directly from the home network instead, change the port line in
`docker-compose.preprod.yml` to your server's LAN IP (e.g. `"192.168.1.10:8081:80"`).
**Do not** forward port 8081 on the router.

---

## 4. Updating the theme later

New theme versions land on `main`. To bring them into your site:

```bash
git fetch origin
git checkout site/perso
git merge origin/main        # keep your personal commits on top
git push origin site/perso
./scripts/deploy.sh all
```

---

## Security checklist

- [x] No development server exposed (`jekyll serve` / WEBrick only on `127.0.0.1` for local dev)
- [x] Security headers + CSP + HSTS on the production vhost, `ServerTokens Prod`, no directory listing
- [x] Hidden files (`.git`, `.env`…) return 403
- [x] Preprod: `noindex`, read-only container, all capabilities dropped except the ones Apache needs
- [ ] Keep the server updated: `sudo apt install unattended-upgrades`
- [ ] SSH: key authentication only (`PasswordAuthentication no`), consider `fail2ban`
- [ ] Firewall: `sudo ufw allow 80,443/tcp && sudo ufw allow from 192.168.0.0/16 to any port 22 && sudo ufw enable`
