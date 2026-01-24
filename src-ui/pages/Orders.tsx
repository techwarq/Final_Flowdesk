import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpRight, Copy, Truck, ShoppingBag, Clock, Check, RefreshCw, Loader } from 'lucide-react';
import { Account, Platform, Order } from '../types';
import { FlipkartIcon, ShopsyIcon, AmazonIcon, GenericPlatformIcon } from '../components/Icons';
import { FetchState } from '../hooks/useDataFetcher';

interface OrdersProps {
    accounts: Account[];
    isLoading?: boolean;
    fetchingAccountId?: string | null;
    orderStates?: Record<string, FetchState>;
    onFetchOrders?: () => void;
}

// Extended Order type for UI display with Account info
interface DisplayOrder extends Order {
    accountIdentifier: string;
    platform: Platform;
}

export const Orders: React.FC<OrdersProps> = ({ accounts, isLoading, fetchingAccountId, orderStates, onFetchOrders }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const allOrders: DisplayOrder[] = useMemo(() => {
        return accounts.flatMap(acc => (acc.orders || []).map(o => ({
            ...o,
            accountIdentifier: acc.identifier,
            platform: acc.platform
        })));
    }, [accounts]);

    // Stats calculation
    const stats = useMemo(() => {
        return {
            pending: allOrders.filter(o => o.status?.toLowerCase().includes('processing') || o.status?.toLowerCase().includes('ordered')).length,
            ready: allOrders.filter(o => o.status?.toLowerCase().includes('packed') || o.status?.toLowerCase().includes('shipping')).length,
            shipped: allOrders.filter(o => o.status?.toLowerCase().includes('shipped') || o.status?.toLowerCase().includes('delivery')).length,
            returns: allOrders.filter(o => o.status?.toLowerCase().includes('return') || o.status?.toLowerCase().includes('cancel')).length
        };
    }, [allOrders]);

    // Calculate fetch progress
    const fetchProgress = useMemo(() => {
        if (!orderStates) return { done: 0, total: 0 };
        const total = Object.keys(orderStates).length;
        const done = Object.values(orderStates).filter(s => s.status === 'done' || s.status === 'error').length;
        return { done, total };
    }, [orderStates]);

    const currentAccount = accounts.find(a => a.id === fetchingAccountId);

    const filteredOrders = allOrders.filter(order => {
        // Text Search
        const matchesSearch = order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.trackingId && order.trackingId.toLowerCase().includes(searchQuery.toLowerCase()));

        // Status Filter
        let matchesFilter = true;
        if (filterStatus !== 'all') {
            const status = (order.status || '').toLowerCase();
            if (filterStatus === 'processing') {
                // Expanded to include Ordered, Confirmed, etc.
                matchesFilter = status.includes('processing') || status.includes('ordered') || status.includes('confirmed') || status.includes('approval');
            } else if (filterStatus === 'shipped') {
                // Expanded to include Expected, In Transit, On the way
                matchesFilter = status.includes('shipped') || status.includes('ready') || status.includes('out for delivery') || status.includes('arriving') || status.includes('expected') || status.includes('transit') || status.includes('way');
            } else if (filterStatus === 'delivered') {
                matchesFilter = status.includes('delivered');
            } else if (filterStatus === 'cancelled') {
                matchesFilter = status.includes('cancel') || status.includes('return') || status.includes('refund');
            }
        }

        return matchesSearch && matchesFilter;
    });

    const handleExportCSV = () => {
        const headers = ['Order ID', 'Product', 'Status', 'Price', 'Delivery Date', 'Tracking ID', 'Account', 'Platform'];
        const csvContent = [
            headers.join(','),
            ...filteredOrders.map(o => [
                o.orderId,
                `"${(o.productName || '').replace(/"/g, '""')}"`, // Escape quotes
                o.status,
                o.price,
                o.deliveryDate,
                o.trackingId || '',
                o.accountIdentifier,
                o.platform
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Loading Banner */}
            {isLoading && (
                <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-4 flex items-center gap-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-primary border-t-transparent"></div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-text-primary">
                            Fetching orders... ({fetchProgress.done}/{fetchProgress.total} accounts)
                        </p>
                        {currentAccount && (
                            <p className="text-xs text-text-secondary mt-0.5">
                                Currently fetching: <span className="font-medium">{currentAccount.identifier}</span> ({currentAccount.platform})
                            </p>
                        )}
                    </div>
                    <div className="w-32 h-2 bg-bg-surface-hover rounded-full overflow-hidden">
                        <div
                            className="h-full bg-brand-primary transition-all duration-300 rounded-full"
                            style={{ width: `${fetchProgress.total > 0 ? (fetchProgress.done / fetchProgress.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary tracking-tight">Order Management</h2>
                    <p className="text-text-secondary text-sm mt-1">Track and process orders across {accounts.length} connected accounts.</p>
                </div>
                <div className="flex gap-3">
                    {/* Fetch Orders Button */}
                    <button
                        onClick={onFetchOrders}
                        disabled={isLoading || !onFetchOrders}
                        className="px-4 py-2.5 bg-brand-primary text-white font-bold text-xs rounded-xl hover:opacity-90 transition-colors shadow-lg shadow-brand-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {isLoading ? 'FETCHING...' : 'FETCH ORDERS'}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`px-4 py-2.5 border text-xs font-bold rounded-xl flex items-center gap-2 transition-colors ${filterStatus !== 'all'
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-bg-surface border-border-subtle text-text-secondary hover:bg-bg-surface-hover'
                                }`}
                        >
                            <Filter size={14} />
                            FILTER {filterStatus !== 'all' && `(${filterStatus})`}
                        </button>

                        {/* Filter Dropdown */}
                        {isFilterOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-bg-surface rounded-xl shadow-xl border border-border-subtle z-20 overflow-hidden py-1">
                                    {[
                                        { id: 'all', label: 'All Orders' },
                                        { id: 'processing', label: 'Processing' },
                                        { id: 'shipped', label: 'Shipped / In Transit' },
                                        { id: 'delivered', label: 'Delivered' },
                                        { id: 'cancelled', label: 'Cancelled / Returns' }
                                    ].map(option => (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                setFilterStatus(option.id);
                                                setIsFilterOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-surface-hover flex items-center justify-between text-text-secondary hover:text-text-primary"
                                        >
                                            {option.label}
                                            {filterStatus === option.id && <Check size={14} className="text-brand-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={handleExportCSV}
                        className="px-4 py-2.5 bg-brand-accent text-white font-bold text-xs rounded-xl hover:opacity-90 transition-colors shadow-lg shadow-brand-accent/20 flex items-center gap-2"
                    >
                        <ArrowUpRight size={16} />
                        EXPORT CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">Processing</p>
                    <p className="text-3xl font-black text-text-primary">{stats.pending}</p>
                </div>
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Ready / Shipped</p>
                    <p className="text-3xl font-black text-text-primary">{stats.ready + stats.shipped}</p>
                </div>
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-1">Total Found</p>
                    <p className="text-3xl font-black text-text-primary">{allOrders.length}</p>
                </div>
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Returns / Cancelled</p>
                    <p className="text-3xl font-black text-text-primary">{stats.returns}</p>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-bg-surface rounded-card shadow-card overflow-hidden flex flex-col min-h-[400px] border border-border-subtle">
                {/* Toolbar */}
                <div className="p-4 border-b border-border-subtle flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
                        <input
                            type="text"
                            placeholder="Search by Order ID, Tracking ID, or Product..."
                            className="w-full pl-10 pr-4 py-2.5 bg-bg-canvas border border-transparent rounded-xl text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all placeholder:text-text-tertiary text-text-primary"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                {filteredOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-text-secondary font-semibold text-xs border-b border-border-subtle bg-bg-surface">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Order Details</th>
                                    <th className="px-6 py-4 font-medium">Product</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Price</th>
                                    <th className="px-6 py-4 font-medium">Delivery Info</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {filteredOrders.map(order => (
                                    <tr key={order.orderId} className="hover:bg-bg-surface-hover transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-bg-canvas flex items-center justify-center shrink-0 border border-border-subtle">
                                                    {order.platform === 'flipkart' ? <FlipkartIcon size={20} /> :
                                                        order.platform === 'shopsy' ? <ShopsyIcon size={20} /> :
                                                            order.platform === 'amazon' ? <AmazonIcon size={20} /> :
                                                                <GenericPlatformIcon name={order.platform} className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-primary text-sm">{order.orderId}</p>
                                                    <p className="text-xs text-text-tertiary mt-0.5">{order.accountIdentifier}</p>
                                                    {order.otp && (
                                                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-md border border-yellow-200">
                                                            OTP: {order.otp} <Copy size={10} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-center gap-3">
                                                {order.imageUrl && (
                                                    <img src={order.imageUrl} alt="Product" className="w-8 h-8 rounded-md object-cover border border-border-subtle" />
                                                )}
                                                <p className="font-semibold text-text-primary text-sm truncate" title={order.productName}>{order.productName}</p>
                                            </div>
                                            {order.receiverName && (
                                                <p className="text-xs text-text-secondary mt-1">To: {order.receiverName}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${order.status?.includes('Delivered') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                order.status?.includes('Shipp') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    order.status?.includes('Cancel') ? 'bg-red-50 text-red-700 border-red-100' :
                                                        'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                {order.status?.includes('Delivered') && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>}
                                                {order.status}
                                            </span>
                                            {order.trackingId && (
                                                <div className="flex items-center gap-1 mt-2 text-[10px] text-text-tertiary font-mono">
                                                    <Truck size={10} />
                                                    {order.trackingId}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-text-primary text-base">{order.price}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs text-text-secondary font-medium">
                                                <Clock size={14} className="text-text-tertiary" />
                                                {order.deliveryDate || 'No date'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary py-20">
                        <div className="w-16 h-16 bg-bg-canvas rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag size={24} className="opacity-50" />
                        </div>
                        <p className="font-medium text-text-secondary">No orders found</p>
                        <p className="text-sm">Connect accounts and fetch orders to see them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
