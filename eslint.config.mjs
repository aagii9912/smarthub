import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "e2e-screenshots/**",
      "*.html",
      "tsconfig.tsbuildinfo",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-unused-vars": "off",
      "prefer-const": "off",
    },
    linterOptions: {
      // The codebase has stale eslint-disable comments from older rule sets.
      // Don't double-report on those — focus on real issues.
      reportUnusedDisableDirectives: "off",
    },
  },
];
