import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Settings } from './components/Settings';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpensePieChart } from './components/Charts';
import { api } from './services/api';
import { storage } from './services/storage';
import { AppConfig, Expense, User, TransactionType, ApiState } from './types';
import { Plus, RefreshCw, LogOut, Settings as SettingsIcon, PieChart, List, Trash2, Edit2, Search } from 'lucide-react';

const Login: React.FC<{ onLogin: (u: User) => void; config: AppConfig | undefined }> = ({ onLogin, config }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !config.allowedEmails.length) {
      setError("System not configured. Please add allowed emails in Settings.");
      return;
    }
    
    if (config.allowedEmails.includes(email.trim())) {
      onLogin({ email: email.trim(), name: email.split('@')[0] });
    } else {
      setError("This email is not authorized for this trip.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">TripSplit</h1>
        <p className="text-center text-gray-500 mb-8">Secure Travel Expense Tracker</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
             <label className="block text-sm font-medium mb-1">Email Access</label>
             <input 
              type="email" 
              required
              className="w-full p-3 rounded border dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
             />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">
            Access Trip
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t dark:border-gray-700 text-center">
           <p className="text-xs text-gray-400">If this is a new device, configure the app first.</p>
           <a href="#/settings" className="text-sm text-blue-500 hover:underline">Go to Settings</a>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ expenses: Expense[], apiState: ApiState, onRefresh: () => void, baseCurrency: string }> = ({ expenses, apiState, onRefresh, baseCurrency }) => {
  const totalExpense = expenses
    .filter(e => e.type === TransactionType.EXPENSE)
    .reduce((acc, curr) => acc + (curr.amount * curr.exchangeRate), 0);

  const totalIncome = expenses
    .filter(e => e.type === TransactionType.INCOME)
    .reduce((acc, curr) => acc + (curr.amount * curr.exchangeRate), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Overview</h2>
        <button 
          onClick={onRefresh} 
          disabled={apiState.isLoading}
          className={`p-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 ${apiState.isLoading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow border-l-4 border-red-500">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-xl font-bold text-red-600">
            {baseCurrency} {totalExpense.toFixed(0)}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Reimbursed</p>
          <p className="text-xl font-bold text-green-600">
            {baseCurrency} {totalIncome.toFixed(0)}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <h3 className="font-semibold mb-4">Category Breakdown</h3>
        <ExpensePieChart expenses={expenses} />
      </div>
    </div>
  );
};

const ExpenseList: React.FC<{ 
  expenses: Expense[], 
  onEdit: (e: Expense) => void, 
  onDelete: (id: string) => void 
}> = ({ expenses, onEdit, onDelete }) => {
  const [search, setSearch] = useState('');
  
  const filtered = expenses
    .filter(e => 
      e.item.toLowerCase().includes(search.toLowerCase()) || 
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.payer.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input 
          type="text"
          placeholder="Search expenses..."
          className="w-full pl-10 p-2 rounded-lg border dark:bg-gray-800 dark:border-gray-700"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3 pb-20">
        {filtered.map(exp => (
          <div key={exp.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                 <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                   {exp.date.slice(5)}
                 </span>
                 <h4 className="font-semibold">{exp.item}</h4>
              </div>
              <p className="text-sm text-gray-500">{exp.category} • Paid by {exp.payer.split('@')[0]}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${exp.type === TransactionType.EXPENSE ? 'text-red-500' : 'text-green-500'}`}>
                {exp.type === TransactionType.EXPENSE ? '-' : '+'}{exp.amount} {exp.currency}
              </p>
              <div className="flex gap-2 justify-end mt-1">
                <button onClick={() => onEdit(exp)} className="text-gray-400 hover:text-blue-500"><Edit2 size={16} /></button>
                <button onClick={() => onDelete(exp.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No expenses found.</p>}
      </div>
    </div>
  );
};

export default function App() {
  const [config, setConfig] = useState<AppConfig | undefined>();
  const [user, setUser] = useState<User | undefined>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [apiState, setApiState] = useState<ApiState>({ isLoading: false, error: null, lastUpdated: null });
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const storedConfig = await storage.getConfig();
      const storedUser = await storage.getUser();
      const storedExpenses = await storage.getExpenses();
      
      if (storedConfig) setConfig(storedConfig);
      if (storedUser) setUser(storedUser);
      if (storedExpenses) setExpenses(storedExpenses);
    };
    init();
  }, []);

  const refreshExpenses = useCallback(async () => {
    if (!config?.gasUrl || !user) return;
    
    setApiState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await api.fetchExpenses(config.gasUrl, user.email);
      setExpenses(data);
      await storage.saveExpenses(data);
      setApiState(prev => ({ ...prev, isLoading: false, lastUpdated: Date.now() }));
    } catch (err: any) {
      setApiState(prev => ({ ...prev, isLoading: false, error: err.message }));
      console.error(err);
    }
  }, [config, user]);

  // Initial fetch when user/config is ready
  useEffect(() => {
    if (user && config && expenses.length === 0) {
      refreshExpenses();
    }
  }, [user, config, expenses.length, refreshExpenses]);

  const handleSaveConfig = async (newConfig: AppConfig) => {
    await storage.saveConfig(newConfig);
    setConfig(newConfig);
    alert("Configuration saved.");
  };

  const handleLogout = async () => {
    await storage.clearUser();
    setUser(undefined);
    setExpenses([]);
    window.location.hash = '/login';
  };

  const handleLogin = async (newUser: User) => {
    await storage.saveUser(newUser);
    setUser(newUser);
    // Navigate done by Router rendering
  };

  const handleSaveExpense = async (expense: Expense) => {
    if (!config?.gasUrl || !user) return;
    
    // Optimistic update
    const isEdit = !!editingExpense;
    const oldExpenses = [...expenses];
    
    let newExpenses;
    if (isEdit) {
      newExpenses = expenses.map(e => e.id === expense.id ? expense : e);
    } else {
      newExpenses = [expense, ...expenses];
    }
    
    setExpenses(newExpenses);
    setShowForm(false);
    setEditingExpense(null);

    // Async Sync
    try {
      await api.syncTransaction(config.gasUrl, user.email, isEdit ? 'edit' : 'add', expense);
      await storage.saveExpenses(newExpenses);
    } catch (err) {
      alert("Failed to sync with Google Sheets. Data is local only for now.");
      // Rollback or keep dirty state - for now keeping it as is, will sync on next refresh
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;
    if (!config?.gasUrl || !user) return;

    const expenseToDelete = expenses.find(e => e.id === id);
    if (!expenseToDelete) return;

    const newExpenses = expenses.filter(e => e.id !== id);
    setExpenses(newExpenses);

    try {
      await api.syncTransaction(config.gasUrl, user.email, 'delete', expenseToDelete);
      await storage.saveExpenses(newExpenses);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-20">
        <Routes>
          <Route path="/login" element={
             user ? <Navigate to="/" /> : <Login onLogin={handleLogin} config={config} />
          } />
          
          <Route path="/settings" element={
            <>
              <div className="p-4 bg-white dark:bg-gray-800 shadow sticky top-0 z-10 flex items-center">
                 <NavLink to="/" className="mr-4"><LogOut className="transform rotate-180" /></NavLink>
                 <h1 className="text-xl font-bold">Settings</h1>
              </div>
              <Settings config={config} onSave={handleSaveConfig} onLogout={handleLogout} />
            </>
          } />

          <Route path="/*" element={
            !user ? <Navigate to="/login" /> : (
              <>
                 {/* Header */}
                 <div className="p-4 bg-white dark:bg-gray-800 shadow sticky top-0 z-10 flex justify-between items-center">
                   <h1 className="text-xl font-bold text-blue-600">TripSplit</h1>
                   <div className="text-xs text-gray-500 flex flex-col items-end">
                      <span>{user.name}</span>
                      <span>{apiState.lastUpdated ? `Updated ${new Date(apiState.lastUpdated).toLocaleTimeString()}` : ''}</span>
                   </div>
                 </div>

                 {/* Main Content */}
                 <div className="p-4 max-w-2xl mx-auto">
                    {apiState.error && (
                      <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                        {apiState.error}
                      </div>
                    )}
                    
                    <Routes>
                      <Route path="/" element={
                        <Dashboard 
                          expenses={expenses} 
                          apiState={apiState} 
                          onRefresh={refreshExpenses} 
                          baseCurrency={config?.baseCurrency || 'TWD'} 
                        />
                      } />
                      <Route path="/list" element={
                        <ExpenseList 
                          expenses={expenses} 
                          onEdit={(e) => { setEditingExpense(e); setShowForm(true); }}
                          onDelete={handleDeleteExpense}
                        />
                      } />
                    </Routes>
                 </div>

                 {/* FAB */}
                 <button 
                  onClick={() => { setEditingExpense(null); setShowForm(true); }}
                  className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95 z-40"
                 >
                   <Plus size={28} />
                 </button>

                 {/* Bottom Nav */}
                 <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 flex justify-around p-3 z-30">
                   <NavLink to="/" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                     <PieChart size={24} />
                     <span className="text-xs mt-1">Stats</span>
                   </NavLink>
                   <NavLink to="/list" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                     <List size={24} />
                     <span className="text-xs mt-1">Expenses</span>
                   </NavLink>
                   <NavLink to="/settings" className={({isActive}) => `flex flex-col items-center ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                     <SettingsIcon size={24} />
                     <span className="text-xs mt-1">Settings</span>
                   </NavLink>
                 </nav>

                 {/* Modal */}
                 {showForm && (
                   <ExpenseForm 
                      initialData={editingExpense} 
                      currentUser={user}
                      onSave={handleSaveExpense}
                      onCancel={() => { setShowForm(false); setEditingExpense(null); }}
                   />
                 )}
              </>
            )
          } />
        </Routes>
      </div>
    </HashRouter>
  );
}
