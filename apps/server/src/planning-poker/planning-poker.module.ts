import { Module } from '@nestjs/common';
import { PlanningPokerGateway } from './planning-poker.gateway';
import { PlanningPokerService } from './planning-poker.service';

@Module({
  providers: [PlanningPokerService, PlanningPokerGateway],
  exports: [PlanningPokerService],
})
export class PlanningPokerModule {}
