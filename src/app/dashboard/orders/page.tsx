'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { Search, Filter, Eye, Truck, CheckCircle, XCircle, Package } from 'lucide-react';

// Demo data
const demoOrders = [
    {
        id: 'ORD-001',
        customer: { name: 'Болд Бат', phone: '99001122' },
        items: [{ name: 'Хар куртка XL', quantity: 1, price: 185000 }],
        total: 185000,
        status: 'pending',
        createdAt: '2024-01-05 10:30',
        address: 'БЗД, 3-р хороо'
    },
    {
        id: 'ORD-002',
        customer: { name: 'Сараа Дорж', phone: '99112233' },
        items: [
            { name: 'Цагаан цамц M', quantity: 2, price: 45000 },
            { name: 'Джинс өмд', quantity: 1, price: 95000 }
        ],
        total: 185000,
        status: 'confirmed',
        createdAt: '2024-01-05 09:15',
        address: 'СХД, 15-р хороо'
    },
    {
        id: 'ORD-003',
        customer: { name: 'Дорж Батсүх', phone: '99223344' },
        items: [{ name: 'Спорт гутал 42', quantity: 1, price: 120000 }],
        total: 120000,
        status: 'shipped',
        createdAt: '2024-01-04 16:45',
        address: 'ЧД, Сансар'
    },
    {
        id: 'ORD-004',
        customer: { name: 'Оюунаа Мөнх', phone: '99334455' },
        items: [{ name: 'Гоёлын даашинз', quantity: 1, price: 250000 }],
        total: 250000,
        status: 'delivered',
        createdAt: '2024-01-04 11:20',
        address: 'ХУД, Зайсан'
    },
    {
        id: 'ORD-005',
        customer: { name: 'Төмөр Эрдэнэ', phone: '99445566' },
        items: [{ name: 'Хар куртка L', quantity: 1, price: 185000 }],
        total: 185000,
        status: 'cancelled',
        createdAt: '2024-01-03 14:00',
        address: 'БГД, 5-р хороо'
    },
];

const statusFilters = [
    { label: 'Бүгд', value: 'all' },
    { label: 'Хүлээгдэж буй', value: 'pending' },
    { label: 'Баталгаажсан', value: 'confirmed' },
    { label: 'Илгээсэн', value: 'shipped' },
    { label: 'Хүргэгдсэн', value: 'delivered' },
];

export default function OrdersPage() {
    const [orders] = useState(demoOrders);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState<typeof demoOrders[0] | null>(null);

    const filteredOrders = orders.filter(o => {
        const matchesSearch = o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Захиалгууд</h1>
                    <p className="text-gray-500 mt-1">Нийт {orders.length} захиалга</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Захиалга хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                            {statusFilters.map((filter) => (
                                <button
                                    key={filter.value}
                                    onClick={() => setStatusFilter(filter.value)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${statusFilter === filter.value
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Orders List */}
            <div className="space-y-4">
                {filteredOrders.map((order) => (
                    <Card key={order.id} hover className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                        <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Package className="w-6 h-6 text-violet-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-gray-900">{order.id}</p>
                                            <OrderStatusBadge status={order.status} />
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{order.customer.name} • {order.customer.phone}</p>
                                        <p className="text-sm text-gray-500">{order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className="text-right">
                                        <p className="font-bold text-lg text-gray-900">₮{order.total.toLocaleString()}</p>
                                        <p className="text-sm text-gray-500">{order.createdAt}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {order.status === 'pending' && (
                                            <>
                                                <Button size="sm" variant="ghost" className="!text-green-600 !hover:bg-green-50">
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="!text-red-600 !hover:bg-red-50">
                                                    <XCircle className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <Button size="sm">
                                                <Truck className="w-4 h-4 mr-1" />
                                                Илгээх
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedOrder.id}</h2>
                                <p className="text-sm text-gray-500">{selectedOrder.createdAt}</p>
                            </div>
                            <OrderStatusBadge status={selectedOrder.status} />
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-500 mb-1">Харилцагч</p>
                                <p className="font-medium text-gray-900">{selectedOrder.customer.name}</p>
                                <p className="text-sm text-gray-600">{selectedOrder.customer.phone}</p>
                                <p className="text-sm text-gray-600">{selectedOrder.address}</p>
                            </div>

                            <div className="p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-500 mb-2">Бүтээгдэхүүн</p>
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                                        <span className="text-gray-900">{item.name} x{item.quantity}</span>
                                        <span className="font-medium text-gray-900">₮{(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-3 mt-2 border-t border-gray-300">
                                    <span className="font-semibold text-gray-900">Нийт</span>
                                    <span className="font-bold text-lg text-violet-600">₮{selectedOrder.total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="secondary" onClick={() => setSelectedOrder(null)}>
                                Хаах
                            </Button>
                            {selectedOrder.status === 'pending' && (
                                <Button>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Баталгаажуулах
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
