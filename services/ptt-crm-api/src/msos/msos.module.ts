import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffMsosGuard } from './guards/staff-msos.guard';
import { MsosController } from './msos.controller';
import { MsosRepository } from './msos.repository';
import { MsosService } from './msos.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [MsosController],
  providers: [MsosService, MsosRepository, StaffMsosGuard],
})
export class MsosModule {}
