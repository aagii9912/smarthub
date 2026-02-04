import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Bot, Zap, Target, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const dummyAiStats = [
    { name: '09:00', automated: 45, handoff: 5 },
    { name: '12:00', automated: 82, handoff: 12 },
    { name: '15:00', automated: 65, handoff: 8 },
    { name: '18:00', automated: 95, handoff: 15 },
    { name: '21:00', automated: 78, handoff: 10 },
];

export function AIMonitor() {
    return (
        <div className="space-y-4">
            {/* AI Highlight Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatsCard
                    title="AI Харилцаа"
                    value="156"
                    icon={Bot}
                    iconColor="purple"
                />
                <StatsCard
                    title="Авт. шийдвэрлэлт"
                    value="92%"
                    icon={Zap}
                    iconColor="warning"
                />
            </div>

            {/* AI Performance Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Target className="w-4 h-4 text-violet-600" />
                        AI Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dummyAiStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="automated"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={false}
                                    name="AI Шийдсэн"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="handoff"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Хүнд шилжүүлсэн"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-4 mt-4 justify-center">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                            <span className="text-[10px] font-medium text-gray-500 uppercase">AI Automated</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span className="text-[10px] font-medium text-gray-500 uppercase">Human Handoff</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
