import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';
import { PASTA_ARTES } from './catalogo/artes';

/** Pasta da página do painel (apps/api/admin), a mesma rodando de src/ ou de dist/. */
const PASTA_ADMIN = resolve(__dirname, '../admin');

/**
 * Configuração comum do app (usada pelo main.ts e pelos testes):
 * CORS opcional e a página do painel em /admin com cabeçalhos de segurança.
 */
export function configurarApp(app: NestExpressApplication) {
  // Atrás do proxy da hospedagem, o IP do jogador vem no cabeçalho X-Forwarded-For.
  // Sem isto, o limite de pedidos trataria todos os jogadores como um só.
  // TRUST_PROXY = número de proxies na frente da API (normalmente 1).
  const proxies = Number(process.env.TRUST_PROXY ?? 0);
  if (proxies > 0) app.set('trust proxy', proxies);

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
  // Artes das figurinhas. O nome do arquivo muda quando a arte muda, então dá para guardar em cache para sempre.
  app.useStaticAssets(PASTA_ARTES, {
    prefix: '/artes/',
    index: false,
    immutable: true,
    maxAge: '365d',
    setHeaders: (res: Response) => res.setHeader('Access-Control-Allow-Origin', '*'),
  });
}
