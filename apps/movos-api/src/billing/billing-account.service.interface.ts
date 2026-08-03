import type { BillingAccount, BillingAccountType } from '@prisma/client';

/**
 * CAP-009 (WO-ARGOS-017) — the domain-service contract for BillingAccount,
 * the canonical debt owner named by docs/domain/CAP-008_DEBT_OWNERSHIP.md.
 *
 * Interface only, per this work order's explicit scope: no implementing
 * class exists yet, and none of these methods may ever calculate a
 * balance, generate an invoice, or process a payment — that remains
 * Architecture Backlog #25 (Billing) / #26 (Payments), not this
 * foundation. See docs/domain/CAP-009_BILLING_ACCOUNT_MODEL.md.
 */

export interface CreateBillingAccountInput {
  organizationId: string;
  type: BillingAccountType;
  displayName: string;
  /** ISO 4217 currency code (e.g. "USD", "COP"). */
  currency: string;
}

export interface BillingAccountService {
  /** Creates a new, ACTIVE BillingAccount scoped to exactly one organization. */
  create(input: CreateBillingAccountInput): Promise<BillingAccount>;

  findById(id: string): Promise<BillingAccount | null>;

  /**
   * Lists BillingAccounts for one organization. Never across
   * organizations — a BillingAccount is tenant-scoped like every other
   * business record in this schema (DEC-022 tenant-isolation precedent).
   */
  findByOrganization(organizationId: string): Promise<BillingAccount[]>;

  /**
   * Transitions a BillingAccount to ARCHIVED. There is deliberately no
   * `delete` method on this interface — see
   * docs/domain/CAP-009_INVARIANTS.md's "BillingAccounts can be archived
   * but never deleted" rule.
   */
  archive(id: string): Promise<BillingAccount>;
}
