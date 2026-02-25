import React from 'react';
import type { ConfirmOptions } from '@/shared/lib/confirm';

export type ConfirmContextValue = {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);
