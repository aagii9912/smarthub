/**
 * Mobile utility functions for SmartHub
 */

// Device detection
export const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android/.test(navigator.userAgent);
};

// Haptic feedback (iOS only, requires user gesture)
export const vibrate = (pattern: number | number[] = 10): void => {
    if (typeof window === 'undefined' || !navigator.vibrate) return;

    try {
        navigator.vibrate(pattern);
    } catch (_e) {
        // Vibration not supported or failed
    }
};

// Light haptic for successful actions
export const lightHaptic = () => vibrate(10);

// Medium haptic for warnings
export const mediumHaptic = () => vibrate(20);

// Strong haptic for errors
export const strongHaptic = () => vibrate([30, 10, 30]);

// Safe area helpers
export const getSafeAreaInsets = () => {
    if (typeof window === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };

    const style = getComputedStyle(document.documentElement);

    return {
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
    };
};

// Prevent body scroll (useful for modals on mobile)
export const disableBodyScroll = () => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
};

export const enableBodyScroll = () => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
};

// Check if user prefers reduced motion
export const prefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Get viewport dimensions (excluding browser chrome on mobile)
export const getViewportDimensions = () => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };

    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
};

// Scroll to top smoothly
export const scrollToTop = (smooth = true) => {
    if (typeof window === 'undefined') return;

    window.scrollTo({
        top: 0,
        behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
    });
};

// Check if device is in landscape mode
export const isLandscape = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
};

// Check if PWA is installed
export const isPWA = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches;
};

// Network information (if available)
export const getNetworkType = (): string => {
    if (typeof navigator === 'undefined') return 'unknown';
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection?.effectiveType || 'unknown';
};

export const isSlowNetwork = (): boolean => {
    const type = getNetworkType();
    return type === 'slow-2g' || type === '2g';
};
