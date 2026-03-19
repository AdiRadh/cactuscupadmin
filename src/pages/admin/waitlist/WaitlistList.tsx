import { type FC, useState } from 'react';
import { Users } from 'lucide-react';
import { TournamentWaitlistTab } from './TournamentWaitlistTab';
import { SpecialEventWaitlistTab } from './SpecialEventWaitlistTab';
import { AddonWaitlistTab } from './AddonWaitlistTab';

type WaitlistTab = 'tournaments' | 'special-events' | 'addons';

const TABS: { key: WaitlistTab; label: string }[] = [
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'special-events', label: 'Special Events' },
  { key: 'addons', label: 'Add-ons' },
];

export const WaitlistList: FC = () => {
  const [activeTab, setActiveTab] = useState<WaitlistTab>('tournaments');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-orange-500" />
          <h1 className="text-3xl font-viking text-white">Waitlist Management</h1>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 bg-turquoise-800/50 p-1 rounded-lg w-fit" role="tablist" aria-label="Waitlist categories">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-turquoise-300 hover:text-white hover:bg-turquoise-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div role="tabpanel">
        {activeTab === 'tournaments' && <TournamentWaitlistTab />}
        {activeTab === 'special-events' && <SpecialEventWaitlistTab />}
        {activeTab === 'addons' && <AddonWaitlistTab />}
      </div>
    </div>
  );
};
