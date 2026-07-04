import { defineConfig } from 'tsup';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		provider: 'src/provider/index.ts',
		diagnostics: 'src/diagnostics/index.ts',
		auth: 'src/auth/index.ts',
		runtime: 'src/runtime/index.ts',
		models: 'src/models/index.ts',
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
