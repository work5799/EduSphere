import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, parseDriveLink } from '../utils/api';
import { 
  ArrowLeft, ChevronDown, ChevronRight, Play, FileText, 
  Volume2, CheckSquare, Square, Menu, X, CheckCircle2, BookOpen
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

  const allLinks = activeLesson && activeLesson.drive_link 
    ? activeLesson.drive_link.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean) 
    : [];
  const mainLink = allLinks[0] || '';
  const parsedDrive = mainLink ? parseDriveLink(mainLink, activeLesson?.type) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col lg:flex-row overflow-hidden h-screen">
      
      {/* Mobile Top Navbar */}
      <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between flex-shrink-0 z-30">
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
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white mb-4 transition font-semibold">
            <ArrowLeft className="h-3.5 w-3.5" />
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
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" 
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
                                  ? 'bg-indigo-600/25 border-indigo-500/30 text-white shadow-lg shadow-indigo-500/5' 
                                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate max-w-[190px]">
                                <span className={isActive ? 'text-indigo-400' : 'text-indigo-500/60 group-hover:text-indigo-400'}>
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
      <main className="flex-grow flex flex-col h-full bg-[#0a0a0f] overflow-y-auto">
        {loading ? (
          <div className="flex-grow flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-555 text-sm">Loading learning player...</p>
          </div>
        ) : activeLesson ? (
          <div className="flex-grow flex flex-col h-full">
            {/* Player Stream Container */}
            <div className="bg-[#0c0c14] border-b border-white/5 p-4 sm:p-6 flex items-center justify-center flex-shrink-0 relative">
              <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative">
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
                  // General link fallback if parser didn't catch it
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
                    <FileText className="h-12 w-12 text-slate-700 mb-3" />
                    <h3 className="text-lg font-bold text-slate-350 mb-1">No stream link provided</h3>
                    <p className="text-slate-500 text-xs max-w-sm">This lesson does not contain a Google Drive media embed link.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lesson Info Details */}
            <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-6 flex-grow">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                  <span className="bg-indigo-950 text-indigo-400 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-indigo-900/40">
                    {activeLesson.type.toUpperCase()} LESSON
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white mt-3.5 tracking-tight leading-tight">
                    {activeLesson.title}
                  </h1>
                </div>

                {/* Complete & Next Navigation */}
                <button
                  onClick={handleMarkCompleteAndNext}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto text-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {completedLessons.includes(activeLesson.id) 
                      ? 'Next Lesson' 
                      : 'Mark Complete & Next'}
                  </span>
                </button>
              </div>

              {/* Lesson Instructions Guide */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lesson Resources & Notes</h3>
                <div className="rounded-2xl p-6 border border-white/5 text-slate-400 leading-relaxed text-xs"
                  style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)'}}>
                  <p className="mb-4">
                    Welcome to this module. Please watch/review the embedded resource from Google Drive above. 
                    If the media fails to load, ensure you are logged into your Google account in this browser window, 
                    or verify the administrator has set the Drive file permissions to "Anyone with the link can view".
                  </p>
                  {allLinks.length > 0 && (
                    <div className="pt-5 border-t border-white/5 space-y-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                        Class Materials / PDF Documents:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allLinks.map((link, idx) => {
                          return (
                            <a 
                              key={idx}
                              href={link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-indigo-600/10 hover:text-white border border-white/5 hover:border-indigo-500/20 text-indigo-400 transition font-bold"
                            >
                              <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                              <div className="flex-grow min-w-0 text-left">
                                <span className="text-xs text-slate-200 block truncate font-black">Attachment #{idx + 1}</span>
                                <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">{link}</span>
                              </div>
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-black px-2.5 py-1 rounded-lg border border-indigo-500/20 whitespace-nowrap">Open</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
