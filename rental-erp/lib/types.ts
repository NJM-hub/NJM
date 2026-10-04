// DB 행 타입 (금액은 number, 날짜는 'YYYY-MM-DD')
import type {
  ContractStatus,
  DepositStatus,
  DocumentCategory,
  ExpenseCategory,
  OwnerType,
  PaymentMethod,
  PropertyType,
  RateType,
  RepaymentType,
} from "@/lib/constants";

export type Owner = {
  id: string;
  name: string;
  owner_type: OwnerType;
  biz_no: string | null;
  representative: string | null;
  phone: string | null;
  memo: string | null;
  is_active: boolean;
};

export type Property = {
  id: string;
  owner_id: string | null;
  name: string;
  address: string | null;
  building_name: string | null;
  property_type: PropertyType;
  purchase_date: string | null;
  purchase_price: number;
  current_value: number | null;
  acquisition_cost: number;
  remodeling_cost: number;
  other_investment: number;
  memo: string | null;
  is_active: boolean;
};

export type Unit = {
  id: string;
  property_id: string;
  dong: string | null;
  floor: string | null;
  unit_no: string;
  area_m2: number | null;
  expected_deposit: number;
  expected_rent: number;
  vacant_since: string | null;
  memo: string | null;
  is_active: boolean;
};

export type Tenant = {
  id: string;
  name: string;
  phone: string | null;
  biz_no: string | null;
  email: string | null;
  memo: string | null;
};

export type Contract = {
  id: string;
  contract_no: string;
  unit_id: string;
  tenant_id: string;
  landlord_name: string | null;
  contract_date: string | null;
  start_date: string;
  end_date: string;
  deposit: number;
  monthly_rent: number;
  maintenance_fee: number;
  vat_amount: number;
  pay_day: number;
  billing_from: string | null;
  status: ContractStatus;
  is_renewal: boolean;
  previous_contract_id: string | null;
  terminated_on: string | null;
  special_terms: string | null;
  memo: string | null;
};

export type Deposit = {
  id: string;
  contract_id: string;
  amount: number;
  received_amount: number;
  received_date: string | null;
  return_due_date: string | null;
  returned_amount: number;
  offset_amount: number;
  returned_date: string | null;
  status: DepositStatus;
  memo: string | null;
};

export type Charge = {
  id: string;
  contract_id: string;
  billing_month: string;
  due_date: string;
  rent_amount: number;
  maintenance_amount: number;
  vat_amount: number;
  amount: number;
  paid_amount: number;
  hold_unpaid?: boolean; // 미납으로 고정 (자동 배분에서 건너뜀)
  memo: string | null;
};

export type Payment = {
  id: string;
  contract_id: string;
  charge_id: string | null;
  paid_date: string;
  amount: number;
  method: PaymentMethod;
  memo: string | null;
  created_at: string;
};

export type Allocation = { payment_id: string; charge_id: string; amount: number };

export type Loan = {
  id: string;
  property_id: string;
  lender: string;
  product: string | null;
  start_date: string | null;
  principal: number;
  balance: number;
  interest_rate: number;
  rate_type: RateType;
  repayment_type: RepaymentType;
  monthly_payment: number | null;
  interest_day: number | null;
  maturity_date: string | null;
  memo: string | null;
  is_closed: boolean;
};

export type LoanTx = {
  id: string;
  loan_id: string;
  tx_date: string;
  tx_type: "principal" | "interest" | "rate_change";
  amount: number;
  new_rate: number | null;
  memo: string | null;
};

export type Expense = {
  id: string;
  property_id: string | null;
  owner_id: string | null;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  vendor: string | null;
  memo: string | null;
  loan_id: string | null;
};

export type DocumentMeta = {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  tenant_id: string | null;
  loan_id: string | null;
  category: DocumentCategory;
  title: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

/** 계산에 필요한 전체 데이터 */
export type Dataset = {
  owners: Owner[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  contracts: Contract[];
  deposits: Deposit[];
  charges: Charge[];
  payments: Payment[];
  allocations: Allocation[];
  loans: Loan[];
  loanTxs: LoanTx[];
  expenses: Expense[];
};

export type FormState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
} | null;
