'use client';

import { EvalDashboard } from '@/components/eval-dashboard';

export default function EvalPage() {
  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="w-full flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-7xl">
          <EvalDashboard />
        </div>
      </div>
    </div>
  );
}