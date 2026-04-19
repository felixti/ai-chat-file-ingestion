'use client';

import { useState, useEffect } from 'react';

interface ModelsResponse {
  models: string[];
  defaultModel: string;
}

export function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>('gemma4:31b-cloud');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        const res = await fetch('/api/models');
        if (!res.ok) throw new Error('Failed to load models');
        const data: ModelsResponse = await res.json();
        if (!cancelled) {
          setModels(data.models);
          setDefaultModel(data.defaultModel);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchModels();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, defaultModel, isLoading, error };
}
