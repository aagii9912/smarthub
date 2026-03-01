'use client';
import { useState, useEffect } from 'react';
import { Save, Store, Building2, CreditCard, Globe, LogOut, Trash2, AlertTriangle, Facebook, Instagram, Bot, User, Phone, Mail, MapPin, Clock, Loader2, Link2, Unlink } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shop, setShop] = useState<any>(null);

    const [shopInfo, setShopInfo] = useState({ name: '', description: '', phone: '', address: '', working_hours: '' });
    const [bankInfo, setBankInfo] = useState({ bank_name: '', account_name: '', account_number: '' });
    const [fbConnected, setFbConnected] = useState(false);
    const [igConnected, setIgConnected] = useState(false);

    // Handle Instagram OAuth redirect feedback
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const igSuccess = params.get('ig_success');
        const igError = params.get('ig_error');
        if (igSuccess) {
            toast.success('Instagram амжилттай холбогдлоо! ✅');
            window.history.replaceState({}, '', '/dashboard/settings');
            fetchSettings();
        }
        if (igError) {
            const errorMessages: Record<string, string> = {
                'no_instagram_account': 'Instagram Business Account олдсонгүй. Facebook Page-тай IG холбогдсон эсэхийг шалгана уу.',
                'token_error': 'Token авахад алдаа гарлаа',
                'pages_error': 'Facebook Pages уншихад алдаа гарлаа',
                'config_missing': 'App тохиргоо дутуу',
                'db_save_failed': 'Мэдээлэл хадгалахад алдаа',
                'exception': 'Алдаа гарлаа, дахин оролдоно уу',
            };
            toast.error(errorMessages[igError] || `IG холболтын алдаа: ${igError}`);
            window.history.replaceState({}, '', '/dashboard/settings');
        }
    }, []);

    useEffect(() => { fetchSettings(); }, []);

    async function fetchSettings() {
        try {
            setLoading(true);
            const res = await fetch('/api/shop', { headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' } });
            const data = await res.json();
            if (data.shop) {
                setShop(data.shop);
                setShopInfo({ name: data.shop.name || '', description: data.shop.description || '', phone: data.shop.phone || '', address: data.shop.address || '', working_hours: data.shop.working_hours || '' });
                setBankInfo({ bank_name: data.shop.bank_name || '', account_name: data.shop.account_name || '', account_number: data.shop.account_number || '' });
                setFbConnected(!!data.shop.facebook_page_id);
                setIgConnected(!!data.shop.instagram_business_account_id);
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }

    async function saveSettings(body: any) {
        setSaving(true);
        try {
            const res = await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' }, body: JSON.stringify(body) });
            if (res.ok) toast.success('Амжилттай хадгалагдлаа');
            else throw new Error('Failed');
        } catch { toast.error('Хадгалахад алдаа гарлаа'); } finally { setSaving(false); }
    }

    async function disconnectPlatform(platform: string) {
        try {
            await fetch('/api/shop', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' }, body: JSON.stringify(platform === 'facebook' ? { facebook_page_id: null, facebook_page_name: null, facebook_page_access_token: null } : { instagram_business_account_id: null, instagram_account_id: null, instagram_username: null, instagram_access_token: null }) });
            if (platform === 'facebook') setFbConnected(false); else setIgConnected(false);
            toast.success(`${platform === 'facebook' ? 'Facebook' : 'Instagram'} салгагдлаа`);
        } catch { toast.error('Алдаа гарлаа'); }
    }

    const inputCls = "w-full px-3 py-2 border border-white/[0.08] rounded-md text-[13px] text-foreground bg-transparent focus:outline-none focus:border-white/[0.2] transition-colors";
    const labelCls = "block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-1.5";
    const cardCls = "bg-[#0F0B2E] rounded-lg border border-white/[0.08] p-6";
    const sectionTitleCls = "flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.02em] mb-4";

    if (loading) return <div className="flex items-center justify-center h-96"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Shop Info */}
            <div className={cardCls}>
                <h3 className={sectionTitleCls}><Store className="w-4 h-4 text-white/30" strokeWidth={1.5} />Дэлгүүрийн мэдээлэл</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className={labelCls}>Нэр</label><input type="text" value={shopInfo.name} onChange={(e) => setShopInfo({ ...shopInfo, name: e.target.value })} className={inputCls} placeholder="Дэлгүүрийн нэр" /></div>
                    <div><label className={labelCls}>Утас</label><input type="text" value={shopInfo.phone} onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })} className={inputCls} placeholder="Утасны дугаар" /></div>
                    <div className="md:col-span-2"><label className={labelCls}>Тайлбар</label><textarea value={shopInfo.description} onChange={(e) => setShopInfo({ ...shopInfo, description: e.target.value })} className={`${inputCls} resize-none`} rows={2} placeholder="Дэлгүүрийн тайлбар" /></div>
                    <div><label className={labelCls}>Хаяг</label><input type="text" value={shopInfo.address} onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })} className={inputCls} placeholder="Хаяг" /></div>
                    <div><label className={labelCls}>Ажлын цаг</label><input type="text" value={shopInfo.working_hours} onChange={(e) => setShopInfo({ ...shopInfo, working_hours: e.target.value })} className={inputCls} placeholder="09:00 - 18:00" /></div>
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={() => saveSettings(shopInfo)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-md text-[12px] font-medium hover:opacity-80 transition-opacity disabled:opacity-50">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах
                    </button>
                </div>
            </div>

            {/* Bank Details */}
            <div className={cardCls}>
                <h3 className={sectionTitleCls}><CreditCard className="w-4 h-4 text-white/30" strokeWidth={1.5} />Банкны мэдээлэл</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Банк</label><input type="text" value={bankInfo.bank_name} onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })} className={inputCls} placeholder="Хаан банк" /></div>
                    <div><label className={labelCls}>Данс эзэмшигч</label><input type="text" value={bankInfo.account_name} onChange={(e) => setBankInfo({ ...bankInfo, account_name: e.target.value })} className={inputCls} placeholder="Нэр" /></div>
                    <div><label className={labelCls}>Дансны дугаар</label><input type="text" value={bankInfo.account_number} onChange={(e) => setBankInfo({ ...bankInfo, account_number: e.target.value })} className={inputCls} placeholder="0000000000" /></div>
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={() => saveSettings(bankInfo)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-md text-[12px] font-medium hover:opacity-80 transition-opacity disabled:opacity-50">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}Хадгалах
                    </button>
                </div>
            </div>

            {/* Platform Connections */}
            <div className={cardCls}>
                <h3 className={sectionTitleCls}><Globe className="w-4 h-4 text-white/30" strokeWidth={1.5} />Платформ холболтууд</h3>
                <div className="space-y-3">
                    {/* Facebook */}
                    <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-md border border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <Facebook className="w-5 h-5 text-white/30" strokeWidth={1.5} />
                            <div><p className="text-[13px] font-medium text-foreground">Facebook</p><p className="text-[11px] text-white/40">{fbConnected ? 'Холбогдсон' : 'Холбогдоогүй'}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${fbConnected ? 'bg-emerald-500' : 'bg-white/10'}`} />
                            {fbConnected ? <button onClick={() => disconnectPlatform('facebook')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/5 transition-colors"><Unlink className="w-3 h-3" strokeWidth={1.5} />Салгах</button> : <a href="/api/auth/facebook" className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-emerald-500 border border-emerald-500/20 rounded-md hover:bg-emerald-500/5 transition-colors"><Link2 className="w-3 h-3" strokeWidth={1.5} />Холбох</a>}
                        </div>
                    </div>
                    {/* Instagram */}
                    <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-md border border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <Instagram className="w-5 h-5 text-white/30" strokeWidth={1.5} />
                            <div><p className="text-[13px] font-medium text-foreground">Instagram</p><p className="text-[11px] text-white/40">{igConnected ? 'Холбогдсон' : 'Холбогдоогүй'}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${igConnected ? 'bg-emerald-500' : 'bg-white/10'}`} />
                            {igConnected ? <button onClick={() => disconnectPlatform('instagram')} className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/5 transition-colors"><Unlink className="w-3 h-3" strokeWidth={1.5} />Салгах</button> : <a href={`/api/auth/instagram?source=settings&shop_id=${localStorage.getItem('smarthub_active_shop_id') || ''}`} className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-emerald-500 border border-emerald-500/20 rounded-md hover:bg-emerald-500/5 transition-colors"><Link2 className="w-3 h-3" strokeWidth={1.5} />Холбох</a>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Account */}
            <div className={cardCls}>
                <h3 className={sectionTitleCls}><User className="w-4 h-4 text-white/30" strokeWidth={1.5} />Аккаунт</h3>
                <div className="flex items-center justify-between p-4 bg-[#0D0928] rounded-md border border-white/[0.04]">
                    <div><p className="text-[13px] font-medium text-foreground">Системээс гарах</p><p className="text-[11px] text-white/40">Бүх төхөөрөмж дээрээс гарна</p></div>
                    <button onClick={() => { window.location.href = '/sign-in'; }} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] rounded-md text-[12px] font-medium text-foreground hover:border-white/[0.15] transition-colors">
                        <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />Гарах
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#0F0B2E] rounded-lg border border-red-500/20 p-6">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-red-600 text-red-400 tracking-[-0.02em] mb-3">
                    <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />Аюултай бүс
                </h3>
                <p className="text-[12px] text-white/50 mb-4">Дэлгүүрээ устгах. Энэ үйлдлийг буцаах боломжгүй.</p>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-md text-[12px] font-medium hover:bg-red-700 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />Дэлгүүр устгах
                </button>
            </div>
        </div>
    );
}
