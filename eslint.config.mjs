import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The 3D shop: the client's own project, with its own compiler settings
    // and library versions (shop/README.md).
    "shop/**",
    // Prebuilt bundles served as they are: the shop's and the notebook's.
    "public/**",
  ]),
]);

export default eslintConfig;
