import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Flat config, non type-aware so single files can be linted standalone.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // TypeScript already resolves globals/identifiers; no-undef double-reports them.
      'no-undef': 'off',
    },
  },
);
