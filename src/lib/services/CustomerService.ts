/**
 * CustomerService - Handles customer-related database operations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DatabaseError, NotFoundError } from '@/types/errors';
import type { Customer } from '@/types/database';

export interface CreateCustomerData {
    shopId: string;
    facebookId: string;
    name?: string | null;
    phone?: string | null;
    address?: string | null;
}

export interface UpdateCustomerData {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
}

export class CustomerService {
    private supabase = supabaseAdmin();

    /**
     * Get customer by ID
     */
    async getById(id: string): Promise<Customer | null> {
        const { data, error } = await this.supabase
            .from('customers')
            .select('id, name, phone, address, facebook_id, instagram_id, total_orders, total_spent, is_vip, ai_paused_until, message_count, shop_id, created_at')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to get customer', { id, error });
            throw new DatabaseError('Failed to get customer', { id });
        }

        return data;
    }

    /**
     * Get customer by Facebook ID for a specific shop
     */
    async getByFacebookId(facebookId: string, shopId: string): Promise<Customer | null> {
        const { data, error } = await this.supabase
            .from('customers')
            .select('id, name, phone, address, facebook_id, total_orders, total_spent, is_vip, ai_paused_until, message_count, shop_id, created_at')
            .eq('facebook_id', facebookId)
            .eq('shop_id', shopId)
            .single();

        if (error && error.code !== 'PGRST116') {
            logger.error('Failed to get customer by Facebook ID', { facebookId, shopId, error });
            throw new DatabaseError('Failed to get customer', { facebookId, shopId });
        }

        return data;
    }

    /**
     * Get or create customer - used during webhook processing
     */
    async getOrCreate(data: CreateCustomerData): Promise<Customer> {
        // Try to find existing customer
        const customer = await this.getByFacebookId(data.facebookId, data.shopId);

        if (customer) {
            return customer;
        }

        // Create new customer
        const { data: newCustomer, error } = await this.supabase
            .from('customers')
            .insert({
                shop_id: data.shopId,
                facebook_id: data.facebookId,
                name: data.name,
                phone: data.phone,
                address: data.address,
            })
            .select()
            .single();

        if (error) {
            logger.error('Failed to create customer', { data, error });
            throw new DatabaseError('Failed to create customer', { facebookId: data.facebookId });
        }

        logger.info('Created new customer', { customerId: newCustomer.id, facebookId: data.facebookId });
        return newCustomer;
    }

    /**
     * Update customer data
     */
    async update(id: string, data: UpdateCustomerData): Promise<Customer> {
        const { data: updated, error } = await this.supabase
            .from('customers')
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update customer', { id, data, error });
            throw new DatabaseError('Failed to update customer', { id });
        }

        if (!updated) {
            throw new NotFoundError('Customer', id);
        }

        return updated;
    }

    /**
     * Update customer from Facebook profile
     */
    async updateFromFacebook(
        customerId: string,
        pageAccessToken: string,
        facebookId: string
    ): Promise<Customer | null> {
        try {
            const profileResponse = await fetch(
                `https://graph.facebook.com/${facebookId}?fields=first_name,last_name,name&access_token=${pageAccessToken}`
            );

            if (!profileResponse.ok) {
                logger.warn('Could not fetch Facebook profile', { facebookId });
                return null;
            }

            const profileData = await profileResponse.json();
            const userName = profileData.name || profileData.first_name || null;

            if (userName) {
                return this.update(customerId, { name: userName });
            }

            return null;
        } catch (error: unknown) {
            logger.warn('Error fetching Facebook profile', { facebookId, error });
            return null;
        }
    }

    /**
     * Extract phone number from message and update customer
     */
    async extractAndUpdatePhone(customerId: string, message: string): Promise<string | null> {
        const phoneMatch = message.match(/(\d{8})/);

        if (phoneMatch) {
            const phone = phoneMatch[1];
            await this.update(customerId, { phone });
            logger.info('Phone extracted from message', { phone, customerId });
            return phone;
        }

        return null;
    }

    /**
     * Get customers for a shop with pagination
     */
    async getByShop(
        shopId: string,
        options?: { limit?: number; offset?: number; orderBy?: string }
    ): Promise<Customer[]> {
        let query = this.supabase
            .from('customers')
            .select('id, shop_id, name, phone, address, facebook_id, instagram_id, total_orders, total_spent, is_vip, tags, created_at')
            .eq('shop_id', shopId);

        if (options?.orderBy) {
            query = query.order(options.orderBy, { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Failed to get customers', { shopId, error });
            throw new DatabaseError('Failed to get customers', { shopId });
        }

        return data || [];
    }

    /**
     * Get VIP customers for a shop
     */
    async getVIPCustomers(shopId: string): Promise<Customer[]> {
        const { data, error } = await this.supabase
            .from('customers')
            .select('id, shop_id, name, phone, address, facebook_id, total_orders, total_spent, is_vip, tags, created_at')
            .eq('shop_id', shopId)
            .eq('is_vip', true)
            .order('total_spent', { ascending: false });

        if (error) {
            logger.error('Failed to get VIP customers', { shopId, error });
            throw new DatabaseError('Failed to get VIP customers', { shopId });
        }

        return data || [];
    }

    // ================================================
    // Customer Intelligence
    // ================================================

    /**
     * Calculate customer score (0-100)
     * Based on: purchase frequency, average order value, recency, engagement
     */
    calculateCustomerScore(customer: Customer): number {
        let score = 0;

        // 1. Purchase frequency (max 30 points)
        const orders = customer.total_orders || 0;
        if (orders >= 10) score += 30;
        else if (orders >= 5) score += 20;
        else if (orders >= 3) score += 15;
        else if (orders >= 1) score += 8;

        // 2. Total spending (max 30 points)
        const spent = customer.total_spent || 0;
        if (spent >= 1000000) score += 30;      // 1M+
        else if (spent >= 500000) score += 22;   // 500K+
        else if (spent >= 200000) score += 15;   // 200K+
        else if (spent >= 50000) score += 8;     // 50K+

        // 3. Recency (max 25 points) — how recently they engaged
        const daysSinceCreated = Math.floor(
            (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const messageCount = customer.message_count || 0;

        // Estimate last activity from message count and account age
        if (messageCount > 0 && daysSinceCreated < 7) score += 25;
        else if (messageCount > 0 && daysSinceCreated < 30) score += 18;
        else if (messageCount > 0 && daysSinceCreated < 90) score += 10;
        else if (daysSinceCreated < 30) score += 5;

        // 4. Engagement depth (max 15 points)
        if (messageCount >= 50) score += 15;
        else if (messageCount >= 20) score += 10;
        else if (messageCount >= 5) score += 5;

        // Bonus: has contact info (+5 for phone, +3 for address)
        if (customer.phone) score += 3;
        if (customer.address) score += 2;

        return Math.min(100, score);
    }

    /**
     * Get customer segment based on score
     */
    getCustomerSegment(score: number): {
        segment: 'vip' | 'active' | 'at_risk' | 'new' | 'lost';
        label: string;
        color: string;
    } {
        if (score >= 70) return { segment: 'vip', label: 'VIP', color: '#8B5CF6' };
        if (score >= 45) return { segment: 'active', label: 'Идэвхтэй', color: '#10B981' };
        if (score >= 25) return { segment: 'at_risk', label: 'Эрсдэлтэй', color: '#F59E0B' };
        if (score >= 10) return { segment: 'new', label: 'Шинэ', color: '#3B82F6' };
        return { segment: 'lost', label: 'Алдсан', color: '#6B7280' };
    }

    /**
     * Get segment distribution for a shop
     */
    async getSegmentDistribution(shopId: string): Promise<{
        segments: Array<{ segment: string; label: string; color: string; count: number; percentage: number }>;
        totalCustomers: number;
        averageScore: number;
    }> {
        const { data: customers, error } = await this.supabase
            .from('customers')
            .select('id, total_orders, total_spent, message_count, phone, address, created_at')
            .eq('shop_id', shopId);

        if (error || !customers) {
            return { segments: [], totalCustomers: 0, averageScore: 0 };
        }

        const segmentCounts: Record<string, { label: string; color: string; count: number }> = {
            vip: { label: 'VIP', color: '#8B5CF6', count: 0 },
            active: { label: 'Идэвхтэй', color: '#10B981', count: 0 },
            at_risk: { label: 'Эрсдэлтэй', color: '#F59E0B', count: 0 },
            new: { label: 'Шинэ', color: '#3B82F6', count: 0 },
            lost: { label: 'Алдсан', color: '#6B7280', count: 0 },
        };

        let totalScore = 0;

        for (const customer of customers) {
            const score = this.calculateCustomerScore(customer as Customer);
            const { segment } = this.getCustomerSegment(score);
            segmentCounts[segment].count++;
            totalScore += score;
        }

        const total = customers.length;
        const segments = Object.entries(segmentCounts).map(([segment, data]) => ({
            segment,
            label: data.label,
            color: data.color,
            count: data.count,
            percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        }));

        return {
            segments,
            totalCustomers: total,
            averageScore: total > 0 ? Math.round(totalScore / total) : 0,
        };
    }

    /**
     * Auto-promote high-score customers to VIP
     */
    async autoPromoteVIPs(shopId: string, threshold: number = 70): Promise<number> {
        const { data: customers, error } = await this.supabase
            .from('customers')
            .select('id, total_orders, total_spent, message_count, phone, address, is_vip, created_at')
            .eq('shop_id', shopId)
            .eq('is_vip', false);

        if (error || !customers) return 0;

        const toPromote: string[] = [];

        for (const customer of customers) {
            const score = this.calculateCustomerScore(customer as Customer);
            if (score >= threshold) {
                toPromote.push(customer.id);
            }
        }

        if (toPromote.length === 0) return 0;

        const { error: updateError } = await this.supabase
            .from('customers')
            .update({ is_vip: true })
            .in('id', toPromote);

        if (updateError) {
            logger.error('Failed to auto-promote VIPs', { error: updateError });
            return 0;
        }

        logger.info(`Auto-promoted ${toPromote.length} customers to VIP`, { shopId });
        return toPromote.length;
    }
}

// Export singleton instance
export const customerService = new CustomerService();
