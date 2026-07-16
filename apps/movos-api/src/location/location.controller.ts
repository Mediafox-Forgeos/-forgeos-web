import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  LocationSuggestion,
  ResolvedLocation,
} from '@mediafox/shared-types';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AutocompleteQueryDto } from './dto/autocomplete-query.dto';
import { PlaceQueryDto } from './dto/place-query.dto';
import { LocationService } from './location.service';

@ApiTags('locations')
@ApiHeader({
  name: 'Authorization',
  description: 'Bearer access token',
  required: true,
})
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Get('autocomplete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Debounced address autocomplete via Google Places' })
  async autocomplete(
    @Query() query: AutocompleteQueryDto,
  ): Promise<LocationSuggestion[]> {
    return this.location.autocomplete(
      query.input,
      query.sessionToken,
      query.region,
      query.language,
    );
  }

  @Get('place/:placeId')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resolve a place ID to normalized location data' })
  async getPlace(
    @Param('placeId') placeId: string,
    @Query() query: PlaceQueryDto,
  ): Promise<ResolvedLocation | null> {
    return this.location.resolvePlace(
      placeId,
      query.sessionToken,
      query.language,
    );
  }
}
