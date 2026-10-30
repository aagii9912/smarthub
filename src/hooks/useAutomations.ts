import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ShopAutomationView } from '@/lib/operator/settings';

export type { ShopAutomationView };

export interface AutomationRun {
    id: string;
    agent_slug: string;
    status: 'queued' | 'running' | 'awaiting_approval' | 'sent' | 'skipped' | 'failed' | 'rejected';
    subject_type: string | null;
    subject_id: string | null;
    payload: Record<string, unknown>;
    result: Record<string, unknown> | null;
    error: string | null;
    created_at: string;
    finished_at: string | null;
}

interface AutomationsResponse {
    pack: { id: string; label: string } | null;
    automations: ShopAutomationView[];
    pendingCount: number;
}

function shopHeaders(): Record<string, string> {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return { 'x-shop-id': shopId || '', 'Content-Type': 'application/json' };
}

function activeShopId() {
    return typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
}

export function useAutomations() {
    return useQuery({
        queryKey: ['automations', activeShopId()],
        queryFn: async (): Promise<AutomationsResponse> => {
            const res = await fetch('/api/dashboard/automations', { headers: shopHeaders() });
            if (!res.ok) throw new Error('Failed to fetch automations');
            return res.json();
        },
    });
}

export function useAutomationRuns(view: 'inbox' | 'log') {
    return useQuery({
        queryKey: ['automation-runs', view, activeShopId()],
        queryFn: async (): Promise<AutomationRun[]> => {
            const res = await fetch(`/api/dashboard/automations/runs?view=${view}`, { headers: shopHeaders() });
            if (!res.ok) throw new Error('Failed to fetch automation runs');
            return (await res.json()).runs || [];
        },
        refetchInterval: 60_000,
    });
}

export function useUpdateAutomation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            slug,
            ...patch
        }: {
            slug: string;
            enabled?: boolean;
            mode?: 'auto' | 'approve';
            config?: Record<string, unknown>;
        }): Promise<ShopAutomationView> => {
            const res = await fetch(`/api/dashboard/automations/${encodeURIComponent(slug)}`, {
                method: 'PATCH',
                headers: shopHeaders(),
                body: JSON.stringify(patch),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Хадгалж чадсангүй');
            return (await res.json()).automation;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['automations'] });
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useRunAction() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' | 'done' }) => {
            const res = await fetch(`/api/dashboard/automations/runs/${id}`, {
                method: 'POST',
                headers: shopHeaders(),
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Алдаа гарлаа');
            return res.json();
        },
        onSuccess: (_data, { action }) => {
            qc.invalidateQueries({ queryKey: ['automation-runs'] });
            qc.invalidateQueries({ queryKey: ['automations'] });
            toast.success(action === 'approve' ? 'Илгээх дараалалд орлоо' : action === 'done' ? 'Хийсэн гэж тэмдэглэлээ' : 'Татгалзлаа');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
