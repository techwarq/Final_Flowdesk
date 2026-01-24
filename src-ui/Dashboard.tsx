import React, { useEffect, useState } from 'react';
import { api } from './api/client';
import { Account } from './types';
import { Layout } from './components/Layout';
import { AccountTable } from './components/AccountTable';
import { AddAccountModal } from './components/AddAccountModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminModal } from './components/AdminModal';
import {
    LayoutDashboard,
    Users,
    Smartphone,
    Activity,
    Settings,
    Layers,
    ShieldCheck,
    Search,
    RefreshCw,
    Plus,
    AlertTriangle,
    Info,
    CheckCircle2
} from 'lucide-react';

interface Props {
    username: string;
    onLogout: () => void;
    onSwitchToUser: () => void;
}

type AdminView = 'dashboard' | 'users' | 'accounts' | 'activity' | 'settings' | 'allocation' | 'access';

export const Dashboard: React.FC<Props> = ({ username, onLogout, onSwitchToUser }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState<'all' | 'flipkart' | 'shopsy'>('all');
    const [currentView, setCurrentView] = useState<AdminView>('dashboard');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAdminOpen, setIsAdminOpen] = useState(false);
    const [adminUsers, setAdminUsers] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.getAccounts();
            setAccounts(data.accounts || []);
            // Also load users and logs
            const [users, logs] = await Promise.all([
                api.getAdminUsers(),
                api.getActivityLogs()
            ]);

            if (Array.isArray(users)) setAdminUsers(users);
            if (Array.isArray(logs)) setActivityLogs(logs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filteredAccounts = accounts.filter(a => {
        const matchesSearch = search === '' ||
            a.id.toLowerCase().includes(search.toLowerCase()) ||
            a.identifier.toLowerCase().includes(search.toLowerCase()) ||
            (a.assignedTo && a.assignedTo.toLowerCase().includes(search.toLowerCase()));
        const matchesPlatform = platformFilter === 'all' || a.platform === platformFilter;
        return matchesSearch && matchesPlatform;
    });

    const stats = {
        totalAccounts: accounts.length,
        healthyAccounts: accounts.filter(a => a.status === 'Healthy').length,
        errorAccounts: accounts.filter(a => a.status === 'Error').length,
        newAccounts: accounts.filter(a => a.status === 'New').length,
        totalUsers: adminUsers.length,
        activeUsers: adminUsers.filter((u: any) => u.role !== 'disabled').length,
        flipkartAccounts: accounts.filter(a => a.platform === 'flipkart').length,
        shopsyAccounts: accounts.filter(a => a.platform === 'shopsy').length
    };

    const handleSignOut = () => {
        api.signOut();
        if (onLogout) onLogout();
        else window.location.reload();
    };

    const navItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard size={20} />,
            onClick: () => setCurrentView('dashboard'),
            active: currentView === 'dashboard'
        },
        {
            id: 'users',
            label: 'Users',
            icon: <Users size={20} />,
            onClick: () => setCurrentView('users'),
            active: currentView === 'users'
        },
        {
            id: 'accounts',
            label: 'IDs / Accounts',
            icon: <Smartphone size={20} />,
            onClick: () => setCurrentView('accounts'),
            active: currentView === 'accounts'
        },
        {
            id: 'activity',
            label: 'Activity Logs',
            icon: <Activity size={20} />,
            onClick: () => setCurrentView('activity'),
            active: currentView === 'activity'
        },
        {
            id: 'allocation',
            label: 'ID Allocation',
            icon: <Layers size={20} />,
            onClick: () => setCurrentView('allocation'),
            badge: 'Beta'
        },
        {
            id: 'access',
            label: 'Access Control',
            icon: <ShieldCheck size={20} />,
            onClick: () => setCurrentView('access'),
            badge: 'Beta'
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: <Settings size={20} />,
            onClick: () => { setCurrentView('settings'); setIsSettingsOpen(true); },
            active: currentView === 'settings'
        }
    ];

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            );
        }

        switch (currentView) {
            case 'accounts':
                return renderAccountsView();
            case 'users':
                return renderUsersView();
            case 'activity':
                return renderActivityView();
            case 'allocation':
            case 'access':
                return renderPlaceholderView(currentView === 'allocation' ? 'ID Allocation' : 'Access Control');
            default:
                return renderDashboardView();
        }
    };

    const renderPlaceholderView = (title: string) => (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                {title === 'ID Allocation' ? <Layers size={40} className="text-slate-400" /> : <ShieldCheck size={40} className="text-slate-400" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
                This feature includes advanced {title.toLowerCase()} configurations and is currently being prepared for the next release.
            </p>
            <button
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
            >
                Return to Dashboard
            </button>
        </div>
    );

    const renderDashboardView = () => (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">Admin Overview</h2>
                <p className="text-text-secondary text-sm mt-1">System status and key metrics</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-bg-surface rounded-card p-6 border border-border-subtle shadow-card hover:shadow-float transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-bg-surface-hover rounded-xl text-text-secondary">
                            <Users size={20} />
                        </div>
                        <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Total Users</div>
                    </div>
                    <div className="text-4xl font-black text-text-primary tracking-tight">{stats.totalUsers}</div>
                    <div className="text-xs font-semibold text-text-tertiary mt-2 bg-bg-surface-hover inline-block px-2 py-1 rounded-md">{stats.activeUsers} active</div>
                </div>

                <div className="bg-bg-surface rounded-card p-6 border border-border-subtle shadow-card hover:shadow-float transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-bg-surface-hover rounded-xl text-text-primary border border-border-subtle">
                            <Smartphone size={20} />
                        </div>
                        <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Total IDs</div>
                    </div>
                    <div className="text-4xl font-black text-text-primary tracking-tight">{stats.totalAccounts}</div>
                    <div className="text-xs font-medium text-text-tertiary mt-2">
                        <span className="text-yellow-600 font-bold">{stats.flipkartAccounts}</span> Flipkart • <span className="text-emerald-600 font-bold">{stats.shopsyAccounts}</span> Shopsy
                    </div>
                </div>

                <div className="bg-bg-surface rounded-card p-6 border border-border-subtle shadow-card hover:shadow-float transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Healthy Sessions</div>
                    </div>
                    <div className="text-4xl font-black text-emerald-600 tracking-tight">{stats.healthyAccounts}</div>
                </div>

                <div className="bg-bg-surface rounded-card p-6 border border-border-subtle shadow-card hover:shadow-float transition-all duration-300">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-red-50 rounded-xl text-red-600">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Needs Attention</div>
                    </div>
                    <div className="text-4xl font-black text-red-600 tracking-tight">0</div>
                    <div className="text-xs font-semibold text-text-tertiary mt-2 bg-bg-surface-hover inline-block px-2 py-1 rounded-md">{stats.newAccounts} new</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Accounts */}
                <div className="bg-bg-surface rounded-card border border-border-subtle shadow-card overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface-hover/50">
                        <h3 className="font-bold text-text-primary">Recent Accounts</h3>
                        <button
                            onClick={() => setCurrentView('accounts')}
                            className="text-xs text-text-primary font-bold hover:text-text-secondary hover:underline"
                        >
                            View All →
                        </button>
                    </div>
                    <div className="divide-y divide-border-subtle flex-1">
                        {accounts.slice(0, 5).map(acc => (
                            <div key={acc.id} className="px-6 py-4 flex items-center justify-between hover:bg-bg-surface-hover transition-colors">
                                <div className="flex items-center gap-4">
                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${acc.platform === 'flipkart'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-green-100 text-green-800'
                                        }`}>
                                        {acc.platform.slice(0, 3)}
                                    </span>
                                    <span className="text-sm font-semibold text-text-secondary">{acc.identifier}</span>
                                </div>

                            </div>
                        ))}
                        {accounts.length === 0 && (
                            <div className="px-6 py-12 text-center text-slate-400 text-sm">
                                <Smartphone size={24} className="mx-auto mb-2 opacity-50" />
                                No accounts connected
                            </div>
                        )}
                    </div>
                </div>

                {/* Warnings */}
                <div className="space-y-6">
                    <div className="bg-bg-surface rounded-card border border-border-subtle shadow-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-border-subtle bg-bg-surface-hover/50">
                            <h3 className="font-bold text-text-primary">System Warnings</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Errors hidden as per request */}
                            {false && stats.errorAccounts > 0 && (
                                <div className="flex items-start gap-4 p-4 bg-red-50/80 rounded-xl border border-red-100">
                                    <div className="p-2 bg-white rounded-full text-red-500 shadow-sm">
                                        <AlertTriangle size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">
                                            {stats.errorAccounts} account(s) with errors
                                        </p>
                                        <p className="text-xs text-text-secondary mt-1">Sessions may be expired or blocked. Please refresh them.</p>
                                        <button
                                            onClick={async () => {
                                                if (confirm('Reset all error statuses to "Needs Refresh"?')) {
                                                    await api.clearAccountErrors();
                                                    load();
                                                }
                                            }}
                                            className="mt-2 text-xs font-bold text-red-600 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                                        >
                                            Fix Errors
                                        </button>
                                    </div>
                                </div>
                            )}
                            {stats.newAccounts > 0 && (
                                <div className="flex items-start gap-4 p-4 bg-blue-50/80 rounded-xl border border-blue-100">
                                    <div className="p-2 bg-white rounded-full text-blue-500 shadow-sm">
                                        <Info size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">
                                            {stats.newAccounts} new account(s)
                                        </p>
                                        <p className="text-xs text-text-secondary mt-1">These accounts need their first login session.</p>
                                    </div>
                                </div>
                            )}
                            {stats.errorAccounts === 0 && stats.newAccounts === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-sm">
                                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-3">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <p className="font-medium text-slate-600">All systems operational</p>
                                    <p className="text-xs text-slate-400">No issues requiring attention</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderUsersView = () => (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h2>
                    <p className="text-slate-500 text-sm mt-1">Manage system access and roles</p>
                </div>
                <button
                    onClick={() => setIsAdminOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <Plus size={16} strokeWidth={3} />
                    ADD USER
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Last Active</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {adminUsers.length > 0 ? (
                            adminUsers.map((user: any, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4 font-bold text-slate-900">{user.username}</td>
                                    <td className="px-6 py-4 capitalize">{user.role}</td>
                                    <td className="px-6 py-4 text-slate-500">Just now</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold">Active</span></td>
                                    <td className="px-6 py-4 text-right"><span className="text-indigo-600 font-bold cursor-pointer">Edit</span></td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">No users found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderActivityView = () => (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Activity</h2>
                    <p className="text-slate-500 text-sm mt-1">Audit logs and system events</p>
                </div>
                <button className="text-indigo-600 font-bold text-xs hover:underline">Export Logs</button>
            </div>

            <div className="space-y-4">
                {activityLogs.length > 0 ? (
                    activityLogs.map((log: any, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-4">
                            <div className={`p-2 rounded-full shrink-0 ${log.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <Activity size={16} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">{log.message || 'System Event'}</p>
                                <p className="text-xs text-slate-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <Activity size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No activity logs found</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAccountsView = () => (
        <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Accounts</h2>
                <p className="text-slate-500 text-sm mt-1">View and manage connected platform accounts</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search identifier..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                        />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['all', 'flipkart', 'shopsy'].map(p => (
                            <button
                                key={p}
                                onClick={() => setPlatformFilter(p as any)}
                                className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${platformFilter === p
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={load}
                        className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={14} />
                        REFRESH LIST
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 active:transform active:scale-95"
                    >
                        <Plus size={16} strokeWidth={3} />
                        ADD ID
                    </button>
                </div>
            </div>

            {/* Account Table */}
            <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <AccountTable accounts={filteredAccounts} onRefresh={load} />
            </div>
        </div>
    );

    return (
        <>
            <Layout
                username={username}
                role="admin"
                accounts={accounts}
                navItems={navItems}
                onSelectAccount={() => { }}
                onAddAccount={() => setIsAddModalOpen(true)}
                onRefresh={load}
                onSignOut={handleSignOut} // Use wrapper that resets profile
                showAccountSelector={false}
                onSwitchToUser={onSwitchToUser}
            >
                {renderContent()}
            </Layout>

            <AddAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={load}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            <AdminModal
                isOpen={isAdminOpen}
                onClose={() => setIsAdminOpen(false)}
            />
        </>
    );
};
