import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  server: {
    deps: {
      inline: ['@rotomeca/utils'],
    },
  },
    coverage: {
      provider: "v8",

      // ── Périmètre ──────────────────────────────────────────────────────────
      // Inclure tous les fichiers source, même ceux sans aucun test importé.
      // Sans `all: true`, un fichier jamais importé n'apparaît pas du tout
      // dans le rapport → threshold silencieusement ignoré.
      all: true,
      include: ["src/**/*.ts"],
      exclude: [
        // Fichiers sans code exécutable (uniquement des constantes / regex)
        "lib/constants.ts",
        "lib/regex.ts",
        // Internals non exportés publiquement
        "lib/private/**",
      ],

      // ── Thresholds ─────────────────────────────────────────────────────────
      // perFile: true → chaque fichier doit passer individuellement.
      // Sans cette option, un fichier à 0 % peut être noyé par les autres.
      thresholds: {
        perFile: true,
        functions: 100,
        lines: 90,
        branches: 90,
        statements: 90,
      },

      // ── Reporters ──────────────────────────────────────────────────────────
      // text   → résumé lisible dans le terminal et la CI
      // lcov   → compatible Codecov / SonarQube / GitLab
      // html   → rapport navigable en local (coverage/index.html)
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
  esbuild: {
    target: 'es2022',
  },

});
