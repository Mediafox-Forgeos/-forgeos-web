import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

// WO-ARGOS-049 — called by movos-web's upload route, server-to-server,
// before it mints a Blob client upload token. The real MIME/size
// enforcement happens in WorkOrderAttachmentService against the same
// shared-types constants movos-web's own token constraints use — this DTO
// only validates shape, not the allow-list itself.
export class AuthorizeAttachmentUploadDto {
  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  fileSizeBytes!: number;

  @ApiPropertyOptional({
    description:
      'The checklist/resolution WorkOrderEvent this evidence documents, if any.',
  })
  @IsOptional()
  @IsString()
  eventId?: string;
}
