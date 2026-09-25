# frozen_string_literal: true
#
# _plugins/cover_images.rb — article cover images
#
# For every post:
#   · custom cover — front matter `image:` (+ optional `image_light:` for the
#     light theme) pointing to a file that exists → used as is;
#   · otherwise a cover is generated at build time from the title, the tags,
#     the site name and the date, in a dark and a light variant (SVG,
#     1200×630). When `rsvg-convert` is available (it is in the Docker image),
#     a PNG copy is also produced and used for Open Graph / Twitter cards,
#     since social networks don't accept SVG.
#
# Exposes page.cover, page.cover_light and page.cover_generated to templates
# (see _includes/cover.html). Config: theme_config.covers (see _config.yml).
require "cgi"
require "fileutils"
require "open3"

module InfopsCovers
  W = 1200
  H = 630
  OUT_DIR = "assets/images/covers"

  PALETTES = {
    "dark" => {
      bg: "#0d1117", grid: "rgba(88,166,255,0.07)", orb1: "#58a6ff", orb2: "#a5a5ff",
      title: "#e6edf3", muted: "#8b949e", accent: "#58a6ff", tag_bg: "rgba(88,166,255,0.12)",
      tag_border: "rgba(88,166,255,0.35)", g1: "#58a6ff", g2: "#a5a5ff", g3: "#56d364"
    },
    "light" => {
      bg: "#eef2f8", grid: "rgba(37,99,235,0.08)", orb1: "#2563eb", orb2: "#7c3aed",
      title: "#111827", muted: "#4b5563", accent: "#2563eb", tag_bg: "rgba(37,99,235,0.08)",
      tag_border: "rgba(37,99,235,0.3)", g1: "#2563eb", g2: "#7c3aed", g3: "#0891b2"
    }
  }.freeze

  module_function

  def esc(str)
    CGI.escapeHTML(str.to_s)
  end

  def source_file?(site, path)
    return false if path.nil? || path.to_s.strip.empty? || path.to_s =~ %r{\A[a-z]+://}i
    File.file?(File.join(site.source, path.to_s.sub(%r{\A/}, "")))
  end

  # Greedy word wrap on an estimated glyph width
  def wrap(text, font_size, max_width, max_lines)
    max_chars = [(max_width / (font_size * 0.62)).floor, 8].max   # bold sans ≈ 0.6 em per glyph
    lines = [""]
    text.split(/\s+/).each do |word|
      candidate = lines.last.empty? ? word : "#{lines.last} #{word}"
      if candidate.length <= max_chars
        lines[-1] = candidate
      else
        lines << word
      end
    end
    if lines.length > max_lines
      lines = lines.first(max_lines)
      lines[-1] = lines[-1].sub(/\s*\S*\z/, "") + " …"
    end
    lines
  end

  def svg(site, post, theme)
    c     = PALETTES[theme]
    title = post.data["title"].to_s
    tags  = Array(post.data["tags"]).first(5).map { |t| "##{t}" }
    date  = post.date.strftime("%b %d, %Y")
    host  = site.config["url"].to_s.sub(%r{\Ahttps?://}, "").sub(%r{/\z}, "")
    host  = site.config["title"].to_s if host.empty?
    brand = site.config["title"].to_s

    size  = if title.length <= 38 then 68 elsif title.length <= 70 then 58 else 50 end
    lines = wrap(title, size, 1040, 4)
    lh    = (size * 1.18).round
    top   = 210 + [(4 - lines.length), 0].max * (lh / 2)
    title_svg = lines.each_with_index.map do |l, i|
      %(<text x="80" y="#{top + i * lh}" font-size="#{size}" font-weight="800" fill="#{c[:title]}" font-family="Inter, 'Segoe UI', 'DejaVu Sans', Arial, sans-serif" letter-spacing="-1">#{esc(l)}</text>)
    end.join("\n  ")

    x = 80
    tags_svg = tags.map do |t|
      w = (t.length * 13.2 + 34).round
      break_out = x + w > W - 80
      next "" if break_out
      s = %(<rect x="#{x}" y="520" width="#{w}" height="44" rx="22" fill="#{c[:tag_bg]}" stroke="#{c[:tag_border]}"/>) +
          %(<text x="#{x + w / 2}" y="549" font-size="22" text-anchor="middle" fill="#{c[:accent]}" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace">#{esc(t)}</text>)
      x += w + 14
      s
    end.join("\n  ")

    <<~SVG
      <svg xmlns="http://www.w3.org/2000/svg" width="#{W}" height="#{H}" viewBox="0 0 #{W} #{H}" role="img" aria-label="#{esc(title)}">
        <defs>
          <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#{c[:g1]}"/><stop offset="0.5" stop-color="#{c[:g2]}"/><stop offset="1" stop-color="#{c[:g3]}"/>
          </linearGradient>
          <radialGradient id="o1" cx="0.12" cy="0.1" r="0.55">
            <stop offset="0" stop-color="#{c[:orb1]}" stop-opacity="0.28"/><stop offset="1" stop-color="#{c[:orb1]}" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="o2" cx="0.92" cy="0.95" r="0.55">
            <stop offset="0" stop-color="#{c[:orb2]}" stop-opacity="0.22"/><stop offset="1" stop-color="#{c[:orb2]}" stop-opacity="0"/>
          </radialGradient>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#{c[:grid]}" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="#{W}" height="#{H}" fill="#{c[:bg]}"/>
        <rect width="#{W}" height="#{H}" fill="url(#grid)"/>
        <rect width="#{W}" height="#{H}" fill="url(#o1)"/>
        <rect width="#{W}" height="#{H}" fill="url(#o2)"/>
        <rect width="#{W}" height="8" fill="url(#bar)"/>
        <circle cx="92" cy="92" r="9" fill="#ff5f56"/><circle cx="122" cy="92" r="9" fill="#ffbd2e"/><circle cx="152" cy="92" r="9" fill="#27ca3f"/>
        <text x="184" y="100" font-size="24" fill="#{c[:accent]}" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace">~/#{esc(brand)} $</text>
        #{title_svg}
        #{tags_svg}
        <text x="#{W - 80}" y="100" font-size="22" text-anchor="end" fill="#{c[:muted]}" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace">#{esc(date)}</text>
        <text x="#{W - 80}" y="#{H - 40}" font-size="22" text-anchor="end" fill="#{c[:muted]}" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace">#{esc(host)}</text>
      </svg>
    SVG
  end

  def rsvg?
    return @rsvg unless @rsvg.nil?
    @rsvg = system("command -v rsvg-convert >/dev/null 2>&1")
  end

  class Generator < Jekyll::Generator
    priority :low

    def generate(site)
      cfg = site.config.dig("theme_config", "covers") || {}
      return if cfg["enabled"] == false

      site.config["infops_generated_covers"] = []
      site.posts.docs.each do |post|
        custom = post.data["image"]
        custom = custom["path"] if custom.is_a?(Hash)
        if InfopsCovers.source_file?(site, custom)
          post.data["cover"] = custom
          light = post.data["image_light"]
          post.data["cover_light"] = light if InfopsCovers.source_file?(site, light)
          next
        end

        name = post.basename_without_ext
        %w[dark light].each do |theme|
          page = Jekyll::PageWithoutAFile.new(site, site.source, OUT_DIR, "#{name}-#{theme}.svg")
          page.content = InfopsCovers.svg(site, post, theme)
          page.data["layout"] = nil
          page.data["sitemap"] = false
          site.pages << page
        end
        post.data["cover"]           = "/#{OUT_DIR}/#{name}-dark.svg"
        post.data["cover_light"]     = "/#{OUT_DIR}/#{name}-light.svg"
        post.data["cover_generated"] = true

        # Open Graph needs a raster image: PNG rendered after the site is written
        if cfg["png"] != false && InfopsCovers.rsvg?
          post.data["image"] = "/#{OUT_DIR}/#{name}.png"
          site.config["infops_generated_covers"] << name
        else
          post.data.delete("image") # the configured file is missing: don't advertise it
        end
      end
    end
  end
end

Jekyll::Hooks.register :site, :post_write do |site|
  names = site.config["infops_generated_covers"] || []
  next if names.empty?

  dir = File.join(site.dest, InfopsCovers::OUT_DIR)
  names.each do |name|
    svg = File.join(dir, "#{name}-dark.svg")
    png = File.join(dir, "#{name}.png")
    next unless File.file?(svg)

    _out, err, status = Open3.capture3("rsvg-convert", "-w", InfopsCovers::W.to_s, "-h", InfopsCovers::H.to_s, "-o", png, svg)
    Jekyll.logger.warn("cover_images:", "PNG failed for #{name}: #{err.strip}") unless status.success?
  end
end
