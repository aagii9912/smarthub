import Link from "next/link";
import { MessageSquare, Bot, Zap, BarChart3, Shield, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25"></div>

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          {/* Header/Nav */}
          <nav className="mb-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">SmartHub</span>
            </div>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Dashboard
              </Link>
              <Link
                href="/auth/login"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Нэвтрэх
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Bot className="h-4 w-4" />
              AI-Powered Business Solutions
            </div>

            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl">
              Таны бизнест зориулсан
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> AI туслах</span>
            </h1>

            <p className="mb-10 text-xl leading-8 text-gray-600 dark:text-gray-400">
              Facebook Messenger дээр ажилладаг AI чатбот. Автоматаар захиалга авч, харилцагчидтай харилцаж,
              борлуулалтаа нэмэгдүүлээрэй.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/register"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-105"
              >
                <Zap className="h-5 w-5" />
                Бүртгүүлэх
              </Link>
              <Link
                href="/auth/login"
                className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <MessageSquare className="h-5 w-5" />
                Нэвтрэх
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Онцлог шийдлүүд
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              Бизнесээ автоматжуулж, илүү үр дүнтэй болгоорой
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <MessageSquare className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                AI Чатбот
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Facebook Messenger дээр 24/7 харилцагчидтай автоматаар харилцана
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Analytics Dashboard
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Борлуулалт, харилцагчид, захиалгын статистик хянах
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Шуурхай суулгалт
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                5 минутын дотор Facebook хуудастайгаа холбож эхэлнэ
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Gemini AI
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Google-ийн хамгийн сүүлийн үеийн AI загвар ашиглана
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Shield className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                Аюулгүй найдвартай
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Supabase болон Vercel дээр хостлогдсон, өндөр хамгаалалттай
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-xl transition-all dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/30">
                <Sparkles className="h-6 w-6 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
                CRM систем
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Харилцагчийн мэдээлэл автоматаар хадгалж, tag-аар ангилна
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 px-8 py-16 shadow-2xl sm:px-16 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Өнөөдөр эхэлцгээе
              </h2>
              <p className="mt-4 text-lg leading-8 text-indigo-100">
                AI туслахыг бизнестээ нэвтрүүлж, борлуулалтаа нэмэгдүүлээрэй. Үнэгүй туршилт эхлүүлнэ үү.
              </p>
              <div className="mt-8 flex items-center justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="rounded-lg bg-white px-8 py-4 text-lg font-semibold text-indigo-600 shadow-lg hover:bg-gray-50 transition-all"
                >
                  Бүртгүүлэх
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-lg border-2 border-white px-8 py-4 text-lg font-semibold text-white hover:bg-white/10 transition-all"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>&copy; 2026 SmartHub. Бүх эрх хуулиар хамгаалагдсан.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
