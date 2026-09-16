# Designakum brand assets

Drop the official artwork here. The base name is what the app looks for; the
extension can be `.svg`, `.png`, `.webp`, `.jpg` or `.avif`.

| File | Use |
| --- | --- |
| `wordmark-light.*` | **The logo.** White, for dark and blue backgrounds — header, dashboards, footers |
| `wordmark-brand.*` | Full logo in Designakum blue — black or light backgrounds |
| `wordmark-dark.*` | Full logo in black — light backgrounds, print, invoices |
| `mark-light.*` | Icon only, white — **favicon and app icon only**, never beside the wordmark |
| `mark-brand.*` | Icon only, blue |
| `mark-dark.*` | Icon only, black |
| `welcome-ar.*` | “Ahlan wa sahlan” calligraphy — welcome and language screens |
| `riyal.*` | Official Saudi Riyal symbol, single colour — recoloured in CSS, so export it as a solid black or white glyph |
| `favicon.png` / `icon.png` | 512×512 app icon (optional; falls back to `mark-*`) |

Until a file exists the UI falls back to type — nothing breaks, it simply looks
plainer. `/admin` shows which files are still missing.

## Where these came from

The current files were built from the master artwork in `~/Downloads/ديزاينكم
بدون خلفية` and `~/Downloads/ديزاينكم بخلفية`.

Those masters are **not transparent** despite the folder name — they are RGB,
flattened onto near-black — so they cannot be dropped in directly. Each asset
here was un-mixed: given a flat background `B` and a flat artwork colour `F`,
every pixel `C` solves `C = a*F + (1-a)*B` for the coverage `a`, which recovers a
real alpha channel with the antialiasing intact. Then trimmed to the ink and
resized.

If the artwork is ever re-exported, export it with genuine transparency and this
step disappears. Otherwise repeat it — a straight copy puts a black plate behind
every logo on the site.
