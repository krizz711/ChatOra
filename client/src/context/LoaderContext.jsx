import { createContext, useState, useCallback, useRef } from 'react';

export const LoaderContext = createContext(null);

export const LoaderProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loaderMessage, setLoaderMessage] = useState('');
    const refCount = useRef(0);

    const showLoader = useCallback((message = '') => {
        refCount.current += 1;
        setLoaderMessage(message);
        setIsLoading(true);
    }, []);

    const hideLoader = useCallback(() => {
        refCount.current = Math.max(0, refCount.current - 1);
        if (refCount.current === 0) {
            setIsLoading(false);
        }
    }, []);

    return (
        <LoaderContext.Provider value={{ isLoading, loaderMessage, showLoader, hideLoader }}>
            {children}
        </LoaderContext.Provider>
    );
};
