
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export interface BankDetails {
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
}

export interface InvoiceData {
  invoiceNo: string;
  date: string;
  customerName: string;
  customerAddress: string;
  items: InvoiceItem[];
  bankDetails: BankDetails;
  logo: string | null;
  signature: string | null;
  notes: string;
  phone: string;
  email: string;
}
