import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Settings } from '../components/Settings';
import { AppConfig } from '../types';

interface SettingsPageProps {
  config: AppConfig | undefined;
  onSave: (config: AppConfig) => void;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = (props) => {
  return (
    <div className="pb-20 bg-background min-h-screen">
      <div className="p-4 bg-surface shadow sticky top-0 z-10 flex items-center gap-4 transition-colors border-b border-border">
         <NavLink to="/" className="text-text-muted hover:text-primary transition-colors">
            <ArrowLeft size={24} />
         </NavLink>
         <h1 className="text-xl font-bold text-text-main">Settings</h1>
      </div>
      <div className="p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Settings {...props} />
      </div>
    </div>
  );
};