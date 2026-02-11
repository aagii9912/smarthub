/**
 * Swagger UI Page
 * Interactive API documentation
 */

'use client';

import { useEffect } from 'react';

export default function SwaggerUIPage() {
    useEffect(() => {
        // Dynamically load Swagger UI
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
        script.onload = () => {
            // @ts-ignore
            window.SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                presets: [
                    // @ts-ignore
                    window.SwaggerUIBundle.presets.apis,
                    // @ts-ignore
                    window.SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: 'BaseLayout',
                deepLinking: true,
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
            });
        };
        document.body.appendChild(script);

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
        document.head.appendChild(link);

        return () => {
            document.body.removeChild(script);
            document.head.removeChild(link);
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#0F0B2E]">
            <div className="max-w-7xl mx-auto py-8">
                <header className="mb-8 px-4">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Syncly API Documentation
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Interactive API documentation powered by OpenAPI 3.0
                    </p>
                </header>
                <div id="swagger-ui" />
            </div>
        </div>
    );
}
