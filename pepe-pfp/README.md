# Pepe PFP Builder

A pick-your-traits avatar builder in the style of botpfp.com. Open `index.html` in a browser, or host it as a static page.

## How traits work

Traits are hardcoded layers inside `index.html`. Nothing is generated at runtime. Each trait is one option you pick from a grid.

| Layer | Where it lives |
| --- | --- |
| Option lists | `SHAPES` (drawn traits) and `SWATCH` (colors) |
| Rarity (share of the collection, each list adds up to 100) | `WEIGHTS` |
| Drawing | `background()`, `outfit()`, `eyes()`, `mouth()`, `blush()`, `hat()`, `extra()` |
| Start state | `DEFAULTS` |

To add a trait:

1. Add its id to the list in `SHAPES` (or a color to `SWATCH`).
2. Give it a share in `WEIGHTS`, and lower other entries so the list still adds up to 100.
3. Draw it in the matching function on the 512 × 512 canvas.
4. Add a display name to `OPTION_NAMES` if the id doesn't read well capitalized.

Layer order, from back to front: background, hood, body/outfit, chain, head, cheeks, eyes, mouth, hat, extra, laser beams.

## Sharing

State lives in the URL: `?eyes=degen&extra=headset&background=terminal`, or `#eyes.degen~extra.headset` in the artifact version.

## Trader pack

`btc` and `degen` eyes, `tired` mouth, `headset` extra, and `terminal`, `pump` and `dump` backgrounds. The Roll a trader button picks from these.
