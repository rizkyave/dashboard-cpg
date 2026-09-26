'use client';

import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Anchor,
  BarChart3,
  Boxes,
  Menu,
} from 'lucide-react';
import { TabType } from '@/types/procurement';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  totalCount: number;
  criticalCount: number;
  onOpenSidebar: () => void;
}

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  totalCount,
  criticalCount,
  onOpenSidebar,
}: MobileBottomNavProps) {
  const tabs: {
    id: TabType;
    label: string;
    icon: any;
    badge?: string;
    badgeDestructive?: boolean;
  }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'procurement',
      label: 'Pengadaan',
      icon: ShoppingBag,
      badge:
        totalCount > 0
          ? totalCount >= 1000
            ? `${(totalCount / 1000).toFixed(0)}k`
            : `${totalCount}`
          : undefined,
    },
    {
      id: 'armada',
      label: 'Armada',
      icon: Anchor,
    },
    {
      id: 'inventory',
      label: 'Stok',
      icon: Boxes,
      badge: '10k',
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-background/95 backdrop-blur-md border-t border-border shadow-2xl transition-colors duration-200"
      style={{
        paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="grid grid-cols-5 items-stretch h-14 px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-1 transition-all touch-manipulation ${
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {/* Active pill indicator at top */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-foreground" />
              )}

              <div className="relative">
                <Icon
                  className={`size-5 transition-transform ${
                    isActive ? 'scale-110 text-foreground' : 'text-muted-foreground'
                  }`}
                />
                {tab.badge && (
                  <span
                    className={`absolute -top-1.5 -right-3 text-[9px] font-bold font-mono px-1 min-w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
                      tab.badgeDestructive
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-muted text-foreground border-border'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                  isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* 5th button: Open Drawer Sidebar Menu */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-1 px-1 text-muted-foreground hover:text-foreground transition-all touch-manipulation active:scale-95"
          title="Buka Menu & Filter Lanjutan"
        >
          <div className="relative">
            <Menu className="size-5 text-muted-foreground" />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-600 ring-2 ring-background" />
            )}
          </div>
          <span className="text-[10px] tracking-tight leading-none text-muted-foreground">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
