import { useState, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { Account, Order } from '../types';

export interface FetchState {
    status: 'idle' | 'fetching' | 'done' | 'error';
    error?: string;
}

export interface DataFetcherResult {
    // Orders data keyed by account ID
    ordersData: Record<string, Order[]>;
    // GV balance data keyed by account ID
    gvData: Record<string, string>;

    // Per-account fetch states
    orderStates: Record<string, FetchState>;
    gvStates: Record<string, FetchState>;

    // Overall fetching status
    isOrdersFetching: boolean;
    isGVFetching: boolean;

    // Current account being fetched (for UI display)
    currentOrderAccountId: string | null;
    currentGVAccountId: string | null;

    // Trigger functions
    triggerOrdersFetch: (accounts: Account[]) => void;
    triggerGVFetch: (accounts: Account[]) => void;

    // Cancel functions
    cancelOrdersFetch: () => void;
    cancelGVFetch: () => void;
}

export function useDataFetcher(): DataFetcherResult {
    // Data stores
    const [ordersData, setOrdersData] = useState<Record<string, Order[]>>({});
    const [gvData, setGvData] = useState<Record<string, string>>({});

    // Per-account states
    const [orderStates, setOrderStates] = useState<Record<string, FetchState>>({});
    const [gvStates, setGvStates] = useState<Record<string, FetchState>>({});

    // Overall status
    const [isOrdersFetching, setIsOrdersFetching] = useState(false);
    const [isGVFetching, setIsGVFetching] = useState(false);

    // Current account being fetched
    const [currentOrderAccountId, setCurrentOrderAccountId] = useState<string | null>(null);
    const [currentGVAccountId, setCurrentGVAccountId] = useState<string | null>(null);

    // Race condition prevention - increment to cancel previous fetches
    const ordersFetchId = useRef(0);
    const gvFetchId = useRef(0);

    // Cancel flags
    const cancelOrdersRef = useRef(false);
    const cancelGVRef = useRef(false);

    const triggerOrdersFetch = useCallback(async (accounts: Account[]) => {
        if (accounts.length === 0) return;

        // Increment fetch ID to invalidate any previous fetch
        const currentFetchId = ++ordersFetchId.current;
        cancelOrdersRef.current = false;

        // Reset states
        setIsOrdersFetching(true);
        setOrdersData({});
        setOrderStates({});

        // Initialize all accounts as idle
        const initialStates: Record<string, FetchState> = {};
        accounts.forEach(acc => {
            initialStates[acc.id] = { status: 'idle' };
        });
        setOrderStates(initialStates);

        // Fetch sequentially one by one
        for (const account of accounts) {
            // Check if cancelled or if a newer fetch started
            if (cancelOrdersRef.current || currentFetchId !== ordersFetchId.current) {
                break;
            }

            setCurrentOrderAccountId(account.id);
            setOrderStates(prev => ({
                ...prev,
                [account.id]: { status: 'fetching' }
            }));

            try {
                const result = await api.fetchOrders(account.id, account.platform);

                // Check again after async operation
                if (cancelOrdersRef.current || currentFetchId !== ordersFetchId.current) {
                    break;
                }

                if (result.success && result.orders) {
                    setOrdersData(prev => ({
                        ...prev,
                        [account.id]: result.orders
                    }));
                    setOrderStates(prev => ({
                        ...prev,
                        [account.id]: { status: 'done' }
                    }));
                } else {
                    setOrderStates(prev => ({
                        ...prev,
                        [account.id]: {
                            status: 'error',
                            error: result.message || 'Failed to fetch orders'
                        }
                    }));
                }
            } catch (err: any) {
                // Check if still valid
                if (currentFetchId === ordersFetchId.current && !cancelOrdersRef.current) {
                    setOrderStates(prev => ({
                        ...prev,
                        [account.id]: {
                            status: 'error',
                            error: err.message || 'Network error'
                        }
                    }));
                }
            }
        }

        // Only update if this is still the current fetch
        if (currentFetchId === ordersFetchId.current) {
            setIsOrdersFetching(false);
            setCurrentOrderAccountId(null);
        }
    }, []);

    const triggerGVFetch = useCallback(async (accounts: Account[]) => {
        if (accounts.length === 0) return;

        // Increment fetch ID to invalidate any previous fetch
        const currentFetchId = ++gvFetchId.current;
        cancelGVRef.current = false;

        // Reset states
        setIsGVFetching(true);
        setGvData({});
        setGvStates({});

        // Initialize all accounts as idle
        const initialStates: Record<string, FetchState> = {};
        accounts.forEach(acc => {
            initialStates[acc.id] = { status: 'idle' };
        });
        setGvStates(initialStates);

        // Fetch sequentially one by one
        for (const account of accounts) {
            // Check if cancelled or if a newer fetch started
            if (cancelGVRef.current || currentFetchId !== gvFetchId.current) {
                break;
            }

            setCurrentGVAccountId(account.id);
            setGvStates(prev => ({
                ...prev,
                [account.id]: { status: 'fetching' }
            }));

            try {
                const result = await api.fetchGVBalance(account.id);

                // Check again after async operation
                if (cancelGVRef.current || currentFetchId !== gvFetchId.current) {
                    break;
                }

                if (result.success && result.gvBalance) {
                    setGvData(prev => ({
                        ...prev,
                        [account.id]: result.gvBalance
                    }));
                    setGvStates(prev => ({
                        ...prev,
                        [account.id]: { status: 'done' }
                    }));
                } else {
                    setGvStates(prev => ({
                        ...prev,
                        [account.id]: {
                            status: 'error',
                            error: result.message || 'Failed to fetch GV balance'
                        }
                    }));
                }
            } catch (err: any) {
                // Check if still valid
                if (currentFetchId === gvFetchId.current && !cancelGVRef.current) {
                    setGvStates(prev => ({
                        ...prev,
                        [account.id]: {
                            status: 'error',
                            error: err.message || 'Network error'
                        }
                    }));
                }
            }
        }

        // Only update if this is still the current fetch
        if (currentFetchId === gvFetchId.current) {
            setIsGVFetching(false);
            setCurrentGVAccountId(null);
        }
    }, []);

    const cancelOrdersFetch = useCallback(() => {
        cancelOrdersRef.current = true;
        setIsOrdersFetching(false);
        setCurrentOrderAccountId(null);
    }, []);

    const cancelGVFetch = useCallback(() => {
        cancelGVRef.current = true;
        setIsGVFetching(false);
        setCurrentGVAccountId(null);
    }, []);

    return {
        ordersData,
        gvData,
        orderStates,
        gvStates,
        isOrdersFetching,
        isGVFetching,
        currentOrderAccountId,
        currentGVAccountId,
        triggerOrdersFetch,
        triggerGVFetch,
        cancelOrdersFetch,
        cancelGVFetch
    };
}
