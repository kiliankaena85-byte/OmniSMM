import React from 'react';
import { SmmPlanFullApp } from '../components/plan-views';

export const metadata = {
  title: 'SMMplan — Личный кабинет клиента (Главная)',
  description: 'Терминал профессионала SMMplan',
};

export default function FullScreenPlanPage() {
  return <SmmPlanFullApp initialTab="dashboard" />;
}
