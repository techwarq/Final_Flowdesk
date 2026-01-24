
export { };

declare global {
    interface Window {
        electron: {
            sendAppReady: () => void;
            setCookies: (partition: string, cookies: any[]) => void;
            setProxy: (partition: string, proxyRules: string) => void;
        };
    }
}
