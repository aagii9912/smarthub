import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    ShoppingCart,
    Users,
    TrendingUp,
    Package,
    Clock,
    ArrowRight,
    MessageSquare,
} from 'lucide-react';

// Demo data - энэ нь Supabase-ээс ирнэ
const demoOrders = [
    { id: '1', customer: 'Болд', product: 'Хар куртка XL', amount: 185000, status: 'pending', time: '5 мин өмнө' },
    { id: '2', customer: 'Сараа', product: 'Цагаан цамц M', amount: 45000, status: 'confirmed', time: '15 мин өмнө' },
    { id: '3', customer: 'Дорж', product: 'Спорт гутал 42', amount: 120000, status: 'shipped', time: '1 цаг өмнө' },
    { id: '4', customer: 'Оюунаа', product: 'Гоёлын даашинз', amount: 250000, status: 'delivered', time: '2 цаг өмнө' },
];

const demoChats = [
    { id: '1', customer: 'Батаа', message: 'Энэ куртка L размер байна уу?', time: '2 мин өмнө', unread: true },
    { id: '2', customer: 'Нараа', message: 'Баярлалаа, захиалга өгсөн', time: '10 мин өмнө', unread: false },
    { id: '3', customer: 'Түвшин', message: 'Хэзээ хүргэх вэ?', time: '25 мин өмнө', unread: true },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Сайн байна уу! 👋</h1>
                    <p className="text-gray-500 mt-1">Өнөөдрийн борлуулалтын тойм</p>
                </div>
                <Button>
                    <Package className="w-4 h-4 mr-2" />
                    Бүтээгдэхүүн нэмэх
                </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                    title="Өнөөдрийн захиалга"
                    value="24"
                    change={{ value: 12, isPositive: true }}
                    icon={ShoppingCart}
                    iconColor="from-violet-500 to-indigo-600"
                />
                <StatsCard
                    title="Нийт орлого"
                    value="₮2.4M"
                    change={{ value: 8, isPositive: true }}
                    icon={TrendingUp}
                    iconColor="from-emerald-500 to-teal-600"
                />
                <StatsCard
                    title="Шинэ харилцагч"
                    value="18"
                    change={{ value: 5, isPositive: true }}
                    icon={Users}
                    iconColor="from-amber-500 to-orange-600"
                />
                <StatsCard
                    title="Хүлээгдэж буй"
                    value="7"
                    icon={Clock}
                    iconColor="from-rose-500 to-pink-600"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Сүүлийн захиалгууд</CardTitle>
                            <Button variant="ghost" size="sm">
                                Бүгдийг харах <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {demoOrders.map((order) => (
                                    <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{order.product}</p>
                                                <p className="text-sm text-gray-500">{order.customer} • {order.time}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="font-semibold text-gray-900">₮{order.amount.toLocaleString()}</p>
                                            <OrderStatusBadge status={order.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Chats */}
                <div>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Чат мессежүүд</CardTitle>
                            <Badge variant="danger">3 шинэ</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {demoChats.map((chat) => (
                                    <div key={chat.id} className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${chat.unread ? 'bg-gradient-to-br from-violet-500 to-indigo-600' : 'bg-gray-200'}`}>
                                                <MessageSquare className={`w-5 h-5 ${chat.unread ? 'text-white' : 'text-gray-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className={`font-medium ${chat.unread ? 'text-gray-900' : 'text-gray-600'}`}>{chat.customer}</p>
                                                    <span className="text-xs text-gray-400">{chat.time}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 truncate">{chat.message}</p>
                                            </div>
                                            {chat.unread && (
                                                <div className="w-2 h-2 mt-2 bg-violet-500 rounded-full"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
