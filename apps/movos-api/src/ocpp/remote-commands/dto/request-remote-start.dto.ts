import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** WO-ARGOS-064 §6 — the operator selects an existing, real
 * AuthorizationCredential id belonging to their organization. Never a raw
 * idTag string: the backend re-resolves and validates the credential
 * (status, expiry, org ownership) from this id — see
 * RemoteCommandService.getOwnedActiveCredential. */
export class RequestRemoteStartDto {
  @ApiProperty({
    description:
      'An existing AuthorizationCredential id owned by the organization',
  })
  @IsString()
  @MinLength(1)
  authorizationCredentialId!: string;
}
