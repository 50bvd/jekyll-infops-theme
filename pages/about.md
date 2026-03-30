---
layout: default
title: About
permalink: /about/
description: "About this blog and the jekyll-infops-theme."
---

<div class="main-container">
  <div class="content">
    <article class="post-content">
      <header class="post-header">
        <h1 class="post-title">About</h1>
        {% if site.description %}<p class="post-description">{{ site.description }}</p>{% endif %}
      </header>
      <div class="post-body">

{% if site.author.bio %}<p>{{ site.author.bio }}</p>{% endif %}

<h2>jekyll-infops-theme</h2>

<p>A modern, customizable Jekyll theme built for DevOps, SysOps and infrastructure engineers.</p>

<h3>Features</h3>

<ul>
  <li><strong>Interactive terminal</strong> — type <code>help</code> in the hero section to explore commands and games</li>
  <li><strong>Dark / Light mode</strong> — persisted via <code>localStorage</code>, no flash on reload</li>
  <li><strong>Canvas background</strong> — particles that react to cursor movement</li>
  <li><strong>Client-side search</strong> — instant full-text, no external service</li>
  <li><strong>Syntax highlighting</strong> — Prism.js with a copy button on every block</li>
  <li><strong>Table of Contents</strong> — auto-generated from headings, scroll-aware</li>
  <li><strong>Reading progress</strong> — progress bar while reading articles</li>
  <li><strong>Callout blocks</strong> — <code>note</code>, <code>tip</code>, <code>info</code>, <code>warning</code>, <code>danger</code>, <code>success</code></li>
  <li><strong>Analytics</strong> — GoatCounter / GA4 / Plausible / Umami (production only)</li>
  <li><strong>Comments</strong> — Utterances (GitHub Issues) or Disqus</li>
  <li><strong>Accessible</strong> — skip-link, ARIA labels, reduced-motion support</li>
</ul>

<h3>Tech stack</h3>

<table>
  <thead><tr><th>Component</th><th>Technology</th></tr></thead>
  <tbody>
    <tr><td>Generator</td><td>Jekyll 4.3</td></tr>
    <tr><td>CSS</td><td>Modular SCSS</td></tr>
    <tr><td>Icons</td><td>Font Awesome 6.4</td></tr>
    <tr><td>Syntax</td><td>Prism.js</td></tr>
    <tr><td>Feed</td><td>jekyll-feed</td></tr>
    <tr><td>SEO</td><td>jekyll-seo-tag</td></tr>
  </tbody>
</table>

<h3>Contribute</h3>

{% if site.author.github and site.author.github != "YOUR_USERNAME" %}
<p>Source code: <a href="https://github.com/{{ site.author.github }}/jekyll-infops-theme" target="_blank" rel="noopener">github.com/{{ site.author.github }}</a>.
Issues and pull requests are welcome.</p>
{% else %}
<p>See <code>README.md</code> for contribution instructions.</p>
{% endif %}

      </div>
    </article>
  </div>
  {% include sidebar.html %}
</div>
