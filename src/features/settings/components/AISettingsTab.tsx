import React, { useState } from 'react';
import { TokenManagerSheet } from './TokenManagerSheet';
import { QuotaSettingsSheet } from './QuotaSettingsSheet';
import { KeyRound, Bot } from 'lucide-react';

export function AISettingsTab() {
  const [subTab, setSubTab] = useState<'tokens' | 'quotas'>('tokens');

  return (
    <div className="space-y-4">
      <div className="flex border-b border-outline-variant/20 pb-2 gap-2">
        <button
          onClick={() => setSubTab('tokens')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            subTab === 'tokens'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <KeyRound size={14} /> Quản lý AI Tokens
        </button>
        <button
          onClick={() => setSubTab('quotas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
            subTab === 'quotas'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'text-on-surface-variant hover:bg-surface-container-high'
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
