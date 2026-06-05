'use client';

import { useState } from 'react';

interface CopyButtonProps {
  textToCopy: string;
}

export default function CopyButton({ textToCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
        copied
          ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
          : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/30 text-white shadow-md shadow-indigo-600/10'
      }`}
    >
      {copied ? '✅ ¡Copiado!' : '📋 Copiar al Portapapeles'}
    </button>
  );
}
