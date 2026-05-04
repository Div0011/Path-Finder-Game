/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/Path-Finder-Game' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Path-Finder-Game/' : '',
};

export default nextConfig;
