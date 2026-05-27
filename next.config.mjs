/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: process.env.BASE_PATH || "",
    env: {
        NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH || "",
    },
    output: 'export', // enable static export
};

export default nextConfig;
