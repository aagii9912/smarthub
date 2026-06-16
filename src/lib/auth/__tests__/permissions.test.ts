/**
 * RBAC permission matrix-ийн нэгж тест.
 * Цэвэр логик тул mock шаардлагагүй.
 */

import { describe, it, expect } from 'vitest';
import { hasRole, roleCan, ROLE_PERMISSIONS } from '@/lib/auth/permissions';

describe('hasRole — эрхийн шатлал', () => {
    it('owner нь бүх түвшнээс дээгүүр', () => {
        expect(hasRole('owner', 'admin')).toBe(true);
        expect(hasRole('owner', 'staff')).toBe(true);
        expect(hasRole('owner', 'owner')).toBe(true);
    });

    it('admin нь staff-аас дээгүүр, owner-ээс доогуур', () => {
        expect(hasRole('admin', 'staff')).toBe(true);
        expect(hasRole('admin', 'admin')).toBe(true);
        expect(hasRole('admin', 'owner')).toBe(false);
    });

    it('staff нь зөвхөн staff түвшинд хүрэлцэнэ', () => {
        expect(hasRole('staff', 'staff')).toBe(true);
        expect(hasRole('staff', 'admin')).toBe(false);
        expect(hasRole('staff', 'owner')).toBe(false);
    });
});

describe('roleCan — зөвшөөрлийн матриц', () => {
    it('owner-д бүх зөвшөөрөл байна', () => {
        expect(roleCan('owner', 'billing:manage')).toBe(true);
        expect(roleCan('owner', 'shop:delete')).toBe(true);
        expect(roleCan('owner', 'team:manage')).toBe(true);
        expect(roleCan('owner', 'settings:write')).toBe(true);
    });

    it('admin settings/ai/team засна, харин billing/delete-гүй', () => {
        expect(roleCan('admin', 'settings:write')).toBe(true);
        expect(roleCan('admin', 'ai:write')).toBe(true);
        expect(roleCan('admin', 'team:manage')).toBe(true);
        expect(roleCan('admin', 'billing:manage')).toBe(false);
        expect(roleCan('admin', 'shop:delete')).toBe(false);
    });

    it('staff нь orders/products/inbox бичнэ, харин ai/settings/team-гүй', () => {
        expect(roleCan('staff', 'orders:write')).toBe(true);
        expect(roleCan('staff', 'products:write')).toBe(true);
        expect(roleCan('staff', 'inbox:write')).toBe(true);
        expect(roleCan('staff', 'ai:write')).toBe(false);
        expect(roleCan('staff', 'settings:write')).toBe(false);
        expect(roleCan('staff', 'team:manage')).toBe(false);
        expect(roleCan('staff', 'customers:export')).toBe(false);
    });

    it('билл, дэлгүүр устгах нь зөвхөн owner-д байна', () => {
        for (const r of ['admin', 'staff'] as const) {
            expect(roleCan(r, 'billing:manage')).toBe(false);
            expect(roleCan(r, 'shop:delete')).toBe(false);
        }
    });
});

describe('ROLE_PERMISSIONS бүрэн бүтэн байдал', () => {
    it('гурван role тус бүр тодорхойлогдсон', () => {
        expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(['admin', 'owner', 'staff']);
    });
});
