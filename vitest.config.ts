import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		server: {
			deps: {
				inline: ['@rotomeca/utils'],
			},
		},
		coverage: {
			provider: 'v8',

			// ── Périmètre ──────────────────────────────────────────────────────────
			// Inclure tous les fichiers source, même ceux sans aucun test importé.
			// Sans `all: true`, un fichier jamais importé n'apparaît pas du tout
			// dans le rapport → threshold silencieusement ignoré.
			all: true,
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.d.ts',
				'src/**/index.ts',
				'src/lib/interfaces/**',
				'src/lib/decorators/**', // ← décorateurs non testables avec oxc
				'src/lib/documentation/**',
				'src/lib/utils/types.ts', // ← uniquement des types, pas de logique
			],

			// ── Thresholds ─────────────────────────────────────────────────────────
			// perFile: true → chaque fichier doit passer individuellement.
			// Sans cette option, un fichier à 0 % peut être noyé par les autres.
			thresholds: {
				perFile: true,
				functions: 100,
				lines: 80,
				branches: 80,
				statements: 80,
			},

			// ── Reporters ──────────────────────────────────────────────────────────
			// text   → résumé lisible dans le terminal et la CI
			// lcov   → compatible Codecov / SonarQube / GitLab
			// html   → rapport navigable en local (coverage/index.html)
			reporter: ['text', 'lcov', 'html'],
			reportsDirectory: './coverage',
		},
	},
	esbuild: {
		target: 'es2022',
	},
});
