import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

// WO-ARGOS-049 — sent by the browser after a direct-to-Blob upload
// completes, to persist durable metadata. storagePath is the opaque Blob
// pathname movos-web's upload route issued — WorkOrderAttachmentService
// re-validates MIME/size here too (never trust a single check), it does
// not merely trust the earlier authorize-upload call.
export class CreateWorkOrderAttachmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  storagePath!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  fileSizeBytes!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalFilename?: string;

  @ApiPropertyOptional({
    description:
      'The checklist/resolution WorkOrderEvent this evidence documents, if any.',
  })
  @IsOptional()
  @IsString()
  eventId?: string;
}
