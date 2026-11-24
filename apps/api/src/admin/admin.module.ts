import { Module } from '@nestjs/common';
import { LigaModule } from '../liga/liga.module';
import { SocialModule } from '../social/social.module';
import { PacotesModule } from '../pacotes/pacotes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TestesService } from './testes.service';

@Module({
  imports: [PacotesModule, LigaModule, SocialModule],
  controllers: [AdminController],
  providers: [AdminService, TestesService],
})
export class AdminModule {}
