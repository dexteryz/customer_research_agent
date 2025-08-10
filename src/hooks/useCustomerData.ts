import { useContext } from 'react';
import { CustomerDataContext } from '../contexts/CustomerDataContext';

export function useCustomerData() {
  const ctx = useContext(CustomerDataContext);
  if (!ctx) throw new Error("useCustomerData must be used within CustomerDataProvider");
  return ctx;
}