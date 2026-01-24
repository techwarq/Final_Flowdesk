import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import {
    X,
    Plus,
    RefreshCw,
    ArrowLeft,
    ArrowRight,
    Shield,
    Globe,
    LogOut,
    Wifi,
    Search,
    ChevronDown,
    LayoutGrid
} from 'lucide-react';
import { Account, Platform } from '../types';
import { GenericPlatformIcon } from './Icons';

interface BrowserTab {
    id: string;
    title: string;
    url: string;
    loading: boolean;
    partition?: string;
    accountId?: string;
    platform?: Platform;
    actualIp?: string;
    initialUrl: string;
}

interface InAppBrowserProps {
    savedAccounts: Account[];
    onClose: () => void;
    onAddAccount?: () => void;
    launchTarget?: { accountId: string; platform: Platform } | null;
}

const START_URL = 'about:blank';

// Grouping saved accounts by Platform for the "Tree View" effect
// Flipkart and Shopsy share same auth, so show accounts under both platforms
const groupAccountsByPlatform = (accounts: Account[]) => {
    const grouped = accounts.reduce((acc, account) => {
        const p = account.platform;
        if (!acc[p]) acc[p] = [];
        acc[p].push(account);
        return acc;
    }, {} as Record<string, Account[]>);

    // Flipkart and Shopsy share authentication - merge them
    const flipkartAccounts = grouped['flipkart'] || [];
    const shopsyAccounts = grouped['shopsy'] || [];

    // Add Flipkart accounts to Shopsy (if they don't exist)
    if (flipkartAccounts.length > 0) {
        if (!grouped['shopsy']) grouped['shopsy'] = [];
        flipkartAccounts.forEach(acc => {
            if (!grouped['shopsy'].find(s => s.id === acc.id)) {
                grouped['shopsy'].push({ ...acc, platform: 'shopsy' as Platform });
            }
        });
    }

    // Add Shopsy accounts to Flipkart (if they don't exist)
    if (shopsyAccounts.length > 0) {
        if (!grouped['flipkart']) grouped['flipkart'] = [];
        shopsyAccounts.forEach(acc => {
            if (!grouped['flipkart'].find(s => s.id === acc.id)) {
                grouped['flipkart'].push({ ...acc, platform: 'flipkart' as Platform });
            }
        });
    }

    return grouped;
};

export const InAppBrowser: React.FC<InAppBrowserProps> = ({ savedAccounts, onClose, launchTarget }) => {

    const [tabs, setTabs] = useState<BrowserTab[]>([
        { id: 'start', title: 'New Tab', url: START_URL, initialUrl: START_URL, loading: false }
    ]);
    const [activeTabId, setActiveTabId] = useState<string>('start');
    const [urlInput, setUrlInput] = useState('');

    // Handle Launch Target (Auto-open tab)
    useEffect(() => {
        if (launchTarget) {
            const acc = savedAccounts.find(a => a.id === launchTarget.accountId);
            if (acc) {
                createNewTab(acc, launchTarget.platform);
            }
        }
    }, [launchTarget]);

    // UI State for New Tab Page
    const [expandedPlatforms, setExpandedPlatforms] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');

    const webviewRefs = useRef<{ [key: string]: any }>({});
    const activeTab = tabs.find(t => t.id === activeTabId);

    const groupedAccounts = groupAccountsByPlatform(savedAccounts);
    const platforms = Object.keys(groupedAccounts);

    const togglePlatform = (p: string) => {
        setExpandedPlatforms(prev => ({
            ...prev,
            [p]: !prev[p]
        }));
    };

    useEffect(() => {
        if (activeTab) {
            setUrlInput(activeTab.url === START_URL ? '' : activeTab.url);
        }
    }, [activeTabId, tabs]);

    // Attach Webview Listeners
    useEffect(() => {
        tabs.forEach(tab => {
            const wv = webviewRefs.current[tab.id];
            if (wv) {
                const onStart = () => updateTab(tab.id, { loading: true });
                const onStop = () => updateTab(tab.id, { loading: false, title: wv.getTitle() || tab.title, url: wv.getURL() });

                // Handle new window requests (target="_blank" links) - open in new tab instead of system browser
                const onNewWindow = (e: any) => {
                    e.preventDefault();
                    const newUrl = e.url;
                    if (newUrl && newUrl !== 'about:blank') {
                        // Create a new tab with the same partition (same account session)
                        const newTabId = `tab-${Date.now()}`;
                        const newTab: BrowserTab = {
                            id: newTabId,
                            title: 'Loading...',
                            url: newUrl,
                            initialUrl: newUrl,
                            loading: true,
                            partition: tab.partition, // Keep same session/cookies
                            accountId: tab.accountId,
                            platform: tab.platform,
                            actualIp: tab.actualIp
                        };
                        setTabs(prev => [...prev, newTab]);
                        setActiveTabId(newTabId);
                    }
                };

                // Handle loading errors gracefully (ERR_ABORTED is common during HMR/quick navigation)
                const onFailLoad = (e: any) => {
                    // ERR_ABORTED (-3) is common when navigation is interrupted - don't log as error
                    if (e.errorCode === -3) {
                        console.log(`[Webview] Navigation aborted for ${tab.id} (normal during quick navigation)`);
                    } else if (e.errorCode !== 0) {
                        console.warn(`[Webview] Load failed for ${tab.id}: ${e.errorDescription} (${e.errorCode})`);
                    }
                    updateTab(tab.id, { loading: false });
                };

                try {
                    wv.removeEventListener('did-start-loading', onStart);
                    wv.removeEventListener('did-stop-loading', onStop);
                    wv.removeEventListener('new-window', onNewWindow);
                    wv.removeEventListener('did-fail-load', onFailLoad);

                    wv.addEventListener('did-start-loading', onStart);
                    wv.addEventListener('did-stop-loading', onStop);
                    wv.addEventListener('new-window', onNewWindow);
                    wv.addEventListener('did-fail-load', onFailLoad);
                } catch (e) { console.error(e); }
            }
        });
    }, [tabs]); // Re-bind when tabs change (e.g. new tab added)

    const checkIP = async (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (!tab || !tab.accountId) return;

        updateTab(tabId, { actualIp: 'Checking...' });
        console.log(`[InAppBrowser] Checking IP for tab ${tabId} (Partition: ${tab.partition})`);

        // Request IP check from Main process
        if ((window as any).electron && (window as any).electron.getIpInfo) {
            console.log(`[InAppBrowser] Sending get-ip-info IPC for ${tab.partition}`);
            (window as any).electron.getIpInfo(tab.partition);
        } else {
            console.log('[InAppBrowser] Electron not found, using fallback');
            // Fallback for dev/browser without electron
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                updateTab(tabId, { actualIp: data.ip + ' (Local)' });
            } catch (e) {
                updateTab(tabId, { actualIp: 'Check Failed' });
            }
        }
    };

    // Listen for IP Code Result
    useEffect(() => {
        if (!(window as any).electron) return;

        const handleIpResult = (_: any, data: { partition: string, ip?: string, error?: string }) => {
            console.log(`[InAppBrowser] IP Result received for ${data.partition}:`, data);
            setTabs(prev => prev.map(t => {
                if (t.partition === data.partition) {
                    return { ...t, actualIp: data.ip || 'Error' };
                }
                return t;
            }));
        };

        const removeListener = (window as any).electron.on('ip-info-result', handleIpResult);
        return () => { if (removeListener) removeListener(); };
    }, []); // Empty dependency array to prevent listener flapping

    // Listen for open-url-in-tab from main process (intercepted window.open / target="_blank")
    useEffect(() => {
        if (!(window as any).electron) return;

        const handleOpenUrl = (_: any, data: { url: string }) => {
            console.log(`[InAppBrowser] Received open-url-in-tab:`, data.url);

            // Find active tab to inherit partition (session)
            const currentTab = tabs.find(t => t.id === activeTabId);

            if (data.url && data.url !== 'about:blank') {
                const newTabId = `tab-${Date.now()}`;
                const newTab: BrowserTab = {
                    id: newTabId,
                    title: 'Loading...',
                    url: data.url,
                    initialUrl: data.url,
                    loading: true,
                    partition: currentTab?.partition, // Inherit session from current tab
                    accountId: currentTab?.accountId,
                    platform: currentTab?.platform,
                    actualIp: currentTab?.actualIp
                };
                setTabs(prev => [...prev, newTab]);
                setActiveTabId(newTabId);
            }
        };

        const removeListener = (window as any).electron.on('open-url-in-tab', handleOpenUrl);
        return () => { if (removeListener) removeListener(); };
    }, [tabs, activeTabId]); // Depend on tabs and activeTabId to get current session

    const createNewTab = async (account?: Account, platform?: Platform) => {
        const newTabId = `tab-${Date.now()}`;
        const isSpecificSession = !!account;
        let partition = undefined;

        if (isSpecificSession && account) {
            partition = `persist:${account.id}`;

            // Open with current assigned proxy (no rotation prompt)
            // User can rotate IP using the dedicated button in header

            // Inject cookies & PROXY before opening functionality
            if ((window as any).electron && platform) {
                try {
                    // 1. Get Proxy
                    try {
                        const proxyRes = await api.get<{ success: boolean; proxy: string | null }>(`/accounts/${account.id}/proxy`);
                        if (proxyRes.data.success && proxyRes.data.proxy) {
                            const proxyHost = proxyRes.data.proxy.split('@')[1] || proxyRes.data.proxy;
                            console.log(`%c[InAppBrowser] 🌐 PROXY SET for ${partition}: ${proxyHost}`, 'color: cyan; font-weight: bold; font-size: 14px');
                            (window as any).electron.setProxy(partition, proxyRes.data.proxy);
                        } else {
                            console.log(`%c[InAppBrowser] ⚠️ No proxy assigned for ${partition} - using direct connection`, 'color: orange');
                            (window as any).electron.setProxy(partition, "");
                        }
                    } catch (e) {
                        console.error('Failed to fetch proxy settings', e);
                    }

                    // 2. Cookies
                    const cookies = await api.getCookies(account.id, platform);
                    if (cookies && cookies.length > 0) {
                        console.log(`[InAppBrowser] Injecting ${cookies.length} cookies for ${partition}`);
                        (window as any).electron.setCookies(partition, cookies);
                        // Small buffer to ensure Main process applies cookies
                        await new Promise(r => setTimeout(r, 200));
                    }
                } catch (e) {
                    console.error('[InAppBrowser] Failed to inject session data:', e);
                }
            }
        }

        const newTab: BrowserTab = {
            id: newTabId,
            title: isSpecificSession ? `${platform} - ${account.identifier}` : 'New Tab',
            url: isSpecificSession ? getPlatformUrl(platform!) : START_URL,
            initialUrl: isSpecificSession ? getPlatformUrl(platform!) : START_URL,
            loading: true,
            partition: partition,
            accountId: account?.id,
            platform: platform,
            actualIp: 'Checking...'
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTabId);
        setTimeout(() => checkIP(newTabId), 2000);
    };

    const closeTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        const newTabs = tabs.filter(t => t.id !== tabId);
        if (newTabs.length === 0) {
            setTabs([{ id: `tab-${Date.now()}`, title: 'New Tab', url: START_URL, initialUrl: START_URL, loading: false }]);
            setActiveTabId(newTabs[0]?.id || `tab-${Date.now()}`);
        } else {
            setTabs(newTabs);
            if (activeTabId === tabId) {
                setActiveTabId(newTabs[newTabs.length - 1].id);
            }
        }
    };

    const updateTab = (id: string, updates: Partial<BrowserTab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const handleNavigate = (e: React.FormEvent) => {
        e.preventDefault();
        let url = urlInput;
        // Simple valid check
        if (!url.includes('.') && !url.includes(':')) {
            // Search
            url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        } else if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        if (webviewRefs.current[activeTabId]) {
            webviewRefs.current[activeTabId].loadURL(url);
        }
    };

    const getPlatformUrl = (p: Platform) => {
        switch (p) {
            case 'flipkart': return 'https://www.flipkart.com/';
            case 'shopsy': return 'https://www.shopsy.in/';
            case 'amazon': return 'https://www.amazon.in/';
            case 'blinkit': return 'https://blinkit.com/';
            case 'zepto': return 'https://zeptonow.com/';
            case 'reliance': return 'https://www.reliancedigital.in/';
            case 'samsung': return 'https://www.samsung.com/in/';
            case 'oneplus': return 'https://www.oneplus.in/';
            case 'vivo': return 'https://www.vivo.com/in/';
            case 'oppo': return 'https://www.oppo.com/in/';
            case 'realme': return 'https://www.realme.com/in/';
            case 'redmi': return 'https://www.mi.com/in/';
            case 'iqoo': return 'https://www.iqoo.com/in/';
            case 'vijaysales': return 'https://www.vijaysales.com/';
            default: return `https://www.google.com/search?q=${p}`;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden rounded-[1.5rem] border border-slate-200 shadow-2xl">
            {/* Minimal Header */}
            <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-slate-100 z-20 shadow-sm shrink-0">
                <div className="flex gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-100 shrink-0">
                    <button onClick={() => webviewRefs.current[activeTabId]?.goBack()} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-slate-900 transition-all"><ArrowLeft size={16} /></button>
                    <button onClick={() => webviewRefs.current[activeTabId]?.goForward()} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-slate-900 transition-all"><ArrowRight size={16} /></button>
                    <button onClick={() => webviewRefs.current[activeTabId]?.reload()} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-slate-900 transition-all"><RefreshCw size={16} /></button>
                </div>

                {/* Integrated Address Bar */}
                <form onSubmit={handleNavigate} className="flex-1 max-w-2xl mx-auto flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/20 transition-all">
                    <div className="text-slate-400">
                        {activeTab?.url.includes('https') ? <Shield size={14} className="text-emerald-500" /> : <Globe size={14} />}
                    </div>
                    <input
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 min-w-0"
                        placeholder="Search or enter website..."
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                    />
                </form>

                <div className="flex items-center gap-3 shrink-0">
                    {activeTab?.actualIp && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm">
                            <Wifi size={12} />
                            <span className="text-[10px] font-bold font-mono">{activeTab.actualIp}</span>
                        </div>
                    )}

                    {/* Rotate IP Button */}
                    {activeTab?.accountId && (
                        <button
                            onClick={async () => {
                                try {
                                    console.log('%c[InAppBrowser] 🔄 Rotating IP...', 'color: magenta; font-weight: bold');

                                    // 1. Rotate Offset
                                    await api.post(`/accounts/${activeTab.accountId}/rotate-ip`, { skipLaunch: true });

                                    // 2. Set New Proxy
                                    if ((window as any).electron && activeTab.partition) {
                                        const proxyRes = await api.get<{ success: boolean; proxy: string | null }>(`/accounts/${activeTab.accountId}/proxy`);
                                        if (proxyRes.data.success && proxyRes.data.proxy) {
                                            const proxyHost = proxyRes.data.proxy.split('@')[1] || proxyRes.data.proxy;
                                            console.log(`%c[InAppBrowser] 🌐 NEW PROXY: ${proxyHost}`, 'color: lime; font-weight: bold; font-size: 14px');
                                            (window as any).electron.setProxy(activeTab.partition, proxyRes.data.proxy);
                                        } else {
                                            console.log('%c[InAppBrowser] ⚠️ No proxy - using direct connection', 'color: orange');
                                            (window as any).electron.setProxy(activeTab.partition, "");
                                        }
                                    }

                                    // 3. Reload
                                    webviewRefs.current[activeTabId]?.reload();

                                    // 4. Check IP again
                                    updateTab(activeTabId, { actualIp: 'Rotating...' });
                                    const partition = activeTab.partition;
                                    setTimeout(() => {
                                        if ((window as any).electron && partition) {
                                            console.log(`[InAppBrowser] Checking new IP for ${partition}...`);
                                            (window as any).electron.getIpInfo(partition);
                                        }
                                    }, 3000);

                                } catch (e) {
                                    console.error('[InAppBrowser] Rotation failed:', e);
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors font-semibold text-xs"
                            title="Rotate to a new IP address"
                        >
                            <RefreshCw size={14} />
                            <span>Rotate IP</span>
                        </button>
                    )}

                    <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><LogOut size={18} /></button>
                </div>
            </div>

            {/* Tab Strip - Separated Below Header */}
            <div className="bg-slate-50/50 px-4 py-1.5 flex items-center gap-1.5 border-b border-slate-200/60 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border shrink-0
                            ${activeTabId === tab.id
                                ? 'bg-white text-slate-900 border-slate-200 shadow-sm ring-1 ring-slate-200'
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-white/50 hover:text-slate-700'
                            }
                        `}
                    >
                        <span className="truncate max-w-[150px]">{tab.title}</span>
                        <button
                            onClick={(e) => closeTab(e, tab.id)}
                            className={`rounded p-0.5 transition-colors ${activeTabId === tab.id ? 'hover:bg-slate-100 text-slate-400 hover:text-red-500' : 'hover:bg-slate-200 text-transparent group-hover:text-slate-400'}`}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
                <button onClick={() => createNewTab()} className="p-1.5 bg-slate-200/50 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"><Plus size={14} /></button>
            </div>


            {/* Content Area */}
            <div className="flex-1 relative bg-white">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`absolute inset-0 w-full h-full bg-white ${activeTabId === tab.id ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'}`}
                    >
                        {tab.url === START_URL ? (
                            // NEW TAB PAGE (Reference Style)
                            <div className="h-full w-full flex flex-col items-center pt-24 pb-12 overflow-y-auto">
                                <div className="w-full max-w-2xl px-6">
                                    {/* Search Header */}
                                    <div className="mb-8 text-center">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                            <LayoutGrid size={32} className="text-slate-900" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Workspace Browser</h2>
                                        <p className="text-slate-500">Select an account to launch a secure session.</p>
                                    </div>

                                    {/* Search Input */}
                                    <div className="relative mb-8 group">
                                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Search accounts..."
                                            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-900 font-medium focus:ring-4 focus:ring-slate-100 focus:border-slate-300 outline-none transition-all placeholder:text-slate-400"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {/* Accounts List (Tree View style) */}
                                    <div className="bg-white border border-slate-100 rounded-3xl shadow-float overflow-hidden">
                                        {platforms.map(platform => {
                                            // Filter accounts by search term
                                            const filteredAccounts = groupedAccounts[platform].filter(acc =>
                                                searchTerm.trim() === '' ||
                                                acc.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                acc.id.toLowerCase().includes(searchTerm.toLowerCase())
                                            );

                                            // Don't show platform if no matching accounts
                                            if (filteredAccounts.length === 0) return null;

                                            return (
                                                <div key={platform} className="border-b border-slate-50 last:border-none">
                                                    <button
                                                        onClick={() => togglePlatform(platform)}
                                                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors text-left"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                                <GenericPlatformIcon name={platform} className="w-5 h-5" />
                                                            </div>
                                                            <span className="font-bold text-slate-900 capitalize">{platform}</span>
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md">{filteredAccounts.length}</span>
                                                        </div>
                                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${expandedPlatforms[platform] ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {/* Accounts Inside */}
                                                    {expandedPlatforms[platform] && (
                                                        <div className="bg-slate-50/50 px-6 py-2 space-y-1 border-t border-slate-50">
                                                            {filteredAccounts.map(acc => (
                                                                <button
                                                                    key={acc.id}
                                                                    onClick={() => createNewTab(acc, acc.platform)}
                                                                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all text-left group"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                                                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{acc.identifier}</span>
                                                                    </div>
                                                                    <ArrowRight size={14} className="text-slate-300 group-hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-all" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {savedAccounts.length === 0 && (
                                            <div className="p-8 text-center text-slate-400 text-sm">No accounts found. Add one from the Dashboard.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <webview
                                ref={el => { if (el) webviewRefs.current[tab.id] = el; }}
                                src={tab.initialUrl}
                                partition={tab.partition}
                                className="w-full h-full"
                                // @ts-ignore - Electron webview attribute
                                allowpopups="true"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Add logging to track webview mounting
// And use useEffect to bind events if refs are available
// Since tabs map renders webviews, we can't easily use one top-level useEffect for all
// unless we iterate refs.
// Better approach: A wrapper component for the Webview?
// For now, simpler: Just remove the event props that might be causing React errors.
// The loading state is nice but if it breaks the app, remove it or implement safer.
// I will keep the event listeners in a useEffect hook watching 'tabs'.
