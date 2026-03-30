## Docker

### Développement (livereload)

```bash
docker compose up
# → http://localhost:4000
```

Les sources sont montées en volume — tout changement est pris en compte en temps réel sans rebuild du container.

### Production (nginx)

```bash
docker compose -f docker-compose.prod.yml up -d --build
# → http://localhost
```

Build le site statique avec `JEKYLL_ENV=production`, puis le sert via nginx avec headers de sécurité et compression gzip.
