import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  poweredByHeader: false,
  webpack(config, { isServer, dev }) {
    if (!isServer) {
      if (!dev) config.output.workerPublicPath = '/tools/_next/'
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
}

export default config
