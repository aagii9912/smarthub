'use client';

import { labelCls, inputCls } from '../shared-styles';
import type { FulfillmentSLA } from '@/types/ai';

interface FulfillmentSLAFormProps {
    sla: FulfillmentSLA;
    onChange: (next: FulfillmentSLA) => void;
}

function parseInt0(s: string): number | undefined {
    if (s === '') return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function FulfillmentSLAForm({ sla, onChange }: FulfillmentSLAFormProps) {
    function update<K extends keyof FulfillmentSLA>(key: K, value: FulfillmentSLA[K]) {
        onChange({ ...sla, [key]: value });
    }

    return (
        <div className="space-y-4">
            <p className="text-[11.5px] text-white/45 leading-relaxed">
                AI хэрэглэгчид хариулахдаа эдгээр тоог л ашиглана. Хоосон бол асуусан үед "тодорхой биш" гэж хариулна.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label className={labelCls}>Хариулах хугацаа (минут)</label>
                    <input
                        type="number"
                        min={0}
                        max={1440}
                        className={inputCls}
                        placeholder="5"
                        value={sla.response_minutes ?? ''}
                        onChange={(e) => update('response_minutes', parseInt0(e.target.value))}
                    />
                </div>

                <div>
                    <label className={labelCls}>Илгээх хугацаа (цаг)</label>
                    <input
                        type="number"
                        min={0}
                        max={720}
                        className={inputCls}
                        placeholder="24"
                        value={sla.ship_within_hours ?? ''}
                        onChange={(e) => update('ship_within_hours', parseInt0(e.target.value))}
                    />
                </div>

                <div>
                    <label className={labelCls}>Буцаалт хийх хугацаа (хоног)</label>
                    <input
                        type="number"
                        min={0}
                        max={365}
                        className={inputCls}
                        placeholder="7"
                        value={sla.refund_within_days ?? ''}
                        onChange={(e) => update('refund_within_days', parseInt0(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
}
