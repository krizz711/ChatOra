import { useContext } from 'react';
import { LoaderContext } from '../context/LoaderContext';

export function useLoader() {
    const ctx = useContext(LoaderContext);
    if (!ctx) {
        throw new Error('useLoader must be used within a <LoaderProvider>');
    }
    return ctx;
}
