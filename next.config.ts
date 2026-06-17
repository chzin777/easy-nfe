import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-forge e xml-crypto usam APIs nativas do Node; mantém fora do bundle de Server.
  serverExternalPackages: ["node-forge", "xml-crypto", "pg", "@prisma/adapter-pg"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "www.varitus.com.br" }],
  },
};

export default nextConfig;
