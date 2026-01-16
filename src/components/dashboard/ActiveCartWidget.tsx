import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Send, ArrowRightLeft } from 'lucide-react';

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

interface ActiveCartWidgetProps {
    customerName: string;
    items: CartItem[];
    onConvertToOrder: () => void;
    onSendReminder: () => void;
}

export function ActiveCartWidget({ customerName, items, onConvertToOrder, onSendReminder }: ActiveCartWidgetProps) {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <Card className="shadow-sm border-violet-100 bg-gradient-to-br from-white to-violet-50/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-violet-600" />
                    Идэвхтэй сагс
                </CardTitle>
            </CardHeader>
            <CardContent>
                {items.length > 0 ? (
                    <>
                        <div className="space-y-2 mb-4">
                            {items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs">
                                    <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                                    <span className="font-semibold text-gray-900">{(item.price * item.quantity).toLocaleString()}₮</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-3 border-t border-violet-100 flex justify-between items-center mb-4">
                            <span className="text-xs font-medium text-gray-500">Нийт:</span>
                            <span className="text-lg font-black text-violet-600">{total.toLocaleString()}₮</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" onClick={onConvertToOrder} className="h-8 text-[11px] font-bold">
                                <ArrowRightLeft className="w-3 h-3 mr-1" />
                                Захиалга
                            </Button>
                            <Button variant="secondary" size="sm" onClick={onSendReminder} className="h-8 text-[11px] font-bold">
                                <Send className="w-3 h-3 mr-1" />
                                Сануулах
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-xs text-gray-400">Сагс хоосон байна</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
