import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/",
      "index.html", // build output of build.js
      "coverage/", // c8 output of npm run coverage
    ],
  },
  js.configs.recommended,
  {
    // Browser sources: ES modules that build.js bundles into one classic <script>. QB_BUILT is defined by the bundler.
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, QB_BUILT: "readonly" },
    },
  },
  {
    // Node test scripts (ES modules). `window` is the real one inside Playwright page.evaluate() callbacks in the four
    // Playwright scripts (smoke.js, a11y.js, shot.js, reader.js).
    files: ["test/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node, window: "readonly" },
    },
  },
  {
    files: ["*.mjs", "build.js", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  prettier, // keep last: turns off rules that conflict with Prettier formatting
];
