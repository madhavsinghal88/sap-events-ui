'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Monitor,
  Clock,
  Search,
  ExternalLink,
  Globe,
  Sun,
  Moon
} from 'lucide-react';

const getCountryFromLocation = (location) => {
  if (!location) return 'Global';
  let loc = location.trim();
  if (loc.toLowerCase() === 'online') return 'Online';
  if (loc.toLowerCase() === 'global') return 'Global';
  
  if (loc.includes('Online - ')) {
    loc = loc.replace('Online - ', '').trim();
  } else if (loc.includes(',')) {
    const parts = loc.split(',');
    loc = parts[parts.length - 1].trim();
  }
  
  if (loc.includes('Germany')) return 'Germany';
  if (loc === 'Swiss') return 'Switzerland';
  if (loc === 'Uk') return 'United Kingdom';
  if (loc === 'Sk') return 'Slovakia';
  if (loc === 'Latinamerica') return 'Latin America';
  if (loc === 'United States of America') return 'United States';
  if (loc === 'Sea') return 'South East Asia';
  if (loc === 'Mena') return 'Middle East & North Africa';
  
  return loc;
};

const PRODUCT_CATEGORY_RULES = [
  ['AI & Analytics', ['ai', 'analytics', 'data cloud', 'data', 'planning', 'joule']],
  ['ERP & Finance', ['erp', 'finance', 'financial', 'accounting', 'tax', 'treasury']],
  ['Human Capital Management', ['hr', 'workforce', 'human capital', 'employee', 'successfactors']],
  ['Customer Experience', ['customer experience', 'cx', 'sales', 'service', 'commerce', 'crm', 'marketing']],
  ['Supply Chain', ['supply chain', 'procurement', 'logistics', 'inventory', 'manufacturing']],
  ['Integration & Platform', ['integration', 'btp', 'platform', 'developer', 'api', 'cloud']],
];

const INDUSTRY_RULES = [
  ['Travel & Transportation', ['travel', 'transportation', 'airline', 'airport', 'mobility']],
  ['Retail & Consumer', ['retail', 'consumer', 'e-commerce', 'commerce']],
  ['Manufacturing', ['manufacturing', 'automotive', 'industrial', 'factory']],
  ['Financial Services', ['bank', 'banking', 'insurance', 'finance', 'financial']],
  ['Public Sector', ['public sector', 'government', 'education', 'academic']],
  ['Technology', ['technology', 'developer', 'software', 'cloud', 'data']],
];

const EVENT_CATEGORY_RULES = [
  ['Conference', ['conference', 'congress', 'connect', 'convention']],
  ['Webinar', ['webinar', 'web cast', 'webcast']],
  ['Workshop', ['workshop', 'bootcamp', 'hands-on']],
  ['Summit', ['summit']],
  ['Forum', ['forum']],
  ['Roadshow', ['roadshow', 'tour']],
];

function deriveFromRules(text, rules, fallback) {
  const normalized = String(text || '').toLowerCase();
  for (const [label, keywords] of rules) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return label;
    }
  }
  return fallback;
}

function getProductCategory(event) {
  return deriveFromRules(event.title, PRODUCT_CATEGORY_RULES, 'General Business');
}

function getIndustry(event) {
  return deriveFromRules(`${event.title} ${event.location}`, INDUSTRY_RULES, 'Cross-industry');
}

function getEventCategory(event) {
  const fromTitle = deriveFromRules(event.title, EVENT_CATEGORY_RULES, null);
  if (fromTitle) return fromTitle;
  if (event.type === 'In-person') return 'Event';
  if (event.type === 'Hybrid') return 'Hybrid Event';
  if (event.type === 'Virtual - On-demand') return 'On-demand Session';
  return 'Virtual Event';
}

function getLanguage(event) {
  const title = String(event.title || '');
  const link = String(event.link || '').toLowerCase();
  const location = String(event.location || '').toLowerCase();

  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(title)) return 'Japanese';
  if (/[äöüß]/i.test(title) || link.includes('/germany/') || location.includes('germany')) return 'German';
  if (/[\u00c0-\u024f]/.test(title) && (link.includes('/spain/') || link.includes('/mexico/') || location.includes('spain'))) {
    return 'Spanish';
  }
  if (link.includes('/france/') || location.includes('france')) return 'French';
  if (link.includes('/brazil/') || location.includes('brazil')) return 'Portuguese';
  return 'English';
}

function getDateRangeBucket(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((date - startOfToday) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Past';
  if (diffDays <= 30) return 'Next 30 Days';
  if (diffDays <= 90) return 'Next 90 Days';
  return 'Later';
}

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Explore all events');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('All');
  const [selectedProductCategory, setSelectedProductCategory] = useState('All');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [selectedEventCategory, setSelectedEventCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedEventType, setSelectedEventType] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');

  const [lastRefreshed, setLastRefreshed] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('eventall-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
  };

  const formatLastSynced = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) {
      return `Today at ${timeStr}`;
    }
    
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data && data.events) {
        setEvents(data.events);
        if (data.lastSynced) {
          setLastRefreshed(formatLastSynced(data.lastSynced));
        }
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const res = await fetch('/api/events', { method: 'PATCH' });
      const data = await res.json();
      await fetchEvents();
      if (data.lastSynced) {
        setLastRefreshed(formatLastSynced(data.lastSynced));
      } else {
        setLastRefreshed(formatLastSynced(new Date().toISOString()));
      }
      if (data.source === 'sap_api') {
        setSyncMessage(`Synced ${data.count} live SAP events.`);
      } else {
        setSyncMessage(data.hint || 'Server sync blocked. Run the browser import from SAP finder.');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      setSyncMessage('Refresh failed. Try browser import from SAP finder.');
    }
  };

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchEvents();
    }, 0);

    const interval = setInterval(() => {
      refreshData();
    }, 86400000); // 24 hours (24 * 60 * 60 * 1000)

    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  const updateStatus = async (id, status) => {
    try {
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  const handleCompanyChange = (company) => {
    setSelectedCompany(company);
    setSelectedCountry('All');
    setSelectedDateRange('All');
    setSelectedProductCategory('All');
    setSelectedIndustry('All');
    setSelectedEventCategory('All');
    setSelectedLanguage('All');
    setSelectedEventType('All');
    setSelectedMonth('All');
    setSearchTerm('');
    setActiveTab('Explore all events');
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const parseDateForSort = (dateStr) => {
    if (!dateStr) return new Date(0);
    
    let clean = dateStr.replace(/[–—-]/g, '-');
    
    if (clean.includes('-')) {
      const parts = clean.split('-');
      const firstPart = parts[0].trim();
      const lastPart = parts[parts.length - 1].trim();
      
      if (/^\d+$/.test(firstPart)) {
        const monthYearMatch = lastPart.match(/[a-zA-Z]+,?\s*\d{4}/);
        if (monthYearMatch) {
          clean = `${monthYearMatch[0].replace(',', '')} ${firstPart}`;
        }
      } else {
        const yearMatch = lastPart.match(/\d{4}/);
        if (yearMatch) {
          clean = `${firstPart}, ${yearMatch[0]}`;
        }
      }
    }

    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) return parsed;
    
    const yearMatch = dateStr.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : '1970';
    const monthMatch = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
    const month = monthMatch ? monthMatch[0] : 'January';
    
    return new Date(`${month} 1, ${year}`);
  };

  const enrichedEvents = useMemo(() => (
    events.map((event) => {
      const parsedDate = parseDateForSort(event.date);
      return {
        ...event,
        parsedDate,
        regionCountry: getCountryFromLocation(event.location),
        productCategory: getProductCategory(event),
        industry: getIndustry(event),
        eventCategory: getEventCategory(event),
        language: getLanguage(event),
        eventType: event.type || 'Other',
        dateRange: getDateRangeBucket(parsedDate),
      };
    })
  ), [events]);

  const companyFilteredEvents = useMemo(() => {
    if (selectedCompany === 'All') return enrichedEvents;
    return enrichedEvents.filter(e => (e.company || 'SAP').toLowerCase() === selectedCompany.toLowerCase());
  }, [enrichedEvents, selectedCompany]);

  const countriesList = useMemo(() => {
    const list = new Set();
    companyFilteredEvents.forEach((e) => list.add(e.regionCountry));
    return Array.from(list).sort();
  }, [companyFilteredEvents]);

  const productCategories = useMemo(() => (
    Array.from(new Set(companyFilteredEvents.map((e) => e.productCategory))).sort()
  ), [companyFilteredEvents]);

  const industries = useMemo(() => (
    Array.from(new Set(companyFilteredEvents.map((e) => e.industry))).sort()
  ), [companyFilteredEvents]);

  const eventCategories = useMemo(() => (
    Array.from(new Set(companyFilteredEvents.map((e) => e.eventCategory))).sort()
  ), [companyFilteredEvents]);

  const languages = useMemo(() => (
    Array.from(new Set(companyFilteredEvents.map((e) => e.language))).sort()
  ), [companyFilteredEvents]);

  const eventTypes = useMemo(() => (
    Array.from(new Set(companyFilteredEvents.map((e) => e.eventType))).sort()
  ), [companyFilteredEvents]);

  const sortedEvents = [...companyFilteredEvents].sort((a, b) => {
    if (sortConfig.key === 'date') {
      const dateA = a.parsedDate;
      const dateB = b.parsedDate;
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }

    if (sortConfig.key === 'status') {
      const statusWeight = {
        'to_be_applied': 1,
        'not_applied': 2,
        'applied': 3
      };
      const weightA = statusWeight[a.status] || 99;
      const weightB = statusWeight[b.status] || 99;
      return sortConfig.direction === 'asc' ? weightA - weightB : weightB - weightA;
    }

    const valA = a[sortConfig.key] || '';
    const valB = b[sortConfig.key] || '';

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredEvents = sortedEvents.filter(event => {
    let matchesTab = false;
    if (activeTab === 'Explore all events') {
      matchesTab = true;
    } else if (activeTab === 'Upcoming') {
      matchesTab = parseDateForSort(event.date) > new Date();
    } else if (activeTab === 'In-person') {
      matchesTab = event.inPerson;
    } else if (activeTab === 'Virtual - Live') {
      matchesTab = event.virtualLive;
    } else if (activeTab === 'Virtual - On-demand') {
      matchesTab = event.virtualOnDemand;
    } else if (activeTab === 'Applied') {
      matchesTab = event.status === 'applied';
    }

    let matchesMonth = true;
    if (selectedMonth !== 'All') {
      const eventDate = event.parsedDate;
      matchesMonth = eventDate.getMonth() === parseInt(selectedMonth, 10);
    }

    let matchesCountry = true;
    if (selectedCountry !== 'All') {
      matchesCountry = event.regionCountry === selectedCountry;
    }

    const matchesDateRange = selectedDateRange === 'All' || event.dateRange === selectedDateRange;
    const matchesProductCategory = selectedProductCategory === 'All' || event.productCategory === selectedProductCategory;
    const matchesIndustry = selectedIndustry === 'All' || event.industry === selectedIndustry;
    const matchesEventCategory = selectedEventCategory === 'All' || event.eventCategory === selectedEventCategory;
    const matchesLanguage = selectedLanguage === 'All' || event.language === selectedLanguage;
    const matchesEventType = selectedEventType === 'All' || event.eventType === selectedEventType;

    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab &&
      matchesMonth &&
      matchesCountry &&
      matchesDateRange &&
      matchesProductCategory &&
      matchesIndustry &&
      matchesEventCategory &&
      matchesLanguage &&
      matchesEventType &&
      matchesSearch;
  });

  const toBeAppliedEvents = companyFilteredEvents.filter(e => e.status === 'to_be_applied');

  const stats = {
    total: companyFilteredEvents.length,
    upcoming: companyFilteredEvents.filter(e => parseDateForSort(e.date) > new Date()).length,
    virtual: companyFilteredEvents.filter(e => e.virtualLive || e.virtualOnDemand).length,
    applied: companyFilteredEvents.filter(e => e.status === 'applied').length
  };

  if (loading) return <div className="loading-screen">Loading SAP Events...</div>;

  return (
    <main className="dashboard">
      {/* Header */}
      <header className="header glass-panel">
        <div className="header-left">
          <div onClick={() => setView('landing')} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '0.4rem' }}>
            <Globe className="text-blue animate-pulse" size={24} />
            <h1 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800 }}>EventAll</h1>
          </div>
          <div className="last-updated">
            <Clock size={14} className="text-blue" />
             <span className="status-indicator">Last intelligence sync: {lastRefreshed}</span>
            {syncMessage ? <span className="sync-message">{syncMessage}</span> : null}
          </div>
        </div>
        <div className="header-actions">
          <div className="search-box glass-panel">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search titles, keywords, cities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={refreshData} className="refresh-btn glass-panel">
            Trigger Intel Sync
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === 'light' ? 'Switch to black background' : 'Switch to white background'}
            title={theme === 'light' ? 'Black background' : 'White background'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Black' : 'White'}
          </button>
        </div>
      </header>

      <div className="sap-filter-bar glass-panel">
        <FilterSelect
          label="Date Range"
          value={selectedDateRange}
          onChange={setSelectedDateRange}
          options={['All', 'Next 30 Days', 'Next 90 Days', 'Later', 'Past']}
        />
        <FilterSelect
          label="Product Category"
          value={selectedProductCategory}
          onChange={setSelectedProductCategory}
          options={['All', ...productCategories]}
        />
        <FilterSelect
          label="Industry"
          value={selectedIndustry}
          onChange={setSelectedIndustry}
          options={['All', ...industries]}
        />
        <FilterSelect
          label="Event Category"
          value={selectedEventCategory}
          onChange={setSelectedEventCategory}
          options={['All', ...eventCategories]}
        />
        <FilterSelect
          label="Language"
          value={selectedLanguage}
          onChange={setSelectedLanguage}
          options={['All', ...languages]}
        />
        <FilterSelect
          label="Region/Country"
          value={selectedCountry}
          onChange={setSelectedCountry}
          options={['All', ...countriesList]}
        />
        <FilterSelect
          label="Event Type"
          value={selectedEventType}
          onChange={setSelectedEventType}
          options={['All', ...eventTypes]}
        />
        <FilterSelect
          label="Sort By"
          value={`${sortConfig.key}:${sortConfig.direction}`}
          onChange={(value) => {
            const [key, direction] = value.split(':');
            setSortConfig({ key, direction });
          }}
          options={[
            { value: 'date:asc', label: 'Upcoming' },
            { value: 'date:desc', label: 'Newest' },
            { value: 'title:asc', label: 'Title A-Z' },
            { value: 'location:asc', label: 'Location' },
            { value: 'status:asc', label: 'Status' },
          ]}
          alignRight
        />
      </div>

      {/* Company Selector Tab Bar */}
      <div className="company-selector glass-panel">
        {['ALL COMPANIES', 'SAP EVENTS', 'ORACLE EVENTS', 'XYZ EVENTS', 'MICROSOFT EVENTS', 'SALESFORCE EVENTS'].map(compTab => {
          const compValue = compTab.replace(' EVENTS', '').replace('ALL ', 'All');
          const isSelected = selectedCompany === compValue;
          return (
            <button
              key={compTab}
              onClick={() => handleCompanyChange(compValue)}
              className={`company-tab-btn ${isSelected ? 'active' : ''} ${compValue.toLowerCase()}`}
            >
              {compTab}
            </button>
          );
        })}
      </div>

      {/* Stats Section */}
      <section className="stats-grid">
        <StatCard label="Indexed Events" value={stats.total} icon={<Calendar className="text-blue" />} onClick={() => setActiveTab('Explore all events')} />
        <StatCard label="Future Opportunities" value={stats.upcoming} icon={<Clock className="text-purple" />} onClick={() => setActiveTab('Upcoming')} />
        <StatCard label="Online Tracks" value={stats.virtual} icon={<Monitor className="text-green" />} onClick={() => setActiveTab('Virtual - Live')} />
      </section>

      <div className="main-content">
        {/* Explore Section */}
        <section className="explore-section">
          <div className="section-header">
            <h2>Explore Feed <span className="results-count">({filteredEvents.length} opportunities)</span></h2>
            <div className="tabs">
              {[
                { label: 'Explore All', value: 'Explore all events' },
                { label: 'Upcoming', value: 'Upcoming' },
                { label: 'In-Person', value: 'In-person' },
                { label: 'Virtual (Live)', value: 'Virtual - Live' },
                { label: 'On-Demand', value: 'Virtual - On-demand' }
              ].map(tab => (
                <button
                  key={tab.value}
                  className={`tab-btn ${activeTab === tab.value ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="events-table glass-panel">
            <div className="table-header">
              <div className="col sortable" onClick={() => requestSort('date')}>
                Date & Time {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="col sortable" onClick={() => requestSort('title')}>
                Event Title {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="col sortable" onClick={() => requestSort('location')}>
                Location & Type {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </div>
              <div className="col">Official Link</div>
            </div>
            <div className="table-body">
              {filteredEvents.map((event) => (
                <div key={event.id} className="table-row">
                  <div className="col date">{event.date}</div>
                  <div className="col title">
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span className={`company-badge ${(event.company || 'SAP').toLowerCase()}`}>
                        {event.company || 'SAP'}
                      </span>
                      <span className="event-title-text">{event.title}</span>
                    </div>
                  </div>
                  <div className="col location">
                    <span className="badge">{event.type}</span>
                    <MapPin size={12} className="loc-pin" />
                    <span className="loc-text">{event.location}</span>
                  </div>
                  <div className="col action">
                    <a href={event.link} target="_blank" rel="noopener noreferrer" className="apply-link">
                      Apply <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
        <style jsx>{`
        .dashboard {
          padding: 2rem;
          max-width: 1600px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .sap-filter-bar {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 0.35rem;
          padding: 0.6rem 0.8rem;
          align-items: center;
        }

        .company-selector {
          display: flex;
          gap: 0.8rem;
          padding: 0.75rem 1.25rem;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          flex-wrap: wrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .company-tab-btn {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          color: var(--text-muted);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 150ms ease-in-out;
          letter-spacing: 0.03em;
        }

        .company-tab-btn:hover {
          color: var(--foreground);
          background: var(--surface-hover);
          border-color: var(--border-strong);
        }

        .company-tab-btn.active.all {
          border-color: var(--border-strong);
          color: var(--foreground);
          background: var(--surface-alt);
        }

        .company-tab-btn.active.sap {
          border-color: #38BDF8;
          color: #0369A1;
          background: #E0F2FE;
        }

        .company-tab-btn.active.oracle {
          border-color: #FCD34D;
          color: #B45309;
          background: #FEF3C7;
        }

        .company-tab-btn.active.xyz {
          border-color: #F472B6;
          color: #BE185D;
          background: #FCE7F3;
        }

        .company-tab-btn.active.microsoft {
          border-color: #A78BFA;
          color: #6D28D9;
          background: #EDE9FE;
        }

        .company-tab-btn.active.salesforce {
          border-color: #34D399;
          color: #15803D;
          background: #DCFCE7;
        }

        .company-badge {
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .company-badge.sap {
          background: #E0F2FE;
          color: #0369A1;
          border: 1px solid #BAE6FD;
        }

        .company-badge.oracle {
          background: #FEF3C7;
          color: #B45309;
          border: 1px solid #FDE68A;
        }

        .company-badge.xyz {
          background: #FCE7F3;
          color: #BE185D;
          border: 1px solid #FBCFE8;
        }

        .company-badge.microsoft {
          background: #EDE9FE;
          color: #6D28D9;
          border: 1px solid #DDD6FE;
        }

        .company-badge.salesforce {
          background: #DCFCE7;
          color: #15803D;
          border: 1px solid #BBF7D0;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 2rem;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .header-left h1 {
          font-size: 1.6rem;
          font-weight: 800;
          margin-bottom: 0.3rem;
        }

        .last-updated {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
          font-size: 0.8rem;
          flex-wrap: wrap;
        }

        @keyframes status-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }

        .status-indicator::before {
          content: '';
          display: inline-block;
          width: 7px;
          height: 7px;
          background-color: #10B981;
          border-radius: 50%;
          animation: status-pulse 2s infinite;
        }

        .sync-message {
          color: #D97706;
          font-weight: 500;
        }

        .header-actions {
          display: flex;
          gap: 0.8rem;
          align-items: center;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.5rem 0.85rem;
          width: 280px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 8px;
        }

        .search-box input {
          background: none;
          border: none;
          color: var(--foreground);
          width: 100%;
          outline: none;
          font-size: 0.85rem;
        }

        .search-box input::placeholder {
          color: var(--text-placeholder);
        }

        .month-filter-box {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.85rem;
          border-radius: 8px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
        }

        .month-select {
          background: none;
          border: none;
          color: var(--foreground);
          outline: none;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.85rem;
          padding-right: 0.3rem;
        }

        .month-select option {
          background: var(--card-bg);
          color: var(--foreground);
        }

        .refresh-btn {
          padding: 0.5rem 1rem;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--foreground);
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: all 150ms ease;
        }

        .refresh-btn:hover {
          background: var(--surface-hover);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }

        .section-header h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--foreground);
        }

        .tabs {
          display: flex;
          gap: 0.25rem;
          background: var(--surface-alt);
          padding: 0.25rem;
          border-radius: 8px;
          border: 1px solid var(--card-border);
        }

        .tab-btn {
          padding: 0.4rem 0.85rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
          transition: all 150ms ease;
        }

        .tab-btn:hover {
          color: var(--foreground);
          background: var(--tab-hover);
        }

        .tab-btn.active {
          background: var(--card-bg);
          color: var(--foreground);
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .events-table {
          overflow: hidden;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .table-header {
          display: grid;
          grid-template-columns: 120px 1fr 250px 120px;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--card-border);
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.8rem;
          background: var(--surface-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .table-header .col.sortable {
          cursor: pointer;
          user-select: none;
          transition: color 150ms;
        }

        .table-header .col.sortable:hover {
          color: var(--foreground);
        }

        .table-body {
          display: flex;
          flex-direction: column;
          max-height: 800px;
          overflow-y: auto;
        }

        .table-row {
          display: grid;
          grid-template-columns: 120px 1fr 250px 120px;
          padding: 1.1rem 1.5rem;
          border-bottom: 1px solid var(--row-border);
          align-items: center;
          transition: background-color 150ms ease;
        }

        .table-row:hover {
          background: var(--surface-hover) !important;
        }

        .table-row:nth-child(even) {
          background: var(--row-stripe);
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .col {
          padding-right: 1rem;
        }

        .col.date {
          font-weight: 600;
          color: var(--primary);
          font-size: 0.85rem;
        }

        .col.title {
          font-weight: 700;
          font-size: 0.95rem;
          line-height: 1.4;
          color: var(--foreground);
        }

        .col.location {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.85rem;
        }

        .loc-pin {
          color: var(--text-muted);
          margin-right: 0.25rem;
          vertical-align: middle;
        }

        .loc-text {
          color: var(--text-muted);
          vertical-align: middle;
        }

        .badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          background: var(--surface-alt);
          color: var(--text-muted);
          width: fit-content;
          border: 1px solid var(--card-border);
        }

        .apply-link {
          background: var(--primary);
          color: #FFFFFF !important;
          padding: 0.45rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.8rem;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.15);
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .apply-link:hover {
          background: #1D4ED8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
          text-decoration: none;
        }

        .loading-screen {
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--foreground);
          background: var(--background);
        }

        .text-blue { color: #2563EB; }
        .text-purple { color: #8B5CF6; }
        .text-green { color: #10B981; }
        .text-cyan { color: #2563EB; }

        @media (max-width: 1200px) {
          .sap-filter-bar {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .search-box {
            width: 100%;
          }

          .sap-filter-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options, alignRight = false }) {
  return (
    <label className={`sap-filter ${alignRight ? 'align-right' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
      <style jsx>{`
        .sap-filter {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          min-width: 0;
          padding: 0.2rem 0.35rem;
          border-radius: 8px;
        }

        .sap-filter.align-right {
          justify-content: flex-end;
        }

        .sap-filter span {
          font-size: 0.74rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        .sap-filter select {
          min-width: 0;
          width: 100%;
          background: transparent;
          border: none;
          color: var(--foreground);
          font-size: 0.78rem;
          outline: none;
          cursor: pointer;
        }
      `}</style>
    </label>
  );
}

function StatCard({ label, value, icon, onClick }) {
  return (
    <div className={`stat-card glass-panel ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
      </div>
      <style jsx>{`
        .stat-card {
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.04);
          transition: all 150ms ease;
        }
        .stat-card.clickable {
          cursor: pointer;
        }
        .stat-card.clickable:hover {
          transform: translateY(-2px);
          border-color: var(--border-strong);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        .stat-card:hover:not(.clickable) {
          transform: translateY(-1px);
        }
        .stat-icon {
          padding: 0.75rem;
          background: var(--surface-alt);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
        }
        .stat-info {
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .stat-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--foreground);
          margin-top: 0.1rem;
        }
      `}</style>
    </div>
  );
}
