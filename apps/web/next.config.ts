import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // better-sqlite3 is a native module — must not be bundled by webpack/turbopack,
    // it has to run as a real Node addon on the server.
    serverExternalPackages: ['better-sqlite3', '@stylesync/core'],
    // Next's output file tracing can't see `readFileSync(join(__dirname, '*.sql'))`
    // calls inside @stylesync/core (a workspace package reached through a pnpm
    // symlink), so the schema files never made it into the deployed serverless
    // function bundle. Force-include them explicitly.
    outputFileTracingIncludes: {
          '/**': ['../../packages/core/dist/db/*.sql'],
    },
    images: {
          // Reference screenshots live on disk under data/refs, served via the
      // /api/asset route below rather than next/image remote patterns.
      unoptimized: true,
    },
};

export default nextConfig;
