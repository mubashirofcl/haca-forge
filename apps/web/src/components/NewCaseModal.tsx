import React, { useState } from 'react';
import {
  X,
  Pencil,
  ChevronDown,
  Users,
  Sparkles,
} from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCase: (newCase: {
    title: string;
    creator: string;
    team: string;
    budget: number;
    description: string;
    duration: string;
  }) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onAddCase,
}) => {
  const [caseName, setCaseName] = useState('Conversion Issues');
  const [creator, setCreator] = useState('Brian McCartney - Senior Technical Lead');
  const [team, setTeam] = useState('Team-A - Main Support Team');
  const [budget, setBudget] = useState(24985);
  const [description, setDescription] = useState(
    'Resolve cross-browser attribution inconsistencies and optimize performance pipelines for high-traffic assets.'
  );

  const [creatorDropdownOpen, setCreatorDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  const creatorsList = [
    { name: 'Brian McCartney', role: 'Senior Technical Lead', initials: 'BM' },
    { name: 'Sarah Jenkins', role: 'Marketing Lead', initials: 'SJ' },
    { name: 'David Miller', role: 'Creative Director', initials: 'DM' },
  ];

  const teamsList = [
    { name: 'Team-A', label: 'Main Support Team', color: 'from-blue-500 to-indigo-500' },
    { name: 'Team-B', label: 'Motion & Video Cuts', color: 'from-purple-500 to-pink-500' },
    { name: 'Team-C', label: 'Copywriting & Content', color: 'from-emerald-500 to-teal-500' },
  ];

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCase({
      title: caseName,
      creator,
      team,
      budget,
      description,
      duration: 'Approximate wait: 15 minutes',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-modal max-w-[540px] w-full p-6 sm:p-8 relative shadow-modal-glass border border-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#7a6af6]/15 text-[#7a6af6] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Processing of the New Case
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Case Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Case Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={caseName}
                onChange={(e) => setCaseName(e.target.value)}
                placeholder="Enter case name..."
                className="w-full px-4 py-3 bg-white/90 border border-slate-200 rounded-full text-xs font-medium text-slate-900 pr-10 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-sm transition-all"
              />
              <Pencil className="w-3.5 h-3.5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* 2. Case Creator Select */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Case Creator
            </label>
            <button
              type="button"
              onClick={() => {
                setCreatorDropdownOpen(!creatorDropdownOpen);
                setTeamDropdownOpen(false);
              }}
              className="w-full px-4 py-2.5 bg-white/90 hover:bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-left shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
                  BM
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    {creator.split(' - ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    {creator.split(' - ')[1] || 'Lead'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {creatorDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 glass-card p-1.5 z-20 shadow-lg border border-white">
                {creatorsList.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setCreator(`${c.name} - ${c.role}`);
                      setCreatorDropdownOpen(false);
                    }}
                    className="w-full p-2 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[9px] font-bold flex items-center justify-center">
                      {c.initials}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. Responsible Team Select */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Responsible Team
            </label>
            <button
              type="button"
              onClick={() => {
                setTeamDropdownOpen(!teamDropdownOpen);
                setCreatorDropdownOpen(false);
              }}
              className="w-full px-4 py-2.5 bg-white/90 hover:bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-left shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    {team.split(' - ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    {team.split(' - ')[1] || 'Assigned'}
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {teamDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 glass-card p-1.5 z-20 shadow-lg border border-white">
                {teamsList.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setTeam(`${t.name} - ${t.label}`);
                      setTeamDropdownOpen(false);
                    }}
                    className="w-full p-2 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left transition-colors"
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-gradient-to-tr ${t.color} text-white flex items-center justify-center`}
                    >
                      <Users className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{t.name}</div>
                      <div className="text-[10px] text-slate-500">{t.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Allocated Budget Slider + Input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Allocated Budget / Cost
              </label>
              <span className="text-xs font-extrabold text-slate-900 font-mono">
                $ {budget.toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 bg-white/90 border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <input
                type="range"
                min={1000}
                max={100000}
                step={500}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>$ 1,000</span>
                <span>$ 50,000</span>
                <span>$ 100,000</span>
              </div>
            </div>
          </div>

          {/* 5. Case Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Case Description
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description and the complexity of the case..."
              className="w-full p-3.5 bg-white/90 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] shadow-sm resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              Cancel Processing
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#0d0e12] hover:bg-black text-white text-xs font-semibold shadow-md shadow-black/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span>Take for Processing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
