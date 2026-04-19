import React from 'react';
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    renderToBuffer,
} from '@react-pdf/renderer';

// Register a Cyrillic-capable font so Mongolian text renders correctly in PDFs.
// Noto Sans supports full Cyrillic range. Registration is idempotent.
let fontRegistered = false;
function ensureFontRegistered() {
    if (fontRegistered) return;
    try {
        Font.register({
            family: 'NotoSans',
            fonts: [
                {
                    src: 'https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99e.ttf',
                    fontWeight: 'normal',
                },
                {
                    src: 'https://fonts.gstatic.com/s/notosans/v36/o-0NIpQlx3QUlC5A4PNjXhFlYNyRyn7i_pGa_GJQtmNUPtjLjQ.ttf',
                    fontWeight: 'bold',
                },
            ],
        });
        fontRegistered = true;
    } catch {
        // Fall back to built-in Helvetica if registration fails
    }
}

export interface InvoicePdfData {
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

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'NotoSans',
        color: '#1F2937',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 16,
        marginBottom: 24,
        borderBottomWidth: 2,
        borderBottomColor: '#4F46E5',
        borderBottomStyle: 'solid',
    },
    title: {
        fontSize: 24,
        color: '#4F46E5',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    invoiceNumber: {
        fontSize: 10,
        color: '#6B7280',
    },
    dateBlock: {
        textAlign: 'right',
    },
    dateLabel: {
        fontSize: 10,
        color: '#374151',
        fontWeight: 'bold',
    },
    dateValue: {
        fontSize: 10,
        color: '#6B7280',
        marginTop: 2,
    },
    partiesRow: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    party: {
        flex: 1,
        paddingRight: 16,
    },
    partyLabel: {
        fontSize: 9,
        color: '#374151',
        marginBottom: 6,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    partyName: {
        fontSize: 12,
        color: '#111827',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    partyLine: {
        fontSize: 10,
        color: '#6B7280',
        marginBottom: 2,
    },
    paymentBox: {
        padding: 10,
        borderRadius: 4,
        marginBottom: 20,
    },
    paymentPaid: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderStyle: 'solid',
    },
    paymentPending: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE047',
        borderStyle: 'solid',
    },
    paymentTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    paymentPaidText: { color: '#15803D' },
    paymentPendingText: { color: '#A16207' },
    paymentLine: {
        fontSize: 9,
        lineHeight: 1.4,
    },
    table: {
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#374151',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        borderBottomStyle: 'solid',
    },
    tableCell: {
        fontSize: 10,
        color: '#4B5563',
    },
    colName: { flex: 5 },
    colQty: { flex: 1.5, textAlign: 'right' },
    colUnit: { flex: 2, textAlign: 'right' },
    colTotal: { flex: 2, textAlign: 'right' },
    totalsWrap: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 24,
    },
    totalsBox: {
        width: 220,
    },
    totalsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    totalsRowGrand: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 10,
        marginTop: 4,
        borderTopWidth: 2,
        borderTopColor: '#E5E7EB',
        borderTopStyle: 'solid',
    },
    totalsLabel: {
        fontSize: 10,
        color: '#374151',
    },
    totalsGrandLabel: {
        fontSize: 12,
        color: '#111827',
        fontWeight: 'bold',
    },
    totalsValue: {
        fontSize: 10,
        color: '#374151',
    },
    totalsGrandValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: 'bold',
    },
    notesBox: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 4,
        marginBottom: 20,
    },
    notesTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 4,
    },
    notesText: {
        fontSize: 9,
        color: '#6B7280',
        lineHeight: 1.5,
    },
    footer: {
        position: 'absolute',
        left: 40,
        right: 40,
        bottom: 24,
        textAlign: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        borderTopStyle: 'solid',
    },
    footerText: {
        fontSize: 8,
        color: '#9CA3AF',
        marginBottom: 2,
    },
});

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('mn-MN');
    } catch {
        return iso;
    }
}

function getPaymentMethodLabel(method?: string): string {
    const labels: Record<string, string> = {
        qpay: 'QPay',
        cash: 'Бэлэн мөнгө',
        bank_transfer: 'Шилжүүлэг',
    };
    return labels[method || ''] || method || 'Тодорхойгүй';
}

function InvoiceDocument({ data }: { data: InvoicePdfData }): React.ReactElement {
    const isPaid = data.paymentStatus === 'paid';
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>НЭХЭМЖЛЭХ</Text>
                        <Text style={styles.invoiceNumber}>№ {data.invoiceNumber}</Text>
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateLabel}>Огноо:</Text>
                        <Text style={styles.dateValue}>{formatDate(data.orderDate)}</Text>
                    </View>
                </View>

                <View style={styles.partiesRow}>
                    <View style={styles.party}>
                        <Text style={styles.partyLabel}>Борлуулагч</Text>
                        <Text style={styles.partyName}>{data.shop.name}</Text>
                        {data.shop.ownerName ? (
                            <Text style={styles.partyLine}>Эзэмшигч: {data.shop.ownerName}</Text>
                        ) : null}
                        {data.shop.phone ? (
                            <Text style={styles.partyLine}>Утас: {data.shop.phone}</Text>
                        ) : null}
                        {data.shop.address ? (
                            <Text style={styles.partyLine}>{data.shop.address}</Text>
                        ) : null}
                    </View>
                    <View style={styles.party}>
                        <Text style={styles.partyLabel}>Худалдан авагч</Text>
                        <Text style={styles.partyName}>{data.customer.name}</Text>
                        {data.customer.phone ? (
                            <Text style={styles.partyLine}>Утас: {data.customer.phone}</Text>
                        ) : null}
                        {data.customer.email ? (
                            <Text style={styles.partyLine}>Имэйл: {data.customer.email}</Text>
                        ) : null}
                        {data.customer.address ? (
                            <Text style={styles.partyLine}>Хаяг: {data.customer.address}</Text>
                        ) : null}
                    </View>
                </View>

                <View style={[styles.paymentBox, isPaid ? styles.paymentPaid : styles.paymentPending]}>
                    <Text style={[styles.paymentTitle, isPaid ? styles.paymentPaidText : styles.paymentPendingText]}>
                        {isPaid ? '✓ Төлбөр төлөгдсөн' : '⏳ Төлбөр хүлээгдэж байна'}
                    </Text>
                    <Text style={[styles.paymentLine, isPaid ? styles.paymentPaidText : styles.paymentPendingText]}>
                        Хэлбэр: {getPaymentMethodLabel(data.paymentMethod)}
                        {isPaid && data.paidAt ? `   Төлсөн: ${formatDate(data.paidAt)}` : ''}
                    </Text>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.colName]}>Бүтээгдэхүүн</Text>
                        <Text style={[styles.tableHeaderCell, styles.colQty]}>Тоо</Text>
                        <Text style={[styles.tableHeaderCell, styles.colUnit]}>Нэгж үнэ</Text>
                        <Text style={[styles.tableHeaderCell, styles.colTotal]}>Нийт</Text>
                    </View>
                    {data.items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.colName]}>{item.name}</Text>
                            <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                            <Text style={[styles.tableCell, styles.colUnit]}>{formatCurrency(item.unit_price)}</Text>
                            <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(item.total)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.totalsWrap}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalsRow}>
                            <Text style={styles.totalsLabel}>Дэд дүн:</Text>
                            <Text style={styles.totalsValue}>{formatCurrency(data.subtotal)}</Text>
                        </View>
                        <View style={styles.totalsRowGrand}>
                            <Text style={styles.totalsGrandLabel}>НИЙТ ДҮН:</Text>
                            <Text style={styles.totalsGrandValue}>{formatCurrency(data.total)}</Text>
                        </View>
                    </View>
                </View>

                {data.notes ? (
                    <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>Тэмдэглэл</Text>
                        <Text style={styles.notesText}>{data.notes}</Text>
                    </View>
                ) : null}

                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>Баярлалаа! | {data.shop.name}</Text>
                    <Text style={styles.footerText}>Syncly системээс автоматаар үүсгэгдсэн</Text>
                </View>
            </Page>
        </Document>
    );
}

export async function generateInvoicePDF(data: InvoicePdfData): Promise<Buffer> {
    ensureFontRegistered();
    return renderToBuffer(<InvoiceDocument data={data} />);
}
