---
layout: default
title: Archives
permalink: /archives/
---

<div class="main-container">
  <div class="content">
    <header style="margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border-color);">
      <h1 style="display:flex;align-items:center;gap:.6rem;color:var(--accent-blue);">
        <i class="fas fa-archive" aria-hidden="true"></i> Archives
      </h1>
      <p style="color:var(--text-secondary);margin:0;">{{ site.posts | size }} articles publiés.</p>
    </header>

    {% assign postsByYear = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}

    {% for year in postsByYear %}
      <section class="archive-year">
        <h2>{{ year.name }}</h2>
        <ul class="archive-list">
          {% for post in year.items %}
            <li class="archive-item">
              <span class="archive-date">{{ post.date | date: "%m-%d" }}</span>
              <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
              {% if post.tags.size > 0 %}
                <span style="margin-left:auto;display:flex;gap:.3rem;flex-shrink:0;">
                  {% for tag in post.tags limit:2 %}
                    <span class="tag" style="font-size:.72rem;padding:.12rem .5rem;">{{ tag }}</span>
                  {% endfor %}
                </span>
              {% endif %}
            </li>
          {% endfor %}
        </ul>
      </section>
    {% endfor %}

  </div>

  {% include sidebar.html %}
</div>
