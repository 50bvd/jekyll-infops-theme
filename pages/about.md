---
layout: default
title: About
permalink: /about/
description: "About 50bvd — systems and infrastructure administrator, homelab and open source."
---

<div class="main-container">
  <div class="content">
    <article class="post-content">
      <header class="post-header">
        <h1 class="post-title">About</h1>
        {% if site.description %}<p class="post-description">{{ site.description }}</p>{% endif %}
      </header>
      <div class="post-body">

<p>Hi, I'm <strong>50bvd</strong>. {{ site.author.bio }}</p>

<p>This blog collects the guides I write while building and running my own infrastructure: what worked, what broke, and how I fixed it — with real configurations rather than theory.</p>

<h2>What I write about</h2>

<ul>
  <li><strong>Infrastructure &amp; Linux</strong> — Active Directory integration, migrations, Docker in production</li>
  <li><strong>Homelab &amp; virtualization</strong> — Proxmox, ZFS, repurposed hardware</li>
  <li><strong>Networking &amp; reverse proxies</strong> — HAProxy, DNS, TLS</li>
  <li><strong>Security &amp; compliance</strong> — hardening, ISMS tooling</li>
  <li><strong>Open source</strong> — deploying projects and contributing fixes upstream</li>
</ul>

<h2>My stack</h2>

<table>
  <thead><tr><th>Area</th><th>Tools</th></tr></thead>
  <tbody>
    <tr><td>Virtualization</td><td>Proxmox VE, KVM, ZFS</td></tr>
    <tr><td>Containers</td><td>Docker, Docker Compose, Portainer</td></tr>
    <tr><td>Network</td><td>HAProxy, FortiGate, OpenBSD, Pi-hole</td></tr>
    <tr><td>Systems</td><td>Debian, AlmaLinux / RHEL, Windows Server, Active Directory</td></tr>
  </tbody>
</table>

<h2>Open source</h2>

<ul>
  <li><a href="https://github.com/50bvd/jekyll-infops-theme">jekyll-infops-theme</a> — the Jekyll theme this site runs on</li>
  <li><a href="https://github.com/50bvd/clipboardfilter">ClipboardFilter</a> — secure multi-system clipboard filtering tool</li>
  <li><a href="https://github.com/50bvd/gpubios_rewrite_vfio">gpubios_rewrite_vfio</a> — rewrites an NVIDIA vBIOS dump for VFIO passthrough</li>
  <li>Contributions to <a href="https://github.com/sourcentis/deming">Deming</a> (LDAP fixes, PR #688 and #690)</li>
</ul>

<h2>Contact</h2>

<p>You can find me on <a href="https://github.com/{{ site.author.github }}">GitHub</a>. Comments are open at the bottom of each article.</p>

      </div>
    </article>
  </div>

  {% include sidebar.html %}
</div>
