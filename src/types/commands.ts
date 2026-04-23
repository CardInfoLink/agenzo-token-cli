export interface AddPaymentMethodParams {
  api_key: string;
  type: string;
  email: string;
  card_number?: string;
  expiry?: string; // MMYY
  cvv?: string;
  [key: string]: unknown; // Future extension for other payment types
}

export interface VcnParams {
  api_key: string;
  payment_method_id: string;
  member_id: string;
  amount: number;
  currency?: string;
}

export interface NetworkTokenParams {
  api_key: string;
  payment_method_id: string;
  member_id: string;
}

export interface X402Params {
  api_key: string;
  payment_method_id: string;
  member_id: string;
  pay_to: string;
  amount: string;
  nonce: string;
  network: string;
  deadline: number;
}
