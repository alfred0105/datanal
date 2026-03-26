/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // env가 빌드타임에 없어도 허용 (Vercel에서 런타임에 주입됨)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  },
};

module.exports = nextConfig;
