import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDirectImageUrl } from '../utils/api';
import { 
  GraduationCap, LogOut, Users, BookOpen, UserCheck, 
  BarChart3, Plus, Edit2, Trash2, Check, X, FileText, 
  Play, Volume2, ArrowLeft, RefreshCw, FolderPlus, FilePlus,
  Loader
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  phone: string;
  created_at: string;
}

interface CourseDistribution {
  id: string;
  title: string;
  category: string;
  enrollment_count: number;
}

interface Analytics {
  totalStudents: number;
  pendingStudents: number;
  totalCourses: number;
  totalEnrollments: number;
  coursesDistribution: CourseDistribution[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  price: number;
}

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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'courses'>(() => {
    const saved = localStorage.getItem('edusphere_admin_tab');
    return (saved as any) || 'overview';
  });
  
  // Data States
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Active course outline editor state
  const [activeOutlineCourse, setActiveOutlineCourse] = useState<Course | null>(null);
  const [outlineChapters, setOutlineChapters] = useState<Chapter[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(false);

  // Forms / Modal States
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseThumbnail, setCourseThumbnail] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  const [coursePrice, setCoursePrice] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Outline builder form states
  const [showChapterFormFor, setShowChapterFormFor] = useState<string | null>(null); // 'new' or chapterId for editing
  const [chapterTitle, setChapterTitle] = useState('');
  const [showLessonFormFor, setShowLessonFormFor] = useState<{ chapterId: string; lessonId: string | null } | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<'video' | 'audio' | 'pdf'>('video');
  const [lessonLink, setLessonLink] = useState('');

  useEffect(() => {
    // Auth guard
    const userJson = localStorage.getItem('edusphere_user');
    if (!userJson) {
      navigate('/auth');
      return;
    }
    const cachedUser = JSON.parse(userJson);
    if (cachedUser.role !== 'admin') {
      navigate('/');
      return;
    }

    loadAdminData();
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem('edusphere_admin_tab', activeTab);
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [analyticData, studentsData, coursesData] = await Promise.all([
        api.getAnalytics(),
        api.getStudents(),
        api.getCourses()
      ]);
      setAnalytics(analyticData.analytics);
      setStudents(studentsData.students || []);
      setCourses(coursesData.courses || []);
    } catch (err) {
      console.error('Error loading admin panel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  // Student Actions
  const handleStudentStatus = async (studentId: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await api.updateStudentStatus(studentId, status);
      // Update local state dynamically
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
      // Refresh analytics in background
      const analyticData = await api.getAnalytics();
      setAnalytics(analyticData.analytics);
    } catch (err: any) {
      alert(err.message || 'Failed to update student status.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await api.uploadThumbnail(base64, file.name, file.type);
          setCourseThumbnail(res.url);
        } catch (err: any) {
          alert(err.message || 'Image upload failed.');
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        alert('File reading failed.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || 'Image upload failed.');
      setUploading(false);
    }
  };

  // Course Add / Edit Action
  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle) return;

    try {
      const payload = {
        title: courseTitle,
        description: courseDescription,
        thumbnail: courseThumbnail,
        category: courseCategory || 'General',
        price: Number(coursePrice) || 0
      };

      if (editCourseId) {
        await api.updateCourse(editCourseId, payload);
      } else {
        await api.createCourse(payload);
      }

      // Reset
      setShowCourseModal(false);
      setEditCourseId(null);
      setCourseTitle('');
      setCourseDescription('');
      setCourseThumbnail('');
      setCourseCategory('');
      setCoursePrice(0);

      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Course save failed.');
    }
  };

  const handleEditCourseClick = (course: Course) => {
    setEditCourseId(course.id);
    setCourseTitle(course.title);
    setCourseDescription(course.description);
    setCourseThumbnail(course.thumbnail);
    setCourseCategory(course.category);
    setCoursePrice(course.price);
    setShowCourseModal(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course and all its contents?')) return;
    try {
      await api.deleteCourse(courseId);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Delete failed.');
    }
  };

  // --- OUTLINE BUILDER ACTIONS ---

  const handleOpenOutline = async (course: Course) => {
    setActiveOutlineCourse(course);
    setOutlineLoading(true);
    try {
      const data = await api.getCourse(course.id);
      setOutlineChapters(data.chapters || []);
    } catch (err) {
      console.error(err);
      alert('Error fetching course structure.');
    } finally {
      setOutlineLoading(false);
    }
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterTitle || !activeOutlineCourse) return;

    try {
      if (showChapterFormFor === 'new') {
        const order = outlineChapters.length;
        await api.createChapter(activeOutlineCourse.id, { title: chapterTitle, sort_order: order });
      } else {
        // Editing
        const chId = showChapterFormFor;
        if (chId) {
          const currentCh = outlineChapters.find(ch => ch.id === chId);
          await api.updateChapter(chId, { title: chapterTitle, sort_order: currentCh?.sort_order || 0 });
        }
      }

      setChapterTitle('');
      setShowChapterFormFor(null);
      
      // Reload outline
      await handleOpenOutline(activeOutlineCourse);
    } catch (err: any) {
      alert(err.message || 'Failed to save chapter.');
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm('Delete this chapter and all its lessons?')) return;
    try {
      await api.deleteChapter(chapterId);
      await handleOpenOutline(activeOutlineCourse!);
    } catch (err: any) {
      alert(err.message || 'Delete chapter failed.');
    }
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle || !showLessonFormFor) return;

    const { chapterId, lessonId } = showLessonFormFor;

    try {
      const parentChapter = outlineChapters.find(ch => ch.id === chapterId);
      const order = parentChapter ? (parentChapter.lessons?.length || 0) : 0;
      const payload = {
        title: lessonTitle,
        type: lessonType,
        drive_link: lessonLink,
        sort_order: lessonId ? parentChapter?.lessons.find(l => l.id === lessonId)?.sort_order || 0 : order
      };

      if (lessonId) {
        // Edit Lesson
        await api.updateLesson(lessonId, payload);
      } else {
        // Create Lesson
        await api.createLesson(chapterId, payload);
      }

      // Reset
      setLessonTitle('');
      setLessonLink('');
      setLessonType('video');
      setShowLessonFormFor(null);

      await handleOpenOutline(activeOutlineCourse!);
    } catch (err: any) {
      alert(err.message || 'Save lesson failed.');
    }
  };

  const handleEditLessonSetup = (chapterId: string, lesson: Lesson) => {
    setLessonTitle(lesson.title);
    setLessonType(lesson.type);
    setLessonLink(lesson.drive_link);
    setShowLessonFormFor({ chapterId, lessonId: lesson.id });
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    try {
      await api.deleteLesson(lessonId);
      await handleOpenOutline(activeOutlineCourse!);
    } catch (err: any) {
      alert(err.message || 'Delete lesson failed.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('edusphere_token');
    localStorage.removeItem('edusphere_user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex">
      
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-40 border-r border-white/5"
        style={{background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a14 100%)'}}>
        
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">EduSphere</span>
            <p className="text-[10px] text-slate-500 font-medium">Admin Panel</p>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3, badge: null },
            { id: 'students', label: 'Students', icon: Users, badge: analytics?.pendingStudents || null },
            { id: 'courses', label: 'Courses', icon: BookOpen, badge: null },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveOutlineCourse(null);
                setActiveTab(item.id as any);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent'
              }`}
            >
              <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-indigo-400' : ''}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="bg-amber-500 text-black text-[9px] font-black h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/5 space-y-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/5"
          style={{background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)'}}>
          <div>
            <h1 className="text-lg font-black text-white">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'students' && 'Student Management'}
              {activeTab === 'courses' && 'Course Management'}
              {activeOutlineCourse && `📚 ${activeOutlineCourse.title}`}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'overview' && 'Monitor your platform analytics'}
              {activeTab === 'students' && 'Manage student approvals and access'}
              {activeTab === 'courses' && 'Create and manage course content'}
            </p>
          </div>
          {/* Mobile nav */}
          <div className="flex items-center gap-2 lg:hidden">
            {(['overview','students','courses'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveOutlineCourse(null); setActiveTab(tab); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition border ${activeTab === tab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/5 text-slate-400 border-transparent'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="hidden lg:flex items-center gap-2 text-slate-400 hover:text-rose-400 transition text-sm cursor-pointer">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6">

          {/* ── COURSE OUTLINE BUILDER ── */}
          {activeOutlineCourse ? (
            <div className="max-w-4xl mx-auto">
              <button onClick={() => setActiveOutlineCourse(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition font-medium mb-6 cursor-pointer">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Courses</span>
              </button>

              <div className="mb-6 p-6 rounded-2xl border border-indigo-500/20"
                style={{background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))'}}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">Outline Builder</span>
                    <h2 className="text-2xl font-black text-white mt-2">{activeOutlineCourse.title}</h2>
                    <p className="text-slate-400 text-sm mt-1">Manage chapters and lessons with Google Drive media links.</p>
                  </div>
                </div>
              </div>

              {outlineLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="h-10 w-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4" />
                  <p className="text-slate-500 text-sm">Loading modules...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {showChapterFormFor === null && (
                    <button
                      onClick={() => { setShowChapterFormFor('new'); setChapterTitle(''); }}
                      className="w-full py-3.5 px-6 rounded-xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 text-indigo-400 hover:text-indigo-300 font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FolderPlus className="h-5 w-5" />
                      Add New Chapter
                    </button>
                  )}

                  {showChapterFormFor !== null && (
                    <form onSubmit={handleAddChapter} className="p-5 rounded-xl border border-indigo-500/30 space-y-3"
                      style={{background:'rgba(99,102,241,0.05)'}}>
                      <h3 className="font-bold text-slate-200 text-sm">
                        {showChapterFormFor === 'new' ? '➕ New Chapter' : '✏️ Rename Chapter'}
                      </h3>
                      <div className="flex gap-3">
                        <input type="text" required placeholder="Chapter title..."
                          value={chapterTitle} onChange={e => setChapterTitle(e.target.value)}
                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
                        />
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl cursor-pointer text-sm">Save</button>
                        <button type="button" onClick={() => setShowChapterFormFor(null)}
                          className="bg-slate-800 text-slate-400 py-2.5 px-4 rounded-xl cursor-pointer text-sm">Cancel</button>
                      </div>
                    </form>
                  )}

                  {outlineChapters.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
                      <FolderPlus className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No chapters yet. Add a chapter to get started.</p>
                    </div>
                  ) : (
                    outlineChapters.map((ch, idx) => (
                      <div key={ch.id} className="rounded-2xl border border-slate-800 overflow-hidden"
                        style={{background:'rgba(15,15,26,0.8)'}}>
                        <div className="flex items-center justify-between p-4 border-b border-slate-800"
                          style={{background:'rgba(255,255,255,0.02)'}}>
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-black flex items-center justify-center border border-indigo-500/20">
                              {idx + 1}
                            </span>
                            <h3 className="font-bold text-white text-sm">{ch.title}</h3>
                            <span className="text-[10px] text-slate-500">{ch.lessons?.length || 0} lessons</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setShowChapterFormFor(ch.id); setChapterTitle(ch.title); }}
                              className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteChapter(ch.id)}
                              className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { setShowLessonFormFor({ chapterId: ch.id, lessonId: null }); setLessonTitle(''); setLessonLink(''); setLessonType('video'); }}
                              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-3 rounded-lg transition cursor-pointer">
                              <FilePlus className="h-3.5 w-3.5" />
                              Add Lesson
                            </button>
                          </div>
                        </div>

                        {showLessonFormFor?.chapterId === ch.id && (
                          <form onSubmit={handleLessonSubmit} className="p-5 border-b border-slate-800 space-y-3"
                            style={{background:'rgba(99,102,241,0.04)'}}>
                            <h4 className="font-bold text-sm text-slate-300">
                              {showLessonFormFor.lessonId ? '✏️ Edit Lesson' : '➕ Add Lesson'}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-2">
                                <input type="text" required value={lessonTitle} onChange={e => setLessonTitle(e.target.value)}
                                  placeholder="Lesson title..."
                                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white"
                                />
                              </div>
                              <select value={lessonType} onChange={e => setLessonType(e.target.value as any)}
                                className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white">
                                <option value="video">📹 Video</option>
                                <option value="audio">🎧 Audio</option>
                                <option value="pdf">📄 PDF</option>
                              </select>
                            </div>
                            <input type="text" value={lessonLink} onChange={e => setLessonLink(e.target.value)}
                              placeholder="Google Drive shareable link..."
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-white"
                            />
                            <div className="flex gap-2 justify-end">
                              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg cursor-pointer text-xs">Save</button>
                              <button type="button" onClick={() => setShowLessonFormFor(null)}
                                className="bg-slate-800 text-slate-400 py-2 px-4 rounded-lg cursor-pointer text-xs">Cancel</button>
                            </div>
                          </form>
                        )}

                        <div className="p-3 space-y-2">
                          {ch.lessons && ch.lessons.length > 0 ? ch.lessons.map((les, lidx) => (
                            <div key={les.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 transition">
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-slate-600 font-mono">{String(lidx+1).padStart(2,'0')}</span>
                                <span className="text-indigo-400">
                                  {les.type === 'video' && <Play className="h-3.5 w-3.5" />}
                                  {les.type === 'audio' && <Volume2 className="h-3.5 w-3.5" />}
                                  {les.type === 'pdf' && <FileText className="h-3.5 w-3.5" />}
                                </span>
                                <span className="text-slate-200 font-semibold">{les.title}</span>
                                <span className="text-[10px] text-slate-600 uppercase font-bold">{les.type}</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleEditLessonSetup(ch.id, les)}
                                  className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-white rounded-lg transition cursor-pointer">
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button onClick={() => handleDeleteLesson(les.id)}
                                  className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )) : (
                            <p className="text-center text-slate-600 text-xs py-4">No lessons yet.</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          ) : loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
              <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-500 text-sm">Loading dashboard...</p>
            </div>

          ) : (
            <>
              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && analytics && (
                <div className="space-y-6 max-w-7xl mx-auto">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Students', value: analytics.totalStudents, icon: Users, color: 'indigo', gradient: 'from-indigo-500 to-blue-600' },
                      { label: 'Pending Approval', value: analytics.pendingStudents, icon: Users, color: 'amber', gradient: 'from-amber-500 to-orange-500' },
                      { label: 'Active Courses', value: analytics.totalCourses, icon: BookOpen, color: 'violet', gradient: 'from-violet-500 to-purple-600' },
                      { label: 'Total Enrollments', value: analytics.totalEnrollments, icon: UserCheck, color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
                    ].map((stat, i) => (
                      <div key={i} className="relative rounded-2xl p-5 border border-white/8 overflow-hidden group hover:border-white/15 transition-all duration-300"
                        style={{background:'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'}}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
                        <div className="relative flex items-start justify-between">
                          <div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{stat.label}</p>
                            <p className="text-4xl font-black text-white">{stat.value}</p>
                          </div>
                          <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg opacity-80`}>
                            <stat.icon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        {stat.color === 'amber' && stat.value > 0 && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <span className="inline-flex w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-xs text-amber-400 font-semibold">Requires attention</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Enrollment Table */}
                  <div className="rounded-2xl border border-white/8 overflow-hidden"
                    style={{background:'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'}}>
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                      <div>
                        <h3 className="font-bold text-white">Course Enrollment Analytics</h3>
                        <p className="text-slate-500 text-xs mt-0.5">Students enrolled per course</p>
                      </div>
                    </div>
                    {analytics.coursesDistribution.length === 0 ? (
                      <div className="text-center py-16 text-slate-600">
                        <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No data yet. Create courses and enroll students.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {analytics.coursesDistribution.map((c, i) => {
                          const maxCount = Math.max(...analytics.coursesDistribution.map(x => x.enrollment_count), 1);
                          const pct = Math.round((c.enrollment_count / maxCount) * 100);
                          return (
                            <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/3 transition">
                              <span className="text-slate-600 font-mono text-xs w-5">{i+1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-bold text-slate-200 text-sm truncate">{c.title}</span>
                                  <span className="text-indigo-400 font-black text-sm ml-4">{c.enrollment_count}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                                      style={{width: `${pct}%`}} />
                                  </div>
                                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">{c.category}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── STUDENTS TAB ── */}
              {activeTab === 'students' && (
                <div className="max-w-7xl mx-auto">
                  <div className="rounded-2xl border border-white/8 overflow-hidden"
                    style={{background:'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'}}>
                    <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                      <div>
                        <h3 className="font-bold text-white">Registered Students</h3>
                        <p className="text-slate-500 text-xs mt-0.5">{students.length} total registrations</p>
                      </div>
                      {analytics && analytics.pendingStudents > 0 && (
                        <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-full">
                          {analytics.pendingStudents} pending
                        </span>
                      )}
                    </div>

                    {students.length === 0 ? (
                      <div className="text-center py-20 text-slate-600">
                        <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No students registered yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                              <th className="py-4 px-6 text-left">Student</th>
                              <th className="py-4 px-6 text-left">Contact</th>
                              <th className="py-4 px-6 text-left">Registered</th>
                              <th className="py-4 px-6 text-left">Status</th>
                              <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {students.map((student) => (
                              <tr key={student.id} className="hover:bg-white/3 transition group">
                                <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-sm font-black text-indigo-300 flex-shrink-0">
                                      {student.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-slate-200">{student.name}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <p className="text-slate-300 text-xs font-medium">{student.email}</p>
                                  {student.phone && <p className="text-slate-600 text-xs mt-0.5">{student.phone}</p>}
                                </td>
                                <td className="py-4 px-6 text-slate-500 text-xs">
                                  {new Date(student.created_at).toLocaleDateString('en-US', {day:'numeric', month:'short', year:'numeric'})}
                                </td>
                                <td className="py-4 px-6">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                                    student.status === 'approved'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : student.status === 'rejected'
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'approved' ? 'bg-emerald-400' : student.status === 'rejected' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
                                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {student.status === 'pending' && (
                                      <>
                                        <button onClick={() => handleStudentStatus(student.id, 'approved')}
                                          className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-500 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
                                          <Check className="h-3.5 w-3.5" /> Approve
                                        </button>
                                        <button onClick={() => handleStudentStatus(student.id, 'rejected')}
                                          className="flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 hover:border-rose-500 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
                                          <X className="h-3.5 w-3.5" /> Reject
                                        </button>
                                      </>
                                    )}
                                    {student.status === 'approved' && (
                                      <button onClick={() => handleStudentStatus(student.id, 'rejected')}
                                        className="bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
                                        Deactivate
                                      </button>
                                    )}
                                    {student.status === 'rejected' && (
                                      <button onClick={() => handleStudentStatus(student.id, 'approved')}
                                        className="bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-white/5 text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer">
                                        Reactivate
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── COURSES TAB ── */}
              {activeTab === 'courses' && (
                <div className="max-w-7xl mx-auto space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-white">Course Library</h2>
                      <p className="text-slate-500 text-xs mt-0.5">{courses.length} courses available</p>
                    </div>
                    <button
                      onClick={() => { setEditCourseId(null); setCourseTitle(''); setCourseDescription(''); setCourseThumbnail(''); setCourseCategory(''); setCoursePrice(0); setShowCourseModal(true); }}
                      className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      New Course
                    </button>
                  </div>

                  {/* Course Modal */}
                  {showCourseModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-6">
                      <div className="rounded-2xl border border-white/10 w-full max-w-lg p-7 shadow-2xl relative"
                        style={{background:'linear-gradient(135deg, #111122 0%, #0f0f1e 100%)'}}>
                        <button onClick={() => setShowCourseModal(false)}
                          className="absolute top-5 right-5 text-slate-500 hover:text-white transition cursor-pointer">
                          <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-lg font-black text-white mb-6">
                          {editCourseId ? '✏️ Edit Course' : '🚀 Create New Course'}
                        </h3>
                        <form onSubmit={handleCourseSubmit} className="space-y-4">
                          <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Course Title *</label>
                            <input type="text" required value={courseTitle} onChange={e => setCourseTitle(e.target.value)}
                              placeholder="e.g. Complete Web Development Bootcamp"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Category</label>
                              <input type="text" value={courseCategory} onChange={e => setCourseCategory(e.target.value)}
                                placeholder="e.g. Frontend Dev"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Price (BDT)</label>
                              <input type="number" min="0" value={coursePrice} onChange={e => setCoursePrice(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Thumbnail</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input type="text" value={courseThumbnail} onChange={e => setCourseThumbnail(e.target.value)}
                                placeholder="Paste Google Drive or Image URL..."
                                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                              />
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id="thumbnail-upload"
                                  className="hidden"
                                  onChange={handleImageUpload}
                                />
                                <label
                                  htmlFor="thumbnail-upload"
                                  className="flex items-center justify-center gap-1.5 h-[46px] px-4 rounded-xl border border-white/10 hover:border-indigo-500 hover:text-white text-slate-300 font-bold text-xs bg-slate-900 hover:bg-slate-850 cursor-pointer transition whitespace-nowrap"
                                >
                                  {uploading ? <Loader className="h-4 w-4 animate-spin text-indigo-400" /> : <FolderPlus className="h-4 w-4" />}
                                  <span>Choose File</span>
                                </label>
                              </div>
                            </div>
                            {courseThumbnail && (
                              <div className="mt-3 aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-850 relative group">
                                <img src={getDirectImageUrl(courseThumbnail)} alt="Thumbnail Preview" className="object-cover w-full h-full" />
                                <button type="button" onClick={() => setCourseThumbnail('')}
                                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition opacity-0 group-hover:opacity-100 cursor-pointer">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Description</label>
                            <textarea rows={3} value={courseDescription} onChange={e => setCourseDescription(e.target.value)}
                              placeholder="What will students learn in this course?"
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white resize-none"
                            />
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button type="submit"
                              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl cursor-pointer transition">
                              {editCourseId ? 'Save Changes' : 'Create Course'}
                            </button>
                            <button type="button" onClick={() => setShowCourseModal(false)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 px-5 rounded-xl cursor-pointer transition">
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {courses.length === 0 ? (
                    <div className="text-center py-24 rounded-2xl border border-dashed border-white/8">
                      <BookOpen className="h-10 w-10 mx-auto mb-4 text-slate-700" />
                      <p className="text-slate-500 text-sm">No courses yet. Click "New Course" to create your first one.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {courses.map((course) => (
                        <div key={course.id} className="group rounded-2xl border border-white/8 overflow-hidden flex flex-col hover:border-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10"
                          style={{background:'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'}}>
                          <div className="aspect-video relative overflow-hidden bg-slate-950/50">
                            {course.thumbnail ? (
                              <img src={getDirectImageUrl(course.thumbnail)} alt={course.title}
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
                                <BookOpen className="h-10 w-10 text-indigo-500/30" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute top-3 left-3">
                              <span className="bg-black/50 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/10">
                                {course.category || 'General'}
                              </span>
                            </div>
                            <div className="absolute bottom-3 right-3">
                              <span className="bg-indigo-600/90 backdrop-blur-md text-white text-xs font-black px-3 py-1 rounded-lg">
                                {course.price > 0 ? `৳${course.price}` : 'Free'}
                              </span>
                            </div>
                          </div>

                          <div className="p-5 flex flex-col flex-1">
                            <h4 className="font-black text-slate-100 text-base leading-tight line-clamp-2 mb-1">{course.title}</h4>
                            {course.description && (
                              <p className="text-slate-500 text-xs line-clamp-2 mt-1 leading-relaxed">{course.description}</p>
                            )}

                            <div className="mt-auto pt-4 flex items-center gap-2">
                              <button onClick={() => handleOpenOutline(course)}
                                className="flex-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-500 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer text-center">
                                Edit Outline
                              </button>
                              <button onClick={() => handleEditCourseClick(course)}
                                className="p-2 hover:bg-white/8 text-slate-500 hover:text-white rounded-xl border border-white/5 hover:border-white/15 transition cursor-pointer">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDeleteCourse(course.id)}
                                className="p-2 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 rounded-xl border border-white/5 hover:border-rose-500/20 transition cursor-pointer">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
