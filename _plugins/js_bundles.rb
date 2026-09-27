# frozen_string_literal: true
#
# _plugins/js_bundles.rb — concatenates the scripts listed in
# _data/js_bundles.yml into assets/js/<name>.bundle.js at build time.
#
# The files are copied verbatim (no Liquid), in order, each followed by a
# semicolon so a file without a trailing one cannot merge with the next.
# The individual files are still published: `theme_config.js_bundles: false`
# makes the layout load them one by one instead.
module InfopsJsBundles
  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      bundles = site.data["js_bundles"]
      return unless bundles.is_a?(Hash)

      bundles.each do |name, files|
        parts = Array(files).map do |rel|
          path = File.join(site.source, rel)
          raise Jekyll::Errors::FatalException, "js_bundles: #{rel} not found" unless File.file?(path)

          "/* ---- #{rel} ---- */\n#{File.read(path, encoding: 'UTF-8').chomp}\n;"
        end
        page = Jekyll::PageWithoutAFile.new(site, site.source, "assets/js", "#{name}.bundle.js")
        page.content = parts.join("\n")
        page.data["layout"] = nil
        page.data["render_with_liquid"] = false
        page.data["sitemap"] = false
        site.pages << page
      end
    end
  end
end
