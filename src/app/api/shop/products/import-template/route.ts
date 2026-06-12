/**
 * Бүтээгдэхүүн импортын Excel загвар файл
 *
 * GET /api/shop/products/import-template
 * Returns: .xlsx файл — "Бүтээгдэхүүн" (өгөгдөл) + "Заавар" (тусламж) гэсэн 2 хуудастай
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-static';

const HEADERS = [
    'Нэр',
    'Төрөл',
    'Үнэ',
    'Тоо',
    'Нэгж',
    'Өнгө',
    'Хэмжээ',
    'Тайлбар',
    'Зургийн URL',
];

const SAMPLE_ROWS = [
    ['Хөвөн цамц', 'бараа', 45000, 20, 'ширхэг', 'Хар, Цагаан, Цэнхэр', 'S, M, L, XL', 'Зөөлөн хөвөн даавуун цамц', ''],
    ['Спорт пүүз', 'бараа', 120000, 15, 'ширхэг', 'Хар, Шар', '38, 39, 40, 41, 42', 'Хөнгөн гүйлтийн пүүз', ''],
    ['Гэрэл зургийн үйлчилгээ', 'үйлчилгээ', 250000, 10, 'захиалга', '', '', '1 цагийн студи зураг авалт', ''],
];

const GUIDE_ROWS = [
    ['Багана', 'Шаардлага', 'Тайлбар'],
    ['Нэр', 'Заавал', 'Бүтээгдэхүүн / үйлчилгээний нэр'],
    ['Төрөл', 'Сонголттой', '"бараа" эсвэл "үйлчилгээ" (хоосон бол бараа гэж үзнэ)'],
    ['Үнэ', 'Заавал', 'Зөвхөн тоо, төгрөгөөр (жишээ: 45000)'],
    ['Тоо', 'Сонголттой', 'Нөөцийн үлдэгдэл. Үйлчилгээ бол боломжит захиалгын тоо'],
    ['Нэгж', 'Сонголттой', 'ширхэг, захиалга, цаг, хүн гэх мэт'],
    ['Өнгө', 'Сонголттой', 'Таслалаар тусгаарлана (жишээ: Хар, Цагаан, Цэнхэр)'],
    ['Хэмжээ', 'Сонголттой', 'Таслалаар тусгаарлана (жишээ: S, M, L эсвэл 38, 39, 40)'],
    ['Тайлбар', 'Сонголттой', 'Дэлгэрэнгүй мэдээлэл — материал, овор хэмжээ, онцлог'],
    ['Зургийн URL', 'Сонголттой', 'Зургийн шууд холбоос (https://...)'],
    [],
    ['Анхаарах зүйлс', '', ''],
    ['1', '', 'Эхний хуудасны (Бүтээгдэхүүн) өгөгдлийг л уншина'],
    ['2', '', 'Эхний мөр баганын нэр байх ёстой — устгаж болохгүй'],
    ['3', '', 'Жишээ 3 мөрийг өөрийн өгөгдлөөр солино уу'],
    ['4', '', 'Файлын дээд хэмжээ: 5MB'],
    ['5', '', 'Нэр эсвэл үнэ дутуу мөрүүд импортод орохгүй'],
];

export async function GET() {
    const workbook = XLSX.utils.book_new();

    const dataSheet = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE_ROWS]);
    dataSheet['!cols'] = [
        { wch: 28 }, // Нэр
        { wch: 12 }, // Төрөл
        { wch: 10 }, // Үнэ
        { wch: 8 },  // Тоо
        { wch: 10 }, // Нэгж
        { wch: 24 }, // Өнгө
        { wch: 22 }, // Хэмжээ
        { wch: 36 }, // Тайлбар
        { wch: 30 }, // Зургийн URL
    ];
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Бүтээгдэхүүн');

    const guideSheet = XLSX.utils.aoa_to_sheet(GUIDE_ROWS);
    guideSheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'Заавар');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="syncly_products_template.xlsx"',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
