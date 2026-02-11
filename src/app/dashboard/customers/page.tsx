'use client';
import { useState, useEffect } from 'react';
import { Search, User, Crown, Phone, Mail, Tag, X, Plus, MessageSquare, Clock, ChevronDown, Edit2, Save, Users } from 'lucide-react';

interface Customer {
    id: string; name: string | null; phone: string | null; email: string | null;
    address: string | null; notes: string | null; tags: string[]; total_orders: number;
    total_spent: number; is_vip: boolean; created_at: string;
    orders?: Array<{ id: string; status: string; total_amount: number; created_at: string }>;
    chat_history?: Array<{ message: string; response: string; created_at: string }>;
}

const TAGS = ['VIP', 'New', 'Lead', 'Inactive', 'Problem', 'Regular'];

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

    useEffect(() => { fetchCustomers(); }, [selectedTag, sortBy]);

    async function fetchCustomers() {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedTag) params.set('tag', selectedTag);
            params.set('sortBy', sortBy);
            const res = await fetch(`/api/dashboard/customers?${params}`, { headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' } });
            const data = await res.json();
            setCustomers(data.customers || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }

    async function fetchDetail(id: string) {
        try {
            const res = await fetch(`/api/dashboard/customers/${id}`, { headers: { 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' } });
            const data = await res.json();
            setSelectedCustomer(data.customer);
            setEditForm({ name: data.customer.name || '', phone: data.customer.phone || '', email: data.customer.email || '', address: data.customer.address || '', notes: data.customer.notes || '' });
            setIsDetailOpen(true);
        } catch (e) { console.error(e); }
    }

    async function saveCustomer() {
        if (!selectedCustomer) return;
        setSaving(true);
        try {
            await fetch('/api/dashboard/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || '' }, body: JSON.stringify({ id: selectedCustomer.id, ...editForm }) });
            setEditMode(false); fetchCustomers(); fetchDetail(selectedCustomer.id);
        } catch (e) { console.error(e); } finally { setSaving(false); }
    }

    async function addTag(cid: string, tag: string) {
        try { await fetch(`/api/dashboard/customers/${cid}/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag }) }); fetchCustomers(); if (selectedCustomer?.id === cid) fetchDetail(cid); } catch (e) { console.error(e); }
    }
    async function removeTag(cid: string, tag: string) {
        try { await fetch(`/api/dashboard/customers/${cid}/tags`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag }) }); fetchCustomers(); if (selectedCustomer?.id === cid) fetchDetail(cid); } catch (e) { console.error(e); }
    }

    const filtered = customers.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone || '').includes(searchQuery));
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('mn-MN') : '-';
    const fmtTime = (d: string | null) => { if (!d) return ''; const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); if (days === 0) return 'Өнөөдөр'; if (days === 1) return 'Өчигдөр'; if (days < 7) return `${days} өдрийн өмнө`; return fmtDate(d); };

    const inputCls = "w-full px-3 py-1.5 border border-white/[0.08] rounded-md text-[13px] text-foreground bg-transparent focus:outline-none focus:border-white/[0.2]";
    const selectCls = "px-2.5 py-1.5 bg-transparent border border-white/[0.08] rounded-md text-[12px] text-foreground focus:outline-none focus:border-white/[0.2] transition-colors";
    const thCls = "text-left px-5 py-3 text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]";

    if (loading) return <div className="flex items-center justify-center h-96"><div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                    <input type="text" placeholder="Нэр, утас хайх..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${inputCls} !pl-9`} />
                </div>
                <div className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                    <select value={selectedTag || ''} onChange={(e) => setSelectedTag(e.target.value || null)} className={selectCls}><option value="">Бүх Tag</option>{TAGS.map(t => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="flex items-center gap-1.5"><ChevronDown className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls}><option value="created_at">Бүртгэсэн огноо</option><option value="total_spent">Зарцуулсан дүн</option></select>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtered.map(c => (
                    <div key={c.id} onClick={() => fetchDetail(c.id)} className="bg-[#0F0B2E] rounded-lg border border-white/[0.08] p-4 cursor-pointer hover:border-[#4A7CE7]/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0F0B2E] flex items-center justify-center"><User className="w-4 h-4 text-white/30" strokeWidth={1.5} /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-[13px] text-foreground tracking-[-0.01em] truncate">{c.name || 'Харилцагч'}</p>
                                    {c.is_vip && <span className="px-1.5 py-0.5 text-[10px] font-medium text-[#4A7CE7] bg-[#4A7CE7]/10 rounded">VIP</span>}
                                </div>
                                <p className="text-[11px] text-white/40">{c.phone || '-'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[13px] font-semibold text-foreground tabular-nums">₮{Number(c.total_spent || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-white/30">{c.total_orders || 0} захиалга</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-[#0F0B2E] rounded-lg border border-white/[0.08] overflow-hidden">
                <table className="w-full">
                    <thead><tr className="border-b border-white/[0.08]">
                        <th className={thCls}>Харилцагч</th><th className={thCls}>Tags</th><th className={thCls}>Сүүлд харьцсан</th><th className={thCls}>Захиалга</th><th className={`${thCls} text-right`}>Зарцуулсан</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {filtered.length === 0 ? (
                            <tr><td colSpan={5} className="px-5 py-12 text-center"><Users className="w-10 h-10 text-white/10 mx-auto mb-3" strokeWidth={1.5} /><p className="text-[13px] text-white/40">Харилцагч байхгүй</p></td></tr>
                        ) : filtered.map(c => (
                            <tr key={c.id} className="hover:bg-[#0D0928] cursor-pointer transition-colors" onClick={() => fetchDetail(c.id)}>
                                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-[#0F0B2E] flex items-center justify-center"><User className="w-4 h-4 text-white/20" strokeWidth={1.5} /></div><div><p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{c.name || 'Харилцагч'}</p><p className="text-[11px] text-white/40">{c.phone || '-'}</p></div></div></td>
                                <td className="px-5 py-3.5"><div className="flex flex-wrap gap-1">{c.is_vip && <span className="px-1.5 py-0.5 text-[10px] font-medium text-[#4A7CE7] bg-[#4A7CE7]/10 rounded">VIP</span>}</div></td>
                                <td className="px-5 py-3.5"><div className="flex items-center gap-1.5 text-[12px] text-white/50"><Clock className="w-3 h-3 text-white/20" strokeWidth={1.5} />{fmtTime(c.created_at)}</div></td>
                                <td className="px-5 py-3.5"><span className="text-[13px] text-white/60 tabular-nums">{c.total_orders || 0}</span></td>
                                <td className="px-5 py-3.5 text-right"><span className="font-semibold text-[13px] text-foreground tabular-nums">₮{Number(c.total_spent || 0).toLocaleString()}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {isDetailOpen && selectedCustomer && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0A0220] rounded-lg border border-white/[0.08] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#0F0B2E] flex items-center justify-center"><User className="w-5 h-5 text-white/20" strokeWidth={1.5} /></div>
                                <div><h2 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">{selectedCustomer.name || 'Харилцагч'}</h2><p className="text-[11px] text-white/40">Бүртгэсэн: {fmtDate(selectedCustomer.created_at)}</p></div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {editMode ? <button onClick={saveCustomer} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-[12px] font-medium hover:opacity-80 transition-opacity disabled:opacity-50"><Save className="w-3.5 h-3.5" strokeWidth={1.5} />{saving ? 'Хадгалж...' : 'Хадгалах'}</button>
                                    : <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.08] rounded-md text-[12px] font-medium text-foreground hover:border-white/[0.15] transition-colors"><Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />Засах</button>}
                                <button onClick={() => { setIsDetailOpen(false); setEditMode(false); }} className="p-1.5 hover:bg-[#0F0B2E] rounded-md transition-colors"><X className="w-4 h-4 text-white/30" strokeWidth={1.5} /></button>
                            </div>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-4">
                                {[{ l: 'Нэр', k: 'name', icon: null }, { l: 'Утас', k: 'phone', icon: Phone }, { l: 'И-мэйл', k: 'email', icon: Mail }, { l: 'Хаяг', k: 'address', icon: null }].map(f => (
                                    <div key={f.k}><label className="block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-1.5">{f.l}</label>
                                        {editMode ? <input type="text" value={(editForm as any)[f.k]} onChange={(e) => setEditForm({ ...editForm, [f.k]: e.target.value })} className={inputCls} />
                                            : <p className="flex items-center gap-1.5 text-[13px] text-foreground">{f.icon && <f.icon className="w-3 h-3 text-white/20" strokeWidth={1.5} />}{(selectedCustomer as any)[f.k] || '-'}</p>}
                                    </div>
                                ))}
                            </div>
                            {/* Tags */}
                            <div><label className="block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-2">Tags</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedCustomer.is_vip && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#4A7CE7] bg-[#4A7CE7]/10"><Crown className="w-3 h-3" strokeWidth={1.5} />VIP</span>}
                                    {(selectedCustomer.tags || []).map(tag => <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#151040] text-white/60">{tag}<button onClick={() => removeTag(selectedCustomer.id, tag)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" strokeWidth={1.5} /></button></span>)}
                                    <div className="relative group"><button className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-dashed border-white/[0.12] text-white/40 hover:border-[#4A7CE7] hover:text-[#4A7CE7] transition-colors"><Plus className="w-3 h-3" strokeWidth={1.5} />Tag нэмэх</button>
                                        <div className="absolute left-0 mt-1 py-1 w-28 bg-[#0A0220] rounded-md border border-white/[0.08] shadow-lg hidden group-hover:block z-10">{TAGS.filter(t => !(selectedCustomer.tags || []).includes(t)).map(t => <button key={t} onClick={() => addTag(selectedCustomer.id, t)} className="w-full px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-[#0F0B2E] transition-colors">{t}</button>)}</div></div>
                                </div>
                            </div>
                            {/* Notes */}
                            <div><label className="block text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-2">Тэмдэглэл</label>
                                {editMode ? <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Тэмдэглэл..." />
                                    : <p className="text-[13px] text-white/50 bg-[#0D0928] p-3 rounded-md min-h-[48px] border border-white/[0.04]">{selectedCustomer.notes || 'Тэмдэглэл байхгүй'}</p>}
                            </div>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[{ v: selectedCustomer.total_orders || 0, l: 'Захиалга', p: '' }, { v: `₮${Number(selectedCustomer.total_spent || 0).toLocaleString()}`, l: 'Зарцуулсан', p: '' }, { v: fmtTime(selectedCustomer.created_at), l: 'Бүртгэсэн', p: '' }].map((s, i) => (
                                    <div key={i} className="bg-[#0D0928] border border-white/[0.04] p-4 rounded-md text-center">
                                        <p className="text-[18px] font-bold text-foreground tabular-nums">{s.v}</p>
                                        <p className="text-[11px] text-white/40 mt-0.5">{s.l}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Chat History */}
                            {selectedCustomer.chat_history && selectedCustomer.chat_history.length > 0 && (
                                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mb-2"><MessageSquare className="w-3 h-3" strokeWidth={1.5} />Сүүлийн харилцаа</label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto bg-[#0D0928] p-3 rounded-md border border-white/[0.04]">
                                        {selectedCustomer.chat_history.slice(0, 5).map((ch, i) => <div key={i} className="text-[12px]"><p className="text-white/60"><span className="font-medium text-foreground">Хэрэглэгч:</span> {ch.message}</p><p className="text-white/40 mt-0.5"><span className="font-medium text-foreground">AI:</span> {ch.response}</p></div>)}
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
