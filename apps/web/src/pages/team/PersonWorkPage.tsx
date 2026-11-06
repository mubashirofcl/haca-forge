import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PersonWorkHistoryView } from '../../components/PersonWorkHistoryView';

export const PersonWorkPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="p-8 text-center text-slate-500">
        No team member selected.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <div className="max-w-5xl mx-auto pt-6 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ui-ink transition-colors mb-4 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      <PersonWorkHistoryView personId={id} isFullPage />
    </div>
  );
};

export default PersonWorkPage;

