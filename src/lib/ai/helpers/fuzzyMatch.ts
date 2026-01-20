/**
 * Fuzzy Product Matching - Better product search with typo tolerance
 * Uses Levenshtein distance and token matching for fuzzy search
 */

import type { AIProduct } from '@/types/ai';

/**
 * Match result with score
 */
export interface FuzzyMatchResult {
    product: AIProduct;
    score: number;          // 0-1, higher is better
    matchType: 'exact' | 'contains' | 'fuzzy' | 'token';
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * Calculate similarity score (0-1) from Levenshtein distance
 */
function similarityScore(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Normalize Mongolian common typos
        .replace(/ө/g, 'о')
        .replace(/ү/g, 'у')
        .replace(/ё/g, 'е')
        // Remove extra spaces
        .replace(/\s+/g, ' ');
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
    return normalizeText(text)
        .split(/\s+/)
        .filter(word => word.length > 1);
}

/**
 * Calculate token-based match score
 */
function tokenMatchScore(queryTokens: string[], productTokens: string[]): number {
    if (queryTokens.length === 0) return 0;

    let matchedCount = 0;

    for (const queryToken of queryTokens) {
        // Check if any product token matches (fuzzy)
        const bestMatch = productTokens
            .map(pt => similarityScore(queryToken, pt))
            .sort((a, b) => b - a)[0] || 0;

        if (bestMatch > 0.6) {
            matchedCount += bestMatch;
        }
    }

    return matchedCount / queryTokens.length;
}

/**
 * Find best matching products with fuzzy search
 */
export function fuzzyMatchProducts(
    query: string,
    products: AIProduct[],
    options: {
        maxResults?: number;
        minScore?: number;
        searchDescription?: boolean;
    } = {}
): FuzzyMatchResult[] {
    const {
        maxResults = 5,
        minScore = 0.3,
        searchDescription = true
    } = options;

    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const results: FuzzyMatchResult[] = [];

    for (const product of products) {
        const normalizedName = normalizeText(product.name);
        const nameTokens = tokenize(product.name);

        let score = 0;
        let matchType: FuzzyMatchResult['matchType'] = 'fuzzy';

        // 1. Exact match (highest priority)
        if (normalizedName === normalizedQuery) {
            score = 1.0;
            matchType = 'exact';
        }
        // 2. Contains match
        else if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) {
            const containsScore = Math.min(normalizedQuery.length, normalizedName.length) /
                Math.max(normalizedQuery.length, normalizedName.length);
            score = 0.7 + (containsScore * 0.2);
            matchType = 'contains';
        }
        // 3. Token-based match
        else {
            const tokenScore = tokenMatchScore(queryTokens, nameTokens);
            if (tokenScore > 0.5) {
                score = tokenScore * 0.7;
                matchType = 'token';
            } else {
                // 4. Fuzzy string match
                score = similarityScore(normalizedQuery, normalizedName) * 0.6;
                matchType = 'fuzzy';
            }
        }

        // Also search in description if enabled
        if (searchDescription && product.description && score < 0.5) {
            const normalizedDesc = normalizeText(product.description);
            const descTokens = tokenize(product.description);

            if (normalizedDesc.includes(normalizedQuery)) {
                score = Math.max(score, 0.4);
            } else {
                const descTokenScore = tokenMatchScore(queryTokens, descTokens);
                score = Math.max(score, descTokenScore * 0.4);
            }
        }

        if (score >= minScore) {
            results.push({ product, score, matchType });
        }
    }

    // Sort by score (descending) and limit results
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
}

/**
 * Find single best matching product
 */
export function findBestMatch(
    query: string,
    products: AIProduct[],
    minScore: number = 0.5
): AIProduct | null {
    const matches = fuzzyMatchProducts(query, products, { maxResults: 1, minScore });
    return matches.length > 0 ? matches[0].product : null;
}

/**
 * Find multiple products matching a query
 */
export function findMatchingProducts(
    query: string,
    products: AIProduct[],
    maxResults: number = 5
): AIProduct[] {
    const matches = fuzzyMatchProducts(query, products, { maxResults, minScore: 0.4 });
    return matches.map(m => m.product);
}

/**
 * Suggest products based on partial input (for autocomplete)
 */
export function suggestProducts(
    partialQuery: string,
    products: AIProduct[],
    maxSuggestions: number = 5
): AIProduct[] {
    if (partialQuery.length < 2) {
        return products.slice(0, maxSuggestions);
    }

    const normalized = normalizeText(partialQuery);

    // First, find products that start with the query
    const startsWithMatches = products.filter(p =>
        normalizeText(p.name).startsWith(normalized)
    );

    if (startsWithMatches.length >= maxSuggestions) {
        return startsWithMatches.slice(0, maxSuggestions);
    }

    // Then add fuzzy matches
    const fuzzyMatches = fuzzyMatchProducts(partialQuery, products, {
        maxResults: maxSuggestions - startsWithMatches.length,
        minScore: 0.3
    });

    // Combine and deduplicate
    const results = [...startsWithMatches];
    for (const match of fuzzyMatches) {
        if (!results.some(r => r.id === match.product.id)) {
            results.push(match.product);
        }
    }

    return results.slice(0, maxSuggestions);
}
