/**
 * Carrega clubes e figurinhas da Temporada 1 (data/temporada1) no banco.
 * Idempotente: pode rodar várias vezes.
 */
import { PrismaClient, Raridade, TipoFigurinha } from '@prisma/client';
import clubes from '../../../data/temporada1/clubes.json';
import figurinhas from '../../../data/temporada1/figurinhas.json';

const prisma = new PrismaClient();

async function main() {
  // Com --se-vazio (usado ao subir o container), não mexe num banco que já tem
  // figurinhas: assim edições feitas pelo painel nunca são sobrescritas.
  if (process.argv.includes('--se-vazio') && (await prisma.figurinha.count()) > 0) {
    console.log('Seed: banco já tem figurinhas, nada a fazer.');
    return;
  }
  for (const c of clubes) {
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
    };
    await prisma.clube.upsert({ where: { sigla: c.sigla }, create: { sigla: c.sigla, ...dados }, update: dados });
  }

  for (const f of figurinhas) {
    const a = 'atributos' in f ? f.atributos : undefined;
    const dados = {
      numero: f.numero,
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

  console.log(`Seed: ${clubes.length} clubes e ${figurinhas.length} figurinhas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
