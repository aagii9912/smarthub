'use client';
import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import {
    Search,
    Crown,
    Phone,
    Mail,
    Tag,
    X,
    Plus,
    MessageSquare,
    Clock,
    Edit2,
    Save,
    Users,
    Trash2,
    ChevronRight,
    Download,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface Customer {
    id: string; name: string | null; phone: string | null; email: string | null;
    address: string | null; notes: string | null; tags: string[]; total_orders: number;
    total_spent: number; is_vip: boolean; created_at: string;
    orders?: Array<{ id: string; status: string; total_amount: number; created_at: string }>;
    chat_history?: Array<{ message: string; response: string; created_at: string }>;
}

const TAGS = ['VIP', 'New', 'Lead', 'Inactive', 'Problem', 'Regular'];

const TONES: Array<'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan'> = [
    'indigo',
    'violet',
    'emerald',
    'cyan',
    'rose',
    'amber',
];

function toneFor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return TONES[hash % TONES.length];
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState('created_at');
    const [loading, setLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
    const [showTagMenu, setShowTagMenu] = useState(false);

    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedTag) params.set('tag', selectedTag);
            params.set('sortBy', sortBy);
            const res = await fetch(`/api/dashboard/customers?${params}`, { headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' } });
            const data = await res.json();
            setCustomers(data.customers || []);
        } catch (e) { logger.error('Хэрэглэгчийн алдаа', { error: e }); } finally { setLoading(false); }
    }, [selectedTag, sortBy]);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    async function fetchDetail(id: string) {
        try {
            const res = await fetch(`/api/dashboard/customers/${id}`, { headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' } });
            const data = await res.json();
            setSelectedCustomer(data.customer);
            setEditForm({ name: data.customer.name || '', phone: data.customer.phone || '', email: data.customer.email || '', address: data.customer.address || '', notes: data.customer.notes || '' });
            setIsDetailOpen(true);
        } catch (e) { logger.error('Хэрэглэгчийн алдаа', { error: e }); }
    }

    async function saveCustomer() {
        if (!selectedCustomer) return;
        setSaving(true);
        try {
            await fetch('/api/dashboard/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' }, body: JSON.stringify({ id: selectedCustomer.id, ...editForm }) });
            setEditMode(false); fetchCustomers(); fetchDetail(selectedCustomer.id);
        } catch (e) { logger.error('Хэрэглэгчийн алдаа', { error: e }); } finally { setSaving(false); }
    }

    async function deleteCustomer(id: string, name: string | null) {
        if (!confirm(`"${name || 'Харилцагч'}" хэрэглэгчийг устгах уу? Чат түүх, сагс, гомдол бүгд устана.`)) return;
        try {
            const res = await fetch(`/api/dashboard/customers?id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' },
            });
            if (!res.ok) throw new Error('Failed');
            setIsDetailOpen(false);
            setSelectedCustomer(null);
            fetchCustomers();
        } catch (e) { logger.error('Устгах алдаа', { error: e }); }
    }

    async function addTag(cid: string, tag: string) {
        try {
            const res = await fetch(`/api/dashboard/customers/${cid}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify({ tag }),
            });
            if (!res.ok) throw new Error(`Tag add failed: ${res.status}`);
            fetchCustomers();
            if (selectedCustomer?.id === cid) fetchDetail(cid);
        } catch (e) { logger.error('Tag нэмэх алдаа', { error: e }); }
    }
    async function removeTag(cid: string, tag: string) {
        try {
            const res = await fetch(`/api/dashboard/customers/${cid}/tags`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '',
                },
                body: JSON.stringify({ tag }),
            });
            if (!res.ok) throw new Error(`Tag remove failed: ${res.status}`);
            fetchCustomers();
            if (selectedCustomer?.id === cid) fetchDetail(cid);
        } catch (e) { logger.error('Tag устгах алдаа', { error: e }); }
    }

    const filtered = customers.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone || '').includes(searchQuery));
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('mn-MN') : '-';
    const fmtTime = (d: string | null) => { if (!d) return ''; const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); if (days === 0) return 'Өнөөдөр'; if (days === 1) return 'Өчигдөр'; if (days < 7) return `${days} өдрийн өмнө`; return fmtDate(d); };

    const newThisWeek = customers.filter((c) => {
        const d = new Date(c.created_at);
        return Date.now() - d.getTime() < 7 * 86400000;
    }).length;

    const inputCls = 'w-full h-10 px-3 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--brand-indigo)] focus:bg-white/[0.04] transition-colors tracking-[-0.01em] placeholder:text-white/30';

    if (loading) return (
        <div className="space-y-6">
            <div className="h-24 card-outlined animate-pulse" />
            <div className="h-96 card-outlined animate-pulse" />
        </div>
    );

    return (
        <div className="space-y-6">
            <PageHero
                eyebrow="Харилцагчдын жагсаалт"
                title="Харилцагчид"
                subtitle={
                    <>
                        Нийт <span className="text-foreground font-medium tabular-nums">{customers.length}</span> харилцагч ·
                        {' '}
                        <span className="text-[var(--brand-indigo-400)] font-medium tabular-nums">{newThisWeek}</span> шинэ
                    </>
                }
                actions={
                    <>
                        <Button variant="ghost" size="md" leftIcon={<Download className="h-4 w-4" strokeWidth={1.5} />}>
                            Экспорт
                        </Button>
                        <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" strokeWidth={1.8} />}>
                            Шинэ харилцагч
                        </Button>
                    </>
                }
            />

            {/* Toolbar */}
            <div className="card-outlined p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" strokeWidth={1.5} />
                    <input
                        type="text"
                        placeholder="Нэр, утас хайх..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={cn(inputCls, '!pl-10')}
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-white/30" strokeWidth={1.5} />
                    <select
                        value={selectedTag || ''}
                        onChange={(e) => setSelectedTag(e.target.value || null)}
                        className="h-10 px-3 bg-white/[0.02] border border-white/[0.08] rounded-lg text-[13px] text-foreground focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                    >
                        <option value="">Бүх Tag</option>
                        {TAGS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 px-3 bg-white/[0.02] border border-white/[0.08] rounded-lg text-[13px] text-foreground focus:outline-none focus:border-[var(--brand-indigo)] transition-colors"
                >
                    <option value="created_at">Бүртгэсэн огноо</option>
                    <option value="total_spent">Зарцуулсан дүн</option>
                </select>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map((c) => (
                    <div
                        key={c.id}
                        onClick={() => fetchDetail(c.id)}
                        className="card-outlined p-4 cursor-pointer transition-all hover:-translate-y-[1px]"
                    >
                        <div className="flex items-center gap-3">
                            <Avatar size="md" tone={toneFor(c.id)} fallback={c.name || 'Х'} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-[13.5px] text-foreground tracking-[-0.01em] truncate">
                                        {c.name || 'Харилцагч'}
                                    </p>
                                    {c.is_vip && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-indigo-400)] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] rounded-md">
                                            <Crown className="w-3 h-3" strokeWidth={1.8} />
                                            VIP
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11.5px] text-white/45 tabular-nums mt-0.5">{c.phone || '-'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[13.5px] font-semibold text-foreground tabular-nums">
                                    ₮{Number(c.total_spent || 0).toLocaleString()}
                                </p>
                                <p className="text-[10.5px] text-white/30 mt-0.5">{c.total_orders || 0} захиалга</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block card-outlined overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/[0.06]">
                            <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Харилцагч</th>
                            <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Утас</th>
                            <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Зэрэг</th>
                            <th className="text-right px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Захиалга</th>
                            <th className="text-right px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Нийт орлого</th>
                            <th className="text-left px-5 py-3 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Сүүлд</th>
                            <th className="px-5 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-5 py-14 text-center">
                                    <Users className="w-10 h-10 text-white/10 mx-auto mb-3" strokeWidth={1.5} />
                                    <p className="text-[13px] text-white/50">Харилцагч байхгүй</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((c) => (
                                <tr
                                    key={c.id}
                                    onClick={() => fetchDetail(c.id)}
                                    className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                                >
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <Avatar size="sm" tone={toneFor(c.id)} fallback={c.name || 'Х'} />
                                            <p className="font-medium text-[13.5px] text-foreground tracking-[-0.01em]">
                                                {c.name || 'Харилцагч'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-[12.5px] text-white/55 font-mono tabular-nums">
                                            {c.phone || '—'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {c.is_vip ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--brand-indigo-400)] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)]">
                                                <Crown className="w-3 h-3" strokeWidth={1.8} />
                                                VIP
                                            </span>
                                        ) : (c.total_orders || 0) >= 3 ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--success)] bg-[color-mix(in_oklab,var(--success)_18%,transparent)]">
                                                Тогтмол
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-white/55 bg-white/[0.06]">
                                                Шинэ
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <span className="text-[13px] text-white/70 tabular-nums">{c.total_orders || 0}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <span className="font-semibold text-[13.5px] text-foreground tabular-nums">
                                            ₮{Number(c.total_spent || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-1.5 text-[11.5px] text-white/45">
                                            <Clock className="w-3 h-3 text-white/25" strokeWidth={1.5} />
                                            {fmtTime(c.created_at)}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors inline-block" strokeWidth={1.8} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {isDetailOpen && selectedCustomer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0c0c0f] rounded-2xl border border-white/[0.08] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] sticky top-0 bg-[#0c0c0f]/95 backdrop-blur-xl z-10">
                            <div className="flex items-center gap-3">
                                <Avatar size="md" tone={toneFor(selectedCustomer.id)} fallback={selectedCustomer.name || 'Х'} />
                                <div>
                                    <h2 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                                        {selectedCustomer.name || 'Харилцагч'}
                                    </h2>
                                    <p className="text-[11px] text-white/40">
                                        Бүртгэсэн: {fmtDate(selectedCustomer.created_at)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {editMode ? (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<Save className="h-3.5 w-3.5" strokeWidth={1.8} />}
                                        onClick={saveCustomer}
                                        disabled={saving}
                                    >
                                        {saving ? 'Хадгалж...' : 'Хадгалах'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        leftIcon={<Edit2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
                                        onClick={() => setEditMode(true)}
                                    >
                                        Засах
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Устгах"
                                    onClick={() => deleteCustomer(selectedCustomer.id, selectedCustomer.name)}
                                    className="text-white/40 hover:text-[var(--destructive)]"
                                >
                                    <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Close"
                                    onClick={() => { setIsDetailOpen(false); setEditMode(false); }}
                                >
                                    <X className="w-4 h-4" strokeWidth={1.8} />
                                </Button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="card-outlined p-4 text-center">
                                    <p className="text-[22px] font-bold text-foreground tabular-nums">
                                        {selectedCustomer.total_orders || 0}
                                    </p>
                                    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mt-1">
                                        Захиалга
                                    </p>
                                </div>
                                <div className="card-featured p-4 text-center">
                                    <p className="text-[22px] font-bold text-foreground tabular-nums">
                                        ₮{Number(selectedCustomer.total_spent || 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mt-1">
                                        Орлого
                                    </p>
                                </div>
                                <div className="card-outlined p-4 text-center">
                                    <p className="text-[14px] font-bold text-foreground">
                                        {fmtTime(selectedCustomer.created_at)}
                                    </p>
                                    <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mt-1">
                                        Бүртгэсэн
                                    </p>
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-4">
                                {([
                                    { l: 'Нэр', k: 'name' as const, icon: null },
                                    { l: 'Утас', k: 'phone' as const, icon: Phone },
                                    { l: 'И-мэйл', k: 'email' as const, icon: Mail },
                                    { l: 'Хаяг', k: 'address' as const, icon: null },
                                ]).map((f) => (
                                    <div key={f.k}>
                                        <label className="block text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
                                            {f.l}
                                        </label>
                                        {editMode ? (
                                            <input
                                                type="text"
                                                value={editForm[f.k] ?? ''}
                                                onChange={(e) => setEditForm({ ...editForm, [f.k]: e.target.value })}
                                                className={inputCls}
                                            />
                                        ) : (
                                            <p className="flex items-center gap-1.5 text-[13px] text-foreground">
                                                {f.icon && <f.icon className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />}
                                                {((selectedCustomer as unknown as Record<string, unknown>)[f.k] as string) || '—'}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">Tags</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedCustomer.is_vip && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--brand-indigo-400)] bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)]">
                                            <Crown className="w-3 h-3" strokeWidth={1.8} />
                                            VIP
                                        </span>
                                    )}
                                    {(selectedCustomer.tags || []).map((tag) => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.06] text-white/70">
                                            {tag}
                                            <button
                                                onClick={() => removeTag(selectedCustomer.id, tag)}
                                                className="hover:text-[var(--destructive)] transition-colors"
                                            >
                                                <X className="w-3 h-3" strokeWidth={1.8} />
                                            </button>
                                        </span>
                                    ))}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowTagMenu((v) => !v)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-dashed border-white/[0.12] text-white/45 hover:border-[var(--brand-indigo)] hover:text-[var(--brand-indigo-400)] transition-colors"
                                        >
                                            <Plus className="w-3 h-3" strokeWidth={1.8} />
                                            Tag нэмэх
                                        </button>
                                        {showTagMenu && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setShowTagMenu(false)}
                                                />
                                                <div className="absolute left-0 mt-1 py-1 w-36 bg-[#0c0c0f] rounded-lg border border-white/[0.08] shadow-xl z-20">
                                                    {TAGS.filter((t) => !(selectedCustomer.tags || []).includes(t)).length === 0 ? (
                                                        <p className="px-3 py-1.5 text-[11.5px] text-white/40">Боломжит Tag байхгүй</p>
                                                    ) : (
                                                        TAGS.filter((t) => !(selectedCustomer.tags || []).includes(t)).map((t) => (
                                                            <button
                                                                key={t}
                                                                onClick={() => { addTag(selectedCustomer.id, t); setShowTagMenu(false); }}
                                                                className="w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-white/[0.05] transition-colors"
                                                            >
                                                                {t}
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">Тэмдэглэл</label>
                                {editMode ? (
                                    <textarea
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                        rows={3}
                                        className={cn(inputCls, 'h-auto py-2.5 resize-none')}
                                        placeholder="Тэмдэглэл..."
                                    />
                                ) : (
                                    <p className="text-[13px] text-white/60 bg-white/[0.02] p-3 rounded-lg min-h-[48px] border border-white/[0.06]">
                                        {selectedCustomer.notes || 'Тэмдэглэл байхгүй'}
                                    </p>
                                )}
                            </div>

                            {/* Orders */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                                        Захиалгын түүх · {selectedCustomer.orders?.length || 0}
                                    </label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        leftIcon={<Plus className="h-3.5 w-3.5" strokeWidth={1.8} />}
                                        onClick={() => {
                                            const q = new URLSearchParams({ new: '1' });
                                            if (selectedCustomer.id) q.set('customerId', selectedCustomer.id);
                                            window.location.href = `/dashboard/orders?${q.toString()}`;
                                        }}
                                    >
                                        Шинэ захиалга
                                    </Button>
                                </div>
                                {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                                    <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] divide-y divide-white/[0.04] max-h-56 overflow-y-auto">
                                        {selectedCustomer.orders
                                            .slice()
                                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                            .map((o) => {
                                                const statusColor =
                                                    o.status === 'delivered' || o.status === 'confirmed' ? 'text-[var(--success)]' :
                                                        o.status === 'cancelled' ? 'text-[var(--destructive)]' :
                                                            o.status === 'pending' ? 'text-[var(--warning)]' : 'text-white/60';
                                                const statusLabel: Record<string, string> = {
                                                    pending: 'Хүлээгдэж',
                                                    confirmed: 'Баталгаажсан',
                                                    processing: 'Бэлтгэж байна',
                                                    shipped: 'Илгээсэн',
                                                    delivered: 'Хүргэгдсэн',
                                                    cancelled: 'Цуцалсан',
                                                };
                                                return (
                                                    <button
                                                        key={o.id}
                                                        onClick={() => { window.location.href = `/dashboard/orders?orderId=${o.id}`; }}
                                                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-[11.5px] text-white/70">#{o.id.slice(0, 8)}</span>
                                                                <span className={cn('text-[10.5px] font-semibold', statusColor)}>
                                                                    {statusLabel[o.status] || o.status}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10.5px] text-white/40 mt-0.5">{fmtTime(o.created_at)}</p>
                                                        </div>
                                                        <p className="text-[13px] font-semibold text-foreground tabular-nums">
                                                            ₮{Number(o.total_amount || 0).toLocaleString()}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                ) : (
                                    <p className="text-[12.5px] text-white/40 bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                                        Захиалга байхгүй байна.
                                    </p>
                                )}
                            </div>

                            {/* Chat History */}
                            {selectedCustomer.chat_history && selectedCustomer.chat_history.length > 0 && (
                                <div>
                                    <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">
                                        <MessageSquare className="w-3 h-3" strokeWidth={1.8} />
                                        Сүүлийн харилцаа
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto bg-white/[0.02] p-3 rounded-lg border border-white/[0.06]">
                                        {selectedCustomer.chat_history.slice(0, 5).map((ch, i) => (
                                            <div key={i} className="text-[12px]">
                                                <p className="text-white/70">
                                                    <span className="font-medium text-foreground">Хэрэглэгч:</span> {ch.message}
                                                </p>
                                                <p className="text-white/45 mt-0.5">
                                                    <span className="font-medium text-[var(--brand-indigo-400)]">AI:</span> {ch.response}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
