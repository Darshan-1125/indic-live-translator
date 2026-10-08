import React from 'react';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type Language } from '../types/meeting';

interface LanguageSelectorProps {
  label: string;
  selectedCode: string;
  onChange: (code: string) => void;
  className?: string;
  id?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  label,
  selectedCode,
  onChange,
  className = '',
  id,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-indigo-400" />
        {label}
      </label>
      <select
        id={id}
        value={selectedCode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 text-slate-100 text-sm rounded-xl border border-slate-700 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
      >
        <optgroup label="Indic Languages">
          {SUPPORTED_LANGUAGES.filter((lang) => lang.isIndic).map((lang: Language) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.nativeName})
            </option>
          ))}
        </optgroup>
        <optgroup label="Global Languages">
          {SUPPORTED_LANGUAGES.filter((lang) => !lang.isIndic).map((lang: Language) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.nativeName})
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
};
