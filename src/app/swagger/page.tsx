'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to prevent SSR issues, as it relies on browser globals
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function SwaggerDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Интерактивная документация API (Swagger)
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Здесь вы можете изучить и протестировать наше API в режиме реального времени. 
            Используйте ваш API-ключ для авторизации запросов.
          </p>
        </div>
        
        {/* Swagger UI Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <SwaggerUI url="/docs/openapi.yaml" />
        </div>
      </div>
    </div>
  );
}
