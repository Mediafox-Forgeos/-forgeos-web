import { Injectable } from '@nestjs/common';
import type { Organization } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists the organizations the user is an ACTIVE member of.
   */
  async listForUser(userId: string): Promise<Organization[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
    });
    return memberships.map((m) => m.organization);
  }
}
