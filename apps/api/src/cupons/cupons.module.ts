import { Module } from '@nestjs/common';
import { CuponsAdminController, CuponsController } from './cupons.controller';
import { CuponsService } from './cupons.service';

@Module({
  controllers: [CuponsController, CuponsAdminController],
  providers: [CuponsService],
})
export class CuponsModule {}
