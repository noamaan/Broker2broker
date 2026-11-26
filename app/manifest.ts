import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Broker2Broker — Property Network",
    short_name: "Broker2Broker",
    description: "The local network for real estate brokers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#102744",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
