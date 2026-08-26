import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { VnAdminGeoController } from './vn-admin-geo.controller';
import { VnAdminGeoRepository } from './vn-admin-geo.repository';
import { VnAdminGeoService } from './vn-admin-geo.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [VnAdminGeoController],
  providers: [VnAdminGeoRepository, VnAdminGeoService],
  exports: [VnAdminGeoService, VnAdminGeoRepository],
})
export class VnAdminGeoModule {}
