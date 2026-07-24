/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ["frontend/**", "backend/**", ".next/**", "node_modules/**"],
  },
];

module.exports = config;
