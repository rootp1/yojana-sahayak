import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yojana Sahayak — योजना सहायक",
    short_name: "Yojana",
    description: "Find and understand government schemes in Hindi or English",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#c2410c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
