import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  RefreshCw,
  Compass,
  ChevronRight
} from 'lucide-react';

export const LandingSanctuaryDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'grounding' | 'patterns'>('editor');

  return (
    <section id="sanctuary-demo" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase landing-muted mb-3 block">
            The Sanctuary Experience
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif landing-heading mb-6">
            Inside the Bounded Ritual
          </h2>
          <p className="text-lg landing-body leading-relaxed">
            Explore how Inner Pages transforms scattered journaling into a living map of your inner life.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 p-1.5 mb-10 rounded-2xl landing-surface max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'editor' ? 'landing-tab-active shadow-sm' : 'landing-tab-inactive'
            }`}
          >
            Writing Sanctuary
          </button>
          <button
            onClick={() => setActiveTab('grounding')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'grounding' ? 'landing-tab-active shadow-sm' : 'landing-tab-inactive'
            }`}
          >
            Rumination Pivot
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'patterns' ? 'landing-tab-active shadow-sm' : 'landing-tab-inactive'
            }`}
          >
            Pattern Synthesis (Preview)
          </button>
        </div>

        <div className="landing-elevated rounded-3xl p-6 sm:p-10 border shadow-lg transition-all duration-300">
          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-subtle">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 landing-icon" />
                  <span className="font-serif text-lg font-medium landing-heading">Private Writing Canvas</span>
                </div>
                <span className="text-xs landing-muted">Focus Mode Enabled</span>
              </div>
              <div className="space-y-4 font-serif text-base sm:text-lg leading-relaxed landing-body italic opacity-90">
                <p>
                  "I spent the morning feeling anxious about the decision, but as I sit here writing, I realize it wasn't about the project itself. It was the fear of disappointing people I respect..."
                </p>
              </div>
              <div className="p-4 rounded-2xl landing-surface text-xs leading-relaxed landing-body flex items-start gap-3">
                <BookOpen className="w-4 h-4 landing-icon shrink-0 mt-0.5" />
                <span>A clean, calm canvas with no distractions, formatting pressure, or AI interference while you write.</span>
              </div>
            </div>
          )}

          {activeTab === 'grounding' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-subtle">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 landing-icon" />
                  <span className="font-serif text-lg font-medium landing-heading">Rumination Gate & Grounding</span>
                </div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Loop Detection Active</span>
              </div>
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm leading-relaxed landing-body">
                <div className="flex items-center gap-2 font-serif font-medium landing-heading mb-2">
                  <Sparkles className="w-4 h-4 landing-icon" />
                  <span>Grounding Pivot Interception</span>
                </div>
                <p className="mb-3">
                  "I notice we're exploring a familiar circular thought ('What if I'm not ready?'). Let's pause the abstract analysis for a moment:"
                </p>
                <p className="font-serif text-base italic landing-heading bg-surface p-3 rounded-xl border">
                  "What is one concrete action within your control in the next 24 hours?"
                </p>
              </div>
              <p className="text-xs landing-muted">
                Unlike AI assistants that validate endless overthinking, Inner Pages detects cognitive loops and gently guides you back to presence and agency.
              </p>
            </div>
          )}

          {activeTab === 'patterns' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4 border-subtle">
                <div className="flex items-center gap-3">
                  <Compass className="w-5 h-5 landing-icon" />
                  <span className="font-serif text-lg font-medium landing-heading">Longitudinal Pattern Synthesis</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full landing-surface border landing-muted font-medium">
                  Feature Preview
                </span>
              </div>
              <div className="p-3.5 rounded-xl landing-surface border text-xs landing-muted leading-relaxed">
                💡 <strong>Longitudinal Preview:</strong> Pattern synthesis is built over time as you write and accumulate journal entries across weeks and months.
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-2xl landing-surface border flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider landing-muted mb-1">
                      Recurring Theme • Multi-Entry Synthesis
                    </div>
                    <h4 className="font-serif text-base font-medium landing-heading">
                      Autonomy vs. Approval Tension
                    </h4>
                    <p className="text-xs landing-body mt-1 leading-relaxed">
                      Noticeable shift toward prioritizing internal standards over external validation over time.
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 landing-icon shrink-0 mt-2" />
                </div>
                <div className="p-4 rounded-2xl landing-surface border flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider landing-muted mb-1">
                      Core Value • Lived Behavior Signal
                    </div>
                    <h4 className="font-serif text-base font-medium landing-heading">
                      Intellectual Honesty & Boundaries
                    </h4>
                    <p className="text-xs landing-body mt-1 leading-relaxed">
                      Consistent grounding when processing difficult choices in personal and professional relationships.
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 landing-icon shrink-0 mt-2" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
