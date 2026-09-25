---
layout: post
title: "Pi-hole on a Raspberry Pi — Block ads across your whole network"
date: 2026-01-15
author: "50bvd"
categories: [Networking, Homelab]
tags: [pi-hole, raspberry-pi, dns, adblock, linux, networking]
description: "Complete guide to installing Pi-hole on a Raspberry Pi and blocking ads and trackers for every device on your local network through DNS."
image: /assets/images/posts/pihole-cover.jpg
image_light: /assets/images/posts/pihole-light.svg
---

Pi-hole is a DNS-level ad blocker that protects your entire network — phones, smart TVs, consoles, computers — without installing anything on each device.

## How it works

```
Device (phone, PC, TV...)
       │ DNS query: ad.example.com
       ▼
Pi-hole (local DNS server)
       │ Blocklist: ad.example.com → BLOCKED → 0.0.0.0
       │ Legitimate domain → forwarded to 1.1.1.1
       ▼
Internet (legitimate domains only)
```

Pi-hole answers `0.0.0.0` for advertising domains — the device never loads the content.

## Hardware

- Raspberry Pi (Zero 2W, 3B+, 4 or 5)
- microSD card ≥ 8 GB (class 10)
- Micro-USB or USB-C power supply depending on the model
- Ethernet connection (recommended) or Wi-Fi

{% include callout.html type="tip" title="Which model?" content="The Raspberry Pi Zero 2W (~€18) is more than enough for Pi-hole on a home network. The Pi 4 is oversized for this job but lets you host other services at the same time." %}

## Installing Raspberry Pi OS

**1.** Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)

**2.** In the imager, click the ⚙️ icon before flashing to preconfigure:
- Enable SSH
- Set up your Wi-Fi (SSID + password)
- Set a hostname (e.g. `pihole`)
- Set a username/password

{% include screenshot.html src="/assets/images/posts/pihole/01-imager-settings.png" alt="Raspberry Pi Imager advanced settings" caption="Raspberry Pi Imager → ⚙️: SSH, Wi-Fi, hostname and user set before flashing" %}

**3.** Flash the SD card with **Raspberry Pi OS Lite (64-bit)**

**4.** Insert the card and boot the Pi. Connect over SSH:

```bash
ssh pi@pihole.local
# or ssh pi@PI_IP_ADDRESS
```

## Assigning a static IP

Pi-hole must always keep the same IP to act as a DNS server:

```bash
# Option 1: DHCP reservation on your router (recommended)
# Find the Pi's MAC address in your router's interface
# and create a DHCP reservation

# Option 2: static IP on the Pi
sudo nano /etc/dhcpcd.conf

# Add at the end:
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=127.0.0.1
```

## Installing Pi-hole

```bash
curl -sSL https://install.pi-hole.net | bash
```

The interactive installer walks you through:

1. **Network interface**: `eth0` (cable) or `wlan0` (Wi-Fi)
2. **Upstream DNS**: pick your forwarder (Cloudflare, Quad9, etc.)
3. **Static IP confirmation**: confirm your IP
4. **Web interface**: enable it

At the end, write down the generated admin password.

{% include screenshot.html src="/assets/images/posts/pihole/02-installer-done.png" alt="End of the Pi-hole installer" caption="The last installer screen shows the web interface address and the admin password" %}

{% include callout.html type="warning" title="Admin password" content="If you miss the password, you can change it at any time with: pihole -a -p new-password" %}

## Post-installation setup

### Opening the web interface

Open `http://192.168.1.100/admin` in your browser.

{% include screenshot.html src="/assets/images/posts/pihole/03-dashboard.png" alt="Pi-hole dashboard" caption="The Pi-hole dashboard: total queries, blocked queries and blocklist size" %}

### Updating the blocklists

```bash
pihole -g
```

### Adding more lists

In the interface: **Group Management → Adlists**, add:

```
https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts
https://someonewhocares.org/hosts/zero/hosts
https://raw.githubusercontent.com/PolishFiltersTeam/KADhosts/master/KADhosts.txt
https://adaway.org/hosts.txt
```

Then: **Tools → Update Gravity** to download the lists.

{% include screenshot.html src="/assets/images/posts/pihole/04-adlists.png" alt="Pi-hole Adlists page" caption="**Group Management → Adlists** with the extra lists added" %}

## Making your router hand out Pi-hole as DNS

This is the key step: every device on the network must use Pi-hole as its DNS server.

**In your router's interface:**
- DHCP settings → primary DNS: `192.168.1.100` (the Pi's IP)
- Secondary DNS: leave empty or set `1.1.1.1` (fallback if Pi-hole goes down)

{% include screenshot.html src="/assets/images/posts/pihole/05-router-dns.png" alt="Router DHCP settings with Pi-hole as DNS" caption="Router DHCP settings: the Pi-hole IP as primary DNS" %}

On some routers, devices must be restarted to pick up the new DNS.

## Typical results

After a few hours of operation:

| Metric | Typical value |
|--------|---------------|
| Blocked queries | 20-35% |
| Domains on the blocklist | 150,000 - 300,000 |
| Added DNS latency | < 1 ms on the LAN |
| RAM used (Pi Zero 2W) | ~80 MB |

## Useful commands

```bash
# Pi-hole status
pihole status

# Watch queries in real time
pihole -t

# Update Pi-hole
pihole -up

# Disable temporarily (300 seconds)
pihole disable 300
pihole enable

# Whitelist a domain
pihole -w domain.com

# Blacklist a domain manually
pihole -b ad-domain.com

# Quick stats
pihole -c
```

## Common troubleshooting

### A site is blocked by mistake

```bash
# Search the logs
pihole -t | grep "site-name.com"

# Whitelist it
pihole -w site-name.com
```

### Devices don't use Pi-hole

```bash
# Check which DNS a device uses (from that device)
# Windows:
nslookup google.com
# → Server: must show the Pi-hole IP

# Linux/Mac:
dig google.com | grep SERVER
```

{% capture term1 %}
$ nslookup google.com
Server:  192.168.1.100
{% endcapture %}
{% include terminal.html content=term1 title="PowerShell — nslookup" prompt="PS C:\\>" caption="The **Server** line must show the Pi-hole IP" %}

### Pi-hole doesn't answer

```bash
# Check the service
sudo systemctl status pihole-FTL

# Restart if needed
sudo systemctl restart pihole-FTL
```

## In my homelab

On my Raspberry Pi, Pi-hole runs as a Docker container alongside `vlmcsd` (KMS server) on the same machine:

```yaml
services:
  pihole:
    image: pihole/pihole:latest
    container_name: pihole
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "80:80/tcp"
    environment:
      TZ: Europe/Paris
      WEBPASSWORD: your-password
      PIHOLE_DNS_: 94.140.14.14;1.1.1.1
    volumes:
      - ./etc-pihole:/etc/pihole
      - ./etc-dnsmasq.d:/etc/dnsmasq.d

  vlmcsd:
    image: mikolatero/vlmcsd:latest
    container_name: vlmcsd
    restart: unless-stopped
    ports:
      - "1688:1688"
```

{% include callout.html type="success" title="Result" content="On my network, Pi-hole blocks 28% of DNS queries on average — mostly advertising, trackers and Windows and Android telemetry." %}

## Conclusion

Pi-hole is one of the homelab projects with the best effort-to-result ratio. Once installed, it works transparently for every device on the network, with no client-side configuration at all.
