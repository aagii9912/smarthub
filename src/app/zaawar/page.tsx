import type { Metadata } from "next";
import ZaawarClient from "./ZaawarClient";

export const metadata: Metadata = {
    title: "Заавар — Syncly",
    description:
        "Syncly-г хэрхэн ашиглах вэ? Бүртгүүлэхээс эхлээд AI борлуулагч, захиалга, тайлан хүртэл — бүгдийг интерактив зааврaaр алхам алхмаар үзээрэй.",
    openGraph: {
        title: "Syncly хэрэглэх заавар",
        description:
            "Бөмбөлөг бүр дээр дарж Syncly-ийн боломжуудтай алхам алхмаар танилцаарай.",
        url: "https://www.syncly.mn/zaawar",
    },
};

export default function ZaawarPage() {
    return <ZaawarClient />;
}
