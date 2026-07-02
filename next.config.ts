import type { NextConfig } from "next";

// Content-Security-Policy: a principal defesa contra scripts injetados (ex.:
// minerador de cripto carregado de um host externo). `script-src 'self'` barra
// qualquer <script src="https://host-malicioso/...">. 'unsafe-inline'/'unsafe-eval'
// são exigidos pelo runtime do Next (sem eles o app quebra), mas o host externo
// continua bloqueado. connect-src libera só as APIs de CEP/CNPJ usadas no browser.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://brasilapi.com.br https://viacep.com.br",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // node-forge e xml-crypto usam APIs nativas do Node; mantém fora do bundle de Server.
  serverExternalPackages: ["node-forge", "xml-crypto", "pg", "@prisma/adapter-pg"],
  poweredByHeader: false, // não expõe "X-Powered-By: Next.js"
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.varitus.com.br" },
      { protocol: "https", hostname: "wallpapers.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
