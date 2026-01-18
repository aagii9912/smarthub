'use client';

import Link from 'next/link';
import {
  HelpCircle, MessageSquare, Facebook, Package,
  Settings, Mail, ArrowRight, ExternalLink, Sparkles
} from 'lucide-react';

export default function HelpPage() {
  const faqs = [
    {
      question: 'AI чатбот хэрхэн ажилладаг вэ?',
      answer: 'Syncly AI чатбот нь таны Facebook Page-тэй холбогдож, Messenger-ээр ирсэн мессежүүдэд автоматаар хариулна. Google Gemini AI ашиглан хэрэглэгчийн асуултад зөв хариулт өгнө.'
    },
    {
      question: 'Facebook Page-ээ хэрхэн холбох вэ?',
      answer: 'Тохиргоо хуудсанд орж "Facebook-ээр холбох" товчийг дарна уу. Facebook бүртгэлээрээ нэвтэрч, чатбот ажиллуулах Page-ээ сонгоно.'
    },
    {
      question: 'Бүтээгдэхүүн нэмж болох уу?',
      answer: 'Тийм! Dashboard дээрх "Бүтээгдэхүүн" хэсэгт орж шинэ бүтээгдэхүүн нэмэх боломжтой. Чатбот эдгээр бүтээгдэхүүнүүдийг харилцагчдад танилцуулна.'
    },
    {
      question: 'Захиалга хэрхэн үүсдэг вэ?',
      answer: 'Харилцагч Messenger-ээр бүтээгдэхүүн захиалахад системд автоматаар захиалга бүртгэгдэнэ. Dashboard дээр захиалгуудыг удирдах боломжтой.'
    },
    {
      question: 'Чатбот ажиллахгүй байна?',
      answer: 'Facebook Page зөв холбогдсон эсэхийг шалгана уу. Тохиргоо хуудсанд очиж "Чатбот идэвхтэй" гэсэн тэмдэглэгээ байгаа эсэхийг шалгаарай.'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Тусламж & FAQ</h1>
          <p className="text-xl text-violet-100">Syncly ашиглахад тусламж хэрэгтэй юу?</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-4xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/setup"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100 group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Facebook className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Facebook холбох</h3>
            <p className="text-sm text-gray-500 mb-3">Page-ээ холбож чатбот идэвхжүүлэх</p>
            <span className="text-violet-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Тохируулах <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <Link
            href="/dashboard/products"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100 group"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Бүтээгдэхүүн</h3>
            <p className="text-sm text-gray-500 mb-3">Бүтээгдэхүүн нэмж удирдах</p>
            <span className="text-violet-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Бүтээгдэхүүнүүд <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100 group"
          >
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Dashboard</h3>
            <p className="text-sm text-gray-500 mb-3">Борлуулалт, захиалга хянах</p>
            <span className="text-violet-600 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Dashboard <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>

      {/* FAQs */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Түгээмэл асуултууд</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <summary className="px-6 py-4 cursor-pointer flex items-center justify-between hover:bg-gray-50">
                <span className="font-medium text-gray-900">{faq.question}</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Дэмжлэг хэрэгтэй юу?</h2>
          <p className="text-gray-600 mb-8">Бидэнтэй холбоо барина уу</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:support@syncly.mn"
              className="flex items-center gap-2 px-6 py-3 bg-white rounded-xl shadow hover:shadow-lg transition-all"
            >
              <Mail className="w-5 h-5 text-violet-600" />
              <span className="font-medium text-gray-900">support@syncly.mn</span>
            </a>
            <a
              href="https://m.me/synclymn"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-[#1877F2] text-white rounded-xl shadow hover:shadow-lg transition-all"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">Messenger</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Back to Dashboard */}
      <div className="text-center py-8">
        <Link
          href="/dashboard"
          className="text-violet-600 hover:text-violet-700 font-medium"
        >
          ← Dashboard руу буцах
        </Link>
      </div>
    </div>
  );
}

