import { Section } from './ui/Section';
import {
    Users,
    ShoppingCart,
    Package,
    BarChart3,
    MessageSquare,
    Settings
} from 'lucide-react';

const features = [
    {
        name: 'Харилцагчийн удирдлага (CRM)',
        description: 'Харилцагчийн мэдээллийг нэгтгэж, борлуулалтын сувгуудаа хялбар удирдана.',
        icon: Users,
        color: 'bg-blue-500',
    },
    {
        name: 'Борлуулалт',
        description: 'Үнийн санал илгээхээс эхлээд гэрээ байгуулах хүртэлх бүх процессыг автоматжуулна.',
        icon: ShoppingCart,
        color: 'bg-green-500',
    },
    {
        name: 'Агуулахын удирдлага',
        description: 'Бараа материалын үлдэгдэл, хөдөлгөөнийг бодит хугацаанд хянах боломжтой.',
        icon: Package,
        color: 'bg-orange-500',
    },
    {
        name: 'Санхүү, НББ',
        description: 'Нэхэмжлэх, төлбөр тооцоо, тайлан балансаа хялбар аргаар хөтлөх шийдэл.',
        icon: BarChart3,
        color: 'bg-purple-500',
    },
    {
        name: 'Маркетинг',
        description: 'И-мэйл маркетинг, сошиал медиа сурталчилгааг нэг дороос удирдах.',
        icon: MessageSquare,
        color: 'bg-pink-500',
    },
    {
        name: 'Үйлдвэрлэл',
        description: 'Үйлдвэрлэлийн захиалга, ажлын төв, нөөц төлөвлөлтийг оновчтой зохион байгуулна.',
        icon: Settings,
        color: 'bg-slate-500',
    },
];

export function Features() {
    return (
        <Section id="features" className="bg-neutral-50 dark:bg-neutral-900/50">
            <div className="mx-auto max-w-2xl text-center mb-16">
                <h2 className="text-base font-semibold leading-7 text-indigo-600 dark:text-indigo-400">
                    Боломжууд
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                    Бизнесээ өргөжүүлэх бүх хэрэгсэл
                </p>
                <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-neutral-400">
                    Odoo ERP систем нь 70 гаруй модультай бөгөөд таны бизнесийн хэрэгцээнд нийцүүлэн угсрах боломжтой.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature) => (
                    <div key={feature.name} className="relative pl-16 group">
                        <div className={`absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform group-hover:scale-110 duration-300 ${feature.color}`}>
                            <feature.icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold leading-7 text-neutral-900 dark:text-white">
                                {feature.name}
                            </h3>
                            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-400">
                                {feature.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Section>
    );
}
