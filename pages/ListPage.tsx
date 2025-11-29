import React from 'react';
import { ExpenseList } from '../components/ExpenseList';
import { Expense } from '../types';

interface ListPageProps {
  expenses: Expense[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
  baseCurrency: string;
}

export const ListPage: React.FC<ListPageProps> = (props) => {
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <ExpenseList {...props} />
    </div>
  );
};