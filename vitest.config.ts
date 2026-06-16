import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', '.next'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                '.next/',
                'src/test/',
                '**/*.d.ts',
            ],
            // Regression floor: set just below the current covered-file numbers
            // (≈53% statements / 54% lines as of this commit). The goal is to
            // block backsliding, not to be brittle — ratchet these upward as
            // coverage of middleware, webhooks, and services improves.
            thresholds: {
                statements: 50,
                branches: 45,
                functions: 48,
                lines: 50,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
