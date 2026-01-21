import React, { useMemo } from 'react';
import { Wallet as WalletIcon, RefreshCw, ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';
import { Account, Platform } from '../types';
import { FlipkartIcon, ShopsyIcon, AmazonIcon, GenericPlatformIcon } from '../components/Icons';

interface WalletProps {
    accounts: Account[];
}

// Mock helper to generate stable random balance based on ID
const getMockBalance = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Return distinct stable values for realism (e.g., 500, 1200, 5000)
    const base = Math.abs(hash) % 10000;
    return base > 100 ? base : base + 500;
};

export const Wallet: React.FC<WalletProps> = ({ accounts }) => {

    // Aggregate Data Calculation
    const walletData = useMemo(() => {
        const platformBalances: Record<string, number> = {};
        const accountBalances: Array<{ id: string; identifier: string; platform: Platform; balance: number }> = [];
        let total = 0;

        accounts.forEach(acc => {
            const bal = getMockBalance(acc.id);
            total += bal;

            // Platform aggregation
            platformBalances[acc.platform] = (platformBalances[acc.platform] || 0) + bal;

            // Individual account data
            accountBalances.push({
                id: acc.id,
                identifier: acc.identifier,
                platform: acc.platform,
                balance: bal
            });
        });

        return { total, platformBalances, accountBalances };
    }, [accounts]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary tracking-tight">Wallet & GV</h2>
                    <p className="text-text-secondary text-sm mt-1">Aggregated Gift Voucher balances across {accounts.length} connected accounts.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-subtle rounded-xl text-xs font-bold text-text-secondary hover:bg-bg-surface-hover transition-colors shadow-sm">
                    <RefreshCw size={14} />
                    Refresh Balances
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Main Cards */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Total Balance Card */}
                    <div className="bg-brand-primary rounded-card p-8 text-white relative overflow-hidden shadow-float">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />
                        <div className="relative z-10 flex flex-col justify-between h-40">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total Consolidated Value</p>
                                    <h3 className="text-5xl font-black mt-3 tracking-tight">{formatCurrency(walletData.total)}</h3>
                                </div>
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/5">
                                    <WalletIcon size={24} className="text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Platform Wise Breakdown */}
                    <div>
                        <h4 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                            Platform Breakdown
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(walletData.platformBalances).map(([platform, amount]) => (
                                <div key={platform} className="bg-bg-surface p-5 rounded-card border border-border-subtle shadow-card flex flex-col justify-between h-32 hover:border-brand-primary/20 transition-colors">
                                    <div className="flex justify-between items-start">
                                        {platform === 'flipkart' ? <FlipkartIcon size={24} /> :
                                            platform === 'shopsy' ? <ShopsyIcon size={24} /> :
                                                platform === 'amazon' ? <AmazonIcon size={24} /> :
                                                    <GenericPlatformIcon name={platform} className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-text-tertiary uppercase tracking-wider">{platform}</p>
                                        <p className="text-xl font-black text-text-primary mt-1">{formatCurrency(amount)}</p>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(walletData.platformBalances).length === 0 && (
                                <div className="col-span-full py-8 text-center text-text-tertiary text-sm bg-bg-canvas rounded-card border border-dashed border-border-subtle">
                                    No platform data available. Add accounts to see breakdown.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* All Accounts Table */}
                    <div className="bg-bg-surface rounded-card border border-border-subtle shadow-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
                            <h4 className="font-bold text-text-primary text-sm">Account-wise Balances</h4>
                            <button className="text-xs font-bold text-brand-accent hover:text-brand-primary border border-brand-accent/20 px-3 py-1.5 rounded-lg bg-brand-accent/5 hover:bg-brand-accent/10 transition-colors">Export CSV</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-bg-surface-hover text-text-tertiary font-bold text-xs uppercase tracking-wider border-b border-border-subtle">
                                    <tr>
                                        <th className="px-6 py-3">Account ID</th>
                                        <th className="px-6 py-3">Platform</th>
                                        <th className="px-6 py-3 text-right">Available Balance</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {walletData.accountBalances.map((acc, i) => (
                                        <tr key={i} className="hover:bg-bg-surface-hover transition-colors">
                                            <td className="px-6 py-4 font-bold text-text-primary">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-bg-canvas flex items-center justify-center text-xs font-black text-text-secondary border border-border-subtle">
                                                        {acc.identifier.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    {acc.identifier}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 capitalize text-text-secondary font-medium">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-canvas text-text-secondary text-[10px] font-bold uppercase tracking-wide border border-border-subtle">
                                                    {acc.platform}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-emerald-600 font-mono text-base">
                                                {formatCurrency(acc.balance)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-text-tertiary hover:text-brand-accent transition-colors">
                                                    <ChevronRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Recent Activity (Mocked) */}
                <div className="space-y-6">
                    <div className="bg-bg-surface rounded-card p-6 border border-border-subtle shadow-card h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="font-bold text-text-primary">Recent Activity</h4>
                            <button className="text-xs font-bold text-brand-accent hover:underline">View All</button>
                        </div>
                        <div className="space-y-6 relative">
                            {/* Connector Line */}
                            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-border-subtle -z-10"></div>

                            {[1, 2, 3, 4, 5].map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-bg-surface shadow-sm ${i % 2 === 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                        {i % 2 === 0 ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-text-primary">{i % 2 === 0 ? 'Order Debit' : 'Gift Card Credit'}</p>
                                            <span className={`text-xs font-black ${i % 2 === 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {i % 2 === 0 ? '-₹1,200' : '+₹500'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-tertiary mt-0.5">Flipkart (StartTech) • Today</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
