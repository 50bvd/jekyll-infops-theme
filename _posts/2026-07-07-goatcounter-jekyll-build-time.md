---
layout: post
title: "Adding a GoatCounter visitor counter to a Jekyll site without a browser-side request"
date: 2026-07-07
author: "50bvd"
categories: [Infrastructure, Analytics]
tags: [jekyll, goatcounter, ruby, analytics, ca-certificates]
description: "Getting around CORS and blocker issues on GoatCounter endpoints by fetching the visitor count server-side, at Jekyll build time, instead of from the visitor's browser."
image: /assets/images/posts/goatcounter-dark.svg
image_light: /assets/images/posts/goatcounter-light.svg
---

GoatCounter is a lightweight, privacy-friendly alternative to Google Analytics. Showing a simple "visitors / month" counter on the home page looks trivial — in practice, every browser-side approach hits a different wall. This guide documents the problem and the solution that actually works: fetch everything server-side, at build time.

## What doesn't work

**The official stats API** (`/api/v0/stats/total`) always requires a Bearer token, even with the dashboard set to public:

{% capture term11 %}
$ curl -s https://MYCODE.goatcounter.com/api/v0/stats/total
{"error":"no Authorization header"}
{% endcapture %}
{% include terminal.html content=term11 title="Official API without a token" prompt="user@laptop:~" %}

**The public `/counter/*.json` endpoint**, meant to be embedded without a token, works with `curl` but breaks with `fetch()` from the browser:

{% capture term12 %}
! Access to fetch at 'https://mycode.goatcounter.com/counter//.json?...'
! from origin 'https://mydomain.com' has been blocked by CORS policy:
! No 'Access-Control-Allow-Origin' header is present
{% endcapture %}
{% include terminal.html content=term12 title="DevTools — Console" prompt="console" %}

**The `<img>` variant with `/counter/*.svg`** gets around CORS in theory (images aren't subject to it) — but still fails with a `499`/`net::ERR_FAILED`, reproducible on both PC and mobile, unrelated to any local ad blocker.

## The solution: fetch server-side, at build time

Instead of relying on the visitor's browser, a Jekyll plugin fetches the number once, during `jekyll build`/`jekyll serve`, and injects it straight into the generated static HTML — no network request at all when the page loads.

```ruby
# _plugins/goatcounter_stats.rb
require "net/http"
require "json"
require "date"

Jekyll::Hooks.register :site, :after_reset do |site|
  code = site.config.dig("analytics", "goatcounter_code")
  next if code.nil? || code.empty?

  begin
    end_date   = Date.today
    start_date = end_date - 30
    uri = URI("https://#{code}.goatcounter.com/counter//.json?start=#{start_date}&end=#{end_date}")

    Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 5) do |http|
      res = http.get(uri.request_uri)
      if res.is_a?(Net::HTTPSuccess)
        data = JSON.parse(res.body)
        site.config["goatcounter_visitors"] = (data["count_unique"] || data["count"] || "0").to_i
      end
    end
  rescue StandardError => e
    Jekyll.logger.warn "goatcounter_stats:", "fetch failed (#{e.message})"
  end
end
```

{% include callout.html type="warning" title="ca-certificates on Alpine" content="A ruby:3.3-alpine image doesn't ship CA certificates by default — Net::HTTP over HTTPS fails silently (or crashes the Jekyll process at startup) until the ca-certificates package is installed in the Dockerfile." %}

## Template side

The widget just reads a value that's already been computed — no script, no network call on the visitor's side:

```liquid
{% raw %}<div class="stat-card">
  {% if site.goatcounter_visitors %}
    {% if site.goatcounter_visitors >= 1000 %}
      <div class="stat-value">{{ site.goatcounter_visitors | divided_by: 1000.0 | round: 1 }}k</div>
    {% else %}
      <div class="stat-value">{{ site.goatcounter_visitors }}</div>
    {% endif %}
  {% else %}
    <div class="stat-value">—</div>
  {% endif %}
  <div class="stat-label">Visitors / month</div>
</div>{% endraw %}
```

## Configuration

```yaml
# _config.yml
analytics:
  goatcounter_code: "mycode"
```

{% include screenshot.html src="/assets/images/posts/goatcounter/01-dashboard.png" alt="GoatCounter dashboard" caption="The GoatCounter dashboard the count comes from" %}

## Checking

```bash
docker compose -f docker-compose.public.yml up -d --build
docker logs infops-public | grep -i goatcounter   # no error = OK

curl -s http://localhost:4000/ | grep -A3 "Visitors / month"
# → the number must appear directly in the HTML, not "—"
```

{% include screenshot.html src="/assets/images/posts/goatcounter/02-visitors-widget.png" alt="Visitors per month stat on the home page" caption="The **Visitors / month** stat, already in the HTML when the page loads" %}

## Result

- No browser-side network call: no CORS, no blocker, no 499 possible.
- The number is already in the HTML by the time the page reaches the visitor.
- Deliberate trade-off: the value only updates on the next build/reload, not in real time — more than enough for a monthly counter.
