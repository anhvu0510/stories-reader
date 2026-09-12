import React, { useState } from 'react';
import { TokenManagerSheet } from './TokenManagerSheet';
import { QuotaSettingsSheet } from './QuotaSettingsSheet';
import { KeyRound, Bot } from 'lucide-react';

export function AISettingsTab() {
  const [subTab, setSubTab] = useState<'tokens' | 'quotas'>('tokens');

  return (
    <div className="space-y-4">
      <div className="flex border-b border-white/10 pb-2 gap-2">
        <button
          onClick={() => setSubTab('tokens')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
            subTab === 'tokens'
              ? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
              : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10'
          }`}
        >
          <KeyRound size={14} /> Quản lý AI Tokens
        </button>
        <button
          onClick={() => setSubTab('quotas')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
            subTab === 'quotas'
              ? 'bg-primary/20 text-primary border-primary/50 shadow-xs'
              : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10'
          }`}
        >
          <Bot size={14} /> Quản lý Quota & Models
        </button>
      </div>

      <div>
        {subTab === 'tokens' ? (
          <TokenManagerSheet isEmbedded />
        ) : (
          <QuotaSettingsSheet isEmbedded />
        )}
      </div>
    </div>
  );
}
