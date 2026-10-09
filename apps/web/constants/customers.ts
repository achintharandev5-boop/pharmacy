export interface CustomerData {
  id: string;
  name: string;
  phone_number: string;
}

export const HARDCODED_CUSTOMERS: CustomerData[] = [
  { id: 'cust_tharun', name: 'Tharun', phone_number: '07783939393' },
  { id: 'cust_praveen', name: 'Praveen', phone_number: '07499292292' },
  { id: 'cust_achintha', name: 'Achintha', phone_number: '0764876719' },
  { id: 'cust_gagana', name: 'Gagana', phone_number: '07618181922' },
];
