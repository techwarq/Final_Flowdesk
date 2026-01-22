import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Minimize2, Paperclip } from 'lucide-react';

export const Chatbot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ id: string, text: string, sender: 'user' | 'bot' }[]>([
        { id: '1', text: "Hello! I'm Aastha, your Shopping Assistant. How can I help you track your purchases today?", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: userMsg, sender: 'user' }]);
        setInput('');

        // Simulate bot response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: "I'm currently in demo mode. Once fully connected, I'll be able to help you find the best deals and track your order status!",
                sender: 'bot'
            }]);
        }, 1000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[380px] h-[500px] bg-bg-surface rounded-card shadow-float flex flex-col overflow-hidden border border-border-subtle animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="p-4 bg-brand-primary text-white flex items-center justify-between shrink-0 shadow-sm border-b border-brand-primary/10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md">
                                <Bot size={18} className="text-brand-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">Aastha AI</h3>
                                <p className="text-[10px] text-white/80 font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Online
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                            >
                                <Minimize2 size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-canvas">
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user'
                                    ? 'bg-brand-primary text-white rounded-tr-none'
                                    : 'bg-bg-surface text-text-primary rounded-tl-none border border-border-subtle'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-bg-surface border-t border-border-subtle flex items-center gap-2">
                        <button type="button" className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-canvas rounded-xl transition-colors">
                            <Paperclip size={20} />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Aastha..."
                            className="flex-1 bg-bg-canvas border-0 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-brand-primary focus:bg-bg-surface transition-all outline-none placeholder:text-text-tertiary font-medium text-text-primary"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="p-2.5 bg-brand-primary text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-primary/20"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-float flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 z-50 ${isOpen
                    ? 'bg-bg-surface text-brand-primary rotate-90 border border-border-subtle'
                    : 'bg-brand-primary text-white shadow-brand-primary/30'
                    }`}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} fill="currentColor" />}
            </button>
        </div>
    );
};
