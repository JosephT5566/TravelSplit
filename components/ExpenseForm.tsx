import React, { useState, useEffect } from 'react';
import { Expense, TransactionType, User } from '../types';
import { format } from 'date-fns';
import { X } from 'lucide-react';

interface Props {
  initialData?: Expense | null;
  currentUser: User;
  onSave: (data: Expense) => void;
  onCancel: () => void;
}

const CATEGORIES = ['Food', 'Transport', 'Accommodation', 'Shopping', 'Entertainment', 'Others', 'Tickets'];
const CURRENCIES = ['TWD', 'JPY', 'USD', 'EUR', 'KRW'];

export const ExpenseForm: React.FC<Props> = ({ initialData, currentUser, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: TransactionType.EXPENSE,
    currency: 'TWD',
    exchangeRate: 1,
    category: 'Food',
    payer: currentUser.email,
    settled: false,
    item: '',
    amount: 0,
    personalNote: '',
    remark: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item || !formData.amount) return;

    const dayName = new Date(formData.date!).toLocaleDateString('en-US', { weekday: 'long' });

    const newExpense: Expense = {
      id: initialData?.id || crypto.randomUUID(),
      timestamp: initialData?.timestamp || new Date().toISOString(),
      date: formData.date!,
      day: dayName,
      category: formData.category!,
      item: formData.item!,
      type: formData.type!,
      amount: Number(formData.amount),
      currency: formData.currency!,
      payer: formData.payer!,
      personalNote: formData.personalNote || '',
      settled: formData.settled || false,
      remark: formData.remark || '',
      exchangeRate: Number(formData.exchangeRate),
    };

    onSave(newExpense);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-bold">{initialData ? 'Edit Expense' : 'New Expense'}</h3>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                required
                className="input-field"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as TransactionType })}
              >
                <option value={TransactionType.EXPENSE}>I Paid (-)</option>
                <option value={TransactionType.INCOME}>Refund/Income (+)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Item Name</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. Dinner at 7-11"
              value={formData.item}
              onChange={e => setFormData({ ...formData, item: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                className="input-field"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select
                className="input-field"
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value })}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Exchange Rate</label>
              <input
                type="number"
                step="0.0001"
                className="input-field"
                value={formData.exchangeRate}
                onChange={e => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="label">Payer Email</label>
            <input
              type="email"
              required
              className="input-field bg-gray-100 dark:bg-gray-700"
              value={formData.payer}
              onChange={e => setFormData({ ...formData, payer: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Note</label>
            <textarea
              className="input-field"
              rows={2}
              value={formData.personalNote}
              onChange={e => setFormData({ ...formData, personalNote: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="settled"
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={formData.settled}
              onChange={e => setFormData({ ...formData, settled: e.target.checked })}
            />
            <label htmlFor="settled" className="text-sm">Mark as Settled</label>
          </div>
          
          <div className="pt-4 flex gap-3">
             <button type="button" onClick={onCancel} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="submit" className="flex-1 btn-primary">
              Save Transaction
            </button>
          </div>
        </form>
      </div>
      
      <style>{`
        .label {
          @apply block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300;
        }
        .input-field {
          @apply w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none;
        }
        .btn-primary {
          @apply py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors;
        }
        .btn-secondary {
          @apply py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors;
        }
      `}</style>
    </div>
  );
};
