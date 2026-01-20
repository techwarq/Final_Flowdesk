import React, { useEffect, useState, useRef } from 'react';
import { api } from './api/client';
import { Account, Platform, Order, BatchJob } from './types';

import { Layout } from './components/Layout';
import { AddAccountModal } from './components/AddAccountModal';
import { ChatWidget } from './components/ChatWidget';


// Icons for navigation
const DashboardIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const BrowseIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
);

const OrdersIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
);

const ActivityIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

interface Props {
    username: string;
    onLogout: () => void;
}

type ViewMode = 'dashboard' | 'browse' | 'orders' | 'activity' | 'settings';

const OrderDetailsModal: React.FC<{ order: Order; details: any; onClose: () => void }> = ({ order, details, onClose }) => {
    if (!order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900">Order Details</h3>
                        <p className="text-xs text-slate-500">ID: {order.orderId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Status Header */}
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-lg p-2 flex items-center justify-center border border-slate-100 flex-shrink-0">
                            {order.imageUrl ? (
                                <img src={order.imageUrl} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                            ) : (
                                <div className="text-slate-200 text-2xl">📦</div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 leading-tight">{order.productName}</h4>
                            <p className="text-sm text-green-600 font-bold mt-1">{details?.deliveryDetails?.split(' | ')[0] || order.status}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Seller: {details?.seller || 'Flipkart Seller'}</p>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="relative pl-2">
                        <div className="absolute top-2 bottom-2 left-[19px] w-[2px] bg-slate-100"></div>
                        {/* Active line filler */}
                        {details?.timeline && (() => {
                            const lastActiveIdx = details.timeline.reduce((acc: number, step: any, idx: number) => step.active ? idx : acc, -1);
                            if (lastActiveIdx > 0) {
                                const h = (lastActiveIdx / (details.timeline.length - 1)) * 100;
                                return <div className="absolute top-2 left-[19px] w-[2px] bg-green-500 transition-all" style={{ height: `${h}%` }}></div>
                            }
                            return null;
                        })()}

                        <div className="space-y-6 relative z-10">
                            {details?.timeline?.map((step: any, idx: number) => (
                                <div key={idx} className="flex gap-4 group">
                                    <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${step.active ? 'bg-green-500 border-green-500' : 'bg-white border-slate-300'
                                        }`}>
                                        {step.active && <div className="w-2 h-2 bg-white rounded-full"></div>}
                                    </div>
                                    <div className={`flex-1 ${step.active ? 'opacity-100' : 'opacity-50'}`}>
                                        <h5 className="text-sm font-bold text-slate-900">{step.status}</h5>
                                        {step.date && <p className="text-xs text-slate-500">{step.date}</p>}
                                        {step.active && idx === details.timeline.length - 1 && (
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                Your item is on the way.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Open Box Delivery / OTP Section */}
                    {(details?.otp || order.otp) && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <h5 className="font-bold text-slate-900 mb-3 text-sm">Keep in mind at doorstep</h5>

                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                        📦
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-slate-900">Open box delivery</p>
                                        <p className="text-[10px] text-slate-500">Verify item before sharing OTP</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OTP</div>
                                    <div className="text-xl font-black text-slate-900">{details?.otp || order.otp}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Price and Nav */}
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-xs text-slate-500">Total Amount</p>
                            <p className="text-lg font-bold text-slate-900">{details?.priceInfo?.finalAmount || order.price}</p>
                        </div>
                        {order.orderUrl && (
                            <a href={order.orderUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors">
                                View Invoice
                            </a>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export const UserDashboard: React.FC<Props> = ({ username, onLogout }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [browserLoading, setBrowserLoading] = useState(false);
    const [isFetchingOrders, setIsFetchingOrders] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
    const [isFetchingGV, setIsFetchingGV] = useState(false);

    // Batch fetch state
    const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
    const [isBatchFetching, setIsBatchFetching] = useState(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const data = await api.getAccounts();
            const accountsList = data.accounts || [];
            setAccounts(accountsList);
            if (accountsList.length > 0 && !activeAccountId) {
                // Prefer healthy accounts
                const healthy = accountsList.find(a => a.status === 'Healthy');
                setActiveAccountId(healthy ? healthy.id : accountsList[0].id);
            }
        } catch (error) {
            console.error('Failed to load accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    const handleOpenBrowser = async (platform: Platform) => {
        if (!activeAccountId) return;
        setBrowserLoading(true);
        try {
            await api.openSession(activeAccountId, platform);
        } catch (error) {
            console.error('Failed to open browser:', error);
        } finally {
            setBrowserLoading(false);
        }
    };

    const handleFetchGV = async () => {
        if (!activeAccountId) return;
        setIsFetchingGV(true);
        try {
            // Optimistic update notification or toast could be added here
            const res = await api.fetchGVBalance(activeAccountId);
            if (res.success) {
                await loadAccounts();
                // Simple feedback (could be improved with toast)
                console.log(`[GV] Fetched: ${res.balance}`);
            } else {
                console.error(`[GV] Failed: ${res.error}`);
            }
        } catch (error) {
            console.error('[GV] Error:', error);
        } finally {
            setIsFetchingGV(false);
        }
    };

    const handleRemoveAccount = async (id: string) => {
        if (!confirm('Are you sure you want to remove this account?')) return;
        try {
            await api.deleteAccount(id);
            await loadAccounts();
            if (activeAccountId === id) {
                setActiveAccountId(undefined);
            }
        } catch (error) {
            console.error('Failed to remove account:', error);
        }
    };

    const handleFetchOrders = async () => {
        if (!activeAccountId || !activeAccount) return;
        setIsFetchingOrders(true);
        try {
            await api.fetchOrders(activeAccountId, activeAccount.platform);
            await loadAccounts();
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setIsFetchingOrders(false);
        }
    };

    // Batch fetch all accounts
    const handleBatchFetchOrders = async (platform: Platform = 'flipkart') => {
        if (accounts.length === 0) return;

        const accountIds = accounts.map(a => a.id);
        setIsBatchFetching(true);
        setBatchJob({
            jobId: 'starting...',
            status: 'pending',
            total: accountIds.length,
            completed: 0,
            failed: 0,
            results: [],
            errors: []
        });

        try {
            const response = await api.batchFetchOrders(accountIds, platform, 5);
            if (response.success && response.jobId) {
                // Start polling for job status
                pollJobStatus(response.jobId);
            } else {
                setIsBatchFetching(false);
                setBatchJob(null);
            }
        } catch (error) {
            console.error('Failed to start batch fetch:', error);
            setIsBatchFetching(false);
            setBatchJob(null);
        }
    };

    const pollJobStatus = async (jobId: string) => {
        // Clear any existing interval
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        // Poll every 2 seconds
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await api.getBatchJobStatus(jobId);
                if (response.success && response.job) {
                    setBatchJob(response.job);

                    // Stop polling if job is done
                    if (['completed', 'cancelled', 'failed'].includes(response.job.status)) {
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                        setIsBatchFetching(false);
                        // Reload accounts to get updated orders
                        await loadAccounts();
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);
    };

    const handleCancelBatch = async () => {
        if (!batchJob?.jobId) return;
        try {
            await api.cancelBatchJob(batchJob.jobId);
        } catch (error) {
            console.error('Failed to cancel batch:', error);
        }
    };

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, onClick: () => setCurrentView('dashboard') },
        { id: 'browse', label: 'Browse', icon: <BrowseIcon />, onClick: () => setCurrentView('browse') },
        { id: 'orders', label: 'Orders', icon: <OrdersIcon />, onClick: () => setCurrentView('orders') },
        { id: 'activity', label: 'Activity', icon: <ActivityIcon />, onClick: () => setCurrentView('activity') },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon />, onClick: () => setCurrentView('settings') },
    ];

    const renderContent = () => {
        switch (currentView) {
            case 'dashboard': return renderDashboardView();
            case 'browse': return renderBrowseView();
            case 'orders': return renderOrdersView();
            case 'settings': return renderSettingsView();
            default: return renderDashboardView();
        }
    };

    const renderOrdersView = () => {
        if (!activeAccount) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-slate-500">Please select an account to view orders.</p>
                </div>
            );
        }

        const allOrders = activeAccount.orders || [];

        // Filter Logic
        const filteredOrders = allOrders.filter(o => {
            const status = (o.status || '').toLowerCase();
            const isFinished = status.includes('delivered') || status.includes('return') || status.includes('refund') || status.includes('cancel');

            return activeTab === 'active' ? !isFinished : isFinished;
        });

        return (
            <div className="p-6 space-y-6">
                {/* Header Section with GV Balance */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Orders Dashboard</h3>
                        <p className="text-sm text-slate-500">Real-time order tracking and details</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* GUI Balance Card */}
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-2 rounded-lg shadow-sm">
                            <div className="text-[10px] font-medium opacity-80 uppercase tracking-wider">GV Balance</div>
                            <div className="text-lg font-bold">
                                {activeAccount.details?.gvBalance || '₹0.00'}
                            </div>
                        </div>

                        <button
                            onClick={handleFetchOrders}
                            disabled={isFetchingOrders}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {isFetchingOrders ? (
                                <>
                                    <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Fetching...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Refresh Orders</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tabs & Stats */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Active Orders ({allOrders.filter(o => {
                                const s = (o.status || '').toLowerCase();
                                return !(s.includes('delivered') || s.includes('return') || s.includes('refund') || s.includes('cancel'));
                            }).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'past' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            Past Orders ({allOrders.filter(o => {
                                const s = (o.status || '').toLowerCase();
                                return (s.includes('delivered') || s.includes('return') || s.includes('refund') || s.includes('cancel'));
                            }).length})
                        </button>
                    </div>
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="text-5xl mb-4">
                            {activeTab === 'active' ? '⚡' : '🕰️'}
                        </div>
                        <h4 className="text-lg font-medium text-slate-900">
                            No {activeTab} orders found
                        </h4>
                        <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                            {activeTab === 'active'
                                ? "Great news! You have no pending deliveries."
                                : "You haven't completed any orders yet."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredOrders.map((order, idx) => (
                            <OrderCard key={order.orderId || idx} order={order} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const [showModal, setShowModal] = useState(false);

        // Helper to parse the messy deliveryDetails blob into structured JSON
        const parseOrderDetails = (text?: string) => {
            if (!text) return null;

            const rawStatus = (order.status || '').toLowerCase();
            const orderIsDelivered = rawStatus.includes('delivered');
            const orderIsCancelled = rawStatus.includes('cancel');
            const orderIsReturned = rawStatus.includes('return') || rawStatus.includes('refund');

            // 1. Extract Address & Phone - improved patterns
            let shippingAddress: string | null = null;
            let phoneNumber: string | null = null;
            let receiverName: string | null = order.receiverName || null;

            // Try multiple patterns for address extraction
            const addressPatterns = [
                /Delivery details\s*([\s\S]*?)\s*(\d{10})/i,
                /Delivery Address\s*([\s\S]*?)\s*(\d{10})/i,
                /Ship to:\s*([\s\S]*?)\s*(\d{10})/i,
            ];
            for (const pattern of addressPatterns) {
                const match = text.match(pattern);
                if (match) {
                    shippingAddress = match[1].replace(/\n/g, ', ').trim();
                    phoneNumber = match[2];
                    break;
                }
            }

            // Extract name from address section if not already set
            if (!receiverName && shippingAddress) {
                const lines = shippingAddress.split(',').map(l => l.trim());
                if (lines.length > 0 && lines[0].length > 2 && lines[0].length < 40) {
                    receiverName = lines[0];
                }
            }

            // 2. Extract Price Breakdown
            const priceMatches = text.match(/₹([\d,]+)\s+₹([\d,]+)\s+Total fees\s+₹([\d,]+)\s+₹([\d,]+)/i);
            const priceInfo = priceMatches ? {
                mrp: priceMatches[1],
                sellingPrice: priceMatches[2],
                totalFees: priceMatches[3],
                finalAmount: priceMatches[4]
            } : null;

            // 3. Extract structured details as JSON
            const structuredDetails = {
                orderId: order.orderId,
                productName: order.productName,
                status: order.status,
                price: order.price,
                otp: order.otp,
                receiverName: receiverName,
                phoneNumber: phoneNumber,
                address: shippingAddress,
                trackingId: order.trackingId,
                seller: order.seller,
                sku: order.sku
            };

            // 4. Build Timeline based on order status
            const timeline: { status: string; date: string; active: boolean; details: string[] }[] = [];

            // Default timeline steps
            const defaultSteps = [
                { status: 'Ordered', alias: ['Order Confirmed', 'Order Placed'] },
                { status: 'Shipped', alias: ['Dispatched', 'In Transit'] },
                { status: 'Out For Delivery', alias: ['Out for Delivery'] },
                { status: 'Delivered', alias: ['Delivery'] }
            ];

            // For delivered/returned/cancelled orders, set timeline accordingly
            if (orderIsDelivered) {
                // All steps complete for delivered orders
                defaultSteps.forEach(step => {
                    timeline.push({ status: step.status, date: '', active: true, details: [] });
                });
            } else if (orderIsReturned) {
                // Delivered + returned
                defaultSteps.forEach(step => {
                    timeline.push({ status: step.status, date: '', active: true, details: [] });
                });
                timeline.push({ status: 'Returned', date: '', active: true, details: [] });
            } else if (orderIsCancelled) {
                // Only first step active
                timeline.push({ status: 'Ordered', date: '', active: true, details: ['Order was cancelled'] });
                timeline.push({ status: 'Cancelled', date: '', active: true, details: [] });
            } else {
                // Parse from text or use defaults with smart detection
                const headers = ['Order Confirmed', 'Shipped', 'Out For Delivery', 'Delivery'];
                let foundAnyHeader = false;

                headers.forEach(header => {
                    if (text.toLowerCase().includes(header.toLowerCase())) {
                        foundAnyHeader = true;
                    }
                });

                if (foundAnyHeader) {
                    // Try to parse from text
                    let splitIndices: { index: number, label: string }[] = [];
                    headers.forEach(h => {
                        const regex = new RegExp(h, 'i');
                        const match = text.match(regex);
                        if (match && match.index !== undefined) {
                            splitIndices.push({ index: match.index, label: h });
                        }
                    });
                    splitIndices.sort((a, b) => a.index - b.index);

                    for (let i = 0; i < splitIndices.length; i++) {
                        const current = splitIndices[i];
                        const next = splitIndices[i + 1];
                        const content = next
                            ? text.slice(current.index, next.index)
                            : text.slice(current.index, current.index + 200);

                        const hasPending = content.toLowerCase().includes('yet to be') ||
                            content.toLowerCase().includes('expected by');

                        const dateMatch = content.match(/((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)[^,]+,[^,]+)/i);
                        const stepDate = dateMatch ? dateMatch[0] : '';

                        // Step is active if it has actual date and no pending phrases
                        const isActive = stepDate.length > 0 && !hasPending;

                        // Extract details lines
                        const detailsLines = content.split('\n')
                            .map(l => l.trim())
                            .filter(l =>
                                l.length > 0 &&
                                !l.toLowerCase().includes(current.label.toLowerCase()) &&
                                (!stepDate || !l.includes(stepDate)) &&
                                !l.toLowerCase().includes('expected by') &&
                                !l.toLowerCase().includes('yet to be')
                            );

                        timeline.push({
                            status: current.label === 'Order Confirmed' ? 'Ordered' :
                                current.label === 'Delivery' ? 'Delivered' : current.label,
                            date: stepDate,
                            active: isActive,
                            details: detailsLines
                        });
                    }

                    // Enforce sequential - can't have later step active if earlier is inactive
                    let foundInactive = false;
                    for (let i = 0; i < timeline.length; i++) {
                        if (foundInactive) {
                            timeline[i].active = false;
                        } else if (!timeline[i].active) {
                            foundInactive = true;
                        }
                    }
                } else {
                    // Default: only ordered is active
                    timeline.push({ status: 'Ordered', date: '', active: true, details: ['Order placed'] });
                    timeline.push({ status: 'Shipped', date: '', active: false, details: [] });
                    timeline.push({ status: 'Out For Delivery', date: '', active: false, details: [] });
                    timeline.push({ status: 'Delivered', date: '', active: false, details: [] });
                }
            }

            return { shippingAddress, phoneNumber, receiverName, priceInfo, timeline, structuredDetails };
        };

        const details = parseOrderDetails(order.deliveryDetails);
        const currentStatus = order.status || 'Ordered';

        return (
            <div className="bg-white border border-slate-200 rounded-[8px] overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="p-5 flex flex-col lg:flex-row gap-8">
                    {/* Left: Product Info & Image */}
                    <div className="flex flex-col gap-4 w-full lg:w-[350px]">
                        <div className="flex gap-4">
                            <div className="w-24 h-24 flex-shrink-0 bg-slate-50 rounded p-2 flex items-center justify-center border border-slate-100">
                                {order.imageUrl ? (
                                    <img src={order.imageUrl} alt={order.productName} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                ) : (
                                    <div className="text-slate-200"><svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" /></svg></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm line-clamp-2 hover:text-blue-600 cursor-pointer">{order.productName}</h4>
                                <p className="text-[11px] text-slate-500 mt-1 uppercase font-semibold">SKU: {order.sku || 'N/A'}</p>
                                <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${currentStatus.toLowerCase().includes('deliver') ? 'bg-green-100 text-green-700' :
                                    currentStatus.toLowerCase().includes('cancel') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {order.status || 'Status Unknown'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="text-[9px] font-bold text-slate-400 uppercase">Order ID</div>
                                <div className="text-[11px] font-mono font-bold text-slate-700 truncate">{order.orderId || '--'}</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="text-[9px] font-bold text-slate-400 uppercase">OTP</div>
                                <div className="text-xs font-mono font-black text-indigo-600">{order.otp || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <span className="text-xs font-bold text-slate-600">Total Price</span>
                            <span className="text-lg font-black text-slate-900">{order.price || details?.priceInfo?.finalAmount || '₹--'}</span>
                        </div>
                    </div>

                    {/* Middle: Live Tracking Timeline - Flipkart Style */}
                    <div className="flex-1 border-l border-r border-slate-100 px-8 relative">
                        <div className="flex items-center justify-between mb-6">
                            <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Order Journey</h5>
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors flex items-center gap-1"
                            >
                                {isExpanded ? (
                                    <>
                                        <span>Hide Updates</span>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                    </>
                                ) : (
                                    <>
                                        <span>See All Updates</span>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="relative">
                            {/* Vertical connecting line - green for completed portion */}
                            <div className="absolute top-3 bottom-3 left-[9px] w-[2px] bg-slate-200 z-0"></div>
                            {details?.timeline && (() => {
                                const lastActiveIdx = details.timeline.reduce((acc, step, idx) => step.active ? idx : acc, -1);
                                const totalSteps = details.timeline.length;
                                const greenHeight = totalSteps > 1 ? ((lastActiveIdx) / (totalSteps - 1)) * 100 : 0;
                                return (
                                    <div
                                        className="absolute top-3 left-[9px] w-[2px] bg-green-500 z-[1] transition-all duration-500"
                                        style={{ height: `calc(${greenHeight}% - 6px)` }}
                                    ></div>
                                );
                            })()}

                            <div className="space-y-0 relative z-10">
                                {details?.timeline.map((step, idx) => {
                                    const isLastActive = step.active && (!details.timeline[idx + 1] || !details.timeline[idx + 1].active);
                                    const showDetails = isExpanded || isLastActive;

                                    return (
                                        <div key={idx} className="flex gap-4 items-start group pb-6 last:pb-0">
                                            {/* Circle indicator */}
                                            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 ${step.active
                                                ? 'bg-white border-2 border-green-500'
                                                : 'bg-white border-2 border-slate-300'
                                                }`}>
                                                {step.active && (
                                                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                                                )}
                                            </div>

                                            <div className={`flex-1 min-w-0 transition-opacity ${step.active ? 'opacity-100' : 'opacity-60'}`}>
                                                {/* Status Header with Date */}
                                                <div className="flex flex-wrap items-baseline gap-2">
                                                    <h4 className={`text-[15px] font-bold ${step.active ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {step.status}
                                                        {!step.active && step.date && (
                                                            <span className="font-normal text-slate-500 ml-1">Expected By {step.date}</span>
                                                        )}
                                                    </h4>
                                                    {step.active && step.date && (
                                                        <span className="text-sm text-slate-500">{step.date}</span>
                                                    )}
                                                </div>

                                                {/* Detailed sub-events - shown when expanded */}
                                                {showDetails && step.details.length > 0 && (
                                                    <div className="mt-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        {step.details.map((line, dIdx) => {
                                                            // Try to extract timestamp from line
                                                            const timeMatch = line.match(/([A-Za-z]{3},?\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3}(?:\s+'\d{2})?\s*-?\s*\d{1,2}:\d{2}(?:am|pm)?)/i);
                                                            const timestamp = timeMatch ? timeMatch[0] : null;
                                                            const content = timestamp ? line.replace(timestamp, '').trim() : line;

                                                            return (
                                                                <div key={dIdx} className="text-sm text-slate-600 leading-relaxed">
                                                                    <p className="font-medium text-slate-700">{content}</p>
                                                                    {timestamp && (
                                                                        <p className="text-xs text-slate-400 mt-0.5">{timestamp}</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Pending status message */}
                                                {!step.active && showDetails && (
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        {step.status === 'Shipped' && 'Item yet to be shipped.'}
                                                        {step.status === 'Out For Delivery' && 'Item yet to be out for delivery.'}
                                                        {step.status === 'Delivered' && 'Item yet to be delivered.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Shipping & Price Breakdown */}
                    <div className="w-full lg:w-[300px] flex flex-col gap-6">
                        {/* Shipping Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Shipping Details</h5>
                            </div>
                            <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                                <p className="text-xs font-bold text-slate-800 mb-1">{details?.receiverName || order.receiverName || 'Receiver'}</p>
                                <p className="text-[11px] text-slate-600 leading-relaxed italic">{details?.shippingAddress || 'Address not available'}</p>
                                {details?.phoneNumber && (
                                    <div className="flex items-center gap-2 mt-2 text-indigo-600">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        <span className="text-xs font-black">{details.phoneNumber}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Price Breakdown */}
                        {details?.priceInfo && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Payment Summary</h5>
                                </div>
                                <div className="space-y-2 px-1">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500 font-medium">List Price</span>
                                        <span className="text-slate-700 font-bold line-through">₹{details.priceInfo.mrp}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500 font-medium">Selling Price</span>
                                        <span className="text-slate-700 font-bold">₹{details.priceInfo.sellingPrice}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-500 font-medium">Extra Fees</span>
                                        <span className="text-amber-600 font-bold">+ ₹{details.priceInfo.totalFees}</span>
                                    </div>
                                    <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-center mt-2">
                                        <span className="text-xs font-black text-slate-900">Total Charged</span>
                                        <span className="text-sm font-black text-indigo-700">₹{details.priceInfo.finalAmount}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-4 flex gap-2">
                            {order.orderUrl && (
                                <a
                                    href={order.orderUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-center py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded hover:bg-black transition-colors"
                                >
                                    Track on Website
                                </a>
                            )}
                            <button
                                onClick={() => setShowModal(true)}
                                className="px-3 py-2 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                            >
                                <span className="sr-only">View Details</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Detailed Modal */}
                {showModal && (
                    <OrderDetailsModal
                        order={order}
                        details={{ ...details, timeline: details?.timeline || [] }}
                        onClose={() => setShowModal(false)}
                    />
                )}
            </div>
        );
    };

    const renderDashboardView = () => (
        <div className="p-6 space-y-6">
            {/* Welcome Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-2">Welcome back, {username}!</h2>
                <p className="text-indigo-100">
                    Manage your Flipkart & Shopsy accounts from one place.
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected IDs</div>
                    <div className="text-2xl font-black text-slate-900">{accounts.length}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Active Sessions</div>
                    <div className="text-2xl font-black text-green-600">
                        {accounts.filter(a => a.status === 'Healthy').length}
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Needs Attention</div>
                    <div className="text-2xl font-black text-amber-600">
                        {accounts.filter(a => a.status === 'Error' || a.status === 'NeedsRefresh').length}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {activeAccount && (
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => handleOpenBrowser('flipkart')}
                            disabled={browserLoading}
                            className="flex items-center px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
                        >
                            <span className="text-yellow-600 font-bold text-sm">🛒 Open Flipkart</span>
                        </button>
                        <button
                            onClick={() => handleOpenBrowser('shopsy')}
                            disabled={browserLoading}
                            className="flex items-center px-4 py-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                            <span className="text-green-600 font-bold text-sm">🛍️ Open Shopsy</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Batch Fetch Orders Section */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Batch Fetch Orders</h3>
                        <p className="text-sm text-slate-500">Fetch orders from all {accounts.length} accounts at once</p>
                    </div>
                    {!isBatchFetching ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleBatchFetchOrders('flipkart')}
                                disabled={accounts.length === 0}
                                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Fetch All (Flipkart)
                            </button>
                            <button
                                onClick={() => handleBatchFetchOrders('shopsy')}
                                disabled={accounts.length === 0}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                Fetch All (Shopsy)
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleCancelBatch}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancel
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                {batchJob && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">
                                {batchJob.status === 'completed' ? '✅ Completed' :
                                    batchJob.status === 'cancelled' ? '⚠️ Cancelled' :
                                        batchJob.status === 'failed' ? '❌ Failed' :
                                            `⏳ Processing ${batchJob.completed}/${batchJob.total} accounts...`}
                            </span>
                            <span className="text-slate-500">
                                {batchJob.failed > 0 && <span className="text-red-500 mr-2">{batchJob.failed} failed</span>}
                                {Math.round((batchJob.completed / batchJob.total) * 100)}%
                            </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${batchJob.status === 'completed' ? 'bg-green-500' :
                                    batchJob.status === 'failed' ? 'bg-red-500' :
                                        batchJob.status === 'cancelled' ? 'bg-amber-500' :
                                            'bg-indigo-500'
                                    }`}
                                style={{ width: `${(batchJob.completed / batchJob.total) * 100}%` }}
                            />
                        </div>

                        {/* Recent Results */}
                        {batchJob.results.length > 0 && (
                            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-slate-50 text-xs space-y-1">
                                {batchJob.results.slice(-5).reverse().map((result, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="font-mono truncate max-w-[200px]">{result.accountId}</span>
                                        <span className={`font-bold ${result.status === 'done' ? 'text-green-600' :
                                            result.status === 'error' ? 'text-red-600' :
                                                result.status === 'running' ? 'text-blue-600' :
                                                    'text-slate-400'
                                            }`}>
                                            {result.status === 'done' ? `✓ ${result.ordersFound} orders` :
                                                result.status === 'error' ? `✗ Error` :
                                                    result.status === 'running' ? '⏳' : '○'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Errors Summary */}
                        {batchJob.errors.length > 0 && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                <strong>Errors:</strong> {batchJob.errors.slice(0, 3).map(e => e.accountId).join(', ')}
                                {batchJob.errors.length > 3 && ` and ${batchJob.errors.length - 3} more...`}
                            </div>
                        )}
                    </div>
                )}

                {!batchJob && (
                    <div className="text-center py-8 text-slate-400">
                        <div className="text-4xl mb-2">📦</div>
                        <p className="text-sm">Click "Fetch All" to start batch fetching orders from all your accounts</p>
                        <p className="text-xs mt-1">Runs 5 browsers in parallel for optimal speed</p>
                    </div>
                )}
            </div>

            {/* Total GV Balance Summary */}
            {accounts.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold opacity-90">Total GV Balance</h3>
                            <p className="text-sm opacity-75">Across all {accounts.length} accounts</p>
                        </div>
                        <div className="text-3xl font-black">
                            ₹{accounts.reduce((sum, acc) => {
                                const balance = acc.details?.gvBalance?.replace(/[₹,]/g, '') || '0';
                                return sum + (parseFloat(balance) || 0);
                            }, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderBrowseView = () => {
        if (!activeAccount) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <p className="text-slate-500 mb-4">No account selected</p>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Add Account
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="p-6 space-y-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Browse with {activeAccount.details?.name || activeAccount.identifier}
                            </h3>
                            {activeAccount.details?.name && (
                                <p className="text-sm text-slate-500">{activeAccount.identifier}</p>
                            )}
                            <p className="text-sm text-slate-500">Opens in a separate browser window with your saved session</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => handleOpenBrowser('flipkart')}
                            disabled={browserLoading}
                            className="flex-1 min-w-[150px] flex items-center justify-center px-6 py-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors disabled:opacity-50 font-bold"
                        >
                            {browserLoading ? 'Opening...' : '🛒 Open Flipkart'}
                        </button>
                        <button
                            onClick={() => handleOpenBrowser('shopsy')}
                            disabled={browserLoading}
                            className="flex-1 min-w-[150px] flex items-center justify-center px-6 py-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 font-bold"
                        >
                            {browserLoading ? 'Opening...' : '🛍️ Open Shopsy'}
                        </button>
                        <button
                            onClick={handleFetchGV}
                            disabled={isFetchingGV || browserLoading}
                            className="flex-1 min-w-[150px] flex items-center justify-center px-6 py-4 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 font-bold"
                        >
                            {isFetchingGV ? 'Fetching...' : '💳 Fetch Balance'}
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-700">
                        <strong>💡 Tip:</strong> Your session is automatically saved. No need to login again!
                    </p>
                </div>
            </div>
        );
    };

    const renderSettingsView = () => (
        <div className="p-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">User Settings</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <div>
                            <p className="font-medium text-slate-900">Username</p>
                            <p className="text-sm text-slate-500">{username}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <div>
                            <p className="font-medium text-slate-900">Connected Accounts</p>
                            <p className="text-sm text-slate-500">{accounts.length} account(s)</p>
                        </div>
                    </div>
                    <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-600 rounded">
                            In Process
                        </span>
                        <p className="text-sm text-slate-500 mt-2">
                            More settings options coming soon...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>


            <Layout
                username={username}
                role="user"
                accounts={accounts}
                activeAccountId={activeAccountId}
                navItems={navItems}
                onSelectAccount={setActiveAccountId}
                onRemoveAccount={handleRemoveAccount}
                onAddAccount={() => setIsAddModalOpen(true)}
                onRefresh={loadAccounts}
                onSignOut={() => { api.signOut(); onLogout(); }}
                showAccountSelector={true}
            >
                {renderContent()}
            </Layout>

            <ChatWidget onNavigate={(orderId) => {
                // Navigate to orders view
                const items = [...navItems];
                const ordersItem = items.find(i => i.id === 'orders');
                if (ordersItem) {
                    ordersItem.onClick?.();
                }
                // TODO: Implement specific order highlighting/scrolling if needed
                console.log('Navigate to order:', orderId);
            }} />

            <AddAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={loadAccounts}
            />
        </>
    );
};

