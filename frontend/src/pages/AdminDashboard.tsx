import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { 
  GraduationCap, LogOut, Users, BookOpen, UserCheck, 
  BarChart3, Plus, Edit2, Trash2, Check, X, FileText, 
  Play, Volume2, ArrowLeft, RefreshCw, FolderPlus, FilePlus 
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
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'courses'>('overview');
  
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

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const analyticData = await api.getAnalytics();
      setAnalytics(analyticData.analytics);

      const studentsData = await api.getStudents();
      setStudents(studentsData.students || []);

      const coursesData = await api.getCourses();
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            EduSphere Admin
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-400 hover:text-white transition duration-300 border border-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 hover:bg-slate-900 text-slate-400 hover:text-white py-2 px-4 rounded-xl transition duration-300 border border-slate-800 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* Course Outline Builder Mode */}
      {activeOutlineCourse ? (
        <main className="flex-grow max-w-5xl mx-auto px-6 py-10 w-full">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-900">
            <button
              onClick={() => setActiveOutlineCourse(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Course Directory</span>
            </button>
            <span className="bg-indigo-950 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full border border-indigo-900">
              OUTLINE BUILDER
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{activeOutlineCourse.title}</h1>
            <p className="text-slate-500 text-sm mt-1">Manage sections, nested lessons, and media streaming files from Google Drive.</p>
          </div>

          {outlineLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-550 text-sm">Fetching modules...</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Add Chapter Option */}
              {showChapterFormFor === null && (
                <button
                  onClick={() => {
                    setShowChapterFormFor('new');
                    setChapterTitle('');
                  }}
                  className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 font-semibold py-3 px-6 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition duration-300 flex items-center justify-center gap-2 w-full cursor-pointer"
                >
                  <FolderPlus className="h-5 w-5" />
                  <span>Create New Module/Chapter</span>
                </button>
              )}

              {/* Add/Edit Chapter Form */}
              {showChapterFormFor !== null && (
                <form onSubmit={handleAddChapter} className="glass-premium p-6 rounded-2xl border border-indigo-500/20 space-y-4">
                  <h3 className="font-bold text-slate-200">
                    {showChapterFormFor === 'new' ? 'New Module Title' : 'Rename Module'}
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Introduction to LMS Frameworks"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 text-sm w-full"
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        type="submit" 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-5 rounded-xl cursor-pointer flex-1 sm:flex-initial text-sm"
                      >
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowChapterFormFor(null)} 
                        className="bg-slate-900 hover:bg-slate-850 text-slate-400 py-3 px-5 rounded-xl border border-slate-800 cursor-pointer flex-1 sm:flex-initial text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Chapters Tree List */}
              <div className="space-y-6">
                {outlineChapters.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-slate-800 rounded-3xl">
                    <p className="text-slate-500 text-sm">No chapters created yet. Create a chapter first to hold your lessons.</p>
                  </div>
                ) : (
                  outlineChapters.map((ch, idx) => (
                    <div key={ch.id} className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow">
                      {/* Chapter Row header */}
                      <div className="bg-slate-950/40 p-4 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="bg-slate-800 text-slate-400 text-xs font-semibold px-2 py-1 rounded">
                            M{idx + 1}
                          </span>
                          <h3 className="font-bold text-white text-base">{ch.title}</h3>
                        </div>

                        {/* Chapter Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setShowChapterFormFor(ch.id);
                              setChapterTitle(ch.title);
                            }}
                            className="p-2 bg-slate-900/60 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition border border-slate-850 cursor-pointer"
                            title="Rename Chapter"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteChapter(ch.id)}
                            className="p-2 bg-rose-950/20 hover:bg-rose-900/20 text-rose-400 hover:text-rose-300 rounded-lg transition border border-rose-950/30 cursor-pointer"
                            title="Delete Chapter"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setShowLessonFormFor({ chapterId: ch.id, lessonId: null });
                              setLessonTitle('');
                              setLessonLink('');
                              setLessonType('video');
                            }}
                            className="flex items-center gap-1 text-xs bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3 rounded-xl transition cursor-pointer"
                          >
                            <FilePlus className="h-3.5 w-3.5" />
                            <span>Add Lesson</span>
                          </button>
                        </div>
                      </div>

                      {/* Lesson form rendering inline for this chapter */}
                      {showLessonFormFor?.chapterId === ch.id && (
                        <form onSubmit={handleLessonSubmit} className="p-6 bg-slate-950/50 border-b border-slate-850 space-y-4">
                          <h4 className="font-bold text-sm text-slate-200">
                            {showLessonFormFor.lessonId ? 'Edit Lesson' : 'Add Lesson to module'}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Lesson Title</label>
                              <input
                                type="text"
                                required
                                value={lessonTitle}
                                onChange={(e) => setLessonTitle(e.target.value)}
                                placeholder="e.g. Setup environment variables"
                                className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Content Type</label>
                              <select
                                value={lessonType}
                                onChange={(e) => setLessonType(e.target.value as any)}
                                className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs w-full"
                              >
                                <option value="video">Video (Stream)</option>
                                <option value="audio">Audio (Podcast)</option>
                                <option value="pdf">PDF / Notes document</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Google Drive Shareable Link / File ID</label>
                            <input
                              type="text"
                              value={lessonLink}
                              onChange={(e) => setLessonLink(e.target.value)}
                              placeholder="e.g. https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view?usp=sharing"
                              className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs w-full"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              * Make sure the file permissions in Google Drive are set to "Anyone with the link can view" to allow embeds.
                            </p>
                          </div>

                          <div className="flex gap-2 justify-end pt-2">
                            <button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg cursor-pointer text-xs"
                            >
                              Save Lesson
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowLessonFormFor(null)}
                              className="bg-slate-900 hover:bg-slate-850 text-slate-400 py-2 px-4 rounded-lg border border-slate-800 cursor-pointer text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Nested Lessons lists */}
                      <div className="p-3 space-y-2 bg-slate-900/40">
                        {ch.lessons && ch.lessons.length > 0 ? (
                          ch.lessons.map((les, lidx) => (
                            <div 
                              key={les.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-slate-800 transition text-xs"
                            >
                              <div className="flex items-center gap-3 truncate max-w-[400px]">
                                <span className="text-slate-550 font-medium">#{lidx + 1}</span>
                                <span className="text-indigo-400">
                                  {les.type === 'video' && <Play className="h-3.5 w-3.5" />}
                                  {les.type === 'audio' && <Volume2 className="h-3.5 w-3.5" />}
                                  {les.type === 'pdf' && <FileText className="h-3.5 w-3.5" />}
                                </span>
                                <span className="text-slate-200 truncate font-semibold">{les.title}</span>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => handleEditLessonSetup(ch.id, les)}
                                  className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-white rounded-lg transition"
                                  title="Edit Lesson"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(les.id)}
                                  className="p-1.5 hover:bg-rose-900/20 text-rose-400 hover:text-rose-350 rounded-lg transition"
                                  title="Delete Lesson"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-slate-600 text-center py-4">No lessons in this chapter yet.</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-grow max-w-7xl mx-auto px-6 py-10 w-full">
          {/* Welcome heading / Tabs selection */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Administration Board</h1>
              <p className="text-slate-400 mt-1">Manage registration approvals, course creations, and view dashboard analytics.</p>
            </div>
            
            <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-850">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  activeTab === 'overview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Overview</span>
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  activeTab === 'students' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Students</span>
                {analytics && analytics.pendingStudents > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold h-5 px-1.5 rounded-full flex items-center justify-center">
                    {analytics.pendingStudents}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('courses')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  activeTab === 'courses' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Courses</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-550 text-sm">Loading admin systems...</p>
            </div>
          ) : (
            <div>
              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && analytics && (
                <div className="space-y-8">
                  {/* KPI Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                      <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/15">
                        <Users className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Total Students</span>
                        <span className="text-2xl font-black text-white">{analytics.totalStudents}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                      <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/15 animate-pulse">
                        <Users className="h-6 w-6 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Pending Approval</span>
                        <span className="text-2xl font-black text-amber-400">{analytics.pendingStudents}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                      <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/15">
                        <BookOpen className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Active Courses</span>
                        <span className="text-2xl font-black text-white">{analytics.totalCourses}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                      <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/15">
                        <UserCheck className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">Total Enrollments</span>
                        <span className="text-2xl font-black text-white">{analytics.totalEnrollments}</span>
                      </div>
                    </div>
                  </div>

                  {/* Enrollment Distribution */}
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-md">
                    <h3 className="text-lg font-bold text-white mb-6">Course Enrollment Analytics</h3>
                    {analytics.coursesDistribution.length === 0 ? (
                      <p className="text-slate-500 text-xs py-4 text-center">Create courses and enroll students to view metrics.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                              <th className="py-3 px-4">Course Name</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4 text-right">Student Enrolled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.coursesDistribution.map((c) => (
                              <tr key={c.id} className="border-b border-slate-850/50 hover:bg-slate-850/20 text-slate-350">
                                <td className="py-3.5 px-4 font-bold text-slate-100">{c.title}</td>
                                <td className="py-3.5 px-4">
                                  <span className="bg-slate-800 px-2.5 py-0.5 rounded text-[10px] font-semibold text-slate-400">
                                    {c.category}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-black text-indigo-400">{c.enrollment_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. STUDENTS TAB */}
              {activeTab === 'students' && (
                <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-md">
                  <div className="p-6 border-b border-slate-850 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Registered Students</h3>
                    <span className="text-xs text-slate-550">{students.length} students total</span>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <p>No student registrations found in database.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-wider font-bold bg-slate-950/20">
                            <th className="py-4 px-6">Name</th>
                            <th className="py-4 px-6">Email / Phone</th>
                            <th className="py-4 px-6">Joined Date</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6 text-right">Approval Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id} className="border-b border-slate-850/50 hover:bg-slate-850/10 text-slate-350">
                              <td className="py-4 px-6 font-bold text-slate-200">{student.name}</td>
                              <td className="py-4 px-6 space-y-1">
                                <span className="block text-slate-300 font-medium">{student.email}</span>
                                {student.phone && <span className="block text-[10px] text-slate-500">{student.phone}</span>}
                              </td>
                              <td className="py-4 px-6 text-slate-500">
                                {new Date(student.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6">
                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                                  student.status === 'approved' 
                                    ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25' 
                                    : student.status === 'rejected'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                                      : 'bg-amber-500/10 text-amber-450 border-amber-500/25 animate-pulse'
                                }`}>
                                  {student.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {student.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleStudentStatus(student.id, 'approved')}
                                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg border border-emerald-500/20 transition cursor-pointer"
                                        title="Approve student"
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleStudentStatus(student.id, 'rejected')}
                                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg border border-rose-500/20 transition cursor-pointer"
                                        title="Reject student"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                  
                                  {student.status === 'approved' && (
                                    <button
                                      onClick={() => handleStudentStatus(student.id, 'rejected')}
                                      className="px-2.5 py-1.5 hover:bg-rose-600 hover:text-white text-rose-450 rounded-lg border border-rose-950/40 hover:border-rose-600 transition font-semibold cursor-pointer"
                                    >
                                      Deactivate
                                    </button>
                                  )}

                                  {student.status === 'rejected' && (
                                    <button
                                      onClick={() => handleStudentStatus(student.id, 'approved')}
                                      className="px-2.5 py-1.5 hover:bg-emerald-600 hover:text-white text-emerald-450 rounded-lg border border-emerald-950/40 hover:border-emerald-600 transition font-semibold cursor-pointer"
                                    >
                                      Activate
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
              )}

              {/* 3. COURSES TAB */}
              {activeTab === 'courses' && (
                <div className="space-y-6">
                  {/* Create Course Trigger */}
                  <div className="flex justify-between items-center bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow">
                    <div>
                      <h3 className="font-bold text-white text-base">Course Management Directory</h3>
                      <p className="text-slate-500 text-xs mt-1">Design structure templates and update price details.</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditCourseId(null);
                        setCourseTitle('');
                        setCourseDescription('');
                        setCourseThumbnail('');
                        setCourseCategory('');
                        setCoursePrice(0);
                        setShowCourseModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-indigo-600/25 transition duration-300 flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Course</span>
                    </button>
                  </div>

                  {/* Course Add / Edit modal */}
                  {showCourseModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                      <div className="bg-slate-900 border border-slate-850 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
                        <button
                          onClick={() => setShowCourseModal(false)}
                          className="absolute top-6 right-6 text-slate-450 hover:text-white"
                        >
                          <X className="h-6 w-6" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-6">
                          {editCourseId ? 'Edit Course Details' : 'Create New Course'}
                        </h3>

                        <form onSubmit={handleCourseSubmit} className="space-y-4 text-xs">
                          <div>
                            <label className="block text-slate-450 mb-1.5 font-bold uppercase tracking-wider">Course Title</label>
                            <input
                              type="text"
                              required
                              value={courseTitle}
                              onChange={(e) => setCourseTitle(e.target.value)}
                              placeholder="e.g. Master React in 30 Days"
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 w-full text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-slate-450 mb-1.5 font-bold uppercase tracking-wider">Category</label>
                              <input
                                type="text"
                                value={courseCategory}
                                onChange={(e) => setCourseCategory(e.target.value)}
                                placeholder="e.g. Frontend Dev"
                                className="bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 w-full text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-450 mb-1.5 font-bold uppercase tracking-wider">Price ($ USD)</label>
                              <input
                                type="number"
                                min="0"
                                value={coursePrice}
                                onChange={(e) => setCoursePrice(Number(e.target.value))}
                                className="bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 w-full text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-450 mb-1.5 font-bold uppercase tracking-wider">Thumbnail Image URL</label>
                            <input
                              type="url"
                              value={courseThumbnail}
                              onChange={(e) => setCourseThumbnail(e.target.value)}
                              placeholder="e.g. https://images.unsplash.com/..."
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 w-full text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-450 mb-1.5 font-bold uppercase tracking-wider">Course Description</label>
                            <textarea
                              rows={4}
                              value={courseDescription}
                              onChange={(e) => setCourseDescription(e.target.value)}
                              placeholder="Describe the course takeaways..."
                              className="bg-slate-950 border border-slate-850 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-3 w-full text-white leading-relaxed"
                            />
                          </div>

                          <div className="flex gap-3 justify-end pt-4">
                            <button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl cursor-pointer"
                            >
                              {editCourseId ? 'Save Changes' : 'Create Course'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCourseModal(false)}
                              className="bg-slate-950 hover:bg-slate-850 text-slate-400 py-3 px-6 rounded-xl border border-slate-850 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Courses Grid */}
                  {courses.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                      <p>No courses created yet. Click "Create Course" to add one.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {courses.map((course) => (
                        <div 
                          key={course.id}
                          className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden flex flex-col h-full shadow"
                        >
                          {/* Image */}
                          <div className="aspect-video relative overflow-hidden bg-slate-950">
                            {course.thumbnail ? (
                              <img 
                                src={course.thumbnail} 
                                alt={course.title}
                                className="object-cover w-full h-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/10 to-purple-900/10">
                                <BookOpen className="h-8 w-8 text-indigo-500/30" />
                              </div>
                            )}
                            <div className="absolute top-3 left-3 bg-slate-800 text-slate-350 text-[10px] font-bold px-2.5 py-0.5 rounded">
                              {course.category}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-5 flex flex-col flex-grow text-xs">
                            <h4 className="font-extrabold text-base text-slate-200 line-clamp-1 mb-1">{course.title}</h4>
                            <span className="text-indigo-400 font-bold mb-4">{course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}</span>
                            
                            {/* Actions footer */}
                            <div className="mt-auto pt-4 border-t border-slate-850 flex items-center gap-2">
                              <button
                                onClick={() => handleOpenOutline(course)}
                                className="bg-indigo-650/80 hover:bg-indigo-600 text-white font-semibold py-2 px-3 rounded-lg flex-1 text-center transition cursor-pointer"
                              >
                                Edit Outline
                              </button>
                              <button
                                onClick={() => handleEditCourseClick(course)}
                                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg border border-slate-850 transition cursor-pointer"
                                title="Edit course details"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                className="p-2 bg-rose-950/20 hover:bg-rose-900/20 text-rose-450 hover:text-rose-350 rounded-lg border border-rose-950/30 transition cursor-pointer"
                                title="Delete course"
                              >
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
            </div>
          )}
        </main>
      )}
    </div>
  );
}
