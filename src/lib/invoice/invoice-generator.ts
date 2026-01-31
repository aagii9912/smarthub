/**
 * Invoice Generator for Syncly
 * Generates HTML invoices for orders
 */



interface InvoiceData {
    invoiceNumber: string;
    orderDate: string;
    shop: {
        name: string;
        ownerName?: string;
        phone?: string;
        address?: string;
    };
    customer: {
        name: string;
        phone?: string;
        address?: string;
        email?: string;
    };
    items: Array<{
        name: string;
        quantity: number;
        unit_price: number;
        total: number;
    }>;
    subtotal: number;
    total: number;
    paymentMethod?: string;
    paymentStatus?: string;
    paidAt?: string;
    notes?: string;
}

/**
 * Generate invoice number from order ID and date
 */
export function generateInvoiceNumber(orderId: string, createdAt: Date): string {
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const shortId = orderId.slice(0, 8).toUpperCase();
    return `INV-${year}${month}-${shortId}`;
}

/**
 * Generate HTML invoice
 */
export function generateInvoiceHTML(data: InvoiceData): string {
    const {
        invoiceNumber,
        orderDate,
        shop,
        customer,
        items,
        subtotal,
        total,
        paymentMethod,
        paymentStatus,
        paidAt,
        notes,
    } = data;

    return `
<!DOCTYPE html>
<html lang="mn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Нэхэмжлэх - ${invoiceNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            background: #f5f5f5;
        }
        
        .invoice {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4F46E5;
        }
        
        .header h1 {
            color: #4F46E5;
            font-size: 32px;
            margin-bottom: 5px;
        }
        
        .header .invoice-number {
            font-size: 14px;
            color: #666;
        }
        
        .header .date {
            text-align: right;
            color: #666;
        }
        
        .parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }
        
        .party h3 {
            color: #333;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .party p {
            color: #666;
            line-height: 1.6;
            font-size: 14px;
        }
        
        .party strong {
            color: #333;
            display: block;
            margin-bottom: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        thead {
            background: #F3F4F6;
        }
        
        th {
            text-align: left;
            padding: 12px;
            font-weight: 600;
            color: #374151;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #E5E7EB;
            color: #4B5563;
        }
        
        tbody tr:hover {
            background: #F9FAFB;
        }
        
        .text-right {
            text-align: right;
        }
        
        .totals {
            margin-left: auto;
            width: 300px;
        }
        
        .totals table {
            margin-bottom: 0;
        }
        
        .totals td {
            border: none;
            padding: 8px 12px;
        }
        
        .totals tr.total {
            border-top: 2px solid #E5E7EB;
        }
        
        .totals tr.total td {
            font-weight: 700;
            font-size: 18px;
            color: #1F2937;
            padding-top: 15px;
        }
        
        .payment-info {
            background: #F0FDF4;
            border: 1px solid #86EFAC;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
        }
        
        .payment-info.pending {
            background: #FEF3C7;
            border-color: #FDE047;
        }
        
        .payment-info h4 {
            color: #15803D;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .payment-info.pending h4 {
            color: #A16207;
        }
        
        .payment-info p {
            color: #166534;
            font-size: 13px;
            line-height: 1.5;
        }
        
        .payment-info.pending p {
            color: #854D0E;
        }
        
        .notes {
            background: #F9FAFB;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .notes h4 {
            color: #374151;
            margin-bottom: 8px;
            font-size: 14px;
        }
        
        .notes p {
            color: #6B7280;
            font-size: 13px;
            line-height: 1.6;
        }
        
        .footer {
            text-align: center;
            color: #9CA3AF;
            font-size: 12px;
            padding-top: 30px;
            border-top: 1px solid #E5E7EB;
        }
        
        @media print {
            body {
                padding: 0;
                background: white;
            }
            
            .invoice {
                box-shadow: none;
                padding: 20px;
            }
            
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div>
                <h1>НЭХЭМЖЛЭХ</h1>
                <div class="invoice-number">№ ${invoiceNumber}</div>
            </div>
            <div class="date">
                <strong>Огноо:</strong><br>
                ${new Date(orderDate).toLocaleDateString('mn-MN')}
            </div>
        </div>
        
        <div class="parties">
            <div class="party">
                <h3>Борлуулагч</h3>
                <strong>${shop.name}</strong>
                ${shop.ownerName ? `<p>Эзэмшигч: ${shop.ownerName}</p>` : ''}
                ${shop.phone ? `<p>Утас: ${shop.phone}</p>` : ''}
                ${shop.address ? `<p>${shop.address}</p>` : ''}
            </div>
            
            <div class="party">
                <h3>Худалдан авагч</h3>
                <strong>${customer.name}</strong>
                ${customer.phone ? `<p>Утас: ${customer.phone}</p>` : ''}
                ${customer.email ? `<p>Имэйл: ${customer.email}</p>` : ''}
                ${customer.address ? `<p>Хаяг: ${customer.address}</p>` : ''}
            </div>
        </div>
        
        ${paymentStatus === 'paid' ? `
        <div class="payment-info">
            <h4>✓ Төлбөр төлөгдсөн</h4>
            <p>
                Төлбөрийн хэлбэр: ${getPaymentMethodLabel(paymentMethod)}<br>
                ${paidAt ? `Төлсөн огноо: ${new Date(paidAt).toLocaleDateString('mn-MN')}` : ''}
            </p>
        </div>
        ` : `
        <div class="payment-info pending">
            <h4>⏳ Төлбөр хүлээгдэж байна</h4>
            <p>Төлбөрийн хэлбэр: ${getPaymentMethodLabel(paymentMethod)}</p>
        </div>
        `}
        
        <table>
            <thead>
                <tr>
                    <th style="width: 50%;">Бүтээгдэхүүн</th>
                    <th class="text-right" style="width: 15%;">Тоо ширхэг</th>
                    <th class="text-right" style="width: 17.5%;">Нэгж үнэ</th>
                    <th class="text-right" style="width: 17.5%;">Нийт</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(item.unit_price)}</td>
                    <td class="text-right">${formatCurrency(item.total)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <table>
                <tr>
                    <td>Дэд дүн:</td>
                    <td class="text-right">${formatCurrency(subtotal)}</td>
                </tr>
                <tr class="total">
                    <td>НИЙТ ДҮН:</td>
                    <td class="text-right">${formatCurrency(total)}</td>
                </tr>
            </table>
        </div>
        
        ${notes ? `
        <div class="notes">
            <h4>Тэмдэглэл</h4>
            <p>${notes}</p>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Баярлалаа! | ${shop.name}</p>
            <p>Энэхүү нэхэмжлэх нь Syncly системээс автоматаар үүсгэгдсэн</p>
        </div>
    </div>
    
    <script>
        function formatCurrency(amount) {
            return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
        }
        
        function getPaymentMethodLabel(method) {
            const labels = {
                'qpay': 'QPay',
                'cash': 'Бэлэн мөнгө',
                'bank_transfer': 'Шилжүүлэг'
            };
            return labels[method] || method;
        }
    </script>
</body>
</html>
    `.trim();
}

/**
 * Helper: Format currency
 */
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
}

/**
 * Helper: Get payment method label
 */
function getPaymentMethodLabel(method?: string): string {
    const labels: Record<string, string> = {
        'qpay': 'QPay',
        'cash': 'Бэлэн мөнгө',
        'bank_transfer': 'Шилжүүлэг',
    };
    return labels[method || ''] || method || 'Тодорхойгүй';
}
