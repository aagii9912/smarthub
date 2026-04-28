'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface IgAccount {
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramId: string;
    instagramUsername: string;
    instagramName: string;
    profilePicture: string;
}

interface Props {
    accounts: IgAccount[];
    shopId: string;
}

export default function InstagramPickerClient({ accounts, shopId }: Props) {
    const router = useRouter();
    const [selected, setSelected] = useState<string | null>(accounts[0]?.instagramId ?? null);
    const [submitting, setSubmitting] = useState(false);

    const handleConnect = async () => {
        const account = accounts.find((a) => a.instagramId === selected);
        if (!account) {
            toast.error('Бүртгэл сонгогдоогүй байна');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/dashboard/connect-instagram', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId,
                },
                body: JSON.stringify({
                    picked_ig_account_id: account.instagramId,
                    picked_page_access_token: account.pageAccessToken,
                    picked_ig_username: account.instagramUsername,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Холбоход алдаа гарлаа');

            toast.success(`Instagram холбогдлоо: @${account.instagramUsername}`);
            router.push('/dashboard/settings?ig_success=true');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Алдаа гарлаа');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-semibold mb-2">Instagram бүртгэлээ сонгоно уу</h1>
            <p className="text-sm text-gray-500 mb-6">
                Танай Facebook Хуудсуудаас {accounts.length} Instagram бүртгэл олдлоо. Энэ дэлгүүрт
                холбохыг хүсэж буй нэгийг сонгоно уу.
            </p>

            <ul className="space-y-3">
                {accounts.map((acc) => {
                    const isSelected = selected === acc.instagramId;
                    return (
                        <li
                            key={acc.instagramId}
                            className={
                                'border rounded-lg p-4 cursor-pointer transition ' +
                                (isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-400')
                            }
                            onClick={() => setSelected(acc.instagramId)}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="ig-account"
                                    checked={isSelected}
                                    onChange={() => setSelected(acc.instagramId)}
                                />
                                {acc.profilePicture ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={acc.profilePicture}
                                        alt={acc.instagramUsername}
                                        className="w-10 h-10 rounded-full"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                                )}
                                <div className="flex-1">
                                    <div className="font-medium">@{acc.instagramUsername}</div>
                                    <div className="text-xs text-gray-500">
                                        {acc.instagramName} · Page: {acc.pageName}
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="flex gap-3 mt-6">
                <button
                    type="button"
                    onClick={() => router.push('/dashboard/settings')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={submitting}
                >
                    Цуцлах
                </button>
                <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!selected || submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {submitting ? 'Холбож байна…' : 'Холбох'}
                </button>
            </div>
        </div>
    );
}
