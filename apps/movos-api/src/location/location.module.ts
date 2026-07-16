import { Module } from '@nestjs/common';
import { GoogleMapsAdapter } from './google-maps.adapter';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  controllers: [LocationController],
  providers: [GoogleMapsAdapter, LocationService],
  exports: [LocationService],
})
export class LocationModule {}
