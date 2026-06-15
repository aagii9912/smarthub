/**
 * Supabase auth алдааны мессежийг Монгол хэл рүү хөрвүүлнэ.
 *
 * Auth хуудсууд (login / register / forgot-password) Supabase-ийн түүхий
 * англи мессежийг хэрэглэгчид шууд харуулж байсан — энд нийтлэг алдаануудыг
 * нэг газар буулгаж, танихгүй алдааг ерөнхий Монгол мессежээр сольж
 * харуулна (түүхий англи мессеж хэзээ ч гадагш гарахгүй).
 */

const GENERIC_ERROR = 'Алдаа гарлаа. Дахин оролдоно уу.';
const RATE_LIMIT_ERROR = 'Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.';

/** Жижиг үсгээр харьцуулах substring → Монгол мессеж. Эрэмбэ чухал. */
const PATTERNS: Array<[string, string]> = [
    ['invalid login credentials', 'И-мэйл эсвэл нууц үг буруу байна'],
    ['email not confirmed', 'И-мэйл хаягаа баталгаажуулна уу'],
    ['user already registered', 'Энэ и-мэйл бүртгэлтэй байна'],
    ['already registered', 'Энэ и-мэйл бүртгэлтэй байна'],
    ['password should be at least 6 characters', 'Нууц үг хамгийн багадаа 6 тэмдэгт байна'],
    ['at least 6 characters', 'Нууц үг хамгийн багадаа 6 тэмдэгт байна'],
    // Rate-limit хэлбэрүүд: "Email rate limit exceeded", "Too many requests",
    // "For security purposes, you can only request this once every 60 seconds"
    ['rate limit', RATE_LIMIT_ERROR],
    ['too many requests', RATE_LIMIT_ERROR],
    ['for security purposes', RATE_LIMIT_ERROR],
];

export function mapAuthError(message: string | null | undefined): string {
    if (!message) return GENERIC_ERROR;
    const lower = message.toLowerCase();
    for (const [pattern, mn] of PATTERNS) {
        if (lower.includes(pattern)) return mn;
    }
    return GENERIC_ERROR;
}
