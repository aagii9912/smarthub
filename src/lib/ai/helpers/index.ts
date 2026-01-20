/**
 * AI Helpers Index - Barrel export for all helpers
 */

// Stock management
export {
    checkProductStock,
    getProductFromDB,
    addItemToCart,
    getCartFromDB,
    reserveStock,
    restoreStock,
    getOrCreateCart,
} from './stockHelpers';

// Fuzzy product matching
export {
    fuzzyMatchProducts,
    findBestMatch,
    findMatchingProducts,
    suggestProducts,
    type FuzzyMatchResult,
} from './fuzzyMatch';

// Memory with TTL
export {
    MEMORY_CONFIG,
    isExpired,
    saveMemoryWithTTL,
    cleanupMemory,
    getMemoryWithTracking,
    runBatchCleanup,
    deleteMemoryKey,
    clearAllMemory,
} from './memoryTTL';

// Discount expiry
export {
    getDiscountStatus,
    getHoursRemaining,
    enrichProductsWithDiscounts,
    generateUrgencyMessage,
    getExpiringDiscounts,
    createDiscountSchedule,
    getActiveDiscountSchedules,
    deactivateExpiredDiscounts,
    formatDiscountForPrompt,
    type DiscountSchedule,
    type DiscountStatus,
    type ProductWithDiscount,
} from './discountExpiry';
