import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // TS-04: Reglas de accesibilidad WCAG 2.2 - Principio Perceptible
      // Enfocadas en usuarios con baja visión
      'jsx-a11y/alt-text': 'error',                    // Imágenes deben tener alt
      'jsx-a11y/label-has-associated-control': 'error', // Labels asociados a inputs
      'jsx-a11y/no-autofocus': 'warn',                  // Evitar autofocus inesperado
      'jsx-a11y/interactive-supports-focus': 'error',   // Elementos interactivos con foco
      'jsx-a11y/click-events-have-key-events': 'error', // Click debe tener equivalente teclado
      'jsx-a11y/aria-props': 'error',                   // Props aria válidos
      'jsx-a11y/aria-proptypes': 'error',               // Tipos de props aria correctos
      'jsx-a11y/aria-unsupported-elements': 'error',    // No usar aria en elementos no soportados
      'jsx-a11y/role-has-required-aria-props': 'error', // Roles con sus aria requeridos
      'jsx-a11y/anchor-is-valid': 'warn',               // Links con href válido
    },
  },
]
