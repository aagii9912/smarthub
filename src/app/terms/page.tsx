import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service | Syncly',
    description: 'Syncly үйлчилгээний ашиглах нөхцөл',
};

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-950">
            <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
                {/* Header */}
                <div className="mb-12">
                    <Link
                        href="/"
                        className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                        ← Нүүр хуудас руу буцах
                    </Link>
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                        Үйлчилгээний нөхцөл
                    </h1>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                        Сүүлд шинэчилсэн: 2026 оны 1-р сарын 6
                    </p>
                </div>

                {/* Content */}
                <div className="prose prose-lg dark:prose-invert max-w-none">
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Үйлчилгээний тухай</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Syncly нь Facebook Messenger болон Instagram платформ дээр ажилладаг AI чатбот үйлчилгээ юм.
                            Манай үйлчилгээ нь бизнесүүдэд харилцагчидтай автоматаар харилцах, захиалга авах,
                            борлуулалтаа нэмэгдүүлэх боломжийг олгодог.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. Үйлчилгээ ашиглах нөхцөл</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Манай үйлчилгээг ашиглахын тулд та:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>18 нас хүрсэн байх ёстой</li>
                            <li>Үнэн зөв мэдээлэл өгөх ёстой</li>
                            <li>Facebook аккаунт эсвэл Facebook Page эзэмшиж байх ёстой</li>
                            <li>Энэхүү үйлчилгээний нөхцөлийг хүлээн зөвшөөрч байна</li>
                            <li>Монгол Улсын болон олон улсын хууль тогтоомжийг дагаж мөрдөх</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Хэрэглэгчийн хариуцлага</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Та дараах зүйлийг хийхгүй байхыг хүлээн зөвшөөрч байна:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Хууль бус үйл ажиллагаанд ашиглах</li>
                            <li>Бусдын эрхийг зөрчих</li>
                            <li>Хуурамч мэдээлэл тараах</li>
                            <li>Систем, сүлжээнд халдлага хийх</li>
                            <li>Spam эсвэл автомат мессеж илгээх (манай AI-аас бусад)</li>
                            <li>Үйлчилгээг урвуулан инженерчлэх, хуулбарлах</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. AI туслахын ашиглалт</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Манай AI chatbot нь:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Syncly-ийн хөгжүүлсэн AI систем ашиглан хариулт үүсгэдэг</li>
                            <li>Автоматаар мессежүүдэд хариулдаг</li>
                            <li>100% үнэн зөв байхыг баталгаажуулж чаддаггүй</li>
                            <li>Эмнэлэг, хууль зүй, санхүүгийн зөвлөгөө өгөхгүй</li>
                            <li>Сургаж, сайжруулж байгаа процесст байна</li>
                        </ul>
                        <p className="text-gray-700 dark:text-gray-300 mt-4">
                            Та AI-ийн хариултыг өөрийн үүргээрээ шалгаж, баталгаажуулах хариуцлагатай.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Үйлчилгээний хязгаарлалт</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Бид дараах тохиолдолд үйлчилгээг хязгаарлах эсвэл зогсоох эрхтэй:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Үйлчилгээний нөхцөл зөрчсөн тохиолдолд</li>
                            <li>Техникийн засвар үйлчилгээ хийх шаардлагатай үед</li>
                            <li>Аюулгүй байдлын асуудал гарсан үед</li>
                            <li>Төлбөр төлөөгүй тохиолдолд (төлбөртэй үйлчилгээнд)</li>
                            <li>Гуравдагч үйлчилгээ (Facebook, Google) саатсан үед</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">6. Оюуны өмч</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Syncly платформ, код, дизайн, контент нь манай оюуны өмч юм. Та дараах зүйлийг хийж болохгүй:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Манай код, систем хуулбарлах</li>
                            <li>Trademark, logo-г зөвшөөрөлгүй ашиглах</li>
                            <li>Контент, дизайн хулгайлах</li>
                        </ul>
                        <p className="text-gray-700 dark:text-gray-300 mt-4">
                            Таны оруулсан контент (мессеж, өгөгдөл) нь танд хамаарна, гэхдээ бид үүнийг
                            үйлчилгээ үзүүлэх зорилгоор ашиглах эрхтэй.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">7. Төлбөр, үнийн санал</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Одоогоор үйлчилгээ үнэгүй туршилтын хувилбартай. Ирээдүйд:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Төлбөртэй багц нэмэгдэж болно</li>
                            <li>Үнийн өөрчлөлтийг урьдчилан мэдэгдэнэ</li>
                            <li>Төлбөр буцаах бодлого тусад байна</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">8. Гуравдагч үйлчилгээ</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Манай үйлчилгээ дараах платформуудтай интеграцилагдсан:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li><strong>Facebook/Meta:</strong> Та Facebook-ийн Terms of Service-ийг мөрдөх ёстой</li>
                            <li><strong>AI систем:</strong> Syncly-ийн хөгжүүлсэн AI үйлчилгээний нөхцөл</li>
                            <li><strong>Vercel, Supabase:</strong> Тэдний үйлчилгээний нөхцөл хамаарна</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">9. Хариуцлагын хязгаарлалт</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Syncly нь дараах зүйлд хариуцлага хүлээхгүй:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>AI-ийн буруу хариулт, мэдээллээс үүдэлтэй хохирол</li>
                            <li>Гуравдагч платформын саатал, алдаа</li>
                            <li>Өгөгдлийн алдагдал (санамсаргүй тохиолдолд)</li>
                            <li>Бизнесийн орлого алдах, шууд бус хохирол</li>
                            <li>Хэрэглэгчийн буруу ашиглалт</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">10. Үйлчилгээ цуцлах</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Та хүссэн үедээ үйлчилгээг зогсоож болно. Үүний тулд:
                        </p>
                        <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                            <li>Facebook Page-аас webhook холболтыг салга</li>
                            <li>Бидэнд мэдэгдэл илгээ</li>
                            <li>Өгөгдөл устгуулахыг хүсвэл хүсэлт илгээ</li>
                        </ul>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">11. Нөхцөлийн өөрчлөлт</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Бид энэхүү үйлчилгээний нөхцөлийг цаг үетэй өөрчлөх эрхтэй. Томоохон өөрчлөлт
                            гарсан тохиолдолд таныг урьдчилан мэдэгдэнэ.
                        </p>
                    </section>

                    <section className="mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">12. Холбоо барих</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Асуулт, санал байвал:
                        </p>
                        <ul className="list-none text-gray-700 dark:text-gray-300 space-y-2">
                            <li><strong>Вэб:</strong> <Link href="/" className="text-indigo-600 hover:text-indigo-500">smarthub.vercel.app</Link></li>
                            <li><strong>Facebook:</strong> Framebrone хуудас</li>
                            <li><strong>Privacy Policy:</strong> <Link href="/privacy" className="text-indigo-600 hover:text-indigo-500">/privacy</Link></li>
                        </ul>
                    </section>

                    <div className="mt-12 rounded-lg bg-gray-50 dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Манай үйлчилгээг ашигласнаар та энэхүү үйлчилгээний нөхцөлийг хүлээн зөвшөөрч байна.
                            Хэрэв та зөвшөөрөхгүй бол үйлчилгээг ашиглаж болохгүй.
                        </p>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-12 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                    >
                        Нүүр хуудас руу буцах
                    </Link>
                </div>
            </div>
        </div >
    );
}

