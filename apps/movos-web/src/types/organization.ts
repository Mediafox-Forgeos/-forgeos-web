export type Organization = {
  id: string;
  name: string;
  description: string;
  country: string;
  createdAt: string;
};

export type Tenant = {
  id: string;
  organizationId: string;
  productName: string;
  productDescriptor: string;
  locale: string;
  currency: string;
  accentColor: string;
};
