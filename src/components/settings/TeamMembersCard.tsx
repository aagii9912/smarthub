'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Loader2, Trash2, Mail, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { ShopRole } from '@/types/database';

const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';
const selectCls = cn(inputCls, 'appearance-none cursor-pointer');

const ROLE_LABELS: Record<string, string> = {
    owner: 'Эзэн',
    admin: 'Админ',
    staff: 'Ажилтан',
};

interface TeamMember {
    id: string;
    user_id: string | null;
    email: string | null;
    name?: string | null;
    role: ShopRole;
    status: 'pending' | 'active' | 'revoked';
    is_owner: boolean;
}

function shopHeaders(json = false): Record<string, string> {
    const h: Record<string, string> = {
        'x-shop-id': (typeof window !== 'undefined' && localStorage.getItem('smarthub_active_shop_id')) || '',
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
}

/** currentRole — нэвтэрсэн хэрэглэгчийн энэ дэлгүүр дэх эрх (owner | admin). */
export function TeamMembersCard({ currentRole }: { currentRole: ShopRole }) {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');
    const [inviting, setInviting] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/dashboard/team/members', { headers: shopHeaders() });
            const data = await res.json();
            if (res.ok) setMembers(data.members || []);
        } catch {
            /* чимээгүй — UI хоосон харагдана */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            const res = await fetch('/api/dashboard/team/members', {
                method: 'POST',
                headers: shopHeaders(true),
                body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Урих үед алдаа гарлаа');
            } else {
                toast.success('Урилга илгээгдлээ');
                setInviteEmail('');
                setInviteRole('staff');
                await load();
            }
        } catch {
            toast.error('Урих үед алдаа гарлаа');
        } finally {
            setInviting(false);
        }
    };

    const handleRoleChange = async (id: string, role: ShopRole) => {
        setBusyId(id);
        try {
            const res = await fetch(`/api/dashboard/team/members/${id}`, {
                method: 'PATCH',
                headers: shopHeaders(true),
                body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || 'Эрх солиход алдаа гарлаа');
            else {
                toast.success('Эрх шинэчлэгдлээ');
                await load();
            }
        } catch {
            toast.error('Эрх солиход алдаа гарлаа');
        } finally {
            setBusyId(null);
        }
    };

    const handleRemove = async (id: string) => {
        setBusyId(id);
        try {
            const res = await fetch(`/api/dashboard/team/members/${id}`, {
                method: 'DELETE',
                headers: shopHeaders(),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || 'Хасах үед алдаа гарлаа');
            else {
                toast.success('Гишүүнийг хаслаа');
                setConfirmRemoveId(null);
                await load();
            }
        } catch {
            toast.error('Хасах үед алдаа гарлаа');
        } finally {
            setBusyId(null);
        }
    };

    const handleResend = async (id: string) => {
        setBusyId(id);
        try {
            const res = await fetch(`/api/dashboard/team/members/${id}/resend`, {
                method: 'POST',
                headers: shopHeaders(),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || 'Дахин илгээхэд алдаа гарлаа');
            else toast.success('Урилга дахин илгээгдлээ');
        } catch {
            toast.error('Дахин илгээхэд алдаа гарлаа');
        } finally {
            setBusyId(null);
        }
    };

    const isOwnerViewer = currentRole === 'owner';
    // admin зөвхөн staff гишүүнийг удирдана; owner бүгдийг удирдана.
    const canManage = (m: TeamMember) => !m.is_owner && (isOwnerViewer || m.role === 'staff');

    return (
        <div className="card-outlined p-6">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-foreground tracking-[-0.01em] mb-5">
                <Users className="w-4 h-4 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                Багийн гишүүд
            </h3>

            {/* Урих форм */}
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 mb-5">
                <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="имэйл@жишээ.com"
                    className={cn(inputCls, 'flex-1')}
                />
                <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'staff')}
                    className={cn(selectCls, 'sm:w-32')}
                >
                    <option value="staff">Ажилтан</option>
                    {isOwnerViewer && <option value="admin">Админ</option>}
                </select>
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={inviting}
                    leftIcon={inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                    Урих
                </Button>
            </form>

            {/* Гишүүдийн жагсаалт */}
            {loading ? (
                <p className="text-[12px] text-white/45 py-2">Ачааллаж байна...</p>
            ) : (
                <div className="space-y-2">
                    {members.map((m) => (
                        <div
                            key={m.id}
                            className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]"
                        >
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-[#4A7CE7] to-[#8B5CF6] text-[11px] font-bold text-white shrink-0">
                                {(m.name || m.email || '?').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                                    {m.name || m.email || '—'}
                                    {m.is_owner && <Crown className="w-3 h-3 text-amber-400" strokeWidth={2} />}
                                </p>
                                <p className="text-[11px] text-white/45 truncate">
                                    {m.email}
                                    {m.status === 'pending' && ' · Хүлээгдэж буй'}
                                </p>
                            </div>

                            {m.is_owner ? (
                                <span className="text-[11px] font-medium text-white/60 px-2 py-0.5 rounded-full bg-white/[0.04]">
                                    {ROLE_LABELS[m.role]}
                                </span>
                            ) : canManage(m) ? (
                                <>
                                    <select
                                        value={m.role}
                                        disabled={busyId === m.id}
                                        onChange={(e) => handleRoleChange(m.id, e.target.value as ShopRole)}
                                        className={cn(selectCls, 'w-28 py-1.5 text-[12px]')}
                                    >
                                        <option value="staff">Ажилтан</option>
                                        {isOwnerViewer && <option value="admin">Админ</option>}
                                    </select>
                                    {m.status === 'pending' && (
                                        <button
                                            type="button"
                                            onClick={() => handleResend(m.id)}
                                            disabled={busyId === m.id}
                                            title="Урилга дахин илгээх"
                                            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors"
                                        >
                                            <Mail className="w-4 h-4" strokeWidth={1.5} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemoveId(confirmRemoveId === m.id ? null : m.id)}
                                        disabled={busyId === m.id}
                                        title="Хасах"
                                        className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-white/[0.05] transition-colors"
                                    >
                                        {busyId === m.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                        )}
                                    </button>
                                </>
                            ) : (
                                <span className="text-[11px] font-medium text-white/60 px-2 py-0.5 rounded-full bg-white/[0.04]">
                                    {ROLE_LABELS[m.role]}
                                </span>
                            )}

                            {confirmRemoveId === m.id && (
                                <div className="absolute right-6 mt-20 z-10 p-3 rounded-xl border border-white/10 bg-[#16161f] shadow-xl">
                                    <p className="text-[12px] text-white/70 mb-2">Гишүүнийг хасах уу?</p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setConfirmRemoveId(null)}>
                                            Болих
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleRemove(m.id)} disabled={busyId === m.id}>
                                            Хасах
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {members.filter((m) => !m.is_owner).length === 0 && (
                        <p className="text-[12px] text-white/45 py-2 text-center">
                            Одоогоор багийн гишүүн алга. Дээрх формоор ажилтнаа урина уу.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
