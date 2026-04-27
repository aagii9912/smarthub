'use client';

import { useState, useEffect, useMemo } from 'react';
import { AutomationCard } from '@/components/dashboard/AutomationCard';
import type { Automation } from '@/components/dashboard/AutomationCard';
import {
    MessageSquareMore,
    Plus,
    Save,
    Loader2,
    Zap,
    Send,
    MessageCircle,
    Hash,
    Globe,
    Target,
    X,
    Image as ImageIcon,
    ChevronDown,
    Search,
    Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHero } from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ShopPost {
    id: string;
    message: string;
    picture: string | null;
    created_time: string;
    platform: 'facebook' | 'instagram';
    type: string;
}

const labelCls = 'block text-[11px] font-medium text-white/45 uppercase tracking-[0.08em] mb-1.5';
const inputCls =
    'w-full px-3 py-2.5 border border-white/[0.08] rounded-lg text-[13px] text-foreground bg-white/[0.02] focus:outline-none focus:border-[var(--border-accent)] focus:bg-white/[0.04] transition-colors placeholder:text-white/30';

export default function CommentAutomationPage() {
    const { t, locale } = useLanguage();
    const c = t.commentAutomation;
    const dateLocale = locale === 'mn' ? 'mn-MN' : 'en-US';

    const platformOptions = useMemo(
        () => [
            { value: 'both' as const, label: c.platformBoth, icon: '🌐' },
            { value: 'facebook' as const, label: c.platformFacebook, icon: '📘' },
            { value: 'instagram' as const, label: c.platformInstagram, icon: '📸' },
        ],
        [c.platformBoth, c.platformFacebook, c.platformInstagram]
    );

    const actionOptions = useMemo(
        () => [
            { value: 'send_dm' as const, label: c.actionDmLabel, desc: c.actionDmDesc },
            { value: 'reply_comment' as const, label: c.actionReplyLabel, desc: c.actionReplyDesc },
            { value: 'both' as const, label: c.actionBothLabel, desc: c.actionBothDesc },
        ],
        [
            c.actionDmLabel,
            c.actionDmDesc,
            c.actionReplyLabel,
            c.actionReplyDesc,
            c.actionBothLabel,
            c.actionBothDesc,
        ]
    );

    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [triggerKeywords, setTriggerKeywords] = useState('');
    const [dmMessage, setDmMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [matchType, setMatchType] = useState<'contains' | 'exact'>('contains');
    const [actionType, setActionType] = useState<'send_dm' | 'reply_comment' | 'both'>('send_dm');
    const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'both'>('both');
    const [selectedPostId, setSelectedPostId] = useState<string>('');

    // Post selector state
    const [posts, setPosts] = useState<ShopPost[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [showPostDropdown, setShowPostDropdown] = useState(false);
    const [postSearch, setPostSearch] = useState('');

    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') || '' : '';

    useEffect(() => {
        fetchAutomations();
        fetchPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchPosts() {
        try {
            setLoadingPosts(true);
            const res = await fetch('/api/dashboard/posts', {
                headers: { 'x-shop-id': shopId },
            });
            const data = await res.json();
            setPosts(data.posts || []);
        } catch {
            console.error('Failed to fetch posts');
        } finally {
            setLoadingPosts(false);
        }
    }

    async function fetchAutomations() {
        try {
            setLoading(true);
            const res = await fetch('/api/dashboard/comment-automations', {
                headers: { 'x-shop-id': shopId },
            });
            const data = await res.json();
            setAutomations(data.automations || []);
        } catch {
            toast.error(c.errorGeneric);
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setName('');
        setTriggerKeywords('');
        setDmMessage('');
        setReplyMessage('');
        setMatchType('contains');
        setActionType('send_dm');
        setPlatform('both');
        setSelectedPostId('');
        setPostSearch('');
        setShowPostDropdown(false);
        setEditingId(null);
        setShowForm(false);
    }

    function startEdit(a: Automation) {
        setName(a.name);
        setTriggerKeywords(a.trigger_keywords.join(', '));
        setDmMessage(a.dm_message);
        setReplyMessage(a.reply_message || '');
        setMatchType(a.match_type);
        setActionType(a.action_type);
        setPlatform(a.platform);
        setSelectedPostId(a.post_id || '');
        setEditingId(a.id);
        setShowForm(true);
    }

    async function handleSave() {
        if (!name || !triggerKeywords || !dmMessage) {
            toast.error(c.errorRequired);
            return;
        }

        setSaving(true);
        try {
            const keywords = triggerKeywords.split(',').map(k => k.trim()).filter(Boolean);
            const body = {
                ...(editingId ? { id: editingId } : {}),
                name,
                trigger_keywords: keywords,
                dm_message: dmMessage,
                match_type: matchType,
                action_type: actionType,
                reply_message: replyMessage || undefined,
                platform,
                post_id: selectedPostId || undefined,
                post_url: selectedPostId ? posts.find(p => p.id === selectedPostId)?.message?.slice(0, 60) : undefined,
            };

            const res = await fetch('/api/dashboard/comment-automations', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                toast.success(editingId ? c.successUpdated : c.successCreated);
                resetForm();
                fetchAutomations();
            } else {
                const err = await res.json();
                toast.error(err.error || c.errorShort);
            }
        } catch {
            toast.error(c.errorGeneric);
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(id: string, currentState: boolean) {
        try {
            await fetch('/api/dashboard/comment-automations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-shop-id': shopId },
                body: JSON.stringify({ id, is_active: !currentState }),
            });
            setAutomations(prev =>
                prev.map(a => a.id === id ? { ...a, is_active: !currentState } : a)
            );
            toast.success(!currentState ? c.successActivated : c.successDeactivated);
        } catch {
            toast.error(c.errorShort);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm(c.confirmDelete)) return;
        try {
            await fetch(`/api/dashboard/comment-automations?id=${id}`, {
                method: 'DELETE',
                headers: { 'x-shop-id': shopId },
            });
            setAutomations(prev => prev.filter(a => a.id !== id));
            toast.success(c.successDeleted);
        } catch {
            toast.error(c.errorShort);
        }
    }

    const header = (
        <PageHero
            eyebrow={c.eyebrow}
            title={c.pageTitle}
            subtitle={c.subtitle}
            actions={
                <>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] text-white/70">
                        <Zap className="w-3.5 h-3.5 text-[var(--brand-indigo-400)]" strokeWidth={1.5} />
                        <span className="font-medium tabular-nums tracking-[-0.01em]">
                            {automations.length} {c.countSuffix}
                        </span>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                        {c.newAutomation}
                    </Button>
                </>
            }
        />
    );

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-24 card-outlined animate-pulse" />
                <div className="h-96 card-outlined animate-pulse" />
            </div>
        );
    }

    const steps = [c.step1, c.step2, c.step3];

    return (
        <div className="space-y-6">
            {header}

            {/* How it works */}
            {automations.length === 0 && !showForm && (
                <div className="card-outlined p-10 md:p-14 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                        <MessageSquareMore
                            className="w-7 h-7 text-[var(--brand-indigo-400)]"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-[16px] font-semibold text-foreground mb-1 tracking-[-0.02em]">
                        {c.howItWorks}
                    </h3>
                    <p className="text-[13px] text-white/45 max-w-sm mb-6 tracking-[-0.01em]">
                        {c.howItWorksHint}
                    </p>
                    <div className="w-full max-w-md space-y-3 text-[13px] text-white/55 mb-6">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 text-left p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                            >
                                <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 tabular-nums"
                                    style={{
                                        background:
                                            'color-mix(in oklab, var(--brand-indigo) 18%, transparent)',
                                        color: 'var(--brand-indigo-400)',
                                    }}
                                >
                                    {i + 1}
                                </div>
                                <span className="tracking-[-0.01em]">{step}</span>
                            </div>
                        ))}
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setShowForm(true)}
                        leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                    >
                        {c.getStarted}
                    </Button>
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div className="card-featured p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-[15px] font-semibold text-foreground tracking-[-0.02em]">
                                {editingId ? c.editTitle : c.createTitle}
                            </h3>
                            <p className="text-[12px] text-white/45 mt-1 tracking-[-0.01em]">
                                {c.formHint}
                            </p>
                        </div>
                        <button
                            onClick={resetForm}
                            className="p-2 -mr-2 rounded-lg text-white/40 hover:text-foreground hover:bg-white/[0.04] transition-colors"
                            aria-label={c.closeAria}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Name */}
                        <div>
                            <label className={labelCls}>{c.nameLabel}</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={inputCls}
                                placeholder={c.namePlaceholder}
                            />
                        </div>

                        {/* Platform */}
                        <div>
                            <label className={labelCls}>{c.platformLabel}</label>
                            <div className="flex gap-2">
                                {platformOptions.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setPlatform(p.value)}
                                        className={cn(
                                            'flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-all tracking-[-0.01em]',
                                            platform === p.value
                                                ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-foreground'
                                                : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.15] hover:text-white'
                                        )}
                                    >
                                        {p.icon} {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Keywords */}
                        <div>
                            <label className={labelCls}>
                                <Hash className="w-3 h-3 inline mr-1" />
                                {c.keywordsLabel}
                            </label>
                            <input
                                value={triggerKeywords}
                                onChange={e => setTriggerKeywords(e.target.value)}
                                className={inputCls}
                                placeholder={c.keywordsPlaceholder}
                            />
                        </div>

                        {/* Match Type */}
                        <div>
                            <label className={labelCls}>
                                <Target className="w-3 h-3 inline mr-1" />
                                {c.matchTypeLabel}
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMatchType('contains')}
                                    className={cn(
                                        'flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-all tracking-[-0.01em]',
                                        matchType === 'contains'
                                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-foreground'
                                            : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.15] hover:text-white'
                                    )}
                                >
                                    {c.matchContains}
                                </button>
                                <button
                                    onClick={() => setMatchType('exact')}
                                    className={cn(
                                        'flex-1 px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-all tracking-[-0.01em]',
                                        matchType === 'exact'
                                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-foreground'
                                            : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.15] hover:text-white'
                                    )}
                                >
                                    {c.matchExact}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className={labelCls}>
                            <Zap className="w-3 h-3 inline mr-1" />
                            {c.actionLabel}
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {actionOptions.map(a => (
                                <button
                                    key={a.value}
                                    onClick={() => setActionType(a.value)}
                                    className={cn(
                                        'px-4 py-3 rounded-xl border text-left transition-all',
                                        actionType === a.value
                                            ? 'border-[var(--border-accent)] bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] shadow-[inset_0_0_0_1px_var(--border-accent)]'
                                            : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]'
                                    )}
                                >
                                    <p
                                        className={cn(
                                            'text-[13px] font-semibold tracking-[-0.01em]',
                                            actionType === a.value ? 'text-foreground' : 'text-white/70'
                                        )}
                                    >
                                        {a.label}
                                    </p>
                                    <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">
                                        {a.desc}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DM Message */}
                    {(actionType === 'send_dm' || actionType === 'both') && (
                        <div>
                            <label className={labelCls}>
                                <Send className="w-3 h-3 inline mr-1" />
                                {c.dmMessageLabel}
                            </label>
                            <textarea
                                value={dmMessage}
                                onChange={e => setDmMessage(e.target.value)}
                                className={`${inputCls} resize-none`}
                                rows={3}
                                placeholder={c.dmMessagePlaceholder}
                            />
                        </div>
                    )}

                    {/* Reply Message */}
                    {(actionType === 'reply_comment' || actionType === 'both') && (
                        <div>
                            <label className={labelCls}>
                                <MessageCircle className="w-3 h-3 inline mr-1" />
                                {c.replyMessageLabel}
                            </label>
                            <textarea
                                value={replyMessage}
                                onChange={e => setReplyMessage(e.target.value)}
                                className={`${inputCls} resize-none`}
                                rows={2}
                                placeholder={c.replyMessagePlaceholder}
                            />
                        </div>
                    )}

                    {/* Post Selector */}
                    <div className="relative">
                        <label className={labelCls}>
                            <Globe className="w-3 h-3 inline mr-1" />
                            {c.postSelectorLabel}
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPostDropdown(!showPostDropdown)}
                            className={`${inputCls} flex items-center justify-between gap-2 text-left cursor-pointer`}
                        >
                            {selectedPostId ? (
                                <span className="truncate flex items-center gap-2">
                                    {(() => {
                                        const p = posts.find(p => p.id === selectedPostId);
                                        return p ? (
                                            <>
                                                <span
                                                    className={cn(
                                                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                                        p.platform === 'facebook'
                                                            ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)]'
                                                            : 'bg-pink-500/15 text-pink-300'
                                                    )}
                                                >
                                                    {p.platform === 'facebook' ? 'FB' : 'IG'}
                                                </span>
                                                <span className="truncate">{p.message.slice(0, 50)}</span>
                                            </>
                                        ) : selectedPostId;
                                    })()}
                                </span>
                            ) : (
                                <span className="text-white/30">{c.postSelectorAllPosts}</span>
                            )}
                            {loadingPosts ? (
                                <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin shrink-0" />
                            ) : (
                                <ChevronDown
                                    className={cn(
                                        'w-3.5 h-3.5 text-white/30 shrink-0 transition-transform',
                                        showPostDropdown && 'rotate-180'
                                    )}
                                />
                            )}
                        </button>

                        {showPostDropdown && (
                            <div className="absolute z-50 mt-1 w-full card-outlined shadow-2xl max-h-80 overflow-hidden">
                                {/* Search */}
                                <div className="p-2 border-b border-white/[0.06]">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/30" />
                                        <input
                                            value={postSearch}
                                            onChange={e => setPostSearch(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-md text-[12px] text-foreground focus:outline-none focus:border-[var(--border-accent)] placeholder:text-white/25"
                                            placeholder={c.postSearchPlaceholder}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* All posts option */}
                                <div className="overflow-y-auto max-h-64">
                                    <button
                                        onClick={() => {
                                            setSelectedPostId('');
                                            setShowPostDropdown(false);
                                        }}
                                        className={cn(
                                            'w-full px-3 py-2.5 text-left text-[12px] transition-colors flex items-center gap-2 tracking-[-0.01em]',
                                            !selectedPostId
                                                ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_10%,transparent)] text-[var(--brand-indigo-400)]'
                                                : 'text-white/55 hover:bg-white/[0.04]'
                                        )}
                                    >
                                        <Globe className="w-4 h-4 shrink-0" />
                                        {c.postSelectorAllPostsOption}
                                    </button>

                                    {/* Posts list */}
                                    {posts
                                        .filter(p => {
                                            if (!postSearch) return true;
                                            return p.message.toLowerCase().includes(postSearch.toLowerCase());
                                        })
                                        .filter(p => {
                                            if (platform === 'both') return true;
                                            return p.platform === platform;
                                        })
                                        .map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPostId(p.id);
                                                    setShowPostDropdown(false);
                                                    setPostSearch('');
                                                }}
                                                className={cn(
                                                    'w-full px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors flex items-center gap-3',
                                                    selectedPostId === p.id &&
                                                        'bg-[color-mix(in_oklab,var(--brand-indigo)_8%,transparent)]'
                                                )}
                                            >
                                                {/* Thumbnail */}
                                                {p.picture ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={p.picture}
                                                        alt=""
                                                        className="w-10 h-10 rounded-md object-cover shrink-0 border border-white/[0.06]"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                                                        <ImageIcon className="w-4 h-4 text-white/25" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] text-foreground truncate tracking-[-0.01em]">
                                                        {p.message.slice(0, 60)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span
                                                            className={cn(
                                                                'text-[9px] px-1 py-0.5 rounded font-medium',
                                                                p.platform === 'facebook'
                                                                    ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_18%,transparent)] text-[var(--brand-indigo-400)]'
                                                                    : 'bg-pink-500/15 text-pink-300'
                                                            )}
                                                        >
                                                            {p.platform === 'facebook' ? 'FB' : 'IG'}
                                                        </span>
                                                        <span className="text-[10px] text-white/30 tabular-nums">
                                                            {new Date(p.created_time).toLocaleDateString(dateLocale)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}

                                    {posts.length === 0 && !loadingPosts && (
                                        <div className="px-3 py-6 text-center text-[12px] text-white/30">
                                            {c.postNotFound}
                                        </div>
                                    )}
                                    {loadingPosts && (
                                        <div className="px-3 py-6 text-center">
                                            <Loader2 className="w-4 h-4 animate-spin text-white/30 mx-auto" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    {dmMessage && (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="text-[10px] text-white/40 uppercase tracking-[0.08em] mb-2 font-medium">
                                {c.dmPreviewLabel}
                            </p>
                            <div
                                className="inline-block rounded-2xl rounded-bl-sm px-4 py-3 text-[13px] text-white/85 max-w-sm tracking-[-0.01em]"
                                style={{
                                    background:
                                        'color-mix(in oklab, var(--brand-indigo) 14%, transparent)',
                                }}
                            >
                                {dmMessage}
                            </div>
                        </div>
                    )}

                    {/* Save */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                        <Button variant="ghost" size="sm" onClick={resetForm}>
                            {c.cancel}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSave}
                            disabled={saving || !name || !triggerKeywords || !dmMessage}
                            leftIcon={
                                saving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )
                            }
                        >
                            {editingId ? c.update : c.create}
                        </Button>
                    </div>
                </div>
            )}

            {/* Automation List */}
            {automations.length > 0 && (
                <div className="space-y-3">
                    {automations.map(a => (
                        <AutomationCard
                            key={a.id}
                            automation={a}
                            onToggle={toggleActive}
                            onEdit={startEdit}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
