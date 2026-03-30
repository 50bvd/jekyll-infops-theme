source "https://rubygems.org"

# Jekyll
gem "jekyll", "~> 4.3.0"

# Dart Sass — remplace sassc (LibSass déprécié), supporte @use/@forward
gem "jekyll-sass-converter", "~> 3.0"

# Plugins
group :jekyll_plugins do
  gem "jekyll-feed",              "~> 0.12"
  gem "jekyll-sitemap"
  gem "jekyll-seo-tag"
  gem "jekyll-paginate"
  gem "jekyll-relative-links"
end

# Dev
group :development do
  gem "webrick", "~> 1.7"
end

# Windows / JRuby timezone data
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo",      ">= 1", "< 3"
  gem "tzinfo-data"
end

# Windows directory watcher
gem "wdm", "~> 0.1.1", platforms: [:mingw, :x64_mingw, :mswin]
