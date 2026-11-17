import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';

/** Pasta da página do painel (apps/api/admin), a mesma rodando de src/ ou de dist/. */
const PASTA_ADMIN = resolve(__dirname, '../admin');

/**
 * Configuração comum do app (usada pelo main.ts e pelos testes):
 * CORS opcional e a página do painel em /admin com cabeçalhos de segurança.
 */
export function configurarApp(app: NestExpressApplication) {
  const origens = process.env.CORS_ORIGENS?.split(',').map((o) => o.trim()).filter(Boolean);
  if (origens?.length) app.enableCors({ origin: origens });

  app.use('/admin', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
        "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // As rotas da API em /admin/* (JSON) seguem para o Nest; o resto é a página.
    next();
  });
  app.useStaticAssets(PASTA_ADMIN, { prefix: '/admin/', index: 'index.html', redirect: true });
}
