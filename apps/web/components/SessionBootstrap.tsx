'use client';

import { useEffect } from 'react';
import { apiFetch } from '../lib/api';

export function SessionBootstrap() {
  useEffect(() => {
    void apiFetch('/auth/me').catch(() => undefined);
  }, []);

  return null;
}
