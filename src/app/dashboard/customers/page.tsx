'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Search, User, Crown, Phone, MapPin, ShoppingBag } from 'lucide-react';

// Demo data
const demoCustomers = [
    {
        id: '1',
        name: 'Болд Бат',
        phone: '99001122',
        address: 'БЗД, 3-р хороо',
        totalOrders: 12,
        totalSpent: 2450000,
        isVip: true,
        lastOrder: '2024-01-05'
    },
    {
        id: '2',
        name: 'Сараа Дорж',
        phone: '99112233',
        address: 'СХД, 15-р хороо',
        totalOrders: 5,
        totalSpent: 580000,
        isVip: false,
        lastOrder: '2024-01-04'
    },
    {
        id: '3',
        name: 'Дорж Батсүх',
        phone: '99223344',
        address: 'ЧД, Сансар',
        totalOrders: 8,
        totalSpent: 1200000,
        isVip: true,
        lastOrder: '2024-01-03'
    },
    {
        id: '4',
        name: 'Оюунаа Мөнх',
        phone: '99334455',
        address: 'ХУД, Зайсан',
        totalOrders: 3,
        totalSpent: 450000,
        isVip: false,
        lastOrder: '2024-01-02'
    },
    {
        id: '5',
        name: 'Төмөр Эрдэнэ',
        phone: '99445566',
        address: 'БГД, 5-р хороо',
        totalOrders: 15,
        totalSpent: 3200000,
        isVip: true,
        lastOrder: '2024-01-01'
    },
];

export default function CustomersPage() {
    const [customers] = useState(demoCustomers);
    const [searchQuery, setSearchQuery] = useState('');
    const [showVipOnly, setShowVipOnly] = useState(false);

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery);
        const matchesVip = !showVipOnly || c.isVip;
        return matchesSearch && matchesVip;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Харилцагчид</h1>
                    <p className="text-gray-500 mt-1">Нийт {customers.length} харилцагч</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">VIP: {customers.filter(c => c.isVip).length}</span>
                    <Badge variant="vip">
                        <Crown className="w-3 h-3 mr-1" />
                        VIP
                    </Badge>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Нэр, утас хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => setShowVipOnly(!showVipOnly)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${showVipOnly
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <Crown className="w-4 h-4" />
                            VIP only
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Customers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.map((customer) => (
                    <Card key={customer.id} hover className="cursor-pointer">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${customer.isVip
                                            ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                            : 'bg-gradient-to-br from-violet-100 to-indigo-100'
                                        }`}>
                                        {customer.isVip
                                            ? <Crown className="w-6 h-6 text-white" />
                                            : <User className="w-6 h-6 text-violet-600" />
                                        }
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900">{customer.name}</p>
                                            {customer.isVip && <Badge variant="vip" size="sm">VIP</Badge>}
                                        </div>
                                        <p className="text-sm text-gray-500">Сүүлд: {customer.lastOrder}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    {customer.phone}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    {customer.address}
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-1 text-sm">
                                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-600">{customer.totalOrders} захиалга</span>
                                </div>
                                <p className="font-bold text-violet-600">₮{customer.totalSpent.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
