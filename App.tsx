import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SearchForm } from './components/SearchForm';
import { GrantCard } from './components/GrantCard';
import { SavedSearchesList } from './components/SavedSearchesList';
import PWAInstallButton from './components/PWAInstallButton';
import { ShareButtonRow } from './components/ShareButtonRow';
import { OnboardingWizard } from './components/OnboardingWizard';
import { MobileNav } from './components/MobileNav';
import { ResourcesSection } from './components/ResourcesSection';
import { findGrants } from './services/geminiService';
import { Grant, SearchParams, GroundingSource, SavedSearch, SearchFormState, EducationLevel, FundingType, TrackedGrant, ApplicationStatus, UserProfile } from './types';
import { AlertTriangle, Info, BookOpen, Bookmark, Check, TrendingUp, ExternalLink, WifiOff, Lightbulb, Heart, Briefcase, Palette, Loader2 } from 'lucide-react';
import TranscendentEyeLogo from './components/TranscendentEyeLogo';

// Lazy Loaded Components
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const ProfileBuilder = React.lazy(() => import('./components/ProfileBuilder').then(module => ({ default: module.ProfileBuilder })));
const CommunityHub = React.lazy(() => import('./components/CommunityHub').then(module => ({ default: module.CommunityHub })));
const BestPracticesList = React.lazy(() => import('./components/BestPracticesList').then(module => ({ default: module.BestPracticesList })));

// Snowfall Component
const Snowfall = () => {
  const flakes = useMemo(() => Array.from({ length: 50 }).map((_, i) => ({
    left: Math.random() * 100,
    animationDuration: Math.random() * 5 + 5, // 5-10s
    animationDelay: Math.random() * 5,
    opacity: Math.random() * 0.5 + 0.3,
    size: Math.random() * 10 + 10,
  })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
      {flakes.map((flake, i) => (
        <div
          key={i}
          className="absolute top-[-20px] text-white animate-snow"
          style={{
            left: `${flake.left}vw`,
            animationDuration: `${flake.animationDuration}s`,
            animationDelay: `${flake.animationDelay}s`,
            opacity: flake.opacity,
            fontSize: `${flake.size}px`,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  // Views
  const [currentView, setCurrentView] = useState<'home' | 'dashboard' | 'profile' | 'community'>('home');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Search Data
  const [grants, setGrants] = useState<Grant[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  
  // Animation States
  const [studentCount, setStudentCount] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  // Persistence Data
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [currentParams, setCurrentParams] = useState<SearchParams | null>(null);
  const [formOverrides, setFormOverrides] = useState<SearchParams | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  const [trackedGrants, setTrackedGrants] = useState<TrackedGrant[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Install Prompt Logic
  const [triggerInstall, setTriggerInstall] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const testimonials = [
    { name: "Maya R.", amount: "$3,200", quote: "Found funding through my local community center!", avatar: "🎨" },
    { name: "Jordan K.", amount: "$2,800", quote: "No essays, no stress. Just free money.", avatar: "🎸" },
    { name: "Alex T.", amount: "$4,100", quote: "Didn't even know these grants existed!", avatar: "💻" }
  ];

  // Monitor Online Status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stats Counter Animation
  useEffect(() => {
    const timer = setInterval(() => {
      setStudentCount(prev => prev < 2400 ? prev + 50 : 2400);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  // Testimonial Rotator
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Load saved data from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Saved Searches
      const saved = localStorage.getItem('grantGenieSavedSearches');
      if (saved) {
        try { setSavedSearches(JSON.parse(saved)); } catch (e) { console.error("Failed to parse saved searches"); }
      }
      
      // Tracked Grants
      const tracked = localStorage.getItem('grantGenieTracked');
      if (tracked) {
        try { setTrackedGrants(JSON.parse(tracked)); } catch (e) { console.error("Failed to parse tracked grants"); }
      }

      // User Profile & Onboarding Check
      const profile = localStorage.getItem('grantGenieProfile');
      const onboardingDone = localStorage.getItem('onboardingComplete');
      
      if (profile) {
        try { setUserProfile(JSON.parse(profile)); } catch (e) { console.error("Failed to parse profile"); }
      } else if (!onboardingDone) {
        // Show onboarding if no profile and flag not set
        setShowOnboarding(true);
      }

      // Check URL parameters for sharing
      const params = new URLSearchParams(window.location.search);
      if (params.has('location') || params.has('keywords')) {
        const urlParams: SearchFormState = {
          location: params.get('location') || '',
          educationLevel: (params.get('educationLevel') as EducationLevel) || 'Undergraduate',
          fieldOfStudy: params.get('fieldOfStudy') || '',
          keywords: params.get('keywords') || '',
          fundingType: (params.get('fundingType') as FundingType) || 'All Niche Grants'
        };
        setFormOverrides(urlParams);
        handleSearch(urlParams, false);
      }
    }
  }, []);

  // Tracking Logic
  const handleTrackGrant = (grant: Grant) => {
    // Create unique ID based on name + amount to avoid duplicates
    const id = btoa(grant.name + grant.amount).slice(0, 16);
    
    // Check if already tracked
    if (trackedGrants.some(g => g.id === id)) return;

    const newTracked: TrackedGrant = {
      ...grant,
      id,
      status: 'saved',
      dateAdded: Date.now()
    };

    const updated = [newTracked, ...trackedGrants];
    setTrackedGrants(updated);
    localStorage.setItem('grantGenieTracked', JSON.stringify(updated));

    // Trigger Install Prompt if this is their first tracked grant
    if (trackedGrants.length === 0) {
      setTriggerInstall(true);
      // Reset trigger after a moment so it doesn't spam
      setTimeout(() => setTriggerInstall(false), 2000);
    }
  };

  const handleUpdateStatus = (id: string, status: ApplicationStatus) => {
    const updated = trackedGrants.map(g => g.id === id ? { ...g, status } : g);
    setTrackedGrants(updated);
    localStorage.setItem('grantGenieTracked', JSON.stringify(updated));
  };

  const handleRemoveTracked = (id: string) => {
    const updated = trackedGrants.filter(g => g.id !== id);
    setTrackedGrants(updated);
    localStorage.setItem('grantGenieTracked', JSON.stringify(updated));
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('grantGenieProfile', JSON.stringify(profile));
    setCurrentView('home'); // Go back to search after saving profile
  };

  const handleCompleteOnboarding = (profile: UserProfile) => {
    handleSaveProfile(profile);
    setShowOnboarding(false);
    localStorage.setItem('onboardingComplete', 'true');
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboardingComplete', 'true');
  };

  const handleSearch = async (searchForm: SearchFormState, updateUrl = true) => {
    if (!isOnline) {
      setError("You are currently offline. Please check your internet connection.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setWarningMessage(null);
    setSources([]);
    setCurrentParams(searchForm);
    
    checkIfSaved(searchForm, savedSearches);

    if (updateUrl && typeof window !== 'undefined') {
      const params = new URLSearchParams();
      params.set('location', searchForm.location);
      params.set('educationLevel', searchForm.educationLevel);
      params.set('fieldOfStudy', searchForm.fieldOfStudy);
      params.set('keywords', searchForm.keywords);
      params.set('fundingType', searchForm.fundingType);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({}, '', newUrl);
    }

    try {
      const result = await findGrants(searchForm, userProfile);
      setGrants(result.grants);
      setSources(result.sources);
      if (result.warning) {
        setWarningMessage(result.warning);
      }
      // Scroll to results after a short delay to allow rendering
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError("We encountered an issue connecting to the AI. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = (params: SearchParams, searches: SavedSearch[]) => {
    const exists = searches.some(
      s => s.location === params.location && 
           s.fieldOfStudy === params.fieldOfStudy && 
           s.educationLevel === params.educationLevel &&
           s.keywords === params.keywords &&
           s.fundingType === params.fundingType
    );
    setIsSaved(exists);
  };

  const handleSaveSearch = () => {
    if (!currentParams) return;

    const newSearch: SavedSearch = {
      ...currentParams,
      id: Date.now().toString(),
      timestamp: Date.now()
    };

    const updatedSearches = [newSearch, ...savedSearches];
    setSavedSearches(updatedSearches);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('grantGenieSavedSearches', JSON.stringify(updatedSearches));
    }
    setIsSaved(true);
  };

  const handleDeleteSearch = (idToDelete: string) => {
    const updatedSearches = savedSearches.filter(search => search.id !== idToDelete);
    setSavedSearches(updatedSearches);
    if (typeof window !== 'undefined') {
      localStorage.setItem('grantGenieSavedSearches', JSON.stringify(updatedSearches));
    }
    if (currentParams) checkIfSaved(currentParams, updatedSearches);
  };

  const handleLoadSavedSearch = (searchToLoad: SavedSearch) => {
    if (!isOnline) {
      setError("Cannot perform new search while offline.");
      return;
    }
    
    const { id, timestamp, ...params } = searchToLoad;
    setFormOverrides(params);
    const searchState: SearchFormState = {
      location: params.location,
      fieldOfStudy: params.fieldOfStudy,
      educationLevel: params.educationLevel as EducationLevel,
      keywords: params.keywords,
      fundingType: params.fundingType || 'All Niche Grants'
    };
    handleSearch(searchState);
    setCurrentView('home');
  };

  const getShareQuote = () => {
    if (!currentParams) return "Find Funding, Not Debt with Grant Genie AI";
    return `Found ${grants.length} non-repayable grants for ${currentParams.fieldOfStudy} in ${currentParams.location}. No loans, just aid.`;
  };
  
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const renderHomeView = () => (
    <>
      <div className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-primary-800 to-slate-900 dark:from-dark-bg dark:via-primary-900 dark:to-dark-bg pb-12 transition-all duration-300 ${!isOnline ? 'pt-8' : ''}`}>
        
        {/* Animated Orbs (Winter colors) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-96 h-96 bg-accent-400/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-white/10 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>
        
        <Header currentView="home" onNavigate={setCurrentView} />
        
        <main className="max-w-6xl mx-auto px-4 pt-20 pb-8 md:py-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            
            {/* Left Side - Hero Content */}
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs border border-white/20 shadow-sm mx-auto lg:mx-0 ring-1 ring-white/10">
                <div className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]"></div>
                <span className="font-bold tracking-wide uppercase text-[10px] text-accent-400">Winter Grant Season is Open</span>
              </div>

              <div>
                <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] mb-2 tracking-tight drop-shadow-md">
                  Discover Your Money <span className="inline-block drop-shadow-lg animate-wings cursor-default hover:scale-125 transition-transform duration-300">🧊</span>
                </h1>
                <p className="text-xl md:text-2xl font-bold text-white/90">
                  Cold Hard Cash. No Debt.
                </p>
              </div>

              <p className="text-base text-white/80 leading-relaxed font-medium max-w-lg mx-auto lg:mx-0">
                Our AI digs through the snow to find grants hiding in your local churches, salons, rotaries, and small businesses.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <div className="bg-white/10 backdrop-blur-lg px-5 py-3 rounded-xl border border-white/20 shadow-lg min-w-[130px] hover:bg-white/15 transition-colors">
                  <div className="text-2xl font-black text-white mb-0.5">{studentCount.toLocaleString()}+</div>
                  <div className="text-xs font-bold text-blue-100 uppercase tracking-wide">Students Funded</div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg px-5 py-3 rounded-xl border border-white/20 shadow-lg min-w-[130px] hover:bg-white/15 transition-colors">
                  <div className="flex items-center justify-center lg:justify-start gap-1 text-2xl font-black text-white mb-0.5">
                    <TrendingUp className="w-5 h-5 text-accent-400" />
                    <span>$2,500</span>
                  </div>
                  <div className="text-xs font-bold text-blue-100 uppercase tracking-wide">Average Grant</div>
                </div>
              </div>

              {/* Testimonial Carousel */}
              <div className="bg-slate-900/40 backdrop-blur-md p-4 rounded-xl border border-white/10 transition-all duration-500 shadow-xl max-w-md mx-auto lg:mx-0 mt-2">
                <div className="flex items-start gap-3">
                  <div className="text-3xl bg-white/10 w-10 h-10 flex items-center justify-center rounded-full shadow-inner ring-1 ring-white/10">{testimonials[currentTestimonial].avatar}</div>
                  <div className="flex-1 text-left">
                    <p className="text-white italic mb-1 font-medium text-sm">"{testimonials[currentTestimonial].quote}"</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white/90 text-xs font-bold">{testimonials[currentTestimonial].name}</span>
                      <span className="text-accent-400 font-bold bg-accent-500/10 px-1.5 py-0.5 rounded text-[10px] border border-accent-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]">{testimonials[currentTestimonial].amount}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2 justify-center">
                  {testimonials.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1 rounded-full transition-all duration-500 ${idx === currentTestimonial ? 'w-6 bg-white' : 'w-1 bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Side - Form */}
            <div className={`w-full relative transition-opacity duration-500 ${!isOnline ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
               <div className="absolute -top-32 -right-32 opacity-20 pointer-events-none hidden lg:block animate-spin-slow mix-blend-overlay">
                 <TranscendentEyeLogo size="hero" background="transparent" colorScheme="cyan" animated={true} />
               </div>
               
               <SearchForm 
                onSearch={handleSearch} 
                isLoading={loading} 
                initialValues={formOverrides}
              />
              {!isOnline && (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="bg-slate-900/80 backdrop-blur-sm text-white px-6 py-4 rounded-xl font-bold flex items-center shadow-2xl border border-white/10">
                     <WifiOff className="w-5 h-5 mr-3" />
                     Connect to Internet to Search
                   </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* RESULTS SECTION */}
      <div ref={resultsRef} className="bg-slate-50 dark:bg-dark-bg relative z-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            
            {error && (
              <div className="mb-12 p-4 bg-warn-50 dark:bg-warn-900/20 border border-warn-100 dark:border-warn-900/30 rounded-xl flex items-center text-warn-800 dark:text-warn-300 max-w-3xl mx-auto font-medium shadow-sm">
                <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                {error}
              </div>
            )}

            {searched && !loading && !error && (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                {/* Profile Boosters Section (Advanced Strategy) */}
                <div className="mb-12 bg-white dark:bg-dark-surface border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                   <div className="flex items-center gap-2 mb-6">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Advanced Strategy: The "Unicorn" Profile
                      </h3>
                   </div>
                   
                   <div className="grid md:grid-cols-3 gap-6">
                      {/* Volunteer */}
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm uppercase tracking-wide">
                            <Heart className="w-4 h-4" />
                            <span>High-Value Volunteer Work</span>
                         </div>
                         <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Committees look for <strong>maturity</strong>. Instead of generic hours, try volunteering at a <strong>Hospice</strong>, <strong>Crisis Hotline</strong>, or <strong>Literacy Center</strong>. These roles show deep emotional intelligence and grit.
                         </p>
                      </div>

                      {/* Jobs */}
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm uppercase tracking-wide">
                            <Briefcase className="w-4 h-4" />
                            <span>Strategic Employment</span>
                         </div>
                         <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Work that proves "hustle" wins. A job in <strong>Manual Labor</strong> (landscaping/construction), <strong>Caregiving</strong>, or as a <strong>Library Page</strong> tells a stronger story of work ethic than generic retail.
                         </p>
                      </div>

                      {/* Hobbies */}
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm uppercase tracking-wide">
                            <Palette className="w-4 h-4" />
                            <span>Narrative Hobbies</span>
                         </div>
                         <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Be the applicant they remember. "The Gamer" is forgettable. "The <strong>Beekeeper</strong>," "The <strong>Car Restorer</strong>," or "The <strong>Urban Gardener</strong>" sticks in a judge's mind during voting.
                         </p>
                      </div>
                   </div>
                </div>

                {warningMessage && (
                  <div className="mb-12 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-start text-blue-900 dark:text-blue-300 max-w-3xl mx-auto font-medium shadow-sm">
                    <Info className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Offline Search Tip</p>
                      <p className="text-sm">{warningMessage}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-end mb-8 gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-[Poppins]">
                      Funding Matches
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                      Found {grants.length} opportunities in {currentParams?.location}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {grants.length > 0 && (
                      <ShareButtonRow 
                        shareUrl={shareUrl} 
                        quote={getShareQuote()} 
                      />
                    )}
                    <button 
                      onClick={handleSaveSearch}
                      disabled={isSaved}
                      className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-bold transition-all text-sm
                        ${isSaved 
                          ? 'bg-success-50 dark:bg-success-900/30 text-success-500 dark:text-success-500 border border-success-500 dark:border-success-500/30 cursor-default' 
                          : 'bg-white dark:bg-dark-surface border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-primary-600 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 shadow-sm hover:shadow-md'}`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          <span>Save Search</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {grants.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-dark-surface rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                    <div className="bg-slate-50 dark:bg-white/5 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 text-5xl">
                       {/* Snowman Mascot for Empty State */}
                       ☃️
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">The Snowman Found Nothing</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Even the Genie couldn't dig this deep. Try broadening your keywords (e.g., just "Arts" instead of "Oil Painting") or expand the location to the county level.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {grants.map((grant, index) => {
                      // Check if this specific grant is tracked
                      const trackId = btoa(grant.name + grant.amount).slice(0, 16);
                      const tracked = trackedGrants.find(t => t.id === trackId);
                      
                      return (
                        <GrantCard 
                          key={index} 
                          grant={grant} 
                          onTrack={handleTrackGrant}
                          isTracked={!!tracked}
                          status={tracked?.status}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Grounding Sources Section */}
                {sources.length > 0 && (
                  <div className="mt-20 bg-white dark:bg-dark-surface rounded-2xl p-8 border border-slate-100 dark:border-white/10 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Verified Sources
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="group p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-transparent hover:border-primary-600 dark:hover:border-primary-400 hover:bg-white dark:hover:bg-[#252525] hover:shadow-lg transition-all duration-300 block"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-primary-700 dark:text-accent-400 bg-blue-50 dark:bg-primary-900/30 px-2 py-1 rounded-md">SOURCE {idx + 1}</span>
                            <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-primary-600 dark:group-hover:text-accent-400 transition-colors" />
                          </div>
                          <p className="text-sm text-slate-900 dark:text-white font-bold truncate mb-1">{source.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{source.uri}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Best Practices Section */}
                <Suspense fallback={<div className="h-40 bg-slate-100 dark:bg-white/5 animate-pulse rounded-xl mt-12" />}>
                  <BestPracticesList />
                </Suspense>

              </div>
            )}
            
            <ResourcesSection />

            {/* Saved Searches (Bottom) */}
            {savedSearches.length > 0 && (
              <div className="mt-24 pt-12 border-t border-slate-200 dark:border-white/10 mb-20 md:mb-0">
                  <SavedSearchesList 
                    searches={savedSearches} 
                    onSelect={handleLoadSavedSearch} 
                    onDelete={handleDeleteSearch} 
                  />
              </div>
            )}
        </div>
      </div>
    </>
  );

  const renderLoader = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
        <p className="text-slate-500 text-sm font-medium">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-accent-500 selection:text-primary-900 bg-slate-50 dark:bg-dark-bg transition-colors duration-300 relative">
      
      {/* Onboarding Overlay */}
      {showOnboarding && (
        <OnboardingWizard 
          onComplete={handleCompleteOnboarding} 
          onSkip={handleSkipOnboarding} 
        />
      )}

      {/* Seasonal Snowfall */}
      <Snowfall />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-slate-900 dark:bg-black text-white text-center py-2 text-sm font-bold flex items-center justify-center animate-in slide-in-from-top-full border-b border-white/10">
          <WifiOff className="w-4 h-4 mr-2" />
          You are currently offline. Cached pages are available.
        </div>
      )}

      {/* View Switcher */}
      {currentView === 'home' && renderHomeView()}
      
      {currentView === 'dashboard' && (
        <>
          <div className="bg-slate-900 pb-20 pt-8 relative overflow-hidden">
             <Header currentView="dashboard" onNavigate={setCurrentView} />
             <div className="max-w-7xl mx-auto px-6 pt-24 text-center relative z-10">
               <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                   {userProfile?.isParentMode ? "Student's Tracker" : "Application Tracker"}
               </h1>
               <p className="text-slate-400">Manage deadlines, essays, and application statuses.</p>
             </div>
          </div>
          <Suspense fallback={renderLoader()}>
            <Dashboard 
              trackedGrants={trackedGrants} 
              onUpdateStatus={handleUpdateStatus} 
              onRemove={handleRemoveTracked} 
            />
          </Suspense>
        </>
      )}

      {currentView === 'community' && (
        <>
          <div className="bg-slate-900 pb-20 pt-8 relative overflow-hidden">
             <Header currentView="community" onNavigate={setCurrentView} />
             <div className="max-w-7xl mx-auto px-6 pt-24 text-center relative z-10">
               <h1 className="text-3xl md:text-5xl font-black text-white mb-4">Community</h1>
               <p className="text-slate-400">Connect with other students and winners.</p>
             </div>
          </div>
          <Suspense fallback={renderLoader()}>
            <CommunityHub />
          </Suspense>
        </>
      )}

      {currentView === 'profile' && (
        <>
          <div className="bg-slate-900 pb-20 pt-8 relative overflow-hidden">
             <Header currentView="profile" onNavigate={setCurrentView} />
             <div className="max-w-7xl mx-auto px-6 pt-24 text-center relative z-10">
               <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
                  {userProfile?.isParentMode ? "Student Profile" : "Your Profile"}
               </h1>
               <p className="text-slate-400">Tell the AI who you are for better matches.</p>
             </div>
          </div>
          <Suspense fallback={renderLoader()}>
            <ProfileBuilder 
              profile={userProfile} 
              onSave={handleSaveProfile} 
            />
          </Suspense>
        </>
      )}

      <Footer />
      <MobileNav currentView={currentView} onNavigate={setCurrentView} />
      <PWAInstallButton triggerRequest={triggerInstall} />
    </div>
  );
};

export default App;