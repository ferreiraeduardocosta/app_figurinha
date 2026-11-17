import { Module } from '@nestjs/common';
import { PacotesService } from './pacotes.service';

// Os endpoints de pacote e balcão entram junto com a autenticação (próximo passo da Fase 1).
@Module({
  providers: [PacotesService],
  exports: [PacotesService],
})
export class PacotesModule {}
