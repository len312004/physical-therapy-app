declare global {
    interface Window {
        electronAPI: {
            getAppVersion: () => Promise<string>;
            getAppPath: () => Promise<string>;
        };
    }
}
export {};
//# sourceMappingURL=preload.d.ts.map