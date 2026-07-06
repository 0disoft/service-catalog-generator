import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly",
  URL: "readonly"
};

export default [
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**", "packages/*/dist/**"]
  },
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: nodeGlobals
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended
];
