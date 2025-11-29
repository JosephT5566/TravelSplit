import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { storage } from '../services/storage';

interface Props {
  config: AppConfig | undefined;
  onSave: (config: AppConfig) => void;
  onLogout: () => void;
}

export const Settings: React.FC<Props> = ({ config, onSave, onLogout }) => {
  const [formData, setFormData] = useState<AppConfig>({
    gasUrl: '',
    allowedEmails: ["test@gmail.com"],
    baseCurrency: 'TWD',
    googleClientId: ''
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleEmailChange = (val: string) => {
    const emails = val.split(',').map(e => e.trim()).filter(e => e);
    setFormData(prev => ({ ...prev, allowedEmails: emails }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Settings & Configuration</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Google Apps Script Web App URL</label>
          <input
            type="url"
            required
            placeholder="https://script.google.com/macros/s/.../exec"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={formData.gasUrl}
            onChange={e => setFormData({ ...formData, gasUrl: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">From your Google Sheet -> Extensions -> Apps Script -> Deploy -> Web App</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Allowed Emails (Comma separated)</label>
          <textarea
            required
            placeholder="alice@gmail.com, bob@gmail.com"
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={formData.allowedEmails.join(', ')}
            onChange={e => handleEmailChange(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Only these emails will be allowed to log in.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Base Currency</label>
          <input
            type="text"
            required
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            value={formData.baseCurrency}
            onChange={e => setFormData({ ...formData, baseCurrency: e.target.value })}
          />
        </div>

        <div className="pt-4 border-t dark:border-gray-700 flex justify-between items-center">
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-200 rounded"
          >
            Reset User & Data
          </button>
          
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
