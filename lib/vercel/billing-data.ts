export type Currency = string;
export type Units = string;
export type UsageType = "total" | "interval" | "rate";
export type ISODateTime = string; // YYYY-MM-DDTHH:MI:SSZ

export interface BillingData {
  timestamp: ISODateTime;
  eod: ISODateTime;
  period: {
    start: ISODateTime;
    end: ISODateTime;
  };
  billing: BillingItem[];
  usage: ResourceUsage[];
}

export interface BillingItem {
  resourceId?: string;
  billingPlanId: string;
  // Start and end are only needed if different from the period's start/end.
  // E.g. in case of a plan change.
  start?: ISODateTime;
  end?: ISODateTime;
  name: string;
  details?: string;
  price: Currency;
  quantity: number;
  units: Units;
  total: Currency;
}

export interface ResourceUsage {
  resourceId: string;
  name: string;
  type: UsageType;
  units: Units;
  dayValue: number;
  periodValue: number;
  planValue?: number;
}
