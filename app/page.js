'use client';

import { useState, useEffect, useMemo } from 'react';
import { normalizeEvent, parseEventDate } from '../lib/eventFormatters';
import {
  MapPin,
  Clock,
  Search,
  ExternalLink,
  Sun,
  Moon,
  Users,
  Award,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const KNOWN_COUNTRIES = new Set([
  'Algeria',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Belgium',
  'Botswana',
  'Brazil',
  'Canada',
  'Czech Republic',
  'Denmark',
  'Egypt',
  'Finland',
  'France',
  'Germany',
  'Ghana',
  'Hungary',
  'India',
  'Indonesia',
  'Ireland',
  'Italy',
  'Japan',
  'Kazakhstan',
  'Kenya',
  'Latvia',
  'Luxembourg',
  'Malaysia',
  'Malta',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Philippines',
  'Poland',
  'Portugal',
  'Singapore',
  'Slovakia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Taiwan',
  'Uganda',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
]);

const COUNTRY_ALIASES = {
  swiss: 'Switzerland',
  uk: 'United Kingdom',
  'united states of america': 'United States',
  usa: 'United States',
  sk: 'Slovakia',
};

const CITY_TO_COUNTRY = {
  accra: 'Ghana',
  algiers: 'Algeria',
  amsterdam: 'Netherlands',
  astana: 'Kazakhstan',
  baku: 'Azerbaijan',
  barcelona: 'Spain',
  bengaluru: 'India',
  copenhagen: 'Denmark',
  fukuoka: 'Japan',
  hyderabad: 'India',
  krakow: 'Poland',
  'kuala lumpur': 'Malaysia',
  london: 'United Kingdom',
  madrid: 'Spain',
  manila: 'Philippines',
  munich: 'Germany',
  nairobi: 'Kenya',
  osaka: 'Japan',
  paris: 'France',
  rome: 'Italy',
  seoul: 'South Korea',
  singapore: 'Singapore',
  tokyo: 'Japan',
  utrecht: 'Netherlands',
  zurich: 'Switzerland',
};

const LOCATION_HINTS = [
  ['gitex ai asia', 'Singapore'],
  ['hall c', 'Singapore'],
  ['mbs', 'Singapore'],
  ['bayview foyer', 'Singapore'],
  ['guoco midtown', 'Singapore'],
  ['one-north', 'Singapore'],
  ['julius baer office', 'Singapore'],
  ['hsbc office', 'Singapore'],
  ['quanterra classroom equinet', 'Singapore'],
  ['singapore land tower', 'Singapore'],
  ['tx - austin', 'United States'],
];

const LINK_HINTS = [
  ['/germany/', 'Germany'],
  ['/swiss/', 'Switzerland'],
  ['/uk/', 'United Kingdom'],
  ['/australia/', 'Australia'],
  ['/france/', 'France'],
  ['/spain/', 'Spain'],
  ['/india/', 'India'],
  ['/latinamerica/', null],
  ['/sea/', null],
  ['/africa/', null],
];

function normalizeCountryCandidate(value) {
  const cleaned = String(value || '')
    .replace(/^online\s*-\s*/i, '')
    .replace(/\s*\(hybrid\)\s*$/i, '')
    .trim();

  if (!cleaned) return null;

  const alias = COUNTRY_ALIASES[cleaned.toLowerCase()];
  const normalized = alias || cleaned;
  return KNOWN_COUNTRIES.has(normalized) ? normalized : null;
}

const getCountryFromLocation = (event) => {
  const location = typeof event === 'string' ? event : event?.location;
  const title = typeof event === 'object' ? event?.title || '' : '';
  const link = typeof event === 'object' ? event?.link || '' : '';
  const rawLocation = String(location || '').trim();
  const searchText = `${rawLocation} ${title} ${link}`.toLowerCase();

  if (!rawLocation || /^online$/i.test(rawLocation) || /^global$/i.test(rawLocation) || /^tbc$/i.test(rawLocation)) {
    return null;
  }

  const directMatch = normalizeCountryCandidate(rawLocation);
  if (directMatch) return directMatch;

  const locationParts = rawLocation.split(',').map((part) => part.trim()).filter(Boolean);
  for (const part of [...locationParts].reverse()) {
    const countryMatch = normalizeCountryCandidate(part);
    if (countryMatch) return countryMatch;

    const cityMatch = CITY_TO_COUNTRY[part.toLowerCase()];
    if (cityMatch) return cityMatch;
  }

  for (const [needle, country] of LOCATION_HINTS) {
    if (searchText.includes(needle)) return country;
  }

  for (const [needle, country] of LINK_HINTS) {
    if (searchText.includes(needle)) return country;
  }

  return null;
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

function toTitleCaseWord(word) {
  if (!word) return word;
  if (/[A-Z].*[A-Z]/.test(word) || /\d/.test(word) || /[./&-]/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatPartnerTitle(title) {
  const value = String(title || '').trim();
  if (!value) return 'SAP Partner';

  if (value === value.toUpperCase() && /[A-Z]{4,}/.test(value)) {
    return value
      .split(' ')
      .map((word) => {
        if (word.length <= 3 || /[()&/-]/.test(word)) return word;
        return word.charAt(0) + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  if (value === value.toLowerCase()) {
    return value
      .split(' ')
      .map((word) => toTitleCaseWord(word))
      .join(' ');
  }

  return value;
}

function formatPartnerDescription(description) {
  const value = String(description || '').replace(/\s+/g, ' ').trim();
  if (!value) return 'No description available.';

  const normalized = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
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
  const [upcomingSubTab, setUpcomingSubTab] = useState('All');
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
  const [currentView, setCurrentView] = useState('events');
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [totalPartners, setTotalPartners] = useState(0);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersPage, setPartnersPage] = useState(0);
  const [distributions, setDistributions] = useState({ PRODUCTS: [], INDUSTRY: [], ENGAGEMENT: [], LOCATION: [] });

  const [selectedPartnerType, setSelectedPartnerType] = useState('');
  const [selectedSolution, setSelectedSolution] = useState('');
  const [selectedFocusIndustry, setSelectedFocusIndustry] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [partnersSort, setPartnersSort] = useState('bestmatch');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('eventall-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuOpen && !e.target.closest('.download-dropdown')) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [downloadMenuOpen]);

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

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const filterParts = [];
      if (selectedPartnerType) filterParts.push(`engagement:${selectedPartnerType}`);
      if (selectedSolution) filterParts.push(`products:${selectedSolution}`);
      if (selectedFocusIndustry) filterParts.push(`industry:${selectedFocusIndustry}`);
      if (selectedLocation) filterParts.push(`location:${selectedLocation}`);
      const filterStr = filterParts.join(';');

      const url = `/api/partners?q=${encodeURIComponent(searchTerm)}&page=${partnersPage}&filter=${encodeURIComponent(filterStr)}&order=${partnersSort}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && !data.error) {
        setPartners(data.partners || []);
        setTotalPartners(data.count || 0);
        if (data.distributions) {
          setDistributions(data.distributions);
        }
      }
    } catch (e) {
      console.error('Failed to fetch partners:', e);
    } finally {
      setPartnersLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'partners') {
      fetchPartners();
    }
  }, [currentView, searchTerm, partnersPage, selectedPartnerType, selectedSolution, selectedFocusIndustry, selectedLocation, partnersSort]);

  // Reset page number on search or filter change
  useEffect(() => {
    setPartnersPage(0);
  }, [searchTerm, selectedPartnerType, selectedSolution, selectedFocusIndustry, selectedLocation, partnersSort]);

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

  const enrichedEvents = useMemo(() => (
    events.map((event) => {
      const normalized = normalizeEvent(event);
      const parsedDate = parseEventDate(normalized.date, normalized.link);
      return {
        ...normalized,
        parsedDate,
        regionCountry: getCountryFromLocation(normalized),
        productCategory: getProductCategory(normalized),
        industry: getIndustry(normalized),
        eventCategory: getEventCategory(normalized),
        language: getLanguage(normalized),
        eventType: normalized.type || 'Other',
        dateRange: getDateRangeBucket(parsedDate),
      };
    })
  ), [events]);

  const companyFilteredEvents = useMemo(() => {
    if (selectedCompany === 'All') return enrichedEvents;
    return enrichedEvents.filter(e => (e.company || 'SAP').toLowerCase() === selectedCompany.toLowerCase());
  }, [enrichedEvents, selectedCompany]);

  const countryOptions = useMemo(() => {
    const counts = new Map();
    companyFilteredEvents.forEach((event) => {
      if (!event.regionCountry) return;
      counts.set(event.regionCountry, (counts.get(event.regionCountry) || 0) + 1);
    });

    return [
      { value: 'All', label: 'All' },
      ...Array.from(counts.entries())
        .sort(([countryA], [countryB]) => countryA.localeCompare(countryB))
        .map(([country, count]) => ({
          value: country,
          label: `${country} (${count})`,
        })),
    ];
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

  const companyEventCounts = useMemo(() => {
    const counts = { all: enrichedEvents.length };
    enrichedEvents.forEach((event) => {
      const company = (event.company || 'SAP').toLowerCase();
      counts[company] = (counts[company] || 0) + 1;
    });
    return counts;
  }, [enrichedEvents]);

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
      const isUpcoming = event.parsedDate > new Date();
      if (upcomingSubTab === 'All') {
        matchesTab = isUpcoming;
      } else if (upcomingSubTab === 'In-person') {
        matchesTab = isUpcoming && event.inPerson;
      } else if (upcomingSubTab === 'Virtual - Live') {
        matchesTab = isUpcoming && event.virtualLive;
      } else if (upcomingSubTab === 'Virtual - On-demand') {
        matchesTab = isUpcoming && event.virtualOnDemand;
      }
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

  const exportColumns = ['date', 'title', 'company', 'type', 'location', 'status', 'link'];
  const exportHeaders = ['Date', 'Title', 'Company', 'Type', 'Location', 'Status', 'Link'];

  const exportToExcel = () => {
    const rows = filteredEvents.map((e) =>
      exportColumns.map((col) => (col === 'link' ? { f: e.link, t: 'l', l: { Target: e.link, Tooltip: 'Open' } } : e[col] || ''))
    );
    const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Events');
    XLSX.writeFile(wb, 'sap-events.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('SAP Events Tracker', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${filteredEvents.length} events | Exported ${new Date().toLocaleDateString()}`, 14, 22);

    doc.autoTable({
      startY: 28,
      head: [exportHeaders],
      body: filteredEvents.map((e) => exportColumns.map((col) => e[col] || '')),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 248, 250] },
      columnStyles: {
        1: { cellWidth: 60 },
        5: { cellWidth: 25 },
      },
    });

    doc.save('sap-events.pdf');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand-text" style={{ alignItems: 'center' }}>
          <div className="brand-title-line">
            <span className="nexus-gradient nexus-prefix">SAP • AI</span>
            <span className="nexus-gradient nexus-name">NEXUS</span>
          </div>
          <div className="brand-subtitle">GLOBAL EVENT TRACKER</div>
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading events...</p>
      </div>
    );
  }

  return (
    <main className="dashboard">
      {/* Header */}
      <header className="header glass-panel">
        <div className="header-left">
          <div className="brand-lockup">
            <div className="brand-text">
              <div className="brand-title-line">
                <span className="nexus-gradient nexus-prefix">SAP • AI</span>
                <span className="nexus-gradient nexus-name">NEXUS</span>
              </div>
              <div className="brand-subtitle">GLOBAL EVENT TRACKER</div>
              <div className="brand-tagline">SAP + AI EVENTS | INTELLIGENCE & CONNECTION</div>
            </div>
          </div>
          <div className="last-updated">
            <Clock size={14} className="text-blue" />
             <span className="status-indicator">Last intelligence sync: {lastRefreshed}</span>
            {syncMessage ? <span className="sync-message">{syncMessage}</span> : null}
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="view-switcher" style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-alt)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          <button
            onClick={() => setCurrentView('events')}
            className={`view-tab ${currentView === 'events' ? 'active' : ''}`}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: currentView === 'events' ? 'var(--card-bg)' : 'transparent',
              color: currentView === 'events' ? 'var(--foreground)' : 'var(--text-muted)',
              boxShadow: currentView === 'events' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease-in-out'
            }}
          >
            Events
          </button>
          <button
            onClick={() => setCurrentView('partners')}
            className={`view-tab ${currentView === 'partners' ? 'active' : ''}`}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: currentView === 'partners' ? 'var(--card-bg)' : 'transparent',
              color: currentView === 'partners' ? 'var(--foreground)' : 'var(--text-muted)',
              boxShadow: currentView === 'partners' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease-in-out'
            }}
          >
            SAP Partners
          </button>
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
          {currentView === 'events' && (
            <div className="download-dropdown">
              <button
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                className="download-btn glass-panel"
              >
                <Download size={16} /> Download
              </button>
              {downloadMenuOpen && (
                <div className="download-menu glass-panel">
                  <button onClick={() => { exportToExcel(); setDownloadMenuOpen(false); }}>
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={() => { exportToPDF(); setDownloadMenuOpen(false); }}>
                    <FileText size={14} /> PDF
                  </button>
                </div>
              )}
            </div>
          )}
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

      {currentView === 'events' ? (
        <>
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
          options={countryOptions}
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
        {['ALL COMPANIES', 'SAP EVENTS', 'GITEX EVENTS', 'ORACLE EVENTS', 'GLOBAL AI EVENTS', 'XYZ EVENTS', 'MICROSOFT EVENTS', 'SALESFORCE EVENTS'].map(compTab => {
          const compValue = compTab.includes('ALL') ? 'All' : compTab.replace(' EVENTS', '');
          const lookupKey = compValue.toLowerCase();
          const isSelected = selectedCompany.toLowerCase() === lookupKey;
          const eventCount = companyEventCounts[lookupKey] || 0;
          const cssClass = lookupKey.replace(/\s+/g, '-');
          return (
            <button
              key={compTab}
              onClick={() => handleCompanyChange(compValue)}
              className={`company-tab-btn ${isSelected ? 'active' : ''} ${cssClass}`}
            >
              {compTab} ({eventCount})
            </button>
          );
        })}
      </div>

      <div className="main-content">
        {/* Explore Section */}
        <section className="explore-section">
          <div className="section-header">
            <h2>Explore Feed <span className="results-count">({filteredEvents.length} of {companyFilteredEvents.length} events)</span></h2>
            <div className="tabs-wrapper">
              <div className="tabs">
                {[
                  { label: `Explore All (${companyFilteredEvents.length})`, value: 'Explore all events' },
                  { label: 'Upcoming', value: 'Upcoming' },
                  { label: 'In-Person', value: 'In-person' },
                  { label: 'Virtual (Live)', value: 'Virtual - Live' },
                  { label: 'On-Demand', value: 'Virtual - On-demand' }
                ].map(tab => (
                  <button
                    key={tab.value}
                    className={`tab-btn ${activeTab === tab.value ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(tab.value);
                      if (tab.value !== 'Upcoming') setUpcomingSubTab('All');
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab === 'Upcoming' && (
                <div className="upcoming-subtabs">
                  {[
                    { label: 'All', value: 'All' },
                    { label: 'In-Person', value: 'In-person' },
                    { label: 'Virtual', value: 'Virtual - Live' },
                    { label: 'On-Demand', value: 'Virtual - On-demand' }
                  ].map(sub => (
                    <button
                      key={sub.value}
                      className={`subtab-btn ${upcomingSubTab === sub.value ? 'active' : ''}`}
                      onClick={() => setUpcomingSubTab(sub.value)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
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
                <div key={`${event.company || 'SAP'}-${event.id}`} className="table-row">
                  <div className="col date">{event.date}</div>
                  <div className="col title">
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span className={`company-badge ${(event.company || 'SAP').toLowerCase().replace(/\s+/g, '-')}`}>
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
        </>
      ) : (
        <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Partners filter bar */}
          <div className="sap-filter-bar glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem' }}>
            <FilterSelect
              label="Partner Type"
              value={selectedPartnerType}
              onChange={setSelectedPartnerType}
              options={[
                { value: '', label: 'All Types' },
                ...(distributions.ENGAGEMENT || []).map(o => ({ value: o.title, label: `${o.title} (${o.count})` }))
              ]}
            />
            <FilterSelect
              label="Solution"
              value={selectedSolution}
              onChange={setSelectedSolution}
              options={[
                { value: '', label: 'All Solutions' },
                ...(distributions.PRODUCTS || []).map(o => ({ value: o.title, label: `${o.title} (${o.count})` }))
              ]}
            />
            <FilterSelect
              label="Focus Industry"
              value={selectedFocusIndustry}
              onChange={setSelectedFocusIndustry}
              options={[
                { value: '', label: 'All Industries' },
                ...(distributions.INDUSTRY || []).map(o => ({ value: o.title, label: `${o.title} (${o.count})` }))
              ]}
            />
            <FilterSelect
              label="Location"
              value={selectedLocation}
              onChange={setSelectedLocation}
              options={[
                { value: '', label: 'All Locations' },
                ...(distributions.LOCATION || []).map(o => ({ value: o.title, label: `${o.title} (${o.count})` }))
              ]}
            />
            <FilterSelect
              label="Sort By"
              value={partnersSort}
              onChange={setPartnersSort}
              options={[
                { value: 'bestmatch', label: 'Best match' },
                { value: 'title:asc', label: 'Alphabetical A-Z' },
                { value: 'title:desc', label: 'Alphabetical Z-A' }
              ]}
            />
          </div>

          <section className="explore-section">
            <div className="section-header">
              <h2>SAP Partners Directory <span className="results-count">({totalPartners} results)</span></h2>
            </div>
            
            {partnersLoading ? (
              <div className="loading-screen" style={{ minHeight: '350px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--card-border)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading SAP partners...</p>
                </div>
              </div>
            ) : partners.length === 0 ? (
              <div className="loading-screen" style={{ minHeight: '350px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No partners found matching your search criteria.</p>
              </div>
            ) : (
              <>
                <div className="partners-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', padding: '1.5rem 0' }}>
                  {partners.map((partner) => {
                    const displayTitle = formatPartnerTitle(partner.title);
                    const displayDescription = formatPartnerDescription(partner.description);

                    return (
                    <div key={partner.id} className="partner-card glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--surface-alt)', padding: '4px', overflow: 'hidden' }}>
                          <img src={partner.logoUrl.startsWith('http') ? partner.logoUrl : `https://partnerfinder.sap.com${partner.logoUrl}`} alt={displayTitle} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{displayTitle}</h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {partner.profileId}</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--foreground)', margin: '0 0 1.25rem 0', flex: 1, lineHeight: '1.4', opacity: 0.8 }}>{displayDescription}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--card-border)', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Users size={16} className="text-blue" />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1 }}>Consultants</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{partner.consultants ? partner.consultants.toLocaleString() : '0'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Award size={16} className="text-purple" />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1 }}>Competencies</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>{partner.competencyTotal || partner.competencies || 0}</span>
                          </div>
                        </div>
                      </div>
                      <a href={`https://partnerfinder.sap.com/profile/${partner.profileId}`} target="_blank" rel="noopener noreferrer" className="apply-link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', textDecoration: 'none', background: '#3b82f6', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', padding: '0.6rem', borderRadius: '8px', width: '100%', textAlign: 'center' }}>
                        View Profile <ExternalLink size={14} />
                      </a>
                    </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {Math.ceil(totalPartners / 12) > 1 && (
                  <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2rem', padding: '1rem' }}>
                    <button
                      onClick={() => setPartnersPage(p => Math.max(0, p - 1))}
                      disabled={partnersPage === 0}
                      style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--foreground)', cursor: 'pointer', opacity: partnersPage === 0 ? 0.5 : 1 }}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: Math.min(5, Math.ceil(totalPartners / 12)) }, (_, idx) => {
                      const totalPages = Math.ceil(totalPartners / 12);
                      let page = idx;
                      if (partnersPage > 2) {
                        page = partnersPage - 2 + idx;
                      }
                      if (page >= totalPages) return null;
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setPartnersPage(page)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            border: `1px solid ${partnersPage === page ? 'var(--foreground)' : 'var(--card-border)'}`,
                            background: partnersPage === page ? 'var(--foreground)' : 'var(--card-bg)',
                            color: partnersPage === page ? 'var(--background)' : 'var(--foreground)',
                            fontWeight: partnersPage === page ? 'bold' : 'normal',
                            cursor: 'pointer'
                          }}
                        >
                          {page + 1}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPartnersPage(p => Math.min(Math.ceil(totalPartners / 12) - 1, p + 1))}
                      disabled={partnersPage === Math.ceil(totalPartners / 12) - 1}
                      style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--foreground)', cursor: 'pointer', opacity: partnersPage === Math.ceil(totalPartners / 12) - 1 ? 0.5 : 1 }}
                    >
                      &gt;
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
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

        .company-tab-btn.active.gitex {
          border-color: #F97316;
          color: #C2410C;
          background: #FFEDD5;
        }

        .company-tab-btn.active.global-ai {
          border-color: #EF4444;
          color: #991B1B;
          background: #FEE2E2;
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

        .company-badge.gitex {
          background: #FFEDD5;
          color: #C2410C;
          border: 1px solid #FED7AA;
        }

        .company-badge.global-ai {
          background: #FEE2E2;
          color: #991B1B;
          border: 1px solid #FECACA;
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

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
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

        .download-dropdown {
          position: relative;
        }

        .download-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.5rem 0.85rem;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--foreground);
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: all 150ms ease;
          cursor: pointer;
        }

        .download-btn:hover {
          background: var(--surface-hover);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        .download-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          padding: 4px;
          border-radius: 8px;
          z-index: 100;
          min-width: 140px;
        }

        .download-menu button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--foreground);
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 100ms;
        }

        .download-menu button:hover {
          background: var(--surface-hover);
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

        .tabs-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.35rem;
        }

        .upcoming-subtabs {
          display: flex;
          gap: 0.2rem;
          background: var(--surface-alt);
          padding: 0.2rem;
          border-radius: 6px;
          border: 1px solid var(--card-border);
        }

        .subtab-btn {
          padding: 0.25rem 0.65rem;
          border-radius: 5px;
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-muted);
          transition: all 150ms ease;
        }

        .subtab-btn:hover {
          color: var(--foreground);
          background: var(--tab-hover);
        }

        .subtab-btn.active {
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
          flex-direction: column;
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

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
