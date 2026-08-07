import type { MetadataRoute } from "next";

/**
 * The install manifest, for browsers and for the Play listing.
 *
 * Two things here were wrong in a way nothing complains about. The same
 * 1024px logo was declared as both `any` and `maskable`, but a maskable icon is
 * cropped by the platform to a circle or squircle of its choosing — only the
 * middle ~80% survives. Art drawn edge to edge therefore lost its outer ring on
 * Android, and the only symptom was a home-screen icon that looked slightly
 * wrong. `public/icons/maskable-*.png` inset the mark to 60% and fill the rest
 * with the brand colour, since a transparent maskable renders black on some
 * launchers.
 *
 * And a single 1024px source made every install download a megabyte to draw a
 * 48px tile.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /**
     * Pins the app's identity independently of `start_url`. Without it the
     * identity *is* the start URL, so changing that later registers a second,
     * unrelated app and orphans everyone's existing install.
     */
    id: "/",
    name: "Focolare",
    short_name: "Focolare",
    description:
      "Recipes with guided cook mode and a plan that works backwards from dinner time.",
    start_url: "/",
    /** Everything is first-party, so the whole origin stays in the app. */
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf5ec",
    theme_color: "#faf5ec",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    /**
     * Long-press shortcuts. Both are what someone opening this app on a phone
     * is most likely to want, and neither needs a cold navigation through the
     * home page to reach.
     */
    shortcuts: [
      {
        name: "This week's plan",
        short_name: "Plan",
        url: "/plan",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Discover recipes",
        short_name: "Discover",
        url: "/discover",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
