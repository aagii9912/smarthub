import type { Metadata } from "next";
import ZaawarClient from "./ZaawarClient";

export const metadata: Metadata = {
    title: "Заавар — Syncly",
    description:
        "Syncly-г хэрхэн ашиглах вэ? Бүртгүүлэхээс эхлээд AI борлуулагч, захиалга, тайлан хүртэл — бүгдийг интерактив заавраар алхам алхмаар үзээрэй.",
    alternates: {
        canonical: "/zaawar",
    },
    openGraph: {
        title: "Syncly хэрэглэх заавар",
        description:
            "Бөмбөлөг бүр дээр дарж Syncly-ийн боломжуудтай алхам алхмаар танилцаарай.",
        url: "/zaawar",
        siteName: "Syncly",
        locale: "mn_MN",
        type: "website",
    },
};

export default function ZaawarPage() {
    return <ZaawarClient />;
}
