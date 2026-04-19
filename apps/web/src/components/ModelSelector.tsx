'use client';

import React from 'react';

interface ModelSelectorProps {
  models: string[];
  selected: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, selected, onChange, disabled }: ModelSelectorProps) {
  if (!models || models.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="model-select" className="text-gray-500 whitespace-nowrap">
        Model:
      </label>
      <select
        id="model-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
