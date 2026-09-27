# frozen_string_literal: true
#
# _plugins/category_pages.rb — one page per post category at
# /categories/<slug>/ (layout: category), so the category links of the
# sidebar and of each post lead somewhere. No page is generated when no post
# has a category; `theme_config.show_categories: false` turns them off.
module InfopsCategories
  class Generator < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      return if site.config.dig("theme_config", "show_categories") == false
      return unless site.layouts.key?("category")

      site.categories.each_key do |name|
        slug = Jekyll::Utils.slugify(name.to_s)
        next if slug.empty?

        page = Jekyll::PageWithoutAFile.new(site, site.source, File.join("categories", slug), "index.html")
        page.data.merge!(
          "layout"      => "category",
          "category"    => name,
          "title"       => name.to_s,
          "description" => "Posts in the #{name} category"
        )
        site.pages << page
      end
    end
  end
end
