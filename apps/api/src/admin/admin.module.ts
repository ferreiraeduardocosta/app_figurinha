import { Module } from '@nestjs/common';
import { PacotesModule } from '../pacotes/pacotes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PacotesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
