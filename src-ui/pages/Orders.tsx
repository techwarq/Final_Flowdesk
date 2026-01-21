import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpRight, Copy, Truck, ShoppingBag, Clock } from 'lucide-react';
import { Account, Platform } from '../types';
import { FlipkartIcon, ShopsyIcon, AmazonIcon, GenericPlatformIcon } from '../components/Icons';

interface OrdersProps {
    accounts: Account[];
}

interface Order {
    id: string;
    accountId: string;
    platform: Platform;
    customerName: string;
    customerPhone?: string;
    status: 'Pending' | 'Ready to Ship' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';
    amount: number;
    date: string;
    trackingId?: string;
    otp?: string;
    paymentType: 'Prepaid' | 'COD';
    paymentStatus: 'Paid' | 'Pending' | 'Refunded';
}



// Mock data generator
const generateMockOrders = (accounts: Account[]): Order[] => {
    const orders: Order[] = [];
    const names = ['Amit Kumar', 'Rahul Singh', 'Priya Sharma', 'Sneha Gupta', 'Vikram Malhotra', 'Suresh Patel', 'Anjali Devi', 'Rohit Verma'];
    const statuses = ['Pending', 'Ready to Ship', 'Shipped', 'Delivered', 'Cancelled', 'Returned'] as const;

    accounts.forEach(acc => {
        // Generate 3-8 orders per account
        const count = 3 + (acc.identifier.length % 5);
        for (let i = 0; i < count; i++) {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const isCOD = Math.random() > 0.4;

            orders.push({
                id: `OD${Math.floor(Math.random() * 10000000000)}`,
                accountId: acc.identifier,
                platform: acc.platform,
                customerName: names[Math.floor(Math.random() * names.length)],
                customerPhone: Math.random() > 0.5 ? `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}` : undefined,
                status: status,
                amount: Math.floor(Math.random() * 5000) + 100,
                date: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleDateString(),
                trackingId: (status === 'Shipped' || status === 'Delivered') ? `TRK${Math.floor(Math.random() * 100000)}` : undefined,
                otp: (acc.platform === 'flipkart' || acc.platform === 'shopsy') && status === 'Delivered' && Math.random() > 0.7 ? `${Math.floor(Math.random() * 9000) + 1000}` : undefined,
                paymentType: isCOD ? 'COD' : 'Prepaid',
                paymentStatus: isCOD && status !== 'Delivered' ? 'Pending' : 'Paid'
            });
        }
    });

    return orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const Orders: React.FC<OrdersProps> = ({ accounts }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const allOrders = useMemo(() => generateMockOrders(accounts), [accounts]);

    // Stats calculation
    const stats = useMemo(() => {
        return {
            pending: allOrders.filter(o => o.status === 'Pending').length,
            ready: allOrders.filter(o => o.status === 'Ready to Ship').length,
            shipped: allOrders.filter(o => o.status === 'Shipped').length,
            returns: allOrders.filter(o => o.status === 'Returned' || o.status === 'Cancelled').length
        };
    }, [allOrders]);

    const filteredOrders = allOrders.filter(order =>
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.trackingId && order.trackingId.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary tracking-tight">Order Management</h2>
                    <p className="text-text-secondary text-sm mt-1">Track and process orders across {accounts.length} connected accounts.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2.5 bg-bg-surface border border-border-subtle text-text-secondary font-bold text-xs rounded-xl hover:bg-bg-surface-hover transition-colors flex items-center gap-2">
                        <Filter size={14} />
                        FILTER
                    </button>
                    <button className="px-4 py-2.5 bg-brand-accent text-white font-bold text-xs rounded-xl hover:opacity-90 transition-colors shadow-lg shadow-brand-accent/20 flex items-center gap-2">
                        <ArrowUpRight size={16} />
                        EXPORT CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-1">Pending Orders</p>
                    <p className="text-3xl font-black text-text-primary">{stats.pending}</p>
                </div>
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">Ready to Ship</p>
                    <p className="text-3xl font-black text-text-primary">{stats.ready}</p>
                </div>
                <div className="bg-bg-surface p-6 rounded-card shadow-card border border-border-subtle">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-1">Shipped Today</p>
                    <p className="text-3xl font-black text-text-primary">{stats.shipped}</p>
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
                            placeholder="Search by Order ID, Tracking ID, or Customer..."
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
                                    <th className="px-6 py-4 font-medium">Customer</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Payment</th>
                                    <th className="px-6 py-4 font-medium">Delivery</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-bg-surface-hover transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-bg-canvas flex items-center justify-center shrink-0 border border-border-subtle">
                                                    {order.platform === 'flipkart' ? <FlipkartIcon size={20} /> :
                                                        order.platform === 'shopsy' ? <ShopsyIcon size={20} /> :
                                                            order.platform === 'amazon' ? <AmazonIcon size={20} /> :
                                                                <GenericPlatformIcon name={order.platform} className="w-6 h-6" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-primary text-sm">{order.id}</p>
                                                    <p className="text-xs text-text-tertiary mt-0.5">{order.accountId}</p>
                                                    {order.otp && (
                                                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-md border border-yellow-200">
                                                            OTP: {order.otp} <Copy size={10} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-text-primary text-sm">{order.customerName}</p>
                                            {order.customerPhone && (
                                                <p className="text-xs text-text-secondary mt-0.5 font-mono">{order.customerPhone}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    order.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                                                        'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                {order.status === 'Delivered' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>}
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
                                            <p className="font-bold text-text-primary text-base">₹{order.amount.toLocaleString()}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                                <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wide">{order.paymentType}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs text-text-secondary font-medium">
                                                <Clock size={14} className="text-text-tertiary" />
                                                {order.date}
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
                        <p className="text-sm">Try connecting more accounts or adjusting filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
