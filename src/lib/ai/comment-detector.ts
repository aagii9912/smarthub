/**
 * Comment Keyword Detector
 * Detects if a Facebook comment is related to products/services
 * and should receive an auto-reply
 */

// Keywords that indicate product/service inquiry
const PRODUCT_KEYWORDS = [
    // Price related
    'үнэ', 'хэд', 'хичнээ', 'хэдэн', 'price', 'cost', 'хямд',

    // Order/Purchase related
    'захиал', 'авах', 'авмаар', 'худалдаж', 'order', 'buy', 'purchase',

    // Availability
    'байгаа', 'байна уу', 'бий юу', 'байх', 'stock', 'available',

    // Delivery
    'хүргэ', 'хүргэлт', 'ирэх', 'delivery', 'хаяг', 'очих',

    // Contact
    'холбогд', 'утас', 'дугаар', 'contact', 'phone', 'яаж',

    // Timing
    'хэзээ', 'хэдэн өдөр', 'when', 'удах',

    // Questions
    'яаж', 'хэрхэн', 'яадаг', 'how', 'what', 'юу',

    // Interest
    'сонирхо', 'хүсч', 'want', 'interested'
];

// Keywords to IGNORE (non-product related)
const IGNORE_KEYWORDS = [
    // Reactions/Emojis only
    'wow', 'nice', 'гоё', 'cool', 'сайхан', 'хөөрхөн',

    // Simple acknowledgments
    'ok', 'ок', 'за', 'баярлалаа', 'thanks', 'thank', 'love',

    // Spam patterns
    'follow me', 'check my', 'visit my'
];

// Minimum comment length to consider
const MIN_COMMENT_LENGTH = 2;

/**
 * Check if a comment is product/service related
 * @param comment - The comment text
 * @returns boolean - true if should reply
 */
export function shouldReplyToComment(comment: string): boolean {
    if (!comment) return false;

    const normalizedComment = comment.toLowerCase().trim();

    // Too short - probably just emoji or reaction
    if (normalizedComment.length < MIN_COMMENT_LENGTH) {
        return false;
    }

    // Check if it's just emojis
    const emojiOnlyRegex = /^[\p{Emoji}\s]+$/u;
    if (emojiOnlyRegex.test(normalizedComment)) {
        return false;
    }

    // Check for ignore keywords
    for (const ignoreWord of IGNORE_KEYWORDS) {
        if (normalizedComment === ignoreWord.toLowerCase()) {
            return false;
        }
    }

    // Check for product keywords
    for (const keyword of PRODUCT_KEYWORDS) {
        if (normalizedComment.includes(keyword.toLowerCase())) {
            return true;
        }
    }

    // Check if it ends with a question mark (likely a question)
    if (normalizedComment.endsWith('?') || normalizedComment.endsWith('？')) {
        return true;
    }

    return false;
}

/**
 * Generate auto-reply message for comments
 * @param shopName - The shop name
 * @param pageUsername - The Facebook page username for m.me link
 * @returns string - The reply message
 */
export function generateCommentReply(shopName: string, pageUsername?: string): string {
    const messengerLink = pageUsername
        ? `m.me/${pageUsername}`
        : 'манай Messenger';

    return `Сайн байна уу! 😊 Дэлгэрэнгүй мэдээлэл авахыг хүсвэл ${messengerLink} руу бичээрэй. Бид танд туслахдаа баяртай байна! 🙏`;
}

/**
 * Check if we've already replied to this user on this post
 * to avoid spam
 */
export function generateReplyKey(postId: string, userId: string): string {
    return `comment_reply_${postId}_${userId}`;
}
