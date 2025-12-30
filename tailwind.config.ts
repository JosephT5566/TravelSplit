import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./services/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: 'rgb(var(--color-bg) / <alpha-value>)',
                surface: 'rgb(var(--color-surface) / <alpha-value>)',
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                'primary-fg': 'rgb(var(--color-primary-fg) / <alpha-value>)',
                'text-main': 'rgb(var(--color-text-main) / <alpha-value>)',
                'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
                border: 'rgb(var(--color-border) / <alpha-value>)',
            }
        }
    },
    plugins: [],
}

export default config;
