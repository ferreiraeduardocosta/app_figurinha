import { Global, Module } from '@nestjs/common';
import { MissoesController } from './missoes.controller';
import { MissoesService } from './missoes.service';

@Global()
@Module({
  controllers: [MissoesController],
  providers: [MissoesService],
  exports: [MissoesService],
})
export class MissoesModule {}
