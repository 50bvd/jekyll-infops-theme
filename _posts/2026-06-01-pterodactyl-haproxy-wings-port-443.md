---
layout: post
title: "Pterodactyl Panel + Wings behind HAProxy — Port 443 from anywhere"
date: 2026-06-01
author: "50bvd"
categories: [Homelab, Docker]
tags: [pterodactyl, haproxy, wings, reverse-proxy, ssl, minecraft, debian]
description: "Deploying Pterodactyl Panel and Wings on Debian 13 with HAProxy as a TLS reverse proxy — Wings exposed on port 443 to get around corporate network restrictions."
image: /assets/images/posts/pterodactyl-cover.jpg
image_light: /assets/images/posts/pterodactyl-light.svg
---

Pterodactyl is an open-source game server management panel. The classic problem: Wings (the daemon) listens on port 8080 by default, which is often blocked on corporate networks. The solution: put Wings behind HAProxy on port 443.

## The problem

The Pterodactyl panel reaches the Wings daemon from the client's browser:

```
Browser → node.domain.com:8080 → Wings
```

From a corporate network, port 8080 is blocked by the firewall. The node shows up red in the panel even though Wings works perfectly locally.

## Target architecture

```
Internet (port 443 only)
        │
        ▼
HAProxy — TLS termination
        │
        ├── pterodactyl.domain.com:443 → Panel (nginx:443)
        └── node.domain.com:443        → Wings (HTTP:8080)

# Wings listens in plain HTTP on 8080 — HAProxy handles TLS
```

## Debian 13 installation

```bash
# PHP 8.3 from sury.org
curl -sSLo /usr/share/keyrings/deb.sury.org-php.gpg \
  https://packages.sury.org/php/apt.gpg
echo "deb [signed-by=/usr/share/keyrings/deb.sury.org-php.gpg] \
  https://packages.sury.org/php/ trixie main" \
  > /etc/apt/sources.list.d/php.list

apt update && apt install -y \
  php8.3 php8.3-{cli,fpm,mysql,mbstring,bcmath,xml,curl,zip,gd,tokenizer} \
  nginx mariadb-client certbot python3-certbot-nginx
```

## Installing the Panel

```bash
mkdir -p /var/www/pterodactyl && cd /var/www/pterodactyl
curl -Lo panel.tar.gz \
  https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
tar -xzf panel.tar.gz
chmod -R 755 storage/* bootstrap/cache/

composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate --force
php artisan p:environment:setup
php artisan p:environment:database
php artisan migrate --seed --force
php artisan p:user:make
chown -R www-data:www-data /var/www/pterodactyl
```

## Nginx for the Panel

```nginx
server {
    listen 443 ssl;
    server_name pterodactyl.domain.com;

    ssl_certificate     /etc/letsencrypt/live/pterodactyl.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pterodactyl.domain.com/privkey.pem;

    root /var/www/pterodactyl/public;
    index index.php;

    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
    }
}
```

## Installing Wings

```bash
mkdir -p /etc/pterodactyl
curl -L -o /usr/local/bin/wings \
  "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64"
chmod u+x /usr/local/bin/wings
```

### Wings configuration — internal HTTP

In the panel: **Admin → Nodes → Create a node**:
- FQDN: `node.domain.com`
- Daemon Port: `443` ← public port exposed by HAProxy
- ✅ **Behind Proxy** checked ← critical

Copy the generated config into `/etc/pterodactyl/config.yml`.

Make sure Wings listens in **HTTP** on **8080** (not 443):

```yaml
# /etc/pterodactyl/config.yml
api:
  port: 8080      # Internal port — HAProxy proxies to it
  ssl:
    enabled: false # HAProxy handles TLS
```

```bash
# systemd service
curl -o /etc/systemd/system/wings.service \
  https://raw.githubusercontent.com/pterodactyl/wings/develop/wings.service
systemctl enable --now wings

# Check
ss -tlnp | grep 8080
# → Wings listening on 0.0.0.0:8080
```

## HAProxy configuration

```haproxy
frontend https_front
    bind *:443 ssl crt /etc/haproxy/combined.pem alpn h2,http/1.1

    acl is_panel hdr(host) -i pterodactyl.domain.com
    acl is_node  hdr(host) -i node.domain.com

    use_backend panel_backend if is_panel
    use_backend wings_backend if is_node

backend panel_backend
    option forwardfor
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    timeout tunnel 1h
    server panel 192.168.x.x:443 check ssl verify none

backend wings_backend
    mode http
    option forwardfor
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    timeout tunnel 1h
    server wings 192.168.x.x:8080 check
    # No "ssl" here — Wings runs in plain HTTP
```

{% include callout.html type="warning" title="ssl verify none vs check" content="For the Wings backend: just 'check', without 'ssl' — Wings listens in HTTP. For the panel's nginx, which listens in HTTPS: 'check ssl verify none'." %}

## Checking

```bash
# Test Wings through HAProxy
curl -sk https://node.domain.com/api/system -o /dev/null -w "%{http_code}"
# → 401 (authentication required — Wings answers correctly)

# The node should turn green in the panel
```

## Firewall on the Wings server

```bash
# Allow Wings only from HAProxy
iptables -A INPUT -p tcp --dport 8080 -s 192.168.x.11 -j ACCEPT  # HAProxy IP
iptables -A INPUT -p tcp --dport 8080 -j DROP

# Panel nginx port
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Pterodactyl SFTP
iptables -A INPUT -p tcp --dport 2022 -j ACCEPT

# Persist
apt install -y iptables-persistent
netfilter-persistent save
```

## Result

- Panel reachable from any network on port 443 ✅
- Wings reachable through HAProxy on node.domain.com:443 ✅
- Port 8080 not exposed to the internet ✅
- Game servers reachable (Docker opens the ports automatically) ✅

{% include callout.html type="tip" title="Certificate renewal" content="Set up a cron job to renew the Let's Encrypt certificates automatically and rebuild HAProxy's combined.pem (cat fullchain.pem privkey.pem > combined.pem)." %}
