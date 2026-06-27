import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'bin/flue-codex-doctor': 'bin/flue-codex-doctor.ts',
	},
	format: ['esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	target: 'es2022',
	external: ['@flue/runtime', '@flue/runtime/internal', '@flue/runtime/node'],
});
