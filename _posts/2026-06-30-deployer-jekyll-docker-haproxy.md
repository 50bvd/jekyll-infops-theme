---
layout: post
title: "Deploying a Jekyll blog in production with Docker and HAProxy"
date: 2026-06-30
author: "50bvd"
categories: [Infrastructure, Docker]
tags: [jekyll, docker, haproxy, webrick, deployment, reverse-proxy]
description: "Deploying a Jekyll site in production with its own WEBrick server in a Docker container, reverse-proxied by HAProxy — with no separate build step."
image: /assets/images/posts/jekyll-deploy-dark.svg
image_light: /assets/images/posts/jekyll-deploy-light.svg
---

{% include callout.html type="info" title="Update — September 2026" content="This site no longer runs WEBrick in production. It is now built statically at deploy time and served by Apache in a hardened, read-only container on the same port, so HAProxy did not need any change. WEBrick is a development server: fine for the trade-off described below, but not something to expose long term. The original article is kept as is for reference." %}

A classic Jekyll blog is usually deployed by generating static HTML (`jekyll build`) that is then served by nginx or Apache. That approach is the fastest, but every change means going through build → copy files → redeploy. For a low-traffic personal blog, this guide offers a deliberately simpler alternative: run the `jekyll serve` server (WEBrick) directly in a container, with the sources mounted as a volume, reverse-proxied by HAProxy.

## Why not a classic static build?

A build + nginx pipeline serves pages faster, but every content change means rebuilding the image or re-syncing an output folder. For a site with a handful of articles that isn't critical, a slightly slower server is an acceptable price for total simplicity: editing a file on disk is enough, and Jekyll regenerates the site by itself.

## Dockerfile

Two stages: `base` installs the Ruby dependencies, `dev` runs the server. That same stage serves both for local development and for "production" — only the start command differs between the two `docker-compose.yml` files.

```dockerfile
FROM ruby:3.3-alpine AS base

RUN apk add --no-cache \
      build-base git nodejs npm tzdata \
      libffi-dev yaml-dev zlib-dev \
      ca-certificates

WORKDIR /site
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

FROM base AS dev
WORKDIR /site
EXPOSE 4000 35729
CMD ["bundle", "exec", "jekyll", "serve", \
     "--host", "0.0.0.0", \
     "--port", "4000", \
     "--livereload", \
     "--future", \
     "--drafts"]
```

{% include callout.html type="tip" title="ca-certificates" content="On Alpine, the ca-certificates package isn't installed by default. Without it, any outgoing HTTPS call from a Jekyll plugin (Net::HTTP, external API...) fails with an SSL error." %}

## docker-compose.public.yml — the "production" version

```yaml
services:
  jekyll-public:
    build:
      context: .
      target: dev
    container_name: infops-public
    volumes:
      - .:/site
      - gem_cache:/usr/local/bundle
    command: >
      bundle exec jekyll serve
      --host 0.0.0.0
      --port 4000
    ports:
      - "4000:4000"
    environment:
      - JEKYLL_ENV=production
      - TZ=Europe/Paris
    restart: unless-stopped

volumes:
  gem_cache:
```

Two differences from the development compose file: no `--drafts`/`--future` (only articles that are actually dated and published go out), and `JEKYLL_ENV=production` to enable conditional blocks (`{% raw %}{% if jekyll.environment == "production" %}{% endraw %}`) such as loading the analytics scripts.

{% include callout.html type="warning" title="Avoid --incremental" content="Jekyll's --incremental flag has a known bug: it doesn't always reload modified layouts/includes correctly. On a site that runs continuously with frequently changing content, it's better to let Jekyll regenerate everything on each detected change." %}

## HAProxy reverse proxy

HAProxy terminates TLS and routes traffic to the WEBrick container over plain HTTP:

```haproxy
frontend https_front
    bind *:443 ssl crt /etc/haproxy/combined.pem alpn h2,http/1.1

    acl is_main_domain hdr(host) -i 50bvd.com
    use_backend main_website if is_main_domain

backend main_website
    option http-server-close
    option forwardfor
    option httpchk GET /
    http-request set-header X-Forwarded-Port %[dst_port]
    http-request add-header X-Forwarded-Proto https if { ssl_fc }
    timeout tunnel 1h
    server webserver 192.168.1.12:4000 check
```

## Starting and checking

```bash
docker compose -f docker-compose.public.yml up -d --build

# From srv-docker
curl -sI http://localhost:4000/
# → HTTP/1.1 200 OK, Server: WEBrick/1.9.2

# From outside, through HAProxy
curl -sI https://50bvd.com/
```

Any change on disk (article, layout, style) is picked up automatically within a few seconds — no separate build or redeploy to orchestrate.

## Result

- Site online behind TLS through HAProxy, with no manual build step.
- Edit a file = site updated within seconds.
- Deliberate trade-off: a bit slower than a static nginx site, more than enough for a low-traffic personal blog.
