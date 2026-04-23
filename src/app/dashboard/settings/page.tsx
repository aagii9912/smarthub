'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Save,
    Store,
    CreditCard,
    Globe,
    LogOut,
    Trash2,
    AlertTriangle,
    Facebook,
    Instagram,
    User,
    Loader2,
    Link2,
    Unlink,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { cn } from '@/lib/utils';

interface FacebookPage {
    id: string;
    name: string;
    category?: string;
}

const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';
const labelCls =
    'block text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-1.5';
const selectCls = cn(inputCls, 'appearance-none cursor-pointer');

function StatusBadge({ tone, children }: { tone: 'success' | 'danger' | 'warning' | 'neutral'; children: React.ReactNode }) {
    const colors: Record<typeof tone, { bg: string; color: string }> = {
        success: {
            bg: 'color-mix(in oklab, var(--success) 16%, transparent)',
            color: 'var(--success)',
        },
        danger: {
            bg: 'color-mix(in oklab, var(--destructive) 18%, transparent)',
            color: 'var(--destructive)',
        },
        warning: {
            bg: 'color-mix(in oklab, var(--warning) 18%, transparent)',
            color: 'var(--warning)',
        },
        neutral: {
            bg: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.5)',
        },
    };
    const c = colors[tone];
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full tracking-[-0.01em]"
            style={{ background: c.bg, color: c.color }}
        >
            {children}
        </span>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    interface ShopRecord {
        name?: string;
        description?: string;
        phone?: string;
        address?: string;
        working_hours?: string;
        [key: string]: unknown;
    }
    const [shop, setShop] = useState<ShopRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [shopInfo, setShopInfo] = useState({
        name: '',
        description: '',
        phone: '',
        address: '',
        working_hours: '',
    });
    const [bankInfo, setBankInfo] = useState({
        bank_name: '',
        account_name: '',
        account_number: '',
        register_number: '',
        merchant_type: 'person' as 'person' | 'company',
    });
    const [fbConnected, setFbConnected] = useState(false);
    const [igConnected, setIgConnected] = useState(false);
    const [qpayStatus, setQpayStatus] = useState<string>('none');

    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [fbSelecting, setFbSelecting] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/shop', {
                headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' },
            });
            const data = await res.json();
            if (data.shop) {
                setShop(data.shop);
                setShopInfo({
                    name: data.shop.name || '',
                    description: data.shop.description || '',
                    phone: data.shop.phone || '',
                    address: data.shop.address || '',
                    working_hours: data.shop.working_hours || '',
                });
                setBankInfo({
                    bank_name: data.shop.bank_name || '',
                    account_name: data.shop.account_name || '',
                    account_number: data.shop.account_number || '',
                    register_number: data.shop.register_number || '',
                    merchant_type: data.shop.merchant_type || 'person',
                });
                setFbConnected(!!data.shop.facebook_page_id);
                setIgConnected(!!data.shop.instagram_business_account_id);
                setQpayStatus(data.shop.qpay_status || 'none');
            }
        } catch (e) {
            logger.error('Алдаа гарлаа', { error: e });
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchFbPages = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/facebook/pages');
            const data = await res.json();
            if (data.pages && data.pages.length > 0) {
                setFbPages(data.pages);
            } else if (data.code === 'SESSION_EXPIRED') {
                toast.error('Facebook session дууссан. Дахин холбоно уу.');
            }
        } catch {
            toast.error('Facebook page-ийг татахад алдаа');
        }
    }, []);

    // Facebook OAuth redirect feedback
    useEffect(() => {
        const fbSuccess = searchParams.get('fb_success');
        const fbError = searchParams.get('fb_error');

        if (fbSuccess) {
            toast.success('Facebook амжилттай холбогдлоо! Page сонгоно уу.');
            fetchFbPages();
            router.replace('/dashboard/settings');
        }
        if (fbError) {
            const errorMessages: Record<string, string> = {
                csrf_validation_failed: 'Аюулгүй байдлын шалгалт амжилтгүй. Дахин оролдоно уу.',
                no_code: 'Facebook-аас зөвшөөрлийн код ирсэнгүй.',
                config_missing: 'App тохиргоо дутуу байна.',
                token_error: 'Access token авахад алдаа гарлаа.',
                pages_error: 'Facebook Pages уншихад алдаа гарлаа.',
                exception: 'Алдаа гарлаа, дахин оролдоно уу.',
            };
            toast.error(errorMessages[fbError] || `Facebook холболтын алдаа: ${fbError}`);
            router.replace('/dashboard/settings');
        }
    }, [searchParams, router, fetchFbPages]);

    // Instagram OAuth redirect feedback
    useEffect(() => {
        const igSuccess = searchParams.get('ig_success');
        const igError = searchParams.get('ig_error');
        if (igSuccess) {
            toast.success('Instagram амжилттай холбогдлоо! ✅');
            router.replace('/dashboard/settings');
            fetchSettings();
        }
        if (igError) {
            const errorMessages: Record<string, string> = {
                no_instagram_account:
                    'Instagram Business Account олдсонгүй. Facebook Page-тай IG холбогдсон эсэхийг шалгана уу.',
                token_error: 'Token авахад алдаа гарлаа',
                pages_error: 'Facebook Pages уншихад алдаа гарлаа',
                config_missing: 'App тохиргоо дутуу',
                db_save_failed: 'Мэдээлэл хадгалахад алдаа',
                exception: 'Алдаа гарлаа, дахин оролдоно уу',
            };
            toast.error(errorMessages[igError] || `IG холболтын алдаа: ${igError}`);
            router.replace('/dashboard/settings');
        }
    }, [searchParams, router, fetchSettings]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    async function handleFbPageSelect(pageId: string) {
        setFbSelecting(true);
        try {
            const pageRes = await fetch('/api/auth/facebook/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId }),
            });
            const pageData = await pageRes.json();

            if (!pageRes.ok) {
                if (pageData.code === 'SESSION_EXPIRED') {
                    setFbPages([]);
                    toast.error('Session дууссан. Дахин холбож байна...');
                    setTimeout(() => {
                        window.location.href = '/api/auth/facebook?returnTo=/dashboard/settings';
                    }, 1500);
                    return;
                }
                throw new Error(pageData.error || 'Page сонгоход алдаа');
            }

            const shopRes = await fetch('/api/shop', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify({
                    facebook_page_id: pageData.page.id,
                    facebook_page_name: pageData.page.name,
                    facebook_page_access_token: pageData.page.access_token,
                }),
            });

            if (!shopRes.ok) {
                const errData = await shopRes.json().catch(() => ({}));
                throw new Error(errData.error || 'Дэлгүүрийн мэдээлэл хадгалахад алдаа');
            }

            setFbConnected(true);
            setFbPages([]);
            toast.success(`Facebook Page "${pageData.page.name}" амжилттай холбогдлоо! ✅`);
            await fetchSettings();
        } catch (err: unknown) {
            toast.error((err instanceof Error ? err.message : String(err)) || 'Алдаа гарлаа');
        } finally {
            setFbSelecting(false);
        }
    }

    async function saveSettings(body: Record<string, unknown>) {
        setSaving(true);
        try {
            const res = await fetch('/api/shop', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Амжилттай хадгалагдлаа');
                if (data.qpay_setup?.success) {
                    toast.success(data.qpay_setup.message || 'QPay автоматаар идэвхжлээ! ✅');
                    setQpayStatus('active');
                } else if (data.qpay_setup && !data.qpay_setup.success) {
                    toast.warning(data.qpay_setup.message || 'QPay бүртгэл амжилтгүй');
                }
            } else throw new Error(data.error || 'Failed');
        } catch {
            toast.error('Хадгалахад алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    }

    async function disconnectPlatform(platform: string) {
        try {
            await fetch('/api/shop', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify(
                    platform === 'facebook'
                        ? {
                              facebook_page_id: null,
                              facebook_page_name: null,
                              facebook_page_access_token: null,
                          }
                        : {
                              instagram_business_account_id: null,
                              instagram_username: null,
                              instagram_access_token: null,
                          }
                ),
            });
            if (platform === 'facebook') setFbConnected(false);
            else setIgConnected(false);
            toast.success(`${platform === 'facebook' ? 'Facebook' : 'Instagram'} салгагдлаа`);
        } catch {
            toast.error('Алдаа гарлаа');
        }
    }

    async function deleteShop() {
        if (deleteConfirmText !== shop?.name) {
            toast.error('Дэлгүүрийн нэрийг зөв бичнэ үү');
            return;
        }
        setDeleting(true);
        try {
            const res = await fetch('/api/shop', {
                method: 'DELETE',
                headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' },
            });
            if (res.ok) {
                toast.success('Дэлгүүр амжилттай устгагдлаа');
                localStorage.removeItem('smarthub_active_shop_id');
                window.location.href = '/dashboard';
            } else {
                const data = await res.json();
                toast.error(data.error || 'Устгахад алдаа гарлаа');
            }
        } catch {
            toast.error('Устгахад алдаа гарлаа');
        } finally {
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 max-w-3xl">
                <div className="h-24 card-outlined animate-pulse" />
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-56 card-outlined animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <PageHero
                eyebrow="Тохиргоо"
                title={shop?.name || 'Дэлгүүрийн тохиргоо'}
                subtitle="Дэлгүүр, төлбөр, холболт, багийн мэдээллийг нэгдсэн газар удирдаарай."
            />

            {/* Shop Info */}
            <div className="card-outlined p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5">
                    <Store className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    Дэлгүүрийн мэдээлэл
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Нэр</label>
                        <input
                            type="text"
                            value={shopInfo.name}
                            onChange={(e) => setShopInfo({ ...shopInfo, name: e.target.value })}
                            className={inputCls}
                            placeholder="Дэлгүүрийн нэр"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Утас</label>
                        <input
                            type="text"
                            value={shopInfo.phone}
                            onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                            className={inputCls}
                            placeholder="Утасны дугаар"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelCls}>Тайлбар</label>
                        <textarea
                            value={shopInfo.description}
                            onChange={(e) => setShopInfo({ ...shopInfo, description: e.target.value })}
                            className={cn(inputCls, 'resize-none')}
                            rows={2}
                            placeholder="Дэлгүүрийн тайлбар"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Хаяг</label>
                        <input
                            type="text"
                            value={shopInfo.address}
                            onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
                            className={inputCls}
                            placeholder="Хаяг"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Ажлын цаг</label>
                        <input
                            type="text"
                            value={shopInfo.working_hours}
                            onChange={(e) =>
                                setShopInfo({ ...shopInfo, working_hours: e.target.value })
                            }
                            className={inputCls}
                            placeholder="09:00 - 18:00"
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => saveSettings(shopInfo)}
                        disabled={saving}
                        leftIcon={
                            saving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )
                        }
                    >
                        Хадгалах
                    </Button>
                </div>
            </div>

            {/* Bank Details */}
            <div className="card-outlined p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-2">
                    <CreditCard className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    Банкны мэдээлэл
                    <span className="ml-auto">
                        {qpayStatus === 'active' && (
                            <StatusBadge tone="success">
                                <CheckCircle className="w-3 h-3" />
                                QPay идэвхтэй
                            </StatusBadge>
                        )}
                        {qpayStatus === 'failed' && (
                            <StatusBadge tone="danger">
                                <XCircle className="w-3 h-3" />
                                QPay амжилтгүй
                            </StatusBadge>
                        )}
                        {qpayStatus === 'pending' && (
                            <StatusBadge tone="warning">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Боловсруулж байна
                            </StatusBadge>
                        )}
                        {(!qpayStatus || qpayStatus === 'none') && (
                            <StatusBadge tone="neutral">QPay идэвхгүй</StatusBadge>
                        )}
                    </span>
                </h3>
                <p className="text-[12px] text-white/45 mb-5 tracking-[-0.01em]">
                    Банкны мэдээллээ оруулснаар QPay автоматаар идэвхжиж, хэрэглэгчид QR код, банк
                    аппаар төлөх боломжтой болно.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className={labelCls}>Төрөл</label>
                        <select
                            value={bankInfo.merchant_type}
                            onChange={(e) =>
                                setBankInfo({
                                    ...bankInfo,
                                    merchant_type: e.target.value as 'person' | 'company',
                                })
                            }
                            className={selectCls}
                        >
                            <option value="person">Хувь хүн</option>
                            <option value="company">Байгууллага / ХХК</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Банк</label>
                        <select
                            value={bankInfo.bank_name}
                            onChange={(e) =>
                                setBankInfo({ ...bankInfo, bank_name: e.target.value })
                            }
                            className={selectCls}
                        >
                            <option value="">Банк сонгоно уу</option>
                            <option value="Хаан банк">Хаан банк</option>
                            <option value="Голомт банк">Голомт банк</option>
                            <option value="Худалдаа хөгжлийн банк">
                                Худалдаа хөгжлийн банк (TDB)
                            </option>
                            <option value="Хас банк">Хас банк</option>
                            <option value="Капитрон банк">Капитрон банк</option>
                            <option value="Төрийн банк">Төрийн банк</option>
                            <option value="Богд банк">Богд банк</option>
                            <option value="М банк">М банк</option>
                            <option value="Капитал банк">Капитал банк</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={labelCls}>Данс эзэмшигч</label>
                        <input
                            type="text"
                            value={bankInfo.account_name}
                            onChange={(e) =>
                                setBankInfo({ ...bankInfo, account_name: e.target.value })
                            }
                            className={inputCls}
                            placeholder="Нэр"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Дансны дугаар</label>
                        <input
                            type="text"
                            value={bankInfo.account_number}
                            onChange={(e) =>
                                setBankInfo({ ...bankInfo, account_number: e.target.value })
                            }
                            className={inputCls}
                            placeholder="0000000000"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>
                            {bankInfo.merchant_type === 'company'
                                ? 'Байгууллагын регистр'
                                : 'Регистрийн дугаар'}
                        </label>
                        <input
                            type="text"
                            value={bankInfo.register_number}
                            onChange={(e) =>
                                setBankInfo({ ...bankInfo, register_number: e.target.value })
                            }
                            className={inputCls}
                            placeholder={
                                bankInfo.merchant_type === 'company'
                                    ? 'Байгууллагын регистр'
                                    : 'РД (жнь: УА12345678)'
                            }
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => saveSettings(bankInfo)}
                        disabled={
                            saving ||
                            !bankInfo.bank_name ||
                            !bankInfo.account_number ||
                            !bankInfo.account_name
                        }
                        leftIcon={
                            saving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                            )
                        }
                    >
                        Хадгалах
                    </Button>
                </div>
            </div>

            {/* Platform Connections */}
            <div className="card-outlined p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5">
                    <Globe className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    Платформ холболтууд
                </h3>
                <div className="space-y-3">
                    {/* Facebook */}
                    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[color-mix(in_oklab,var(--brand-indigo)_16%,transparent)] text-[#60a5fa]">
                                    <Facebook className="w-4.5 h-4.5" strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                        Facebook
                                    </p>
                                    <p className="text-[11px] text-white/45">
                                        {fbConnected ? 'Холбогдсон' : 'Холбогдоогүй'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {fbConnected ? (
                                    <>
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ background: 'var(--success)' }}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => disconnectPlatform('facebook')}
                                            leftIcon={<Unlink className="w-3 h-3" strokeWidth={1.5} />}
                                            className="text-[var(--destructive)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)] hover:bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)]"
                                        >
                                            Салгах
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        href="/api/auth/facebook?returnTo=/dashboard/settings"
                                        leftIcon={<Link2 className="w-3 h-3" strokeWidth={1.5} />}
                                    >
                                        Холбох
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Page selector */}
                        {fbPages.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/[0.06]">
                                <p className="text-[12px] text-white/55 mb-3 tracking-[-0.01em]">
                                    Page сонгоно уу:
                                </p>
                                <div className="space-y-2">
                                    {fbPages.map((page) => (
                                        <button
                                            key={page.id}
                                            onClick={() => handleFbPageSelect(page.id)}
                                            disabled={fbSelecting}
                                            className="w-full flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-[var(--border-accent)] rounded-xl transition-all disabled:opacity-50"
                                        >
                                            <Facebook
                                                className="w-4 h-4 text-[var(--brand-indigo-400)]"
                                                strokeWidth={1.5}
                                            />
                                            <div className="text-left flex-1">
                                                <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                                    {page.name}
                                                </p>
                                                {page.category && (
                                                    <p className="text-[11px] text-white/45">
                                                        {page.category}
                                                    </p>
                                                )}
                                            </div>
                                            {fbSelecting && (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/45" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Instagram */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[color-mix(in_oklab,var(--brand-violet-500)_20%,transparent)] text-[#e879c4]">
                                <Instagram className="w-4.5 h-4.5" strokeWidth={1.5} />
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                                    Instagram
                                </p>
                                <p className="text-[11px] text-white/45">
                                    {igConnected ? 'Холбогдсон' : 'Холбогдоогүй'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {igConnected ? (
                                <>
                                    <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ background: 'var(--success)' }}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => disconnectPlatform('instagram')}
                                        leftIcon={<Unlink className="w-3 h-3" strokeWidth={1.5} />}
                                        className="text-[var(--destructive)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)] hover:bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)]"
                                    >
                                        Салгах
                                    </Button>
                                </>
                            ) : fbConnected ? (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    leftIcon={<Link2 className="w-3 h-3" strokeWidth={1.5} />}
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(
                                                '/api/dashboard/connect-instagram',
                                                {
                                                    method: 'POST',
                                                    headers: {
                                                        'x-shop-id':
                                                            localStorage.getItem(
                                                                'smarthub_active_shop_id'
                                                            ) || '',
                                                    },
                                                }
                                            );
                                            const data = await res.json();
                                            if (data.success) {
                                                toast.success(
                                                    `Instagram @${data.instagram.username} амжилттай холбогдлоо! ✅`
                                                );
                                                setIgConnected(true);
                                            } else {
                                                toast.error(
                                                    data.error || 'Instagram холбоход алдаа гарлаа'
                                                );
                                            }
                                        } catch {
                                            toast.error('Алдаа гарлаа');
                                        }
                                    }}
                                >
                                    Холбох
                                </Button>
                            ) : (
                                <span className="text-[11px] text-white/40 tracking-[-0.01em]">
                                    Facebook эхлээд холбоно уу
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Account */}
            <div className="card-outlined p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5">
                    <User className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                    Аккаунт
                </h3>
                <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                    <div>
                        <p className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
                            Системээс гарах
                        </p>
                        <p className="text-[11px] text-white/45">Бүх төхөөрөмж дээрээс гарна</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            window.location.href = '/sign-in';
                        }}
                        leftIcon={<LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    >
                        Гарах
                    </Button>
                </div>
            </div>

            {/* Danger Zone */}
            <div
                className="rounded-2xl p-6 border"
                style={{
                    background: 'color-mix(in oklab, var(--destructive) 6%, var(--surface-base) 60%)',
                    borderColor: 'color-mix(in oklab, var(--destructive) 28%, transparent)',
                }}
            >
                <h3
                    className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] mb-3"
                    style={{ color: 'var(--destructive)' }}
                >
                    <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
                    Аюултай бүс
                </h3>
                {!showDeleteConfirm ? (
                    <>
                        <p className="text-[12px] text-white/55 mb-4 tracking-[-0.01em]">
                            Дэлгүүрээ устгах. Бүх бүтээгдэхүүн, захиалга, харилцагч, чат түүх устана.
                            Энэ үйлдлийг буцаах боломжгүй.
                        </p>
                        <Button
                            variant="destructive"
                            size="md"
                            onClick={() => setShowDeleteConfirm(true)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        >
                            Дэлгүүр устгах
                        </Button>
                    </>
                ) : (
                    <div className="space-y-3">
                        <p
                            className="text-[12px] tracking-[-0.01em]"
                            style={{ color: 'color-mix(in oklab, var(--destructive) 90%, white)' }}
                        >
                            Баталгаажуулахын тулд дэлгүүрийнхээ нэрийг бичнэ үү:{' '}
                            <span className="font-bold" style={{ color: 'var(--destructive)' }}>
                                {shop?.name}
                            </span>
                        </p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={shop?.name || 'Дэлгүүрийн нэр'}
                            className="w-full px-3 py-2.5 rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none transition-colors"
                            style={{
                                borderWidth: 1,
                                borderStyle: 'solid',
                                borderColor:
                                    'color-mix(in oklab, var(--destructive) 35%, transparent)',
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <Button
                                variant="destructive"
                                size="md"
                                onClick={deleteShop}
                                disabled={deleting || deleteConfirmText !== shop?.name}
                                leftIcon={
                                    deleting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                    )
                                }
                            >
                                {deleting ? 'Устгаж байна...' : 'Устгахыг баталгаажуулах'}
                            </Button>
                            <Button
                                variant="outline"
                                size="md"
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmText('');
                                }}
                            >
                                Болих
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 max-w-3xl">
                    <div className="h-24 card-outlined animate-pulse" />
                    <div className="h-56 card-outlined animate-pulse" />
                </div>
            }
        >
            <SettingsContent />
        </Suspense>
    );
}
