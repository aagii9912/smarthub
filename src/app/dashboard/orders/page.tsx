'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils/date';
import {
  Package,
  User,
  Phone,
  MapPin,
  Clock,
  Check,
  Truck,
  X,
  RefreshCw,
  MessageSquare,
  FileSpreadsheet,
} from 'lucide-react';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  notes: string | null;
  delivery_address: string | null;
  created_at: string;
  updated_at: string;
  customers: {
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    facebook_id: string | null;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    products: {
      id: string;
      name: string;
      price: number;
    } | null;
  }>;
}

const statusOptions = [
  { value: 'pending', label: 'Хүлээгдэж буй', icon: Clock, color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Баталгаажсан', icon: Check, color: 'bg-blue-500' },
  { value: 'processing', label: 'Бэлтгэж буй', icon: Package, color: 'bg-purple-500' },
  { value: 'shipped', label: 'Хүргэлтэд', icon: Truck, color: 'bg-indigo-500' },
  { value: 'delivered', label: 'Хүргэгдсэн', icon: Check, color: 'bg-green-500' },
  { value: 'cancelled', label: 'Цуцлагдсан', icon: X, color: 'bg-red-500' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);

    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (res.ok) {
        setOrders(orders.map(o =>
          o.id === orderId ? { ...o, status: newStatus } : o
        ));

        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = filter === 'all'
    ? orders
    : orders.filter(o => o.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-muted-foreground">Ачааллаж байна...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Захиалгууд 📦</h1>
          <p className="text-muted-foreground mt-1">Нийт {orders.length} захиалга</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => window.open('/api/orders/export', '_blank')}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={() => fetchOrders(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Шинэчлэх
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${filter === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
        >
          Бүгд ({orders.length})
        </button>
        {statusOptions.map((status) => {
          const count = orders.filter(o => o.status === status.value).length;
          return (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${filter === status.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
            >
              {status.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Захиалга байхгүй байна</p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card
                key={order.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${selectedOrder?.id === order.id ? 'ring-2 ring-violet-500' : ''
                  }`}
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm text-gray-500">
                          #{order.id.slice(0, 8)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {order.order_items.map((item, idx) => (
                          <p key={idx} className="font-medium text-gray-900">
                            {item.products?.name || 'Бүтээгдэхүүн'} x{item.quantity}
                          </p>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {order.customers?.name || 'Харилцагч'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ₮{Number(order.total_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Order Detail */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Захиалгын дэлгэрэнгүй</span>
                  <OrderStatusBadge status={selectedOrder.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Info */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Харилцагч
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="font-medium">{selectedOrder.customers?.name || 'Нэр оруулаагүй'}</p>
                    {selectedOrder.customers?.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {selectedOrder.customers.phone}
                      </p>
                    )}
                    {(selectedOrder.delivery_address || selectedOrder.customers?.address) && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {selectedOrder.delivery_address || selectedOrder.customers?.address}
                      </p>
                    )}
                    {selectedOrder.customers?.facebook_id && (
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Messenger
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Бүтээгдэхүүнүүд
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium">{item.products?.name}</p>
                          <p className="text-sm text-gray-500">
                            ₮{Number(item.unit_price).toLocaleString()} x {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ₮{(Number(item.unit_price) * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-medium">Нийт дүн:</span>
                    <span className="text-xl font-bold text-violet-600">
                      ₮{Number(selectedOrder.total_amount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-900">Тэмдэглэл</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* Status Update */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">Статус өөрчлөх</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((status) => {
                      const Icon = status.icon;
                      const isActive = selectedOrder.status === status.value;
                      const isUpdating = updatingId === selectedOrder.id;

                      return (
                        <button
                          key={status.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus(selectedOrder.id, status.value);
                          }}
                          disabled={isActive || isUpdating}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                            ? 'bg-violet-100 text-violet-700 cursor-default'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            } disabled:opacity-50`}
                        >
                          <Icon className="w-4 h-4" />
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="text-xs text-gray-400 space-y-1 pt-4 border-t">
                  <p>Үүсгэсэн: {formatDate(selectedOrder.created_at)}</p>
                  <p>Шинэчилсэн: {formatDate(selectedOrder.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Захиалга сонгоно уу</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
