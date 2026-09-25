---
layout: post
title: "Deming ISMS — Docker deployment, LDAP and fixing upstream bugs"
date: 2026-05-10
author: "50bvd"
categories: [Infrastructure, Security]
tags: [deming, isms, docker, ldap, active-directory, open-source, php, bug]
description: "Deploying the Deming ISMS tool with Docker and Active Directory LDAP authentication — two bugs found, fixed and merged upstream (PR #688 and #690)."
image: /assets/images/posts/deming-cover.jpg
image_light: /assets/images/posts/deming-light.svg
---

[Deming](https://github.com/sourcentis/deming) is an open-source ISMS compliance management tool (ISO 27001) developed by sourcentis. This guide covers a complete Docker deployment with LDAP, the two bugs I ran into, and how they were fixed upstream.

## Docker deployment

```yaml
# docker-compose.yml
services:
  deming:
    image: sourcentis/deming:latest
    container_name: deming
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      APP_ENV: production
      APP_KEY: ${APP_KEY}
      DB_HOST: mariadb
      DB_DATABASE: deming
      DB_USERNAME: deming
      DB_PASSWORD: ${DB_PASSWORD}
      LDAP_HOST: ${LDAP_HOST}
      LDAP_PORT: 389
      LDAP_BASE_DN: ${LDAP_BASE_DN}
      LDAP_USERNAME: ${LDAP_USERNAME}
      LDAP_PASSWORD: ${LDAP_PASSWORD}
    volumes:
      - deming_storage:/var/www/html/storage
    depends_on:
      - mariadb

  mariadb:
    image: mariadb:10.11
    container_name: deming-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: deming
      MYSQL_USER: deming
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - deming_db:/var/lib/mysql

volumes:
  deming_storage:
  deming_db:
```

```bash
# Generate the Laravel APP key
docker compose run --rm deming php artisan key:generate --show
# Copy the value into .env

docker compose up -d
docker compose exec deming php artisan migrate --force
```

## Bug #1 — Wrong LDAP AND/OR filter

### Symptom

LDAP authentication fails when several attributes are used:

```
LDAP Error: Invalid filter syntax
ldap_search(): Search: Bad search filter
```

### Cause

The generated LDAP filter was wrong when several login attributes were used (e.g. `sAMAccountName` AND `mail`):

```php
// Original code (buggy)
// Produces: (&(objectClass=user)(attr1=val)(attr2=val))
// Correct for 1 attribute, WRONG for several combined with OR
$filter = "(&(objectClass=user)" . implode('', $conditions) . ")";
```

With several attributes combined with OR, they must be wrapped in `(|...)`:

```
// 1 attribute:     (&(objectClass=user)(sAMAccountName=foo))       ✅
// Several:         (&(objectClass=user)(|(sAMAccountName=foo)(mail=foo@bar.com)))  ✅
// Generated (bug): (&(objectClass=user)(sAMAccountName=foo)(mail=foo@bar.com))    ❌
```

### Fix (PR #688)

```php
// After the fix
if (count($conditions) > 1) {
    $filter = "(&(objectClass=user)(|" . implode('', $conditions) . "))";
} else {
    $filter = "(&(objectClass=user)" . $conditions[0] . ")";
}
```

## Bug #2 — Auto-provisioned email hardcoded to null

### Symptom

The first time an LDAP user who isn't in the database yet logs in, auto-provisioning fails:

```
SQLSTATE[23000]: Integrity constraint violation:
1062 Duplicate entry 'null' for key 'users_email_unique'
```

### Cause

The code read the `mail` attribute from LDAP, but when it was missing (service account, account without an email), it fell back to a **hardcoded** `null` instead of using the `sAMAccountName`:

```php
// Original code (buggy)
$email = $ldapUser->getAttribute('mail')[0] ?? null;
// → null when there is no mail → unique constraint violated by the second user without one
```

### Fix (PR #690)

```php
// After the fix — fall back to sAMAccountName@domain
$defaultDomain = config('ldap.default_domain', 'domain.local');
$email = $ldapUser->getAttribute('mail')[0]
      ?? ($ldapUser->getAttribute('sAMAccountName')[0] . '@' . $defaultDomain)
      ?? null;
```

## Testing the LDAP connection

```bash
# From the container
docker exec -it deming ldapsearch \
  -H ldap://DC_IP \
  -D "CN=svc-account,OU=Services,DC=domain,DC=local" \
  -w PASS \
  -b "DC=domain,DC=local" \
  "(sAMAccountName=testuser)" \
  sAMAccountName mail displayName

# Test the corrected filter by hand
docker exec -it deming ldapsearch \
  -H ldap://DC_IP \
  -D "CN=svc-account,OU=Services,DC=domain,DC=local" \
  -w PASS \
  -b "DC=domain,DC=local" \
  "(&(objectClass=user)(|(sAMAccountName=testuser)(mail=test@domain.local)))"
```

## Contributing the fix upstream

```bash
# Fork + clone
git clone https://github.com/YOUR_FORK/deming.git
cd deming
git checkout -b fix/ldap-filter-and-or

# Change the code (see the fixes above)
# ...

git add .
git commit -m "Fix LDAP login filter incorrect AND/OR grouping with multiple attributes"
git push origin fix/ldap-filter-and-or
# → Open the PR on github.com/sourcentis/deming
```

Both PRs were merged into release `2026.06.16`:
- **PR #688** — Fix LDAP login filter AND/OR grouping
- **PR #690** — Fix hardcoded LDAP auto-provision email fallback

{% include callout.html type="success" title="Open source" content="Contributing upstream benefits the whole community. If you find a bug while deploying an open-source project, take 30 minutes to submit a PR — it's often simple and very much appreciated." %}

## HAProxy configuration

```haproxy
backend deming_backend
    option forwardfor
    option http-server-close
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    timeout tunnel 1h
    server deming 192.168.x.x:8080 check
```
