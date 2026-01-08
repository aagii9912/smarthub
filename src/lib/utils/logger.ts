/**
 * Production-safe logger utility
 * Development mode-д console.log харагдана
 * Production mode-д зөвхөн warn, error харагдана
 */

const isDev = process.env.NODE_ENV === 'development';

interface LogData {
    [key: string]: unknown;
}

export const logger = {
    /**
     * Info level - development only
     */
    info: (message: string, data?: LogData) => {
        if (isDev) {
            console.log(`ℹ️ ${message}`, data ?? '');
        }
    },

    /**
     * Debug level - development only
     */
    debug: (message: string, data?: LogData) => {
        if (isDev) {
            console.log(`🔍 ${message}`, data ?? '');
        }
    },

    /**
     * Warning level - always visible
     */
    warn: (message: string, data?: LogData) => {
        console.warn(`⚠️ ${message}`, data ?? '');
    },

    /**
     * Error level - always visible
     */
    error: (message: string, data?: LogData) => {
        console.error(`❌ ${message}`, data ?? '');
    },

    /**
     * Success level - development only
     */
    success: (message: string, data?: LogData) => {
        if (isDev) {
            console.log(`✅ ${message}`, data ?? '');
        }
    },
};

export default logger;
