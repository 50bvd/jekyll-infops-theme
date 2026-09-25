# frozen_string_literal: true
#
# _plugins/goatcounter_stats.rb
# Fetches the GoatCounter unique-visitor count of the last 30 days once, at
# build time, and exposes it as site.goatcounter_visitors (used by
# _includes/widget-stats.html). No request is made from the visitor's browser.
# Needs outbound HTTPS during the build (ca-certificates in the Docker image).
require "net/http"
require "json"
require "date"

Jekyll::Hooks.register :site, :after_reset do |site|
  code = site.config.dig("analytics", "goatcounter_code").to_s
  next if code.empty? || code !~ /\A[a-z0-9-]+\z/i

  begin
    end_date   = Date.today
    start_date = end_date - 30
    uri = URI("https://#{code}.goatcounter.com/counter//.json?start=#{start_date}&end=#{end_date}")

    Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 5) do |http|
      res = http.get(uri.request_uri)
      if res.is_a?(Net::HTTPSuccess)
        data  = JSON.parse(res.body)
        count = (data["count_unique"] || data["count"] || "0").to_s.delete(",   ").to_i
        site.config["goatcounter_visitors"] = count
      else
        Jekyll.logger.warn "goatcounter_stats:", "HTTP #{res.code}"
      end
    end
  rescue StandardError => e
    Jekyll.logger.warn "goatcounter_stats:", "fetch failed (#{e.message})"
  end
end
