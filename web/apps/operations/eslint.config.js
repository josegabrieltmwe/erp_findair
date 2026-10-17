import vue from "eslint-plugin-vue";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import prettier from "@vue/eslint-config-prettier";
import { i18nGate } from "../../packages/platform/eslint/i18n-no-raw-text.js";

export default [
  ...vue.configs["flat/recommended"],
  ...vueTsEslintConfig(),
  prettier,
  // Gate i18n ('error').
  ...i18nGate("error"),
  {
    rules: {
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
