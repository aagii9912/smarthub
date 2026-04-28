import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import InstagramPickerClient from './InstagramPickerClient';

interface IgAccount {
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramId: string;
    instagramUsername: string;
    instagramName: string;
    profilePicture: string;
}

export const dynamic = 'force-dynamic';

export default async function InstagramPickerPage() {
    const store = await cookies();
    const encoded = store.get('ig_accounts')?.value;
    const shopId = store.get('ig_picker_shop_id')?.value;

    if (!encoded || !shopId) {
        redirect('/dashboard/settings?ig_error=picker_expired');
    }

    let accounts: IgAccount[] = [];
    try {
        accounts = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    } catch {
        redirect('/dashboard/settings?ig_error=picker_decode_failed');
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
        redirect('/dashboard/settings?ig_error=picker_empty');
    }

    return <InstagramPickerClient accounts={accounts} shopId={shopId} />;
}
