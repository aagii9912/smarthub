'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Search, User, Crown, Phone, MapPin, ShoppingBag } from 'lucide-react';

interface Customer {
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    total_orders: number;
    total_spent: number;
    is_vip: boolean;
    created_at: string;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showVipOnly, setShowVipOnly] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCustomers();
    }, []);

    async function fetchCustomers() {
        try {
            const res = await fetch('/api/dashboard/customers');
            const data = await res.json();
            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-96">
            <div className="text-lg text-gray-500">Ачааллаж байна...</div>
        </div>;
    }

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.phone || '').includes(searchQuery);
        const matchesVip = !showVipOnly || c.is_vip;
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
                    <span className="text-sm text-gray-500">VIP: {customers.filter(c => c.is_vip).length}</span>
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
                {filteredCustomers.map((customer) => {
                    const lastOrder = new Date(customer.created_at).toLocaleDateString('mn-MN');
                    return (
                        <Card key={customer.id} hover className="cursor-pointer">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${customer.is_vip
                                                ? 'bg-gradient-to-br from-amber-400 to-yellow-500'
                                                : 'bg-gradient-to-br from-violet-100 to-indigo-100'
                                            }`}>
                                            {customer.is_vip
                                                ? <Crown className="w-6 h-6 text-white" />
                                                : <User className="w-6 h-6 text-violet-600" />
                                            }
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-gray-900">{customer.name || 'Харилцагч'}</p>
                                                {customer.is_vip && <Badge variant="vip" size="sm">VIP</Badge>}
                                            </div>
                                            <p className="text-sm text-gray-500">Бүртгэсэн: {lastOrder}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        {customer.phone || 'Утас байхгүй'}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        {customer.address || 'Хаяг байхгүй'}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-1 text-sm">
                                        <ShoppingBag className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-600">{customer.total_orders} захиалга</span>
                                    </div>
                                    <p className="font-bold text-violet-600">₮{Number(customer.total_spent).toLocaleString()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
