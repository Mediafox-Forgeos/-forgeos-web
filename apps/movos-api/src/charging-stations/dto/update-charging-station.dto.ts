import { PartialType } from '@nestjs/swagger';

import { CreateChargingStationDto } from './create-charging-station.dto';

export class UpdateChargingStationDto extends PartialType(
  CreateChargingStationDto,
) {}
