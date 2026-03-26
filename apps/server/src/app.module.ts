import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanningPokerModule } from './planning-poker/planning-poker.module';

@Module({
  imports: [PlanningPokerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
