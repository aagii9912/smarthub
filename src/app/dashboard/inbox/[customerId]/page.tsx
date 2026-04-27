import { ChatThread } from '@/components/inbox/ChatThread';

export default async function InboxThreadPage({
    params,
}: {
    params: Promise<{ customerId: string }>;
}) {
    const { customerId } = await params;
    return <ChatThread customerId={customerId} />;
}
