import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los cobros siguen en pruebas: master y Vercel Production siempre los ocultan.
  ...((process.env.VERCEL_ENV === "production" || process.env.VERCEL_GIT_COMMIT_REF === "master") ? {
    env: { NEXT_PUBLIC_MERCADOPAGO_ENABLED: "false" },
  } : {}),
};

export default nextConfig;
