import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { ProfileDropdown } from './ProfileDropdown';

interface NavbarProps {
  onMobileMenuToggle: () => void;
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onMobileMenuToggle,
  globalSearch,
  setGlobalSearch,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q !== null && q !== globalSearch) {
      setGlobalSearch(q);
    }
  }, [location.search]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(`/teamlead/team-tickets?search=${encodeURIComponent(globalSearch)}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGlobalSearch(val);
    if (location.pathname.includes('/teamlead/team-tickets')) {
      const nextParams = new URLSearchParams(location.search);
      if (val.trim()) {
        nextParams.set('search', val);
      } else {
        nextParams.delete('search');
      }
      navigate(`?${nextParams.toString()}`, { replace: true });
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-3 shadow-2xs shrink-0">
      {/* Mobile Hamburger Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 lg:hidden cursor-pointer"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={globalSearch}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search tickets by ID, subject, requester, assignee..."
            className="w-full bg-slate-100/70 border border-slate-200/80 rounded-full pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20 transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 shrink-0">
        <NotificationDropdown />
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <ProfileDropdown />
      </div>
    </header>
  );
};
