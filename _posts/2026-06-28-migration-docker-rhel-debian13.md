---
layout: post
title: "Migrating Docker from RHEL 8 to Debian 13 — Complete guide"
date: 2026-06-28
author: "50bvd"
categories: [Infrastructure, Docker]
tags: [docker, debian, rhel, migration, portainer, linux, containers]
description: "Step-by-step guide to migrating a complete Docker stack from RHEL 8 to Debian 13 — backing up volumes, transferring data, recreating containers and switching the IP."
image: /assets/images/posts/docker-cover.jpg
image_light: /assets/images/posts/docker-migration-light.svg
---

Docker dropped support for RHEL 8 starting with version 29. If your infrastructure still runs Docker on RHEL 8, here is how to migrate cleanly to Debian 13 without a long outage.

## Why migrate?

- Docker 28 is the last version supported on RHEL 8
- Docker 29+ requires RHEL 9 or another distribution
- Debian 13 (Trixie) supports Docker 29+ natively
- Fewer licensing constraints than RHEL

## Inventory before migrating

```bash
# List the containers
docker ps -a --format "table {% raw %}{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}{% endraw %}"

# List the volumes
docker volume ls

# Find bind mounts (data outside Docker volumes)
docker inspect $(docker ps -aq) \
  --format '{% raw %}{{.Name}}: {{range .Mounts}}{{.Type}}:{{.Source}}→{{.Destination}} {{end}}{% endraw %}'
```

**Example stack to migrate:**

| Container | Persistent data | Method |
|-----------|-----------------|--------|
| portainer | `portainer_data` volume | tar export |
| app-custom | Local build + .env | Copy sources + rebuild |
| stateless-tools | None | Re-pull the image |
| website | Bind mount `/root/site/` | Copy within the home archive |

## Step 1 — Back up

### Home archive (bind mounts included)

```bash
# Leave out large, regenerable caches
tar czf /tmp/home-backup.tar.gz \
  --exclude=/root/jellyfin/cache \
  --exclude=/root/.cache \
  /root

ls -lh /tmp/home-backup.tar.gz
```

### Export the Docker volumes

```bash
# For each named volume
for vol in $(docker volume ls -q); do
  echo "Exporting $vol..."
  docker run --rm \
    -v "${vol}:/data" \
    -v /tmp:/backup \
    alpine tar czf "/backup/${vol}.tar.gz" /data
done

ls -lh /tmp/*.tar.gz
```

## Step 2 — Prepare the Debian 13 VM

Create a new VM (Proxmox or other) with Debian 13 netinstall and a 50 GB disk.

```bash
# System update
apt update && apt upgrade -y

# Essential tools
apt install -y curl wget git vim sudo openssh-server netcat-openbsd

# Docker via the official script
curl -fsSL https://get.docker.com | sh

# Check
docker version
# → Client/Server: Docker Engine 29.x.x
```

## Step 3 — Transfer the data

```bash
# From the Debian VM — fetch the archives
scp root@OLD-IP:/tmp/home-backup.tar.gz /tmp/
scp root@OLD-IP:/tmp/portainer_data.tar.gz /tmp/

# Extract the home directory
tar xzf /tmp/home-backup.tar.gz -C /

# Import the Portainer volume
docker volume create portainer_data
docker run --rm \
  -v portainer_data:/data \
  -v /tmp:/backup \
  alpine tar xzf /backup/portainer_data.tar.gz -C /

# Check
docker run --rm -v portainer_data:/data alpine ls /data
# → backups bin certs portainer.db ...
```

{% capture term7 %}
# docker run --rm -v portainer_data:/data alpine ls /data
backups bin certs portainer.db ...
{% endcapture %}
{% include terminal.html content=term7 title="root@debian13" prompt="root@debian13:~" caption="The Portainer volume is back, with its database" %}

## Step 4 — Recreate the containers

### Portainer (without Docker Swarm)

```yaml
# /root/portainer-compose.yml
services:
  portainer:
    image: portainer/portainer-ee:latest
    container_name: portainer
    restart: always
    ports:
      - "8000:8000"
      - "9443:9443"
    volumes:
      - portainer_data:/data
      - /var/run/docker.sock:/var/run/docker.sock

  portainer_agent:
    image: portainer/agent:latest
    container_name: portainer_agent
    restart: always
    ports:
      - "9001:9001"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/docker/volumes:/var/lib/docker/volumes

volumes:
  portainer_data:
    external: true
```

```bash
docker compose -f /root/portainer-compose.yml up -d
```

{% include screenshot.html src="/assets/images/posts/docker-migration/01-portainer.png" alt="Portainer dashboard on the new Debian 13 host" caption="Portainer running on Debian 13 with its restored settings and stacks" %}

### Stateless containers

```bash
# No data to migrate — just re-pull and recreate
docker run -d --name it-tools --restart always -p 8080:80 corentinth/it-tools
docker run -d --name srv-kms  --restart always -p 1688:1688 mikolatero/vlmcsd
```

### Container with a local build

```bash
cd /root/my-app
docker compose up -d --build
```

## Step 5 — Switch the IP

Once every container has been checked on the new VM:

```bash
# 1. Shut down the old VM (don't delete it right away)
# 2. Give the new VM the same IP (static DHCP lease or network config)

# On Debian 13 — change the IP
nano /etc/network/interfaces
# Change the IP address

systemctl restart networking

# 3. Check connectivity
ip a
ping 8.8.8.8
```

## Step 6 — Update HAProxy if needed

If backends point to an IP that changed:

```haproxy
# haproxy.cfg — update the backend IPs
backend my_backend
    server app NEW-IP:PORT check
```

```bash
haproxy -c -f /etc/haproxy/haproxy.cfg && systemctl reload haproxy
```

## Final check

```bash
# Every container must be Up
docker ps --format "table {% raw %}{{.Names}}\t{{.Status}}\t{{.Ports}}{% endraw %}"

# Test each service
curl -sk https://my-service.domain.com -o /dev/null -w "%{http_code}"
# → 200
```

{% capture term8 %}
$ curl -sk https://my-service.domain.com -o /dev/null -w "%{http_code}"
200
{% endcapture %}
{% include terminal.html content=term8 title="Final check" prompt="user@laptop:~" %}

## Rollback

```bash
# If something goes wrong — power the old VM back on
# (keep it shut down for 48 h before deleting it for good)
# Put the IP back on the old VM
# The new VM gets its original IP back
```

{% include callout.html type="tip" title="Zero downtime" content="By setting up the new VM on a temporary IP and switching the IP only once the migration is validated, the downtime shrinks to the network restart (~30 seconds)." %}

## Conclusion

A RHEL 8 → Debian 13 migration of a standard stack takes less than 2 hours. The key: back up the Docker volumes properly, and only delete the old VM after 48 hours of validation in production.
