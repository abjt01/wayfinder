// eslint-config-next 16 ships native flat configs, so they are imported
// directly rather than bridged through FlatCompat.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "*.tsbuildinfo"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Catches leftovers such as an import orphaned by a refactor. A leading
      // underscore opts a name out.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Warn, not error. Every current instance is a genuine subscription to
      // something outside React — matchMedia, scroll position, an rAF tween,
      // and zustand's localStorage hydration — which is the case the rule
      // itself carves out, but it cannot see that through the store's API.
      // useHydrated in particular is load-bearing: without its effect the
      // production prerender fails. Left visible so new ones get a second look
      // rather than silently joining the pile.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
