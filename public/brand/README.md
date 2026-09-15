# Designakum brand assets

Drop the official artwork here. The base name is what the app looks for; the
extension can be `.svg`, `.png`, `.webp`, `.jpg` or `.avif`.

| File | Use |
| --- | --- |
| `wordmark-light.*` | Full logo in white — dark and blue backgrounds (site header, dashboards) |
| `wordmark-brand.*` | Full logo in Designakum blue — black or light backgrounds |
| `wordmark-dark.*` | Full logo in black — light backgrounds, print, invoices |
| `mark-light.*` | Icon only, white |
| `mark-brand.*` | Icon only, blue |
| `mark-dark.*` | Icon only, black |
| `riyal.*` | Official Saudi Riyal symbol, single colour — recoloured in CSS, so export it as a solid black or white glyph |
| `favicon.png` / `icon.png` | 512×512 app icon (optional; falls back to `mark-*`) |

Until a file exists the UI falls back to type — nothing breaks, it simply looks
plainer. `/admin` shows which files are still missing.
