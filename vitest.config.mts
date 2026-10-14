import { defineConfig } from 'vitest/config';

export default defineConfig({
	// Mocking n8n-workflow makes vite load its dist, whose source maps point to missing files.
	logLevel: 'error',
	test: {
		projects: [
			{
				test: {
					name: 'unit',
					include: ['test/unit/**/*.test.ts'],
				},
			},
			{
				test: {
					name: 'automation',
					include: ['test/automation/**/*.test.ts'],
					globalSetup: ['test/automation/setup.ts'],
					testTimeout: 180_000,
					hookTimeout: 180_000,
					// One n8n folder and one test room: run workflows one after another.
					fileParallelism: false,
				},
			},
		],
	},
});
