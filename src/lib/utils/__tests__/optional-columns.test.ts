import { describe, it, expect, vi } from 'vitest';
import {
    isMissingColumnError,
    missingColumnName,
    writeWithOptionalColumns,
} from '@/lib/utils/optional-columns';

const pgrst204 = (col: string) => ({
    code: 'PGRST204',
    message: `Could not find the '${col}' column of 'products' in the schema cache`,
});

const pgMissing = (col: string) => ({
    message: `column "${col}" of relation "products" does not exist`,
});

describe('missingColumnName', () => {
    it('reads the column out of both PostgREST and Postgres wordings', () => {
        expect(missingColumnName(pgrst204('attributes'))).toBe('attributes');
        expect(missingColumnName(pgMissing('ai_instructions'))).toBe('ai_instructions');
    });

    it('strips a table qualifier', () => {
        expect(missingColumnName({ message: "Could not find the 'products.attributes' column" }))
            .toBe('attributes');
    });

    it('returns null for an unrelated error', () => {
        expect(missingColumnName({ message: 'duplicate key value violates unique constraint' })).toBeNull();
        expect(missingColumnName(null)).toBeNull();
    });
});

describe('isMissingColumnError', () => {
    it('recognises the deploy-lag errors and nothing else', () => {
        expect(isMissingColumnError(pgrst204('attributes'))).toBe(true);
        expect(isMissingColumnError(pgMissing('status'))).toBe(true);
        expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false);
        expect(isMissingColumnError(null)).toBe(false);
    });
});

describe('writeWithOptionalColumns', () => {
    it('writes everything in one round trip when no column is missing', async () => {
        const write = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });

        const res = await writeWithOptionalColumns(write, { name: 'Байр' }, { status: 'draft', attributes: { kind: 'realestate' } });

        expect(write).toHaveBeenCalledTimes(1);
        expect(write).toHaveBeenCalledWith({ name: 'Байр', status: 'draft', attributes: { kind: 'realestate' } });
        expect(res.droppedColumns).toEqual([]);
        expect(res.error).toBeNull();
    });

    // Энэ бол гол шалтгаан: `attributes` багана тавигдаагүй байхад ХУУЧИН код
    // бүх нэмэлтийг хаядаг тул `status: 'discontinued'` ч алга болж, зарагдсан
    // байрыг AI үргэлжлүүлэн санал болгодог байсан.
    it('drops only the missing column and keeps the ones that exist', async () => {
        const write = vi.fn()
            .mockResolvedValueOnce({ data: null, error: pgrst204('attributes') })
            .mockResolvedValueOnce({ data: { id: 'p1' }, error: null });

        const res = await writeWithOptionalColumns(
            write,
            { name: 'Байр' },
            { status: 'discontinued', ai_instructions: 'заавар', attributes: { kind: 'realestate', rooms: 2 } },
        );

        expect(write).toHaveBeenCalledTimes(2);
        expect(write).toHaveBeenLastCalledWith({
            name: 'Байр',
            status: 'discontinued',
            ai_instructions: 'заавар',
        });
        expect(res.droppedColumns).toEqual(['attributes']);
        expect(res.data).toEqual({ id: 'p1' });
        expect(res.error).toBeNull();
    });

    it('peels off several missing columns one at a time', async () => {
        const write = vi.fn()
            .mockResolvedValueOnce({ data: null, error: pgrst204('attributes') })
            .mockResolvedValueOnce({ data: null, error: pgMissing('delivery_note') })
            .mockResolvedValueOnce({ data: { id: 'p1' }, error: null });

        const res = await writeWithOptionalColumns(
            write,
            { name: 'Байр' },
            { status: 'active', delivery_note: '2 хоног', attributes: {} },
        );

        expect(write).toHaveBeenCalledTimes(3);
        expect(write).toHaveBeenLastCalledWith({ name: 'Байр', status: 'active' });
        expect(res.droppedColumns).toEqual(['attributes', 'delivery_note']);
    });

    it('falls back to dropping every extra when the error names no column it holds', async () => {
        const write = vi.fn()
            .mockResolvedValueOnce({ data: null, error: { code: 'PGRST204', message: 'schema cache is stale' } })
            .mockResolvedValueOnce({ data: { id: 'p1' }, error: null });

        const res = await writeWithOptionalColumns(write, { name: 'Байр' }, { status: 'draft', attributes: {} });

        expect(write).toHaveBeenLastCalledWith({ name: 'Байр' });
        expect(res.droppedColumns.sort()).toEqual(['attributes', 'status']);
        expect(res.error).toBeNull();
    });

    it('surfaces a real error instead of retrying it away', async () => {
        const dup = { code: '23505', message: 'duplicate key value violates unique constraint' };
        const write = vi.fn().mockResolvedValue({ data: null, error: dup });

        const res = await writeWithOptionalColumns(write, { name: 'Байр' }, { status: 'draft' });

        expect(write).toHaveBeenCalledTimes(1);
        expect(res.error).toBe(dup);
        expect(res.droppedColumns).toEqual([]);
    });

    it('gives up rather than looping when the base row itself is rejected', async () => {
        // Нэмэлт бүгд хасагдсан ч ижил алдаа гарвал зогсоно (хязгааргүй давталт
        // үүсэхгүй).
        const write = vi.fn().mockResolvedValue({ data: null, error: pgrst204('name') });

        const res = await writeWithOptionalColumns(write, { name: 'Байр' }, { status: 'draft' });

        expect(write).toHaveBeenCalledTimes(2);
        expect(res.error).not.toBeNull();
    });
});
