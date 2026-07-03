import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, parseDriveLink } from '../utils/api';
import { 
  ArrowLeft, ChevronDown, ChevronRight, Play, FileText, 
  Volume2, CheckSquare, Square, Menu, X, CheckCircle2, BookOpen,
  HelpCircle, Info, ChevronLeft, Award, ExternalLink
} from 'lucide-react';

interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  type: 'video' | 'audio' | 'pdf';
  drive_link: string;
  sort_order: number;
}

interface Chapter {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
}

export default function StudentCourseViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeInfoTab, setActiveInfoTab] = useState<'notes' | 'resources' | 'help'>('notes');
  
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id]);

  const loadCourseData = async (selectFirst = true) => {
    try {
      const data = await api.getCourse(id!);
      setCourse(data.course);
      
      const sortedChapters = data.chapters || [];
      setChapters(sortedChapters);
      setCompletedLessons(data.completedLessons || []);
      
      // Auto-expand all chapters initially
      const expandMap: Record<string, boolean> = {};
      sortedChapters.forEach((ch: Chapter) => {
        expandMap[ch.id] = true;
      });
      setExpandedChapters(expandMap);

      // Select first lesson if none active and requested
      if (selectFirst && sortedChapters.length > 0) {
        // Find first chapter that has lessons
        const firstChWithLessons = sortedChapters.find((ch: Chapter) => ch.lessons && ch.lessons.length > 0);
        if (firstChWithLessons && firstChWithLessons.lessons.length > 0) {
          setActiveLesson(firstChWithLessons.lessons[0]);
        }
      }
    } catch (err: any) {
      console.error('Error loading course content:', err);
      alert('Failed to load course contents.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  const handleLessonSelect = (lesson: Lesson) => {
    setActiveLesson(lesson);
    // Close sidebar on mobile
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const toggleCompletion = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation(); // Avoid selecting the lesson when clicking checkbox
    const isCompleted = completedLessons.includes(lessonId);
    
    try {
      if (isCompleted) {
        await api.incompleteLesson(lessonId);
        setCompletedLessons(prev => prev.filter(lid => lid !== lessonId));
      } else {
        await api.completeLesson(lessonId);
        setCompletedLessons(prev => [...prev, lessonId]);
      }
    } catch (err: any) {
      console.error('Error toggling completion:', err);
    }
  };

  // Mark active completed and auto-navigate to the next lesson
  const handleMarkCompleteAndNext = async () => {
    if (!activeLesson) return;
    
    const isCompleted = completedLessons.includes(activeLesson.id);
    
    // 1. Mark completed if not already
    if (!isCompleted) {
      try {
        await api.completeLesson(activeLesson.id);
        setCompletedLessons(prev => [...prev, activeLesson.id]);
      } catch (err) {
        console.error('Error marking completed:', err);
      }
    }

    // 2. Find next lesson in the entire course
    let foundCurrent = false;
    let nextL: Lesson | null = null;

    for (const ch of chapters) {
      for (const les of ch.lessons) {
        if (foundCurrent) {
          nextL = les;
          break;
        }
        if (les.id === activeLesson.id) {
          foundCurrent = true;
        }
      }
      if (nextL) break;
    }

    // 3. Navigate to next lesson, or alert course complete!
    if (nextL) {
      setActiveLesson(nextL);
    } else {
      alert("Congratulations! You've reached the end of this course.");
    }
  };

  // Get total lessons
  const totalLessonsCount = chapters.reduce((sum, ch) => sum + (ch.lessons?.length || 0), 0);
  const completedCount = completedLessons.length;
  const progressPercent = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : 0;

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'audio':
        return <Volume2 className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getPrevNextLessons = () => {
    if (!activeLesson) return { prev: null, next: null };
    let prev: Lesson | null = null;
    let next: Lesson | null = null;
    let foundCurrent = false;

    for (const ch of chapters) {
      if (!ch.lessons) continue;
      for (const les of ch.lessons) {
        if (les.id === activeLesson.id) {
          foundCurrent = true;
          continue;
        }
        if (!foundCurrent) {
          prev = les;
        } else {
          next = les;
          break;
        }
      }
      if (next) break;
    }
    return { prev, next };
  };

  const { prev: prevLesson, next: nextLesson } = getPrevNextLessons();

  const allLinks = activeLesson && activeLesson.drive_link 
    ? activeLesson.drive_link.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean) 
    : [];
  const mainLink = allLinks[0] || '';
  const parsedDrive = mainLink ? parseDriveLink(mainLink) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col lg:flex-row overflow-hidden h-screen">
      
      {/* Mobile Top Navbar */}
      <header className="lg:hidden bg-[#0d0d15] border-b border-white/5 px-4 py-3 flex items-center justify-between flex-shrink-0 z-30">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <span className="font-bold text-sm text-slate-200 truncate max-w-[180px]">
          {course?.title}
        </span>
        <Link to="/dashboard" className="text-indigo-400 text-xs font-bold flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          <span>Dashboard</span>
        </Link>
      </header>

      {/* Sidebar - Course Tree Outline */}
      <aside 
        className={`fixed inset-y-0 left-0 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-0'
        } lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-40 bg-[#0f0f1a] border-r border-white/5 flex flex-col w-80 flex-shrink-0 h-full`}
        style={{ display: sidebarOpen || window.innerWidth >= 1024 ? 'flex' : 'none' }}
      >
        {/* Brand/Return header */}
        <div className="p-5 border-b border-white/5 flex-shrink-0">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white mb-4 transition font-semibold group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
          <h2 className="font-black text-base text-white leading-snug line-clamp-2">
            {course?.title}
          </h2>
        </div>

        {/* Progress Tracker */}
        <div className="px-5 py-4 border-b border-white/5 bg-slate-950/20 flex-shrink-0">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-400">Course Progress</span>
            <span className="text-indigo-400">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-semibold">
            {completedCount} of {totalLessonsCount} items completed
          </p>
        </div>

        {/* Navigation list */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {chapters.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No modules set up yet.</p>
          ) : (
            chapters.map((ch, chIdx) => {
              const isExpanded = !!expandedChapters[ch.id];
              return (
                <div key={ch.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.01]">
                  {/* Chapter title header bar */}
                  <button
                    onClick={() => toggleChapter(ch.id)}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 text-left transition text-xs font-black text-slate-200 border-b border-white/5 cursor-pointer"
                  >
                    <span className="truncate max-w-[210px]">
                      Module {chIdx + 1}: {ch.title}
                    </span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </button>

                  {/* Lessons list */}
                  {isExpanded && (
                    <div className="p-1.5 space-y-1 bg-slate-950/40">
                      {ch.lessons && ch.lessons.length > 0 ? (
                        ch.lessons.map((les) => {
                          const isActive = activeLesson?.id === les.id;
                          const isCompleted = completedLessons.includes(les.id);
                          return (
                            <div
                              key={les.id}
                              onClick={() => handleLessonSelect(les)}
                              className={`group w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                                isActive 
                                  ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-200 shadow-lg shadow-indigo-500/5' 
                                  : 'text-slate-400 border-transparent hover:text-slate-250 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate max-w-[190px]">
                                <span className={isActive ? 'text-indigo-400' : 'text-indigo-500/50 group-hover:text-indigo-400'}>
                                  {getLessonIcon(les.type)}
                                </span>
                                <span className="truncate">{les.title}</span>
                              </div>
                              
                              {/* Completion checkbox */}
                              <button
                                onClick={(e) => toggleCompletion(e, les.id)}
                                className={`p-1 rounded transition-colors ${
                                  isActive 
                                    ? 'hover:bg-indigo-650/40 text-white' 
                                    : 'hover:bg-white/5 text-slate-500 hover:text-slate-350'
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckSquare className="h-4 w-4 text-emerald-400" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[10px] text-slate-600 text-center py-2">No lessons in this module.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content Player Area */}
      <main className="flex-grow flex flex-col h-full bg-[#07070a] overflow-y-auto">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-555 text-sm font-semibold">Loading learning player...</p>
          </div>
        ) : activeLesson ? (
          <div className="flex-grow flex flex-col h-full animate-fadeIn">
            
            {/* Top Navigation Bar inside player content */}
            <div className="bg-[#0b0b12] border-b border-white/5 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-xl border border-indigo-500/20">
                  {activeLesson.type.toUpperCase()}
                </span>
                <span className="text-sm font-extrabold text-white hidden sm:inline truncate max-w-[280px]">
                  {activeLesson.title}
                </span>
              </div>
              
              {/* Navigation controls */}
              <div className="flex items-center gap-2">
                <button
                  disabled={!prevLesson}
                  onClick={() => setActiveLesson(prevLesson)}
                  className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/5 hover:border-indigo-500/30 text-slate-350 disabled:opacity-40 hover:text-white disabled:hover:border-white/5 disabled:hover:text-slate-355 transition text-xs font-bold bg-white/[0.02] cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={!nextLesson}
                  onClick={() => setActiveLesson(nextLesson)}
                  className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/5 hover:border-indigo-500/30 text-slate-355 disabled:opacity-40 hover:text-white disabled:hover:border-white/5 disabled:hover:text-slate-355 transition text-xs font-bold bg-white/[0.02] cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Player Stream Container */}
            <div className="bg-[#09090f]/60 p-4 sm:p-8 flex items-center justify-center flex-shrink-0 relative border-b border-white/5">
              <div className="w-full max-w-4xl aspect-video bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl shadow-indigo-500/5 relative">
                {parsedDrive ? (
                  <iframe
                    src={parsedDrive.embedUrl}
                    width="100%"
                    height="100%"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="border-0"
                    title={activeLesson.title}
                  />
                ) : mainLink ? (
                  <iframe
                    src={mainLink}
                    width="100%"
                    height="100%"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    className="border-0"
                    title={activeLesson.title}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                    <FileText className="h-12 w-12 text-slate-700 mb-3 animate-pulse" />
                    <h3 className="text-lg font-bold text-slate-350 mb-1">No stream link provided</h3>
                    <p className="text-slate-500 text-xs max-w-sm">This lesson does not contain a Google Drive media embed link.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lesson Info Details & Interactive Tab Section */}
            <div className="max-w-4xl mx-auto w-full p-6 sm:p-8 space-y-6 flex-grow">
              
              {/* Header and completion bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Class Lesson Details</span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight leading-snug">
                    {activeLesson.title}
                  </h1>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMarkCompleteAndNext}
                    className={`font-bold text-xs py-3.5 px-6 rounded-2xl transition duration-300 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto ${
                      completedLessons.includes(activeLesson.id)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {completedLessons.includes(activeLesson.id) 
                        ? 'Lesson Completed' 
                        : 'Mark Complete'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tabs for Notes, Resources, Help */}
              <div className="flex border-b border-white/5">
                {[
                  { id: 'notes', label: 'Overview & Guide', icon: Info },
                  { id: 'resources', label: `Attachments (${allLinks.length})`, icon: FileText },
                  { id: 'help', label: 'Troubleshoot', icon: HelpCircle }
                ].map(tab => {
                  const isActive = activeInfoTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveInfoTab(tab.id as any)}
                      className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black transition cursor-pointer ${
                        isActive
                          ? 'border-indigo-500 text-white'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="py-2">
                
                {/* 1. Overview Tab */}
                {activeInfoTab === 'notes' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-405 uppercase tracking-widest">Class Description & Guidelines</h3>
                    <div className="rounded-2xl p-6 border border-white/5 text-slate-400 leading-relaxed text-xs"
                      style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)'}}>
                      <p className="mb-4 text-slate-300">
                        Welcome to this module. Please watch/review the embedded resource from Google Drive above. 
                        Follow the class outline, prepare your study notes, and check the attachments section for downloadable class PDF sheets or exercises.
                      </p>
                      <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-slate-350 text-[11px] flex gap-3">
                        <Award className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                        <div>
                          <strong>Keep track of your study path:</strong> Remember to mark the lesson as completed once you've finished studying to update your course progress gauge.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Resources Tab */}
                {activeInfoTab === 'resources' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-405 uppercase tracking-widest">Downloadable Files & Materials</h3>
                    {allLinks.length === 0 ? (
                      <div className="text-center py-10 rounded-2xl border border-white/5 bg-white/[0.005]">
                        <p className="text-slate-500 text-xs">No extra resources or PDFs are attached to this lesson.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allLinks.map((link, idx) => (
                          <a 
                            key={idx}
                            href={link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-indigo-650/15 hover:text-white border border-white/5 hover:border-indigo-500/20 text-indigo-400 transition font-bold group"
                          >
                            <FileText className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                            <div className="flex-grow min-w-0 text-left">
                              <span className="text-xs text-slate-200 block truncate font-black">Attachment #{idx + 1}</span>
                              <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">{link}</span>
                            </div>
                            <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Troubleshoot Tab */}
                {activeInfoTab === 'help' && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-405 uppercase tracking-widest">Troubleshooting Video / Player Problems</h3>
                    <div className="rounded-2xl p-6 border border-white/5 text-slate-400 leading-relaxed text-xs space-y-4"
                      style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)'}}>
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-200 text-xs">📹 Video showing "Access Denied" or Google Login Page?</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Google Drive's video player sometimes restricts embedded streaming if you are logged out of your Google accounts. 
                          Please log in to your Google Account (Gmail) in another tab in this browser window, and refresh this page.
                        </p>
                      </div>
                      <hr className="border-white/5" />
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-200 text-xs">🔒 Make sure files are shared publicly</h4>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          If logging in does not work, ensure the administrator has shared the Google Drive video file or folder with 
                          <strong>"Anyone with the link can view"</strong> permissions.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <BookOpen className="h-12 w-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-355 mb-1">No lesson active</h3>
            <p className="text-slate-550 text-xs">Please select a lesson from the module tree outline on the left.</p>
          </div>
        )}
      </main>
    </div>
  );
}
