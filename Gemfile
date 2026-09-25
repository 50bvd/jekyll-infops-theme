source "https://rubygems.org"

# Jekyll
gem "jekyll", "~> 4.4"

# Dart Sass (sass-embedded) — replaces sassc/LibSass, supports @use/@forward
gem "jekyll-sass-converter", "~> 3.1"

# Plugins
group :jekyll_plugins do
  gem "jekyll-feed",           "~> 0.17"
  gem "jekyll-sitemap",        "~> 1.4"
  gem "jekyll-seo-tag",        "~> 2.9"
  gem "jekyll-paginate",       "~> 1.1"
  gem "jekyll-relative-links", "~> 0.7"
end

# Gems removed from the Ruby stdlib as of 3.4/3.5
gem "csv"
gem "base64"
gem "bigdecimal"
gem "logger"

# Dev server (Ruby ≥ 3.0 no longer bundles webrick)
gem "webrick", "~> 1.9"

# Windows / JRuby timezone data
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo",      ">= 1", "< 3"
  gem "tzinfo-data"
end

# Windows directory watcher
gem "wdm", "~> 0.2", platforms: [:mingw, :x64_mingw, :mswin]
