import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
	reactCompiler: true,
	async rewrites() {
		return {
			beforeFiles: [
				{
					source: '/api/:path*',
					destination: `${API_ORIGIN}/api/:path*`,
				},
			],
			afterFiles: [],
			fallback: [],
		};
	},
};

export default nextConfig;
