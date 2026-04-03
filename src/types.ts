export interface Year {
  id: string;
  name: string;
  director: string;
}

export interface District {
  id: string;
  year_id: string;
  department: number;
  district: number;
  representative: string;
  phone: string;
}

export interface Member {
  id: string;
  district_id: string;
  address: string;
  name: string;
  monthly_fee: number;
  sort_order: number;
}

export interface Payment {
  id: string;
  member_id: string;
  month: number;
  amount: number;
  paid: boolean;
}

export const MONTHS = [
  { value: 4, label: "4月" },
  { value: 5, label: "5月" },
  { value: 6, label: "6月" },
  { value: 7, label: "7月" },
  { value: 8, label: "8月" },
  { value: 9, label: "9月" },
  { value: 10, label: "10月" },
  { value: 11, label: "11月" },
  { value: 12, label: "12月" },
  { value: 13, label: "1月" },
  { value: 14, label: "2月" },
  { value: 15, label: "3月" },
];
