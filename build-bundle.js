import esbuild from 'esbuild';
import { mkdirSync } from 'fs';
import { execSync } from 'child_process';

const config = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	platform: 'browser',
	format: 'esm',
	sourcemap: 'inline',
};

await Promise.all([
	esbuild.build({
		...config,
		minify: true,
		outfile: 'dist/bundle/rotomeca-event.min.js',
	}),
	esbuild.build({
		...config,
		minify: false,
		outfile: 'dist/bundle/rotomeca-event.js',
	}),
]);

mkdirSync('dist/bundle', { recursive: true });

// Génère un .d.ts groupé avec toutes les déclarations inline
execSync(
	'pnpm exec dts-bundle-generator src/index.ts --out-file=dist/bundle/rotomeca-event.d.ts --external-inlines=@rotomeca/utils',
	{ stdio: 'inherit' },
);

console.log('✓ Bundle généré → dist/bundle/');
