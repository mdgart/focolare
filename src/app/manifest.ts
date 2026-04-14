import type { MetadataRoute } from "next";
import { getPublicLogoUrl } from "@/lib/public-logo-url";

export default function manifest(): MetadataRoute.Manifest {
  const logo = getPublicLogoUrl();
  return {
    name: "Focolare",
    short_name: "Focolare",
    description: "Recipe network with guided cook mode",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#1a0a06",
    icons: [
      {
        src: logo,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: logo,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
