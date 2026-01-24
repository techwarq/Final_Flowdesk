import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDataFetcher } from './hooks/useDataFetcher';
import { api } from './api/client';
import { Account, Platform } from './types';
import { Layout } from './components/Layout';
import { AddAccountModal } from './components/AddAccountModal';
import {
    Activity,
    AlertTriangle,
    Bell,
    CheckCircle2,
    ChevronDown,
    Globe,
    Info,
    LayoutDashboard,
    Monitor,
    Settings,
    ShoppingBag,
    Trash2
} from 'lucide-react';
import { Support } from './pages/Support';
import {
    FlipkartIcon, ShopsyIcon, AmazonIcon, BlinkitIcon, RelianceIcon,
    ZeptoIcon, SamsungIcon, OnePlusIcon, VivoIcon, OppoIcon,
    RedmiIcon, RealmeIcon, IQOOIcon, VijaySalesIcon, GenericPlatformIcon
} from './components/Icons';
import { Orders } from './pages/Orders';
import { Wallet } from './pages/Wallet';
import { InAppBrowser } from './components/InAppBrowser';
import { ChatWidget } from './components/ChatWidget';

interface Props {
    username: string;
    onLogout: () => void;
    isAdmin?: boolean;
    onSwitchToAdmin?: () => void;
}

type ViewMode = 'dashboard' | 'browse' | 'id_portal' | 'orders' | 'wallet' | 'settings' | 'browser_1' | 'browser_2' | 'notifications' | 'support';

export const UserDashboard: React.FC<Props> = ({ username, onLogout, isAdmin: _isAdmin, onSwitchToAdmin }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [browserLoading, setBrowserLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<string>('Default');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    // Async data fetcher for orders and GV balance
    const {
        ordersData,
        gvData,
        orderStates,
        gvStates,
        isOrdersFetching,
        isGVFetching,
        currentOrderAccountId,
        currentGVAccountId,
        triggerOrdersFetch,
        triggerGVFetch
    } = useDataFetcher();

    const AVATARS = [
        { id: 'Default', icon: <div className="w-full h-full bg-brand-primary text-white flex items-center justify-center font-bold text-3xl">{username.charAt(0).toUpperCase()}</div> },
        { id: 'Robot', icon: <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center"><Monitor size={32} /></div> },
        { id: 'Smile', icon: <div className="w-full h-full bg-yellow-400 text-black flex items-center justify-center"><div className="text-3xl font-bold">☺</div></div> },
        { id: 'Ghost', icon: <div className="w-full h-full bg-purple-600 text-white flex items-center justify-center"><div className="text-3xl font-bold">👻</div></div> },
        { id: 'Ninja', icon: <div className="w-full h-full bg-red-600 text-white flex items-center justify-center"><div className="text-3xl font-bold">🐱</div></div> },
    ];

    // Enriched accounts with fetched orders and GV data
    const enrichedAccounts = useMemo(() => {
        return accounts.map(acc => ({
            ...acc,
            orders: ordersData[acc.id] || acc.orders || [],
            details: {
                ...acc.details,
                gvBalance: gvData[acc.id] || acc.details?.gvBalance
            }
        }));
    }, [accounts, ordersData, gvData]);

    const filteredAccounts = accounts.filter(acc =>
        acc.identifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.platform.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const data = await api.getAccounts();
            setAccounts(data.accounts || []);
            // Set first account as active if none selected
            if (!activeAccountId && data.accounts?.length > 0) {
                setActiveAccountId(data.accounts[0].id);
            }
        } catch (e) {
            console.error('Failed to load accounts:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAccounts();
    }, []);

    // Ref to prevent re-triggering fetch on HMR or re-renders
    const hasFetchedRef = useRef(false);

    // Trigger data fetching when accounts are loaded (only once per session)
    // COMMENTED OUT: Auto-fetch on login disabled - use buttons on Orders/Wallet pages instead
    // useEffect(() => {
    //     if (accounts.length > 0 && !loading && !hasFetchedRef.current) {
    //         hasFetchedRef.current = true;
    //         triggerOrdersFetch(accounts);
    //         triggerGVFetch(accounts);
    //     }
    // }, [accounts, loading]);

    const [launchTarget, setLaunchTarget] = useState<{ accountId: string; platform: Platform } | null>(null);

    // ...

    const handleOpenBrowser = async (platform: Platform) => {
        if (!activeAccountId) {
            alert('Please select an account first');
            return;
        }

        // Launch Internal Browser
        setLaunchTarget({ accountId: activeAccountId, platform });
        setCurrentView('browser_1');
    };

    const handleRemoveAccount = async (accountId: string) => {
        if (!confirm('Remove this account?')) return;
        try {
            await api.deleteAccount(accountId);
            loadAccounts();
            if (activeAccountId === accountId) {
                setActiveAccountId(undefined);
            }
        } catch (e) {
            alert('Failed to remove account');
        }
    };

    const handleInitializeNewAccount = (newAccount: Account) => {
        // Refresh account list
        loadAccounts();

        // AUTO-LAUNCH LOGIC:
        // 1. Set this new account as active
        setActiveAccountId(newAccount.id);

        // 2. Launch Session internally
        setLaunchTarget({ accountId: newAccount.id, platform: newAccount.platform });
        setCurrentView('browser_1');
    };

    const activeAccount = accounts.find(a => a.id === activeAccountId);

    const navItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard size={20} />,
            onClick: () => setCurrentView('dashboard'),
            active: currentView === 'dashboard'
        },
        {
            id: 'id_portal',
            label: 'ID Portal',
            icon: <Globe size={20} />,
            onClick: () => setCurrentView('id_portal'),
            active: currentView === 'id_portal'
        },
        {
            id: 'orders',
            label: 'Orders',
            icon: <ShoppingBag size={20} />,
            onClick: () => setCurrentView('orders'),
            active: currentView === 'orders'
        },
        {
            id: 'wallet',
            label: 'Wallet & GV',
            icon: <Activity size={20} />,
            onClick: () => setCurrentView('wallet'),
            active: currentView === 'wallet'
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <Settings size={20} />,
            onClick: () => setCurrentView('settings'),
            active: currentView === 'settings'
        },
        {
            id: 'browser_1',
            label: 'Browser 1',
            icon: <Monitor size={20} />,
            onClick: () => setCurrentView('browser_1'),
            active: currentView === 'browser_1',
            section: 'Browsers'
        },
        {
            id: 'browser_2',
            label: 'Browser 2',
            icon: <Monitor size={20} />,
            onClick: () => setCurrentView('browser_2'),
            section: 'Browsers'
        },
        {
            id: 'notifications',
            label: 'Notifications',
            icon: <Bell size={20} />,
            onClick: () => setCurrentView('notifications'),
            active: currentView === 'notifications',
            section: 'System'
        }
    ];

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
                </div>
            );
        }

        switch (currentView) {
            case 'browse':
                return renderBrowseView();
            case 'id_portal':
                return renderIDPortalView();
            case 'orders':
                return <Orders
                    accounts={enrichedAccounts}
                    isLoading={isOrdersFetching}
                    fetchingAccountId={currentOrderAccountId}
                    orderStates={orderStates}
                    onFetchOrders={() => triggerOrdersFetch(accounts)}
                />;
            case 'wallet':
                return <Wallet
                    accounts={enrichedAccounts}
                    onRefresh={() => {
                        loadAccounts();
                        triggerGVFetch(accounts);
                    }}
                    isLoading={isGVFetching}
                    fetchingAccountId={currentGVAccountId}
                    gvStates={gvStates}
                />;
            case 'support':
                return <Support />;
            case 'settings':
                return renderSettingsView();
            case 'browser_1':
            case 'browser_2':
                // Browsers are rendered separately to preserve state - this just returns null
                return null;
            case 'notifications':
                return renderNotificationsView();
            default:
                return renderDashboardView();
        }
    };



    const renderIDPortalView = () => {
        const platforms = Array.from(new Set(accounts.map(a => a.platform)));

        return (
            <div className="p-8 space-y-8 max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-bold text-text-primary tracking-tight">ID Portal</h3>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-6 py-3 bg-brand-primary text-white rounded-button hover:opacity-90 font-bold transition-all shadow-lg shadow-brand-primary/10 flex items-center gap-2"
                    >
                        + Add New ID
                    </button>
                </div>

                {platforms.length === 0 ? (
                    <div className="text-center py-20 bg-bg-surface rounded-card border border-border-subtle border-dashed">
                        <div className="w-20 h-20 bg-bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-6">
                            <Globe size={32} className="text-text-tertiary" />
                        </div>
                        <h4 className="text-xl font-bold text-text-primary mb-2">No Buyer Accounts Connected</h4>
                        <p className="text-text-secondary max-w-sm mx-auto">Add your first buyer account to get started with the workspace.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {platforms.map(platform => {
                            const platformAccounts = accounts.filter(a => a.platform === platform);
                            return (
                                <div key={platform} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 flex items-center justify-center">
                                            {platform === 'flipkart' ? <FlipkartIcon size={32} /> :
                                                platform === 'shopsy' ? <ShopsyIcon size={32} /> :
                                                    platform === 'amazon' ? <AmazonIcon size={32} /> :
                                                        platform === 'blinkit' ? <BlinkitIcon size={32} /> :
                                                            platform === 'reliance' ? <RelianceIcon size={32} /> :
                                                                platform === 'zepto' ? <ZeptoIcon size={32} /> :
                                                                    platform === 'samsung' ? <SamsungIcon size={32} /> :
                                                                        platform === 'oneplus' ? <OnePlusIcon size={32} /> :
                                                                            platform === 'vivo' ? <VivoIcon size={32} /> :
                                                                                platform === 'oppo' ? <OppoIcon size={32} /> :
                                                                                    platform === 'redmi' ? <RedmiIcon size={32} /> :
                                                                                        platform === 'realme' ? <RealmeIcon size={32} /> :
                                                                                            platform === 'iqoo' ? <IQOOIcon size={32} /> :
                                                                                                platform === 'vijaysales' ? <VijaySalesIcon size={32} /> :
                                                                                                    <GenericPlatformIcon name={platform} className="w-8 h-8" />}
                                        </div>
                                        <h4 className="text-lg font-black uppercase text-text-primary tracking-wider">
                                            {platform}
                                            <span className="ml-3 text-xs bg-bg-surface-hover text-text-secondary px-2 py-1 rounded-full border border-border-subtle">{platformAccounts.length}</span>
                                        </h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {platformAccounts.map(acc => (
                                            <div key={acc.id} className="bg-bg-surface p-5 rounded-card border border-border-subtle hover:border-brand-primary/20 transition-all shadow-card group relative">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-text-primary truncate">{acc.identifier}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className={`w-2 h-2 rounded-full ${acc.status === 'Healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                            <p className="text-xs text-text-secondary font-medium">{acc.status || 'Unknown'}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveAccount(acc.id)}
                                                        className="p-2 text-text-tertiary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <AlertTriangle size={16} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-subtle">
                                                    <button
                                                        onClick={() => {
                                                            setCurrentView('browser_1');
                                                        }}
                                                        className="flex-1 py-2 bg-bg-surface-hover text-text-secondary text-xs font-bold uppercase rounded-lg hover:bg-brand-primary hover:text-white transition-all border border-border-subtle hover:border-transparent"
                                                    >
                                                        Launch Session
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveAccount(acc.id)}
                                                        className="py-2 px-3 bg-red-50 text-red-500 text-xs font-bold uppercase rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-200 hover:border-transparent flex items-center gap-1"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderDashboardView = () => {
        const healthyCount = accounts.filter(a => a.status === 'Healthy').length;
        const attentionCount = accounts.filter(a => a.status === 'Error' || a.status === 'NeedsRefresh').length;
        const flipkartCount = accounts.filter(a => a.platform === 'flipkart').length;
        const shopsyCount = accounts.filter(a => a.platform === 'shopsy').length;
        const totalAccounts = accounts.length;

        // Calculate percentages for "Donut"
        const flipkartPct = totalAccounts > 0 ? (flipkartCount / totalAccounts) * 100 : 0;
        const shopsyPct = totalAccounts > 0 ? (shopsyCount / totalAccounts) * 100 : 0;

        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-text-primary tracking-tight">Welcome Back, {username}!</h2>
                        <p className="text-text-secondary font-medium mt-1">
                            You have <span className="text-text-primary font-bold">{accounts.length} linked accounts</span> today — keep it up!
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2.5 bg-bg-surface border border-border-subtle rounded-button text-text-tertiary hover:text-text-primary transition-all shadow-sm">
                            <Info size={18} />
                        </button>
                        <button onClick={loadAccounts} className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-subtle rounded-button text-xs font-bold text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-all shadow-sm">
                            <Activity size={16} className="text-text-tertiary" />
                            Refresh Data
                        </button>
                    </div>
                </div>

                {/* Highlights Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Stat Can: Total IDs */}
                    <div className="bg-bg-surface rounded-card p-6 shadow-card border border-border-subtle flex flex-col justify-between h-32 relative overflow-hidden group cursor-pointer hover:shadow-float transition-all" onClick={() => setCurrentView('id_portal')}>
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                    <Globe size={14} /> Total IDs
                                </p>
                                <h3 className="text-4xl font-black text-text-primary mt-2">{totalAccounts}</h3>
                            </div>
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">+12%</span>
                        </div>
                        {/* Decorative Sparkline (CSS) */}
                        <div className="absolute bottom-0 left-0 right-0 h-10 w-full opacity-20 group-hover:opacity-30 transition-opacity">
                            <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full h-full text-brand-accent fill-current">
                                <path d="M0,20 L0,10 Q25,18 50,5 T100,0 L100,20 Z" />
                            </svg>
                        </div>
                    </div>

                    {/* Stat Card: Active Sessions */}
                    <div className="bg-bg-surface rounded-card p-6 shadow-card border border-border-subtle flex flex-col justify-between h-32 hover:shadow-float transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 size={14} /> Active
                                </p>
                                <h3 className="text-4xl font-black text-text-primary mt-2">{healthyCount}</h3>
                            </div>
                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">Healthy</span>
                        </div>
                        <div className="w-full bg-bg-surface-hover h-1 rounded-full mt-auto overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(healthyCount / (totalAccounts || 1)) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Stat Card: Issues */}
                    <div className="bg-bg-surface rounded-card p-6 shadow-card border border-border-subtle flex flex-col justify-between h-32 hover:shadow-float transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={14} /> Issues
                                </p>
                                <h3 className="text-4xl font-black text-text-primary mt-2">{attentionCount}</h3>
                            </div>
                            {attentionCount > 0 ? (
                                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full border border-amber-100">Action Req.</span>
                            ) : (
                                <span className="bg-bg-surface-hover text-text-tertiary text-[10px] font-bold px-2 py-1 rounded-full border border-border-subtle">Good</span>
                            )}
                        </div>
                        <div className="w-full bg-bg-surface-hover h-1 rounded-full mt-auto overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(attentionCount / (totalAccounts || 1)) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Stat Card: Platform Split (Mini) */}
                    <div className="bg-bg-surface rounded-card p-6 shadow-card border border-border-subtle flex flex-col justify-between h-32 hover:shadow-float transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-2">
                                    <LayoutDashboard size={14} /> Platforms
                                </p>
                                <div className="flex -space-x-2 mt-3">
                                    <div className="w-8 h-8 rounded-full bg-[#fff700] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#2874f0]">F</div>
                                    <div className="w-8 h-8 rounded-full bg-[#00E065] border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">S</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-text-primary">{flipkartCount} F</span>
                                <span className="text-xs font-bold text-text-secondary">{shopsyCount} S</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Col: Account Status Table */}
                    <div className="lg:col-span-2 bg-bg-surface rounded-card p-8 shadow-card border border-border-subtle">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Activity size={18} className="text-text-tertiary" />
                                Account Status
                            </h3>
                            <div className="flex gap-2">
                                <button className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors">Filter</button>
                                <button className="px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary transition-colors">Sort</button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="pb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider pl-2">Account ID</th>
                                        <th className="pb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider">Platform</th>
                                        <th className="pb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider">Status</th>
                                        <th className="pb-4 text-xs font-bold text-text-tertiary uppercase tracking-wider text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {filteredAccounts.slice(0, 5).map(acc => (
                                        <tr key={acc.id} className="border-t border-border-subtle hover:bg-bg-surface-hover transition-colors group">
                                            <td className="py-4 pl-2 font-bold text-text-primary flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${acc.status === 'Healthy' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {acc.identifier}
                                            </td>
                                            <td className="py-4">
                                                {acc.platform === 'flipkart' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#fff700]/20 text-[#2874f0] text-[10px] font-bold uppercase tracking-wide">
                                                        Flipkart
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00E065]/20 text-[#00E065] text-[10px] font-bold uppercase tracking-wide">
                                                        Shopsy
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4">
                                                <span className={`text-xs font-bold ${acc.status === 'Healthy' ? 'text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100' :
                                                    acc.status === 'Error' ? 'text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100' :
                                                        'text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100'
                                                    }`}>
                                                    {acc.status}
                                                </span>
                                            </td>
                                            <td className="py-4 text-right pr-2">
                                                <button
                                                    onClick={() => { setActiveAccountId(acc.id); handleOpenBrowser(acc.platform); }}
                                                    className="px-3 py-1.5 bg-brand-primary text-white text-[10px] font-bold rounded-lg hover:opacity-90 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                                >
                                                    Launch
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {accounts.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-text-tertiary italic">No accounts connected yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right Col: Platform Split & Quick Review */}
                    <div className="space-y-8">
                        {/* Platform Split Donut */}
                        <div className="bg-bg-surface rounded-card p-8 shadow-card border border-border-subtle flex flex-col items-center justify-center text-center">
                            <h3 className="text-sm font-bold text-text-primary mb-6 w-full text-left flex items-center gap-2">
                                <LayoutDashboard size={18} className="text-text-tertiary" />
                                Platform Distribution
                            </h3>
                            <div className="relative w-40 h-40 mb-6">
                                <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                                    {/* Background Circle */}
                                    <path className="text-bg-surface-hover" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                                    {/* Shopsy Segment */}
                                    <path className="text-[#00E065]" strokeDasharray={`${shopsyPct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                                    {/* Flipkart Segment (Offset by Shopsy Pct) */}
                                    <path className="text-[#fff700]" strokeDasharray={`${flipkartPct}, 100`} strokeDashoffset={`-${shopsyPct}`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.5" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-3xl font-black text-text-primary">{totalAccounts}</span>
                                    <span className="text-[10px] font-bold text-text-tertiary uppercase">Total</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold w-full justify-center">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#fff700]" /> Flipkart</div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#00E065]" /> Shopsy</div>
                            </div>
                        </div>

                        {/* Quick Review */}
                        <div className="bg-bg-surface rounded-card p-8 shadow-card border border-border-subtle">
                            <h3 className="text-sm font-bold text-text-primary mb-2">Quick Access</h3>
                            <p className="text-xs text-text-tertiary mb-6">Jump to frequently used tools.</p>

                            <div className="space-y-3">
                                <button onClick={() => setCurrentView('id_portal')} className="w-full flex items-center gap-3 p-3 rounded-card bg-bg-surface-hover hover:bg-bg-surface hover:shadow-card hover:border-border-subtle transition-all group border border-transparent">
                                    <div className="w-8 h-8 rounded-lg bg-bg-surface shadow-sm flex items-center justify-center text-text-secondary group-hover:text-brand-accent">
                                        <Globe size={16} />
                                    </div>
                                    <span className="text-xs font-bold text-text-primary">Manage IDs</span>
                                    <ChevronDown size={14} className="ml-auto -rotate-90 text-text-tertiary" />
                                </button>
                                <button onClick={() => setCurrentView('orders')} className="w-full flex items-center gap-3 p-3 rounded-card bg-bg-surface-hover hover:bg-bg-surface hover:shadow-card hover:border-border-subtle transition-all group border border-transparent">
                                    <div className="w-8 h-8 rounded-lg bg-bg-surface shadow-sm flex items-center justify-center text-text-secondary group-hover:text-brand-accent">
                                        <ShoppingBag size={16} />
                                    </div>
                                    <span className="text-xs font-bold text-text-primary">Process Orders</span>
                                    <ChevronDown size={14} className="ml-auto -rotate-90 text-text-tertiary" />
                                </button>
                            </div>

                            <button onClick={() => setIsAddModalOpen(true)} className="w-full mt-6 py-3 bg-brand-primary text-white rounded-button text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-brand-primary/10 flex items-center justify-center gap-2">
                                Add New Account <ChevronDown size={14} className="-rotate-90" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBrowseView = () => {
        if (!activeAccount) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-md mx-auto">
                    <div className="w-20 h-20 bg-bg-surface-hover rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                        <Globe size={40} className="text-brand-accent" />
                    </div>
                    <h3 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">No Account Selected</h3>
                    <p className="text-text-secondary mb-8 leading-relaxed">Please select an account from the top bar to start a secure browsing session.</p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-8 py-4 bg-brand-accent text-white rounded-button hover:bg-brand-accent/90 font-bold shadow-lg shadow-brand-accent/20 transition-all hover:-translate-y-0.5"
                    >
                        + Add Account
                    </button>
                </div>
            );
        }

        return (
            <div className="p-8 space-y-8 max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-3xl font-bold text-text-primary tracking-tight">Browse Session</h3>
                        <p className="text-sm text-text-secondary mt-2 flex items-center gap-2">
                            Active Session:
                            <span className="font-bold text-brand-accent bg-brand-accent/5 px-2.5 py-0.5 rounded-md border border-brand-accent/10">
                                {activeAccount.identifier}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={() => setCurrentView('dashboard')}
                        className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-surface-hover border border-border-subtle rounded-button transition-all"
                    >
                        Esc / Back
                    </button>
                </div>

                <div className="bg-bg-surface rounded-card p-10 border border-border-subtle shadow-card">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <button
                            onClick={() => handleOpenBrowser('flipkart')}
                            disabled={browserLoading}
                            className="flex flex-col items-center justify-center p-12 bg-bg-surface hover:bg-bg-surface-hover border-2 border-border-subtle rounded-card hover:border-yellow-400/50 hover:shadow-float transition-all hover:-translate-y-1 group relative overflow-hidden"
                        >
                            <div className="w-24 h-24 bg-[#fff700] rounded-3xl shadow-sm flex items-center justify-center mb-8 group-hover:scale-105 transition-transform duration-300">
                                <FlipkartIcon size={48} className="text-[#2874f0]" />
                            </div>
                            <h4 className="text-2xl font-black text-text-primary mb-3">Open Flipkart</h4>
                            <p className="text-text-tertiary text-center font-medium">Go to Homepage</p>
                        </button>

                        <button
                            onClick={() => handleOpenBrowser('shopsy')}
                            disabled={browserLoading}
                            className="flex flex-col items-center justify-center p-12 bg-bg-surface hover:bg-bg-surface-hover border-2 border-border-subtle rounded-card hover:border-green-400/50 hover:shadow-float transition-all hover:-translate-y-1 group relative overflow-hidden"
                        >
                            <div className="w-24 h-24 bg-[#00E065] rounded-3xl shadow-sm flex items-center justify-center mb-8 group-hover:scale-105 transition-transform duration-300">
                                <ShopsyIcon size={48} className="text-[#00E065]" />
                            </div>
                            <h4 className="text-2xl font-black text-text-primary mb-3">Open Shopsy</h4>
                            <p className="text-text-tertiary text-center font-medium">Go to Homepage</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderSettingsView = () => (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">Settings</h3>

            {/* Profile Section */}
            <div className="bg-bg-surface rounded-card p-8 border border-border-subtle shadow-card">
                <div className="flex items-start justify-between mb-6 border-b border-border-subtle pb-4">
                    <h4 className="text-xs font-black text-text-tertiary uppercase tracking-widest">Profile Information</h4>
                    {!isEditingProfile && (
                        <button onClick={() => setIsEditingProfile(true)} className="text-xs font-bold text-brand-primary hover:text-brand-accent transition-colors">
                            Edit Profile
                        </button>
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Avatar Display / Selection */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-inner ring-4 ring-bg-surface border border-border-subtle relative group">
                            {AVATARS.find(a => a.id === selectedAvatar)?.icon}
                            {isEditingProfile && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    Change
                                </div>
                            )}
                        </div>
                        {isEditingProfile && (
                            <div className="grid grid-cols-5 gap-2 bg-bg-canvas p-2 rounded-xl">
                                {AVATARS.map(avatar => (
                                    <button
                                        key={avatar.id}
                                        onClick={() => setSelectedAvatar(avatar.id)}
                                        className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all ${selectedAvatar === avatar.id ? 'border-brand-primary scale-110 shadow-sm' : 'border-transparent hover:border-border-subtle'}`}
                                    >
                                        {avatar.icon}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-4">
                        {isEditingProfile ? (
                            <div className="space-y-4 max-w-sm">
                                <div>
                                    <label className="text-xs font-bold text-text-tertiary mb-1 block">Username</label>
                                    <input type="text" value={username} disabled className="w-full px-4 py-2 bg-bg-canvas border border-border-subtle rounded-lg text-text-secondary font-medium cursor-not-allowed" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text-tertiary mb-1 block">Current Plan</label>
                                    <select className="w-full px-4 py-2 bg-bg-canvas border border-border-subtle rounded-lg text-text-primary font-bold focus:ring-2 focus:ring-brand-primary outline-none">
                                        <option>Standard User Plan</option>
                                        <option>Pro User Plan</option>
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">Save Changes</button>
                                    <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 bg-bg-surface border border-border-subtle text-text-secondary text-xs font-bold rounded-lg hover:bg-bg-surface-hover">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-2xl font-black text-text-primary mb-1">{username}</h2>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-2 py-0.5 bg-brand-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-md">User</span>
                                    <span className="px-2 py-0.5 bg-bg-surface-hover text-text-secondary text-[10px] font-bold uppercase tracking-wider rounded-md border border-border-subtle">Standard Plan</span>
                                </div>
                                <p className="text-sm text-text-secondary">Manage your personal details and account settings here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Settings */}
                <div className="bg-bg-surface rounded-card p-8 border border-border-subtle shadow-card">
                    <h4 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-6 border-b border-border-subtle pb-2">General Preferences</h4>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">Dark Mode</span>
                            <div className="w-12 h-7 bg-bg-canvas border border-border-subtle rounded-full relative transition-colors">
                                <div className="absolute left-1 top-1 w-5 h-5 bg-text-tertiary rounded-full shadow-sm transition-transform"></div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">Notifications</span>
                            <div className="w-12 h-7 bg-brand-primary rounded-full relative transition-colors">
                                <div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm"></div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between group cursor-pointer">
                            <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">Auto-Launch Browsers</span>
                            <div className="w-12 h-7 bg-bg-canvas border border-border-subtle rounded-full relative transition-colors">
                                <div className="absolute left-1 top-1 w-5 h-5 bg-text-tertiary rounded-full shadow-sm transition-transform"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="bg-bg-surface rounded-card p-8 border border-border-subtle shadow-card">
                    <h4 className="text-xs font-black text-text-tertiary uppercase tracking-widest mb-6 border-b border-border-subtle pb-2">Security</h4>
                    <div className="space-y-3">
                        <button className="w-full text-left px-5 py-4 bg-bg-canvas hover:bg-bg-surface-hover rounded-xl border border-border-subtle font-bold text-text-primary text-sm transition-all flex justify-between items-center group shadow-sm hover:shadow-md">
                            Change Password
                            <ChevronDown size={16} className="-rotate-90 text-text-tertiary group-hover:text-brand-primary transition-colors" />
                        </button>
                        <button className="w-full text-left px-5 py-4 bg-bg-canvas hover:bg-bg-surface-hover rounded-xl border border-border-subtle font-bold text-text-primary text-sm transition-all flex justify-between items-center group shadow-sm hover:shadow-md">
                            Two-Factor Authentication
                            <ChevronDown size={16} className="-rotate-90 text-text-tertiary group-hover:text-brand-primary transition-colors" />
                        </button>
                    </div>
                </div>
            </div>

            {/* App Info */}
            <div className="bg-bg-canvas rounded-card p-8 border border-border-subtle border-dashed text-center opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex justify-center gap-12">
                    <div>
                        <p className="text-4xl font-black text-text-primary tracking-tighter">{accounts.length}</p>
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Connected IDs</p>
                    </div>
                    <div className="w-px bg-border-subtle h-12 self-center"></div>
                    <div>
                        <p className="text-4xl font-black text-text-primary tracking-tighter">1.2.0</p>
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Version</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderNotificationsView = () => (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h3 className="text-3xl font-bold text-text-primary tracking-tight">Notifications</h3>

            <div className="flex flex-col items-center justify-center py-20 bg-bg-surface rounded-card border border-border-subtle shadow-sm">
                <div className="w-16 h-16 bg-bg-surface-hover rounded-full flex items-center justify-center mb-4 text-text-tertiary">
                    <Bell size={24} />
                </div>
                <h4 className="text-lg font-bold text-text-primary">No new notifications</h4>
                <p className="text-text-secondary mt-1">We'll let you know when something important happens.</p>
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
                showSearch={currentView !== 'browser_1' && currentView !== 'browser_2' && currentView !== 'browse' && currentView !== 'settings'}
                showAddButton={currentView === 'id_portal' || currentView === 'dashboard'}
                onSearch={setSearchQuery}
                onSwitchToAdmin={onSwitchToAdmin}
            >
                {renderContent()}

                {/* Persistent Browsers - Hidden when not active, preserves state */}
                <div className={`absolute inset-0 z-50 ${currentView === 'browser_1' ? 'block' : 'hidden'}`}>
                    <InAppBrowser
                        savedAccounts={accounts}
                        onClose={() => setCurrentView('dashboard')}
                        onAddAccount={() => setIsAddModalOpen(true)}
                        launchTarget={launchTarget}
                    />
                </div>
                <div className={`absolute inset-0 z-50 ${currentView === 'browser_2' ? 'block' : 'hidden'}`}>
                    <InAppBrowser
                        savedAccounts={accounts}
                        onClose={() => setCurrentView('dashboard')}
                        onAddAccount={() => setIsAddModalOpen(true)}
                        launchTarget={launchTarget}
                    />
                </div>
            </Layout>


            <ChatWidget onNavigate={(orderId) => {
                setCurrentView('orders');
                console.log('Navigate to order:', orderId);
            }} />

            <AddAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={loadAccounts}
                onInitialize={handleInitializeNewAccount}
            />
        </>
    );
};
