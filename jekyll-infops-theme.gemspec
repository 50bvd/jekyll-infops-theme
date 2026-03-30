Gem::Specification.new do |spec|
  spec.name          = "jekyll-infops-theme"
  spec.version       = "1.0.0"
  spec.authors       = ["50bvd"]
  spec.email         = [""]

  spec.summary       = "A modern Jekyll theme for DevOps, SysOps and infrastructure engineers."
  spec.description   = "jekyll-infops-theme is a feature-rich Jekyll theme with interactive " \
                       "canvas background, dark/light mode, CRT-style terminal with 4 canvas games, " \
                       "syntax highlighting, auto-generated TOC, client-side search, callout blocks, " \
                       "analytics support (GoatCounter, GA4, Plausible, Umami), and full " \
                       "customization via _config.yml and _data/theme.yml."
  spec.homepage      = "https://github.com/50bvd/jekyll-infops-theme"
  spec.license       = "MIT"

  spec.files = `git ls-files -z`.split("\x0").select do |f|
    f.match(%r!^(assets|_includes|_layouts|_sass|_data|pages|_posts|LICENSE|README)!i)
  end

  spec.add_runtime_dependency "jekyll",                "~> 4.3"
  spec.add_runtime_dependency "jekyll-sass-converter", "~> 3.0"
  spec.add_runtime_dependency "jekyll-feed",           "~> 0.12"
  spec.add_runtime_dependency "jekyll-sitemap"
  spec.add_runtime_dependency "jekyll-seo-tag"
  spec.add_runtime_dependency "jekyll-paginate"
  spec.add_runtime_dependency "jekyll-relative-links"
end
