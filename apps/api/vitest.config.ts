import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes de integração usam o mesmo banco: um arquivo por vez evita interferência.
    fileParallelism: false,
  },
});
