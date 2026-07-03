import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, removeToken, getCurrentUser, getDirectImageUrl } from '../utils/api';
import { GraduationCap, LogOut, BookOpen, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';

interface EnrolledCourse {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  price: number;
  enrollment_id: string;
  enrolled_at: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  price: number;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const cachedUser = getCurrentUser();
    if (!cachedUser) {
      navigate('/auth');
      return;
    }
    if (cachedUser.role === 'admin') {
      navigate('/admin');
      return;
    }
    if (cachedUser.status === 'pending') {
      navigate('/pending');
      return;
    }
    setUser(cachedUser);
    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load enrolled courses
      const enrollData = await api.getEnrollments();
      setEnrolled(enrollData.enrollments || []);

      // Load all courses to filter available ones
      const courseData = await api.getCourses();
      const allCourses: Course[] = courseData.courses || [];
      
      // Filter out courses student is already enrolled in
      const enrolledIds = new Set((enrollData.enrollments || []).map((e: any) => e.id));
      const availableCourses = allCourses.filter(c => !enrolledIds.has(c.id));
      
      setCatalog(availableCourses);
    } catch (err) {
      console.error('Error loading student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    setActionLoading(courseId);
    try {
      await api.enroll(courseId);
      await loadDashboardData(); // Reload both lists
    } catch (err: any) {
      alert(err.message || 'Enrollment failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    removeToken();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 px-6 py-4 flex items-center justify-between"
        style={{background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(20px)'}}>
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform duration-300">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
            EduSphere
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-black text-xs flex items-center justify-center">
              {user?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <span className="text-xs text-slate-300 font-bold hidden sm:inline">{user?.name}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-455 py-2 px-4 rounded-xl transition duration-300 border border-white/5 cursor-pointer text-xs font-bold"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-10 w-full">
        {/* Welcome Section */}
        <div className="mb-10 p-8 rounded-3xl border border-white/8 relative overflow-hidden"
          style={{background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.04) 100%)'}}>
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">Student Center</span>
            <h1 className="text-3xl font-black text-white mt-4 tracking-tight">Welcome Back, {user?.name}!</h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-xl leading-relaxed">Access all your active enrolled courses, track your personal learning journey progress, and explore our newest premium courses below.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading learning system...</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* My Courses */}
            <section>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-black text-white">My Enrolled Courses</h2>
              </div>

              {enrolled.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-white/8">
                  <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm mb-3">You are not enrolled in any courses yet.</p>
                  <a href="#catalog" className="text-indigo-400 hover:text-indigo-300 font-bold text-xs bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 transition inline-block">
                    Explore Course Catalog &rarr;
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolled.map((course) => (
                    <div 
                      key={course.id}
                      className="group rounded-2xl border border-white/8 overflow-hidden flex flex-col h-full hover:border-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5"
                      style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'}}
                    >
                      {/* Image */}
                      <div className="aspect-video relative overflow-hidden bg-slate-950">
                        {course.thumbnail ? (
                          <img 
                            src={getDirectImageUrl(course.thumbnail)} 
                            alt={course.title}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
                            <BookOpen className="h-10 w-10 text-indigo-500/30" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/10">
                          {course.category || 'General'}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-grow text-xs">
                        <h3 className="text-base font-black text-slate-100 mb-1 leading-snug line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-slate-550 font-semibold mb-5 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Enrolled: {new Date(course.enrolled_at).toLocaleDateString()}</span>
                        </p>
                        
                        {/* Progress Indicator */}
                        <div className="mt-auto space-y-2 mb-5">
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-400">Progress</span>
                            <span className="text-indigo-400">{course.progress}% Completed</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                            <div 
                              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {course.completedLessons} of {course.totalLessons} lessons completed
                          </p>
                        </div>

                        {/* Continue Button */}
                        <button
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="w-full bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white font-bold py-2.5 px-4 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>{course.progress > 0 ? 'Continue Learning' : 'Start Course'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Explore Courses Catalog */}
            <section id="catalog" className="pt-6 border-t border-white/5">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-black text-white">Explore Available Courses</h2>
              </div>

              {catalog.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-white/8">
                  <p className="text-slate-500 text-sm">Congratulations! You are enrolled in all available courses.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catalog.map((course) => (
                    <div 
                      key={course.id}
                      className="group rounded-2xl border border-white/8 overflow-hidden flex flex-col h-full hover:border-indigo-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5"
                      style={{background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'}}
                    >
                      {/* Image */}
                      <div className="aspect-video relative overflow-hidden bg-slate-950">
                        {course.thumbnail ? (
                          <img 
                            src={getDirectImageUrl(course.thumbnail)} 
                            alt={course.title}
                            className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/10 to-purple-900/10">
                            <BookOpen className="h-10 w-10 text-indigo-500/20" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-slate-350 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/10">
                          {course.category || 'General'}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex flex-col flex-grow text-xs">
                        <h3 className="text-base font-black text-slate-100 mb-2 leading-snug line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-slate-400 leading-relaxed mb-6 line-clamp-3 flex-grow">
                          {course.description || 'No description available.'}
                        </p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                          <span className="text-base font-black text-indigo-400">
                            {course.price > 0 ? `৳${course.price}` : 'Free'}
                          </span>
                          <button
                            onClick={() => handleEnroll(course.id)}
                            disabled={actionLoading === course.id}
                            className="bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-850 text-white font-bold py-2.5 px-4 rounded-xl transition duration-300 flex items-center gap-1.5 shadow-md shadow-indigo-600/15 cursor-pointer"
                          >
                            {actionLoading === course.id ? (
                              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span>Enroll Now</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
