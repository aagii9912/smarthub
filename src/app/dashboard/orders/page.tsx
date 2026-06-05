'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable, createSelectColumn } from '@/components/ui/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatDate } from '@/lib/utils/date';
import { useOrders, OrderWithDetails } from '@/hooks/useOrders';
import { useUpdateOrder, useBulkUpdateOrders } from '@/hooks/useUpdateOrder';
import { useRecheckPayment } from '@/hooks/useRecheckPayment';
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
  ChevronUp,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { OrderStatusModal } from '@/components/dashboard/OrderStatusModal';

export default function OrdersPage() {
  const [filter, setFilter] = useState<string>('all');
  // Төлбөрийн аргаар шүүх — төлөвийн филтертэй хослон (AND) ажиллана
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const { t } = useLanguage();

  const statusOptions = [
    { value: 'pending', label: t.orders.statusPending, icon: Clock, color: 'bg-yellow-500' },
    { value: 'confirmed', label: t.orders.statusConfirmed, icon: Check, color: 'bg-blue-500' },
    { value: 'processing', label: t.orders.statusProcessing, icon: Package, color: 'bg-purple-500' },
    { value: 'shipped', label: t.orders.statusShipped, icon: Truck, color: 'bg-indigo-500' },
    { value: 'delivered', label: t.orders.statusDelivered, icon: Check, color: 'bg-green-500' },
    { value: 'cancelled', label: t.orders.statusCancelled, icon: X, color: 'bg-red-500' },
  ];
  // Захиалгын төлбөрийн шүүлтүүр: зөвхөн COD ба QPay. Банк/Бэлэн сонголтыг
  // цэснээс хассан ч хуучин захиалгууд эдгээр аргатай бол баганад зөв харагдана.
  const paymentOptions = [
    { value: 'cod', label: `📦 ${t.orders.methodCod}` },
    { value: 'qpay', label: '💳 QPay' },
  ];
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const { data: orders = [], isLoading, refetch, isRefetching } = useOrders(dateRange);
  const { mutate: updateStatus } = useUpdateOrder();
  const { mutate: bulkUpdateStatus } = useBulkUpdateOrders();
  const { mutate: recheckPayment, isPending: isRechecking } = useRecheckPayment();

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkSelectedOrders, setBulkSelectedOrders] = useState<OrderWithDetails[]>([]);
  // Нэг захиалгын төлвийг түргэн солих popup (1 товшилт)
  const [statusModalOrder, setStatusModalOrder] = useState<OrderWithDetails | null>(null);
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  // payment_method хоосон (null) бол COD гэж үзнэ — useUpdateOrder доторх логиктой нийцүүлэв
  const matchesStatus = (o: OrderWithDetails) => filter === 'all' || o.status === filter;
  const matchesPayment = (o: OrderWithDetails) => paymentFilter === 'all' || (o.payment_method ?? 'cod') === paymentFilter;

  const filteredOrders = orders.filter((o) => matchesStatus(o) && matchesPayment(o));

  const columns: ColumnDef<OrderWithDetails, unknown>[] = [
    createSelectColumn<OrderWithDetails>(),
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => (
        <span className="text-[13px] text-white/40 font-mono tracking-[-0.01em]">
          #{row.original.id.slice(0, 8)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t.orders.status,
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setStatusModalOrder(row.original);
          }}
          title={t.orders.changeStatusAction}
          className="group inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded-md hover:bg-white/[0.06] transition-colors"
        >
          <OrderStatusBadge status={row.original.status} />
          <ChevronDown className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors" strokeWidth={2} />
        </button>
      ),
      filterFn: (row, _columnId, filterValue) => {
        if (filterValue === 'all') return true;
        return row.original.status === filterValue;
      },
    },
    {
      id: 'payment',
      header: t.orders.payment,
      cell: ({ row }) => {
        const method = row.original.payment_method;
        const isCod = (method ?? 'cod') === 'cod';
        const isPaid = row.original.payment_status === 'paid';
        const methodLabel =
          method === 'qpay' ? '💳 QPay'
            : method === 'bank_transfer' ? '🏦 Банк'
              : method === 'cash' ? '💵 Бэлэн'
                : `📦 ${t.orders.methodCod}`;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-[12px] text-foreground tracking-[-0.01em] whitespace-nowrap">
              {methodLabel}
            </span>
            {isCod && !isPaid ? (
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 whitespace-nowrap">
                <Wallet className="w-3 h-3" strokeWidth={1.75} />
                {t.orders.collect}: ₮{Number(row.original.total_amount).toLocaleString()}
              </span>
            ) : (
              <PaymentStatusBadge status={row.original.payment_status} />
            )}
          </div>
        );
      },
    },
    {
      id: 'products',
      header: t.orders.products,
      cell: ({ row }) => (
        <div className="space-y-0.5">
          {row.original.order_items.slice(0, 2).map((item, idx) => (
            <p key={idx} className="text-[13px] font-medium text-foreground tracking-[-0.01em]">
              {item.products?.name || t.orders.products} x{item.quantity}
            </p>
          ))}
          {row.original.order_items.length > 2 && (
            <p className="text-[11px] text-white/30">+{row.original.order_items.length - 2} {t.orders.others}</p>
          )}
        </div>
      ),
    },
    {
      id: 'customer',
      header: t.orders.customer,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
          <span className="text-[13px] text-foreground tracking-[-0.01em]">
            {row.original.customers?.name || t.orders.anonymous}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-[11px] uppercase tracking-[0.05em] text-white/40"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t.orders.amount}
          {column.getIsSorted() === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <p className="font-semibold text-[13px] text-foreground tabular-nums tracking-[-0.01em]">
          ₮{Number(row.original.total_amount).toLocaleString()}
        </p>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-[11px] uppercase tracking-[0.05em] text-white/40"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          {t.orders.date}
          {column.getIsSorted() === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <span className="text-[13px] text-white/40 tracking-[-0.01em]">{formatDate(row.original.created_at)}</span>
      ),
    },
  ];

  const handleBulkAction = (selectedRows: OrderWithDetails[], action: string) => {
    if (action === 'status') {
      setBulkSelectedOrders(selectedRows);
      setShowBulkStatusModal(true);
    }
  };

  const [tableKey, setTableKey] = useState(0);

  const handleBulkStatusUpdate = (newStatus: string) => {
    const orderIds = bulkSelectedOrders.map(o => o.id);
    bulkUpdateStatus({ orderIds, status: newStatus });
    setShowBulkStatusModal(false);
    setBulkSelectedOrders([]);
    setTableKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-[13px] text-white/40 tracking-[-0.01em]">{t.orders.loading}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow={t.orders.all}
        title={t.header.pageTitles['/dashboard/orders']}
        subtitle={`${orders.length} ${t.orders.all.toLowerCase()}`}
        actions={
          <>
            <button
              className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white/60 bg-card border border-border rounded-lg hover:border-[var(--brand-indigo)]/40 transition-colors tracking-[-0.01em]"
              onClick={() => window.open('/api/orders/export', '_blank')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.5} />
              Export
            </button>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-1.5 bg-card border border-border rounded-lg hover:border-[var(--brand-indigo)]/40 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-white/50 ${isRefetching ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {/* Date Filter */}
      <div className="flex flex-wrap gap-4 items-end card-outlined p-4">
        <div>
          <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-1 block">{t.orders.startDate}</label>
          <input
            type="date"
            value={dateFromInput}
            className="px-3 py-2 border border-border rounded-md text-[13px] bg-transparent focus:outline-none focus:border-[var(--brand-indigo)] transition-colors tracking-[-0.01em]"
            onChange={(e) => {
              setDateFromInput(e.target.value);
              setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : undefined }));
            }}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.05em] mb-1 block">{t.orders.endDate}</label>
          <input
            type="date"
            value={dateToInput}
            className="px-3 py-2 border border-border rounded-md text-[13px] bg-transparent focus:outline-none focus:border-[var(--brand-indigo)] transition-colors tracking-[-0.01em]"
            onChange={(e) => {
              setDateToInput(e.target.value);
              setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(new Date(e.target.value).setHours(23, 59, 59, 999)) : undefined }));
            }}
          />
        </div>
        {(dateRange.from || dateRange.to) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-[var(--brand-indigo)] rounded-md text-[11px] font-medium mb-0.5">
            <span>{t.orders.filterActive}</span>
            <button
              onClick={() => {
                setDateFromInput('');
                setDateToInput('');
                setDateRange({ from: undefined, to: undefined });
              }}
              className="hover:bg-[color-mix(in_oklab,var(--brand-indigo)_24%,transparent)] rounded p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Төлөвийн филтер */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList variant="underline" className="overflow-x-auto no-scrollbar">
          <TabsTrigger variant="underline" value="all" count={orders.filter(matchesPayment).length}>
            {t.orders.all}
          </TabsTrigger>
          {statusOptions.map((status) => {
            const count = orders.filter((o) => o.status === status.value && matchesPayment(o)).length;
            return (
              <TabsTrigger key={status.value} variant="underline" value={status.value} count={count}>
                {status.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Төлбөрийн аргаар шүүх */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em] mr-0.5">
          {t.orders.payment}:
        </span>
        {[{ value: 'all', label: t.orders.all }, ...paymentOptions].map((p) => {
          const isActive = paymentFilter === p.value;
          const count =
            p.value === 'all'
              ? orders.filter(matchesStatus).length
              : orders.filter((o) => (o.payment_method ?? 'cod') === p.value && matchesStatus(o)).length;
          return (
            <button
              key={p.value}
              onClick={() => setPaymentFilter(p.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors tracking-[-0.01em] ${
                isActive
                  ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_16%,transparent)] border-[var(--brand-indigo)]/50 text-[var(--brand-indigo)]'
                  : 'bg-card border-border text-white/55 hover:text-foreground hover:border-white/20'
              }`}
            >
              {p.label}
              {count > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold tabular-nums ${
                    isActive ? 'bg-[var(--brand-indigo)]/20 text-[var(--brand-indigo)]' : 'bg-white/[0.08] text-white/40'
                  }`}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Orders DataTable - Desktop */}
        <div className="lg:col-span-2 hidden md:block">
          <DataTable
            key={tableKey}
            columns={columns}
            data={filteredOrders}
            enableRowSelection
            onBulkAction={handleBulkAction}
            onRowClick={(order) => setSelectedOrderId(order.id)}
            bulkActions={[
              { label: t.orders.changeStatusAction, value: 'status', icon: <Truck className="w-4 h-4 mr-1" /> },
            ]}
            pageSize={10}
          />
        </div>

        {/* Orders List - Mobile Cards */}
        <div className="lg:col-span-2 md:hidden space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-[var(--panel-bg,#0F0B2E)] rounded-lg border border-white/[0.08] py-12 text-center">
              <Package className="w-10 h-10 mx-auto mb-4 text-white/15" strokeWidth={1.5} />
              <p className="text-[13px] text-white/40 tracking-[-0.01em]">{t.orders.noOrders}</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-[var(--panel-bg,#0F0B2E)] rounded-lg border cursor-pointer transition-colors ${selectedOrderId === order.id
                  ? 'border-[var(--brand-indigo)]/50'
                  : 'border-white/[0.08] hover:border-[var(--brand-indigo)]/30'
                  }`}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusModalOrder(order);
                          }}
                          title={t.orders.changeStatusAction}
                          className="inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded-md active:bg-white/[0.08] transition-colors"
                        >
                          <OrderStatusBadge status={order.status} />
                          <ChevronDown className="w-3 h-3 text-white/40" strokeWidth={2} />
                        </button>
                        <span className="text-[11px] text-white/30 font-mono">
                          #{order.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {order.order_items.map((item, idx) => (
                          <p key={idx} className="font-medium text-[13px] text-foreground tracking-[-0.01em]">
                            {item.products?.name || t.orders.products} x{item.quantity}
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-[12px] text-white/40">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {order.customers?.name || t.orders.customer}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-foreground tabular-nums tracking-[-0.02em]">
                        ₮{Number(order.total_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Detail */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="sticky top-6 bg-[var(--panel-bg,#0F0B2E)] rounded-lg border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                <span className="text-sm font-semibold text-foreground tracking-[-0.01em]">{t.orders.details}</span>
                <div className="flex items-center gap-1.5">
                  <OrderStatusBadge status={selectedOrder.status} />
                  <PaymentStatusBadge
                    status={selectedOrder.payment_status}
                    method={selectedOrder.payment_method}
                  />
                </div>
              </div>
              <div className="p-5 space-y-5">
                {/* Customer Info */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]">{t.orders.customerInfo}</h3>
                  <div className="bg-[var(--panel-bg,#0F0B2E)] rounded-md p-3 space-y-2">
                    <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{selectedOrder.customers?.name || t.orders.noName}</p>
                    {selectedOrder.customers?.phone && (
                      <p className="text-[12px] text-white/40 flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {selectedOrder.customers.phone}
                      </p>
                    )}
                    {(selectedOrder.delivery_address || selectedOrder.customers?.address) && (
                      <p className="text-[12px] text-white/40 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {selectedOrder.delivery_address || selectedOrder.customers?.address}
                      </p>
                    )}
                    {selectedOrder.customers?.facebook_id && (
                      <p className="text-[12px] text-white/40 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                        Messenger
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]">{t.orders.products}</h3>
                  <div className="space-y-1.5">
                    {selectedOrder.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[var(--panel-bg,#0F0B2E)] rounded-md p-3">
                        <div>
                          <p className="font-medium text-[13px] text-foreground tracking-[-0.01em]">{item.products?.name}</p>
                          <p className="text-[11px] text-white/40">
                            ₮{Number(item.unit_price).toLocaleString()} x {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-[13px] tabular-nums tracking-[-0.01em]">
                          ₮{(Number(item.unit_price) * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.08] pt-3 flex justify-between items-center">
                    <span className="font-medium text-[13px] tracking-[-0.01em]">{t.orders.totalAmount}</span>
                    <span className="text-lg font-semibold text-foreground tracking-[-0.02em]">
                      ₮{Number(selectedOrder.total_amount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]">Төлбөр</h3>
                  <div className="bg-[var(--panel-bg,#0F0B2E)] rounded-md p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-white/40">Хэлбэр:</span>
                      <span className="text-foreground tracking-[-0.01em]">
                        {selectedOrder.payment_method === 'cod' && '📦 Хүргэлтээр (COD)'}
                        {selectedOrder.payment_method === 'qpay' && '💳 QPay'}
                        {selectedOrder.payment_method === 'bank_transfer' && '🏦 Банк шилжүүлэг'}
                        {selectedOrder.payment_method === 'cash' && '💵 Бэлэн'}
                        {!selectedOrder.payment_method && '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-white/40">Төлөв:</span>
                      <PaymentStatusBadge status={selectedOrder.payment_status} />
                    </div>
                    {selectedOrder.paid_at && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-white/40">Төлсөн:</span>
                        <span className="text-white/70 tracking-[-0.01em]">
                          {formatDate(selectedOrder.paid_at)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.payment_method === 'qpay' &&
                      selectedOrder.payment_status !== 'paid' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            recheckPayment(selectedOrder.id);
                          }}
                          disabled={isRechecking}
                          className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium text-[var(--brand-indigo)] bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] hover:bg-[color-mix(in_oklab,var(--brand-indigo)_24%,transparent)] transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isRechecking ? 'animate-spin' : ''}`}
                            strokeWidth={1.5}
                          />
                          {isRechecking ? 'Шалгаж байна…' : 'QPay-аас төлбөр шалгах'}
                        </button>
                      )}
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]">{t.orders.notes}</h3>
                    <p className="text-[13px] text-white/60 bg-[var(--panel-bg,#0F0B2E)] rounded-md p-3 tracking-[-0.01em]">
                      {selectedOrder.notes}
                    </p>
                  </div>
                )}

                {/* Status Update */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-[0.05em]">{t.orders.changeStatus}</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {statusOptions.map((status) => {
                      const Icon = status.icon;
                      const isActive = selectedOrder.status === status.value;

                      return (
                        <button
                          key={status.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateStatus({ orderId: selectedOrder.id, status: status.value });
                          }}
                          disabled={isActive}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium transition-all tracking-[-0.01em] ${isActive
                            ? 'bg-[color-mix(in_oklab,var(--brand-indigo)_14%,transparent)] text-[var(--brand-indigo)] cursor-default'
                            : 'bg-[var(--panel-bg,#0F0B2E)] text-white/50 hover:bg-white/[0.06]'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="text-[11px] text-white/30 space-y-1 pt-4 border-t border-white/[0.08]">
                  <p>{t.orders.created} {formatDate(selectedOrder.created_at)}</p>
                  <p>{t.orders.updated} {formatDate(selectedOrder.updated_at)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--panel-bg,#0F0B2E)] rounded-lg border border-white/[0.08] py-12 text-center">
              <Package className="w-10 h-10 mx-auto mb-4 text-white/10" strokeWidth={1.5} />
              <p className="text-[13px] text-white/40 tracking-[-0.01em]">{t.orders.selectOrder}</p>
            </div>
          )}
        </div>
      </div>

      {/* Нэг захиалгын төлөв солих popup (мөр эсвэл badge дээр 1 товшилт) */}
      <OrderStatusModal
        open={statusModalOrder !== null}
        title={t.orders.changeStatusAction}
        currentStatus={statusModalOrder?.status}
        statusOptions={statusOptions}
        cancelLabel={t.orders.cancel}
        onSelect={(status) => {
          if (statusModalOrder) {
            updateStatus({ orderId: statusModalOrder.id, status });
          }
          setStatusModalOrder(null);
        }}
        onClose={() => setStatusModalOrder(null)}
      />

      {/* Бөөнөөр төлөв солих popup */}
      <OrderStatusModal
        open={showBulkStatusModal}
        title={`${bulkSelectedOrders.length} ${t.orders.bulkChangeStatus}`}
        statusOptions={statusOptions}
        cancelLabel={t.orders.cancel}
        onSelect={handleBulkStatusUpdate}
        onClose={() => setShowBulkStatusModal(false)}
      />
    </div>
  );
}
