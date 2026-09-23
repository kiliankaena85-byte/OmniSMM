import React from 'react';
import { SmmFluxFullApp } from '../components/flux-views';

export const metadata = {
  title: 'SMMflux — Личный кабинет (Главная)',
  description: 'Приложение SMMflux Aurora App',
};

export default function FullScreenFluxPage() {
  return <SmmFluxFullApp initialTab="dashboard" />;
}
