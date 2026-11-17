/**
 * Dá (ou tira) o papel de administrador de uma conta já cadastrada.
 * Roda só no servidor, com acesso ao banco: o app nunca promove ninguém.
 *
 *   npm run admin:promover -- pessoa@exemplo.com
 *   npm run admin:promover -- pessoa@exemplo.com --remover
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const [email, opcao] = process.argv.slice(2);
  if (!email) {
    console.error('Uso: npm run admin:promover -- <email> [--remover]');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const papel = opcao === '--remover' ? 'JOGADOR' : 'ADMIN';
    const u = await prisma.usuario.update({ where: { email: email.toLowerCase() }, data: { papel } });
    console.log(`${u.apelido} <${u.email}> agora é ${papel}.`);
  } catch {
    console.error(`Nenhuma conta com o e-mail ${email}.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
