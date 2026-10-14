import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 text-center">
      <div className="glass-modal max-w-md w-full p-8 shadow-modal-glass border border-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Access Restricted</h1>
        <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
          You do not possess the required RBAC permissions to access this administrative resource.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0d0e12] hover:bg-black text-white text-xs font-bold rounded-full shadow-pill transition-transform hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};
