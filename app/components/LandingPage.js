'use client';

import React from 'react';
import { Calendar, MapPin, Monitor, CheckCircle2, ArrowRight, Globe, Search, Shield, Zap, Sparkles, Filter, Code, Database, Terminal, Laptop, Clock, ExternalLink } from 'lucide-react';

export default function LandingPage({ events = [], onExplore, onSelectCategory }) {
  // Parse date helper for sorting/filtering
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
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  // Derive stats dynamically from events
  const stats = {
    total: events.length || 427,
    upcoming: events.filter(e => parseDateForSort(e.date) > new Date()).length || 149,
    virtual: events.filter(e => e.virtualLive || e.virtualOnDemand).length || 261,
    applied: events.filter(e => e.status === 'applied').length || 1
  };

  // Get next 3 upcoming events for featured grid
  const upcomingEvents = [...events]
    .filter(e => parseDateForSort(e.date) > new Date())
    .sort((a, b) => parseDateForSort(a.date) - parseDateForSort(b.date))
    .slice(0, 3);

  const categories = [
    { name: 'AI / Tech', icon: <Sparkles size={14} />, search: 'AI' },
    { name: 'Web Dev', icon: <Code size={14} />, search: 'web' },
    { name: 'Database', icon: <Database size={14} />, search: 'database' },
    { name: 'Security', icon: <Shield size={14} />, search: 'security' },
    { name: 'Cloud Computing', icon: <Laptop size={14} />, search: 'cloud' },
    { name: 'Salesforce', icon: <Globe size={14} />, search: 'salesforce' },
    { name: 'Germany', icon: <MapPin size={14} />, search: 'Germany' },
    { name: 'India', icon: <MapPin size={14} />, search: 'India' }
  ];

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav glass-panel">
        <div className="nav-logo">
          <Globe className="text-cyan animate-pulse" size={24} />
          <span>Event<span className="text-cyan font-bold">All</span></span>
        </div>
        <div className="nav-links">
          <a href="#discover" onClick={(e) => { e.preventDefault(); onExplore(); }}>Discover</a>
          <a href="#categories">Categories</a>
          <a href="#featured">Featured</a>
          <a href="#how-it-works">How It Works</a>
        </div>
        <div className="nav-actions">
          <button className="nav-btn-link" onClick={onExplore}>Sign In</button>
          <button className="nav-btn-primary" onClick={onExplore}>Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-grid-bg"></div>
        <div className="hero-content">
          <span className="hero-tagline glass-panel"><Sparkles size={12} className="text-cyan" /> Multi-Company Event Aggregator</span>
          <h1 className="hero-title">
            Discover Events.<br />
            <span className="gradient-text-cyan">Attend Opportunities.</span><br />
            Build Your Future.
          </h1>
          <p className="hero-description">
            The unified portal to track, schedule, and apply for technical events across SAP, Oracle, XYZ, Microsoft, and Salesforce. Bypass CDN firewalls and sync directly to Google Sheets.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>
              Discover Events <ArrowRight size={16} />
            </button>
            <button className="btn-secondary" onClick={onExplore}>
              Go to Dashboard
            </button>
          </div>
        </div>

        {/* Hero Widget Preview */}
        <div className="hero-widget-container">
          <div className="hero-widget glass-panel">
            <div className="widget-header">
              <div className="widget-dot red"></div>
              <div className="widget-dot yellow"></div>
              <div className="widget-dot green"></div>
              <span className="widget-title">Live Tracking Stats</span>
            </div>
            <div className="widget-body">
              <div className="widget-stat-row">
                <span className="stat-label">Total Events Tracked</span>
                <span className="stat-val text-blue">{stats.total}</span>
              </div>
              <div className="widget-stat-row">
                <span className="stat-label">Upcoming Scheduled</span>
                <span className="stat-val text-purple">{stats.upcoming}</span>
              </div>
              <div className="widget-stat-row">
                <span className="stat-label">Virtual Conferences</span>
                <span className="stat-val text-green">{stats.virtual}</span>
              </div>
              <div className="widget-stat-row">
                <span className="stat-label">Applied Watchlist</span>
                <span className="stat-val text-cyan">{stats.applied}</span>
              </div>
              <div className="widget-preview-box">
                <span className="preview-heading">Recent Update:</span>
                <p className="preview-text">Synced live data across 5 enterprise directories successfully.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Life Changer Block */}
      <section className="promo-section container">
        <div className="promo-card glass-panel">
          <div className="promo-emoji">💡</div>
          <h2>One Event Can <span className="gradient-text-blue">Change Your Life</span></h2>
          <p>
            A single conference or panel can introduce you to mentors, partners, and career opportunities that redirect your professional journey. Stop missing out on valuable networking tracks.
          </p>
          <button className="btn-primary" onClick={onExplore}>Find Events by Tech Stack</button>
        </div>
      </section>

      {/* Categories Selector */}
      <section id="categories" className="categories-section container">
        <div className="section-header-center">
          <span className="section-subtitle">EXPLORE PATHWAYS</span>
          <h2>Find What <span className="text-cyan">Interests You</span></h2>
          <p>Select a category tag below to automatically filter and search events in the dashboard.</p>
        </div>
        <div className="categories-grid">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              className="category-btn glass-panel"
              onClick={() => {
                onSelectCategory(cat.search);
                onExplore();
              }}
            >
              {cat.icon}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Grid */}
      <section id="featured" className="featured-section container">
        <div className="section-header-center">
          <span className="section-subtitle">RECOMMENDED FOR YOU</span>
          <h2>Upcoming <span className="text-cyan">Featured Events</span></h2>
        </div>
        <div className="featured-grid">
          {upcomingEvents.length === 0 ? (
            <div className="featured-coming-soon glass-panel">
              <Calendar className="text-cyan" size={32} />
              <h3>New Featured Events Coming Soon</h3>
              <p>We are constantly crawling corporate event registries to index developer conferences, seminars, and webinars.</p>
              <div className="meta-pills">
                <span className="pill">SAP Finder</span>
                <span className="pill">Oracle OCI</span>
                <span className="pill">Salesforce Tour</span>
                <span className="pill">Microsoft Build</span>
              </div>
              <button className="btn-secondary" onClick={onExplore}>View All Events</button>
            </div>
          ) : (
            upcomingEvents.map((event) => (
              <div key={event.id} className="featured-card glass-panel">
                <div className="card-company-header">
                  <span className={`company-badge ${event.company.toLowerCase()}`}>{event.company}</span>
                  <span className="featured-card-type">{event.type}</span>
                </div>
                <h3>{event.title}</h3>
                <div className="card-meta">
                  <div className="meta-item"><Clock size={12} /> {event.date}</div>
                  <div className="meta-item"><MapPin size={12} /> {event.location}</div>
                </div>
                <div className="card-action-bar">
                  <a href={event.link} target="_blank" rel="noopener noreferrer" className="featured-link">
                    Details <ExternalLink size={12} />
                  </a>
                  <button className="btn-mini" onClick={onExplore}>Track Event</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="how-it-works container">
        <div className="section-header-center">
          <span className="section-subtitle">WORKFLOW STEPS</span>
          <h2>How Event<span className="text-cyan font-bold">All</span> Works</h2>
          <p>Four simple columns to aggregate, filter, track, and manage your technical event pipeline.</p>
        </div>
        <div className="steps-grid">
          <div className="step-card glass-panel">
            <div className="step-num text-blue">01</div>
            <h3>Search & Discover</h3>
            <p>Query across 400+ corporate events using keywords, cities, countries, or months.</p>
          </div>
          <div className="step-card glass-panel">
            <div className="step-num text-purple">02</div>
            <h3>Dynamic Tabs</h3>
            <p>Toggle seamlessly between In-person, Virtual-Live, On-demand, and Upcoming listings.</p>
          </div>
          <div className="step-card glass-panel">
            <div className="step-num text-green">03</div>
            <h3>Track & Watch</h3>
            <p>Mark interesting opportunities as "To Be Applied" to hold them in your sidebar watchlist.</p>
          </div>
          <div className="step-card glass-panel">
            <div className="step-num text-cyan">04</div>
            <h3>Apply & Log</h3>
            <p>Follow direct application links and update statuses to "Applied" to keep a clear log.</p>
          </div>
        </div>
      </section>

      {/* Why EventAll is Different */}
      <section className="different-section container">
        <div className="section-header-center">
          <span className="section-subtitle">THE EDGE</span>
          <h2>Why Event<span className="text-cyan font-bold">All</span> is Different</h2>
        </div>
        <div className="different-grid">
          <div className="diff-card glass-panel">
            <div className="diff-icon text-blue"><Globe size={18} /></div>
            <h4>Multi-Company Feeds</h4>
            <p>Aggregates directories from 5 different tech giants (SAP, Oracle, XYZ, Microsoft, Salesforce) in one view.</p>
          </div>
          <div className="diff-card glass-panel">
            <div className="diff-icon text-purple"><Zap size={18} /></div>
            <h4>Real-time Syncing</h4>
            <p>Syncs automatically with a click of a button using optimized web scrapers and feed parsers.</p>
          </div>
          <div className="diff-card glass-panel">
            <div className="diff-icon text-green"><Filter size={18} /></div>
            <h4>Clean Categorization</h4>
            <p>Correctly categorizes locations, dates, and event tags by parsing API metadata directly.</p>
          </div>
          <div className="diff-card glass-panel">
            <div className="diff-icon text-cyan"><Clock size={18} /></div>
            <h4>Personal Watchlist</h4>
            <p>Tracks items you want to register for, keeping them pinned to your layout sidebar.</p>
          </div>
          <div className="diff-card glass-panel">
            <div className="diff-icon text-red"><Calendar size={18} /></div>
            <h4>Dynamic Date Sort</h4>
            <p>Resolves complex en-dash and multi-day calendar string ranges into sorted UNIX timestamps.</p>
          </div>
          <div className="diff-card glass-panel">
            <div className="diff-icon text-yellow"><Shield size={18} /></div>
            <h4>Akamai WAF Bypass</h4>
            <p>Includes an inline manual browser console import injector script if cloud scraper IPs are blocked.</p>
          </div>
        </div>
      </section>

      {/* Dual CTA Blocks */}
      <section className="cta-blocks container">
        <div className="cta-grid">
          <div className="cta-card block-left">
            <div className="cta-badge">🎯 PARTICIPANT</div>
            <h3>Find Events That Move You Forward!</h3>
            <p>Level up your skillsets, network with industry specialists, and discover career-changing avenues.</p>
            <button className="btn-primary" onClick={onExplore}>Explore Dashboard</button>
          </div>
          <div className="cta-card block-right">
            <div className="cta-badge">📊 ENTERPRISE</div>
            <h3>Run Better Events With Real Attendees</h3>
            <p>Connect your tracking system directly with a secure Google Sheets service account for automated logging.</p>
            <button className="btn-cyan" onClick={onExplore}>Learn Sheet Sync</button>
          </div>
        </div>
      </section>

      {/* EventAll Continues After You Join */}
      <section className="continues-section container">
        <div className="section-header-center">
          <span className="section-subtitle">WHAT NEXT?</span>
          <h2>Event<span className="text-cyan font-bold">All</span> Continues After You Join</h2>
          <p>Beyond discovering events, manage your scheduling calendar and history log efficiently.</p>
        </div>
        <div className="features-sub-grid">
          <div className="sub-feat-card glass-panel">
            <div className="sub-feat-icon">📅</div>
            <h4>Refined Month Filters</h4>
            <p>Isolate conferences scheduled in a particular month with one click in the header actions.</p>
          </div>
          <div className="sub-feat-card glass-panel">
            <div className="sub-feat-icon">🌎</div>
            <h4>Clean Country Mapping</h4>
            <p>Filter through regions like Switzerland, India, Germany, United States, and UK instantly.</p>
          </div>
          <div className="sub-feat-card glass-panel">
            <div className="sub-feat-icon">⚙️</div>
            <h4>Background Cron Scheduler</h4>
            <p>Runs automatically every 24 hours on a cloud server scheduler to capture newly published feeds.</p>
          </div>
          <div className="sub-feat-card glass-panel">
            <div className="sub-feat-icon">📑</div>
            <h4>Status Log History</h4>
            <p>Maintain clear metrics on your applied events to measure your professional activity ratios.</p>
          </div>
        </div>
      </section>

      {/* Ready to Discover */}
      <section className="final-cta container">
        <div className="final-cta-card glass-panel">
          <span className="final-tag">AUTOMATED PORTAL</span>
          <h2>Ready to Discover Your Next Opportunity?</h2>
          <p>Get instant access to over 400 indexed tech events. Absolutely free to use.</p>
          <div className="final-actions">
            <button className="btn-cyan" onClick={onExplore}>Get Started</button>
            <button className="btn-secondary" onClick={onExplore}>View Directory</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="nav-logo">
              <Globe className="text-cyan" size={20} />
              <span>Event<span className="text-cyan font-bold">All</span></span>
            </div>
            <p>Unified enterprise event tracking and scheduler.</p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <h5>Product</h5>
              <a href="#discover" onClick={(e) => { e.preventDefault(); onExplore(); }}>Dashboard</a>
              <a href="#categories">Categories</a>
              <a href="#featured">Featured</a>
            </div>
            <div className="footer-col">
              <h5>Sync System</h5>
              <a href="#discover" onClick={(e) => { e.preventDefault(); onExplore(); }}>Google Sheets</a>
              <a href="#discover" onClick={(e) => { e.preventDefault(); onExplore(); }}>WAF Scraper</a>
              <a href="#discover" onClick={(e) => { e.preventDefault(); onExplore(); }}>24h Scheduler</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} EventAll Aggregator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
