# Home hero — ocean voyage sample photos

Real photography (Unsplash License). Use with a dark gradient overlay so white hero text stays readable (same pattern as `shipyard-dock-hero.webp` on `/ship-repair-korea`).

## Recommended (primary)

| File | Description | Credit |
|------|-------------|--------|
| `ocean-voyage-hero-sample.jpg` / `.webp` | Container ship on open ocean, horizon, bright sky — strong “at sea” hero | [Gunnar Ridderström](https://unsplash.com/photos/a-large-cargo-ship-sails-on-the-open-ocean-y-H_RkF-01k) |

## Alternates

| File | Description | Credit |
|------|-------------|--------|
| `ocean-voyage-hero-alt-vast-blue.jpg` / `.webp` | Aerial — ship on **vast deep blue** ocean | [Aynur Bulatov](https://unsplash.com/photos/a-cargo-ship-sails-across-a-vast-deep-blue-ocean-OdLuE1AUq9o) |
| `ocean-voyage-hero-alt-bulk-carrier.jpg` | Bulk carrier centered in open water, moodier tones | [Unsplash](https://unsplash.com/photos/a-large-cargo-ship-in-the-middle-of-the-ocean--ANLkO7F7UI) |

## Set B — different mood / composition (2026-09-20)

| File | Why try it | Credit |
|------|------------|--------|
| `set-b/ocean-voyage-setb-horizon-alone.*` | **Small ship on the horizon** — lots of open sea & sky; text-friendly negative space | [Thomas Marquize](https://unsplash.com/photos/a-container-ship-sails-alone-in-the-ocean-NA1ESlGA3Lw) |
| `set-b/ocean-voyage-setb-sunset-fjord.*` | **Golden-hour cargo ship** — warm, premium brand feel (Norway fjord) | [Vidar Nordli-Mathisen](https://unsplash.com/photos/cargo-ship-sailing-on-water-at-sunset-yZZKpWTd-3M) |
| `set-b/ocean-voyage-setb-wake-trail.*` | **Wake & deep blue** — motion / voyage (ferry wake, Tangier) | [Gunnar Ridderström](https://unsplash.com/photos/wake-of-a-boat-on-the-deep-blue-ocean-FYdzLpKei28) |
| `set-b/ocean-voyage-setb-soft-sunset-fleet.*` | Soft sunset, multiple hulls — more “fleet / trade lane” | [Truong Tuyet Ly](https://unsplash.com/photos/cargo-ships-at-sea-during-a-soft-sunset-b5tWF3qsrBM) |
| `set-b/ocean-voyage-setb-montevideo.*` | Bulk carrier, open water — calm industrial | [Unsplash](https://unsplash.com/photos/a-large-cargo-ship-in-the-middle-of-the-ocean-7XHo4D_iH_w) |

License: [Unsplash License](https://unsplash.com/license) (free for commercial use; attribution appreciated, not required).

**Applied draft (2026-09-20):** home `#hero` uses `hero-ocean-voyage-draft` + `/assets/images/home-ocean-hero-horizon.webp` (from `set-b/ocean-voyage-setb-horizon-alone`).

Suggested CSS (home hero):

```css
body.home-page #hero.home-hero {
  background-color: #0a1128;
  background-image: linear-gradient(rgba(10, 17, 40, 0.82), rgba(15, 23, 42, 0.92)),
    url('/assets/images/samples/ocean-voyage-hero-sample.webp');
  background-size: cover;
  background-position: center 40%;
}
```
