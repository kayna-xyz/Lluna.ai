import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['xlsx', '@supabase/supabase-js'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 避免用户主目录等处另有 package-lock 时，Turbopack 把错误目录当成项目根，导致 dev/解析失败
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
