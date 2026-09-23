import React from 'react';
import { 
  ScanLine, 
  ClipboardPaste, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface CyberLinkScannerProps {
  testLink: string;
  setTestLink: (val: string) => void;
  onApplyLink?: (link: string) => void;
  onClose: () => void;
  onPasteFromClipboard: () => void;
  validationResult: { valid: boolean; message: string; postId?: string; isSingle?: boolean } | null;
}

export function CyberLinkScanner({
  testLink,
  setTestLink,
  onApplyLink,
  onClose,
  onPasteFromClipboard,
  validationResult,
}: CyberLinkScannerProps) {
  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-neutral-900/90 border border-purple-500/40 space-y-3 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-black text-white flex items-center gap-1.5 tracking-wide">
          <ScanLine className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Проверьте ссылку на ваш пост:</span>
        </label>

        <button
          type="button"
          onClick={onPasteFromClipboard}
          className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-3 py-1 rounded-full transition-all active:scale-95"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>Вставить из буфера</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Вставьте ссылку на ваш пост, например: https://t.me/mychannel/150"
          value={testLink}
          onChange={e => setTestLink(e.target.value)}
          className="flex-1 px-4 py-3 rounded-2xl bg-black border border-purple-500/40 focus:border-pink-500 focus:outline-none text-white font-mono text-xs shadow-inner"
        />
        {onApplyLink && testLink && validationResult?.valid && (
          <button
            type="button"
            onClick={() => {
              onApplyLink(testLink);
              onClose();
            }}
            className="px-6 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_0_25px_rgba(217,70,239,0.4)] hover:opacity-90 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            Применить в форму
          </button>
        )}
      </div>

      {validationResult && (
        <div className={`p-3 rounded-2xl flex items-center gap-2 text-xs font-bold ${
          validationResult.valid 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {validationResult.valid ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{validationResult.message}</span>
        </div>
      )}
    </div>
  );
}
