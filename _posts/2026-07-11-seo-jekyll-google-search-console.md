---
layout: post
title: "Setting up Google Search Console and SEO for a Jekyll blog"
date: 2026-07-11
author: "50bvd"
categories: [Infrastructure, SEO]
tags: [jekyll, seo, google-search-console, sitemap, robots-txt]
description: "Putting the SEO basics of a Jekyll blog in place — robots.txt, an automatic sitemap.xml, Google Search Console verification and sitemap submission."
image: /assets/images/posts/seo-gsc-dark.svg
image_light: /assets/images/posts/seo-gsc-light.svg
---

A site can work perfectly without being indexed: without a `robots.txt`, without a declared sitemap and without a verified property in Google Search Console, search engines give no guarantee of reliable indexing. This guide covers a minimal but complete setup for a Jekyll blog.

## robots.txt

```
User-agent: *
Allow: /

Sitemap: https://mydomain.com/sitemap.xml
```

A static file at the root of the site is enough — no plugin needed.

## Automatic sitemap.xml

The official plugin generates and maintains the sitemap with no configuration:

```yaml
# _config.yml
plugins:
  - jekyll-sitemap
```

Jekyll then automatically serves `/sitemap.xml`, regenerated on every build with the up-to-date list of articles and pages.

## SEO meta tags (jekyll-seo-tag)

```yaml
plugins:
  - jekyll-seo-tag
```

```liquid
{% raw %}{% seo %}{% endraw %}
```

This single tag generates the title, description, Open Graph, Twitter Card and `generator` tags from the fields already in `_config.yml` (`title`, `description`, `url`) and each article's front matter (`description`, `image`).

## Google Search Console ownership verification

The simplest method for a static site is the meta tag, added directly to the `<head>` of the main layout:

```html
<meta name="google-site-verification" content="YOUR_CODE_HERE" />
```

{% include callout.html type="tip" title="Where to find the code" content="In Search Console: Settings → Property → Ownership verification → 'HTML tag' method. The code goes straight into the content attribute of the meta tag, nowhere else." %}

## Submitting the sitemap

Once the property is verified in Search Console: **Sitemaps → Add a new sitemap** → enter `sitemap.xml` (the full URL isn't needed, just the relative path). The status changes to "Submitted", then after a few hours to "Success" with the number of discovered pages.

## Checking

```bash
curl -s https://mydomain.com/robots.txt
curl -s https://mydomain.com/sitemap.xml | head -20
curl -s https://mydomain.com/ | grep google-site-verification
```

{% include callout.html type="warning" title="Deleting/re-creating a property" content="If you delete and re-create the property in Search Console, a new verification code is generated every time — the old meta tag stops working and must be replaced before running the verification again." %}

## Result

- `robots.txt` in place, pointing to the sitemap.
- Sitemap generated and kept up to date automatically by Jekyll on every build.
- Search Console property verified and sitemap submitted — the site shows up in Google's index with no recurring manual step.
