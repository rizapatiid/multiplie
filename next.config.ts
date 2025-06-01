
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      { // Tambahkan ini untuk gambar dari Google Drive
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      // Jika Anda menggunakan lh3.googleusercontent.com untuk preview/thumbnail dari Drive
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      }
    ],
  },
  // Aktifkan server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb', // Sesuaikan jika perlu untuk upload file
    }
  },
};

export default nextConfig;
