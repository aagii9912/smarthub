import { Metadata } from 'next';
import { Hero } from '@/components/odoo/Hero';
import { Features } from '@/components/odoo/Features';
import { ContactForm } from '@/components/odoo/ContactForm';

export const metadata: Metadata = {
    title: 'Odoo ERP Implementation | Smarthub',
    description: 'Odoo ERP систем нэвтрүүлэх үйлчилгээ. Бизнесийн бүх үйл ажиллагааг нэг системд.',
};

export default function OdooPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-black">
            <Hero />
            <Features />
            <ContactForm />
        </main>
    );
}
