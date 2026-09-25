# Deploying 50bvd.com on the home server

```
Internet ─▶ router / reverse proxy ─▶ srv-docker:4000 ─▶ 50bvd-prod     (Apache httpd container)
                                      127.0.0.1:8081  ─▶ 50bvd-preprod  (Apache httpd container, noindex)
```

- **Production** and **preprod** are two Apache `httpd` containers built from this branch
  (`docker-compose.50bvd.yml`). Production takes over **port 4000**, the port of the old
  WEBrick container, so whatever forwards traffic to the server keeps working unchanged.
- Jekyll only runs at build time inside Docker — no Ruby and no WEBrick left running.
- Both containers are read-only, run with the minimum Linux capabilities, and send the
  security headers from `apache/security-headers.conf`.

---

## 1. Migrating from the old WEBrick container (`infops-public`)

The old site lives in `/root/50bvd-site` (mounted into the container).

```bash
cd /opt/50bvd
git fetch origin && git checkout site/perso && git pull

# 1. Articles and images from the old site
cp -r  /root/50bvd-site/_posts/.          _posts/
cp -rn /root/50bvd-site/assets/images/.   assets/images/     # -n: keep the theme's files

# 2. Your settings: compare, then copy your values into _config.perso.yml
diff /root/50bvd-site/_config.yml _config.yml

# 3. Check everything on the preprod
./scripts/deploy.sh preprod
#    from your PC: ssh -L 8081:127.0.0.1:8081 root@srv-docker  →  http://localhost:8081

# 4. Stop WEBrick (frees port 4000), start the new production
docker compose -f /root/50bvd-site/docker-compose.public.yml down
./scripts/deploy.sh prod

# 5. Save your articles in Git
git add _posts assets/images _config.perso.yml
git commit -m "content: import articles from the old site"
git push origin site/perso
```

Rollback (if needed): `docker compose -f docker-compose.50bvd.yml down prod` then
`docker compose -f /root/50bvd-site/docker-compose.public.yml up -d`.

Once the new site is confirmed, `/root/50bvd-site` can be archived and removed.

---

## 2. Everyday use

```bash
cd /opt/50bvd
./scripts/deploy.sh preprod   # rebuild the preprod, check it
./scripts/deploy.sh prod      # publish
./scripts/deploy.sh all       # both
```

The script pulls the latest `site/perso`, **builds first** and only then swaps the
container: if the build fails, the running site is left untouched.

- **New article**: add `_posts/YYYY-MM-DD-title.md` (see `_posts/README.md`), push, deploy.
- **Settings** (title, author, terminal boot text, logo…): `_config.perso.yml`.
- **Other ports**: `PROD_PORT=8080 ./scripts/deploy.sh prod`, `PREPROD_PORT=9000 …`.

### Viewing the preprod

It only listens on the server itself (`127.0.0.1:8081`):

```bash
ssh -L 8081:127.0.0.1:8081 root@srv-docker     # then http://localhost:8081
```

To open it to the home network, set `PREPROD_PORT` and change `127.0.0.1` to the
server's LAN IP in `docker-compose.50bvd.yml`. **Never** forward it on the router.

---

## 3. Branches

| Branch | Content | Published by |
|---|---|---|
| `main` | the theme + its demo articles | GitHub Actions → GitHub Pages |
| `site/perso` | the theme + **your** articles and settings | `scripts/deploy.sh` → 50bvd.com |

Getting a new theme version into your site:

```bash
git checkout site/perso
git fetch origin && git merge origin/main
git push origin site/perso
./scripts/deploy.sh all
```

Never merge `site/perso` into `main`.

---

## 4. HTTPS

TLS is terminated **in front of** the container (router / reverse proxy / Cloudflare…),
as it was for the old setup. If that front end is an Apache or nginx you control, enable
HSTS there (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).

### Alternative: Apache installed directly on the host

`apache/50bvd.com.conf` is a complete HTTPS vhost (Let's Encrypt, HTTP/2, HSTS,
www → apex) for serving the site without a container:

```bash
sudo apt install -y apache2 certbot rsync
sudo a2enmod headers deflate expires rewrite ssl http2
sudo mkdir -p /etc/apache2/infops /var/www/50bvd.com
sudo cp apache/security-headers.conf apache/site-common.conf /etc/apache2/infops/
sudo certbot certonly --webroot -w /var/www/html -d 50bvd.com -d www.50bvd.com
sudo cp apache/50bvd.com.conf /etc/apache2/sites-available/ && sudo a2ensite 50bvd.com
sudo apachectl configtest && sudo systemctl reload apache2
./scripts/deploy.sh host      # builds and rsyncs to /var/www/50bvd.com
```

---

## Security checklist

- [x] No WEBrick / `jekyll serve` in production (dev server bound to `127.0.0.1` only)
- [x] Security headers + CSP, `ServerTokens Prod`, no directory listing, hidden files → 403
- [x] Containers read-only, capabilities dropped, `no-new-privileges`
- [x] Preprod: `noindex` (meta + header), localhost only, no analytics / comments
- [ ] Keep the server updated: `apt install unattended-upgrades`
- [ ] SSH: keys only (`PasswordAuthentication no`, `PermitRootLogin prohibit-password`), `fail2ban`
- [ ] Firewall: only the ports the router forwards, SSH from the LAN only
