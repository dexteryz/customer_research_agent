import { createContext } from 'react';

interface CustomerFeedbackRow {
  fields: Record<string, string>;
  tags?: string[];
  category?: string;
}

interface CustomerDataContextType {
  data: CustomerFeedbackRow[];
  setData: (data: CustomerFeedbackRow[]) => void;
}

export const CustomerDataContext = createContext<CustomerDataContextType | undefined>(undefined);

export type { CustomerFeedbackRow, CustomerDataContextType };