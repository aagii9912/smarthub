import { describe, it, expect } from 'vitest';
import {
    shouldReplyToComment,
    generateCommentReply,
    generateReplyKey,
} from '../comment-detector';

describe('Comment Detector', () => {
    describe('shouldReplyToComment', () => {
        describe('Price/Cost keywords', () => {
            it('returns true for "үнэ" (price)', () => {
                expect(shouldReplyToComment('Үнэ хэд вэ?')).toBe(true);
            });

            it('returns true for "хэд" (how much)', () => {
                expect(shouldReplyToComment('хэд вэ')).toBe(true);
            });

            it('returns true for English "price"', () => {
                expect(shouldReplyToComment('What is the price?')).toBe(true);
            });
        });

        describe('Order/Purchase keywords', () => {
            it('returns true for "захиал" (order)', () => {
                expect(shouldReplyToComment('Захиалах гэсэн юм')).toBe(true);
            });

            it('returns true for "авах" (to buy)', () => {
                expect(shouldReplyToComment('авах гэсэн юм аа')).toBe(true);
            });

            it('returns true for English "order"', () => {
                expect(shouldReplyToComment('I want to order')).toBe(true);
            });
        });

        describe('Availability keywords', () => {
            it('returns true for "байна уу" (is there)', () => {
                expect(shouldReplyToComment('Энэ байна уу?')).toBe(true);
            });

            it('returns true for "stock"', () => {
                expect(shouldReplyToComment('Is this in stock?')).toBe(true);
            });
        });

        describe('Delivery keywords', () => {
            it('returns true for "хүргэлт" (delivery)', () => {
                expect(shouldReplyToComment('Хүргэлт байна уу?')).toBe(true);
            });

            it('returns true for English "delivery"', () => {
                expect(shouldReplyToComment('Do you do delivery?')).toBe(true);
            });
        });

        describe('Contact keywords', () => {
            it('returns true for "утас" (phone)', () => {
                expect(shouldReplyToComment('Утас хэд вэ?')).toBe(true);
            });

            it('returns true for "холбогд" (contact)', () => {
                expect(shouldReplyToComment('Яаж холбогдох вэ?')).toBe(true);
            });
        });

        describe('Question mark handling', () => {
            it('returns true for any question with question mark', () => {
                expect(shouldReplyToComment('Энэ юу вэ?')).toBe(true);
            });

            it('returns true for fullwidth question mark (?)', () => {
                expect(shouldReplyToComment('Энэ юу вэ？')).toBe(true);
            });
        });

        describe('Ignore patterns', () => {
            it('returns false for emoji-only comments', () => {
                expect(shouldReplyToComment('❤️ 🔥 👍')).toBe(false);
            });

            it('returns false for simple reactions', () => {
                expect(shouldReplyToComment('nice')).toBe(false);
                expect(shouldReplyToComment('гоё')).toBe(false);
                expect(shouldReplyToComment('сайхан')).toBe(false);
            });

            it('returns false for acknowledgments', () => {
                expect(shouldReplyToComment('ok')).toBe(false);
                expect(shouldReplyToComment('за')).toBe(false);
                expect(shouldReplyToComment('баярлалаа')).toBe(false);
            });

            it('returns false for too short comments', () => {
                expect(shouldReplyToComment('a')).toBe(false);
                expect(shouldReplyToComment('')).toBe(false);
            });

            it('returns false for null/undefined', () => {
                expect(shouldReplyToComment('')).toBe(false);
            });
        });

        describe('Edge cases', () => {
            it('handles mixed case', () => {
                expect(shouldReplyToComment('ҮНЭ ХЭД ВЭ?')).toBe(true);
            });

            it('handles extra whitespace', () => {
                expect(shouldReplyToComment('  үнэ хэд вэ  ')).toBe(true);
            });
        });
    });

    describe('generateCommentReply', () => {
        it('generates reply with page username link', () => {
            const reply = generateCommentReply('Test Shop', 'testshop');
            expect(reply).toContain('m.me/testshop');
            expect(reply).toContain('Сайн байна уу');
        });

        it('generates reply without username', () => {
            const reply = generateCommentReply('Test Shop');
            expect(reply).toContain('манай Messenger');
            expect(reply).not.toContain('m.me/');
        });

        it('includes emojis for friendly tone', () => {
            const reply = generateCommentReply('Test Shop', 'shop');
            expect(reply).toContain('😊');
            expect(reply).toContain('🙏');
        });
    });

    describe('generateReplyKey', () => {
        it('generates unique key from post and user IDs', () => {
            const key = generateReplyKey('post123', 'user456');
            expect(key).toBe('comment_reply_post123_user456');
        });

        it('generates different keys for different posts', () => {
            const key1 = generateReplyKey('post1', 'user1');
            const key2 = generateReplyKey('post2', 'user1');
            expect(key1).not.toBe(key2);
        });

        it('generates different keys for different users', () => {
            const key1 = generateReplyKey('post1', 'user1');
            const key2 = generateReplyKey('post1', 'user2');
            expect(key1).not.toBe(key2);
        });
    });
});
