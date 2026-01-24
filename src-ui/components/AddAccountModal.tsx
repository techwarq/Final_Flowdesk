import React, { useState } from 'react';
import { api } from '../api/client';
import { Platform, LoginType } from '../types';
import { X, Smartphone, Mail, User, Hash, Globe, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onInitialize?: (account: any) => void;
}

export const AddAccountModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, onInitialize }) => {
    const [platform, setPlatform] = useState<Platform>('flipkart');
    const [loginType, setLoginType] = useState<LoginType>('mobile');
    const [accountId, setAccountId] = useState('');
    const [identifier, setIdentifier] = useState('');
    const [profileName, setProfileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatusText('Saving account...');
        try {
            const newAccount = {
                id: accountId,
                platform,
                loginType,
                identifier: identifier,
                assignedTo: profileName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'New'
            };

            await api.addAccount(newAccount);

            setStatusText('Opening external browser for login...');

            // Start external login session (Visual/Interactive)
            // This waits until the user logs in and the browser closes
            const loginRes = await api.startLoginSession(accountId, platform, false);

            if (loginRes.status === 'success') {
                setStatusText('✓ Login Successful!');
                // Refresh list and close
                setTimeout(() => {
                    try {
                        if (onInitialize) {
                            onInitialize(newAccount);
                        } else {
                            onSuccess();
                        }
                    } catch (e) {
                        console.error('Error in success callback:', e);
                    }
                    setLoading(false);
                    onClose();
                }, 1000);
            } else if (loginRes.status === 'cancelled') {
                setStatusText('⚠ Cancelled');
                setTimeout(() => {
                    setLoading(false);
                    onClose();
                }, 1000);
            } else {
                throw new Error(loginRes.message || 'Login failed');
            }

        } catch (err: any) {
            alert(`Failed to add account: ${err.message || err}`);
            console.error(err);
            setLoading(false);
            setStatusText('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-bg-surface rounded-card shadow-float w-full max-w-md p-0 overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-border-subtle">
                <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-bg-surface-hover">
                    <h2 className="text-lg font-black text-text-primary tracking-tight flex items-center gap-2">
                        <div className="w-1 h-5 bg-brand-primary rounded-full" />
                        ADD NEW ID
                    </h2>
                    <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-canvas rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                                <Globe size={12} /> Platform
                            </label>
                            <div className="relative">
                                <select
                                    value={platform}
                                    onChange={e => setPlatform(e.target.value as Platform)}
                                    className="block w-full rounded-xl border-border-subtle shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm font-medium py-2.5 pl-3 pr-8 appearance-none bg-bg-canvas hover:bg-bg-surface-hover transition-colors cursor-pointer text-text-primary"
                                >
                                    <option value="flipkart">Flipkart</option>
                                    <option value="shopsy">Shopsy</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <ArrowRight size={14} className="text-text-tertiary rotate-90" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                                <Smartphone size={12} /> Login Type
                            </label>
                            <div className="relative">
                                <select
                                    value={loginType}
                                    onChange={e => setLoginType(e.target.value as LoginType)}
                                    className="block w-full rounded-xl border-border-subtle shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm font-medium py-2.5 pl-3 pr-8 appearance-none bg-bg-canvas hover:bg-bg-surface-hover transition-colors cursor-pointer text-text-primary"
                                >
                                    <option value="mobile">Mobile</option>
                                    <option value="email">Email</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <ArrowRight size={14} className="text-text-tertiary rotate-90" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                            <Hash size={12} /> Internal Account ID
                        </label>
                        <input
                            type="text"
                            required
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                            className="block w-full rounded-xl border-border-subtle shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm py-2.5 px-4 font-medium placeholder:text-text-tertiary transition-shadow bg-bg-canvas text-text-primary"
                            placeholder="e.g. rohan_flipkart_01"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                            <User size={12} /> Profile Name
                        </label>
                        <input
                            type="text"
                            value={profileName}
                            onChange={e => setProfileName(e.target.value)}
                            className="block w-full rounded-xl border-border-subtle shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm py-2.5 px-4 font-medium placeholder:text-text-tertiary transition-shadow bg-bg-canvas text-text-primary"
                            placeholder="e.g. Rohan Agarwal"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                            {loginType === 'mobile' ? <Smartphone size={12} /> : <Mail size={12} />}
                            {loginType === 'mobile' ? 'Mobile Number' : 'Email Address'}
                        </label>
                        <input
                            type="text"
                            required
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            className="block w-full rounded-xl border-border-subtle shadow-sm focus:border-brand-primary focus:ring-brand-primary text-sm py-2.5 px-4 font-medium placeholder:text-text-tertiary transition-shadow bg-bg-canvas text-text-primary"
                            placeholder={loginType === 'mobile' ? "e.g. 9876543210" : "e.g. name@example.com"}
                        />
                    </div>

                    {statusText && (
                        <div className={`text-center py-3 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-bottom-2 ${statusText.includes('✓') ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            statusText.includes('⚠') ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                'bg-blue-50 border-blue-100 text-blue-600'
                            }`}>
                            {loading && !statusText.includes('✓') && !statusText.includes('⚠') && (
                                <Loader2 size={16} className="animate-spin" />
                            )}
                            {statusText.includes('✓') && <CheckCircle2 size={16} />}
                            {statusText.includes('⚠') && <AlertTriangle size={16} />}
                            {statusText.replace('✓', '').replace('⚠', '')}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-brand-primary text-white font-bold rounded-xl hover:opacity-90 transition-all transform active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>PROCESSING...</span>
                                </>
                            ) : (
                                <>
                                    <span>ADD & START SESSION</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
