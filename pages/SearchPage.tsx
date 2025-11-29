import React from 'react';
import { ExpenseSearch } from '../components/ExpenseSearch';
import { Expense } from '../types';

interface SearchPageProps {
  expenses: Expense[];
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = (props) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen animate-in fade-in duration-200">
      <ExpenseSearch {...props} />
    </div>
  );
};