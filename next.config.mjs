/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cross-Origin-Opener-Policy",
          value: "unsafe-none",
        },
      ],
    },
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'hiredis': false,
        'redis-parser': false,
      };
      
      config.externals = [...(config.externals || [])];
    }
    return config;
  },
};

export default nextConfig;
