/**
 * Carrega clubes e as figurinhas de cada temporada (data/temporadaN) no banco.
 * Idempotente: pode rodar várias vezes.
 *
 * Com --se-vazio (usado ao subir o container), só carrega temporadas que ainda não têm
 * figurinhas no banco: assim edições feitas pelo painel nunca são sobrescritas, e uma
 * temporada nova colocada em data/ entra no próximo deploy.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, Raridade, TipoFigurinha } from '@prisma/client';

const prisma = new PrismaClient();
const DADOS = resolve(__dirname, '../../../data');

interface DadosTemporada {
  numero: number;
  nome: string;
  requisito: number | null;
  publicada: boolean;
}

const ler = <T>(arquivo: string): T => JSON.parse(readFileSync(arquivo, 'utf8'));

async function main() {
  const seVazio = process.argv.includes('--se-vazio');
  const pastas = readdirSync(DADOS)
    .filter((p) => /^temporada\d+$/.test(p) && existsSync(resolve(DADOS, p, 'temporada.json')))
    .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)));

  for (const pasta of pastas) {
    const dir = resolve(DADOS, pasta);
    const t = ler<DadosTemporada>(resolve(dir, 'temporada.json'));
    if (seVazio && (await prisma.figurinha.count({ where: { temporada: t.numero } })) > 0) {
      console.log(`Seed: temporada ${t.numero} já carregada, nada a fazer.`);
      continue;
    }
    await prisma.temporada.upsert({
      where: { numero: t.numero },
      create: { numero: t.numero, nome: t.nome, requisito: t.requisito, publicada: t.publicada },
      update: { nome: t.nome, requisito: t.requisito, publicada: t.publicada },
    });

    if (existsSync(resolve(dir, 'clubes.json'))) {
      for (const c of ler<any[]>(resolve(dir, 'clubes.json'))) {
        const dados = {
          nome: c.nome,
          cidade: c.cidade,
          corPrimaria: c.cores[0],
          corSecundaria: c.cores[1],
          estadio: c.estadio,
          capacidade: c.capacidade,
          mascote: c.mascote,
          lema: c.lema,
          identidade: c.identidade,
          temporada: t.numero,
        };
        await prisma.clube.upsert({ where: { sigla: c.sigla }, create: { sigla: c.sigla, ...dados }, update: dados });
      }
    }

    const figurinhas = ler<any[]>(resolve(dir, 'figurinhas.json'));
    for (const f of figurinhas) {
      const a = 'atributos' in f ? f.atributos : undefined;
      const dados = {
        numero: f.numero,
        temporada: t.numero,
        secao: f.secao,
        clubeSigla: f.clube,
        tipo: f.tipo as TipoFigurinha,
        raridade: f.raridade as Raridade,
        nome: f.nome,
        apelido: f.apelido,
        posicao: f.posicao,
        camisa: f.camisa,
        idade: f.idade,
        destaque: f.destaque,
        historia: f.historia,
        descricaoVisual: f.descricaoVisual,
        ataque: a?.ata ?? null,
        defesa: a?.def ?? null,
        tecnica: a?.tec ?? null,
        velocidade: a?.vel ?? null,
        fisico: a?.fis ?? null,
      };
      await prisma.figurinha.upsert({ where: { codigo: f.codigo }, create: { codigo: f.codigo, ...dados }, update: dados });
    }
    console.log(`Seed: temporada ${t.numero} com ${figurinhas.length} figurinhas.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
