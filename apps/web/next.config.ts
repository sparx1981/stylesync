import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
      // better-sqlite3 is a native module — must not be bundled by webpack/turbopack,
      // it has to run as a real Node addon on the server.
      serverExternalPackages: ['better-sqlite3', '@stylesync/core'],
      images: {
              // Reference screenshots live on disk under data/refs, served via the
        // /api/asset route below rather than next/image remote patterns.
        unoptimized: true,
      },
};

export default nextConfig;
