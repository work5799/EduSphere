import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, removeToken, getCurrentUser } from '../utils/api';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            EduSphere
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 hidden sm:inline">
            Student: <strong className="text-slate-200">{user?.name}</strong>
          </span>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 hover:bg-slate-900 text-slate-400 hover:text-white py-2 px-4 rounded-xl transition duration-300 border border-slate-800 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-10 w-full">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Student Learning Center</h1>
          <p className="text-slate-400 mt-1">Track your progress and enroll in new learning paths.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading dashboard courses...</p>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* My Courses */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="h-5 w-5 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">My Enrolled Courses</h2>
              </div>

              {enrolled.length === 0 ? (
                <div className="text-center py-12 border border-slate-900 rounded-3xl bg-slate-900/10">
                  <p className="text-slate-500 text-sm mb-4">You are not enrolled in any courses yet.</p>
                  <a href="#catalog" className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">
                    Browse the course catalog below &rarr;
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {enrolled.map((course) => (
                    <div 
                      key={course.id}
                      className="bg-slate-900 border border-slate-800 hover:border-indigo-500/20 rounded-2xl overflow-hidden flex flex-col h-full shadow-lg transition duration-300"
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
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
                            <BookOpen className="h-10 w-10 text-indigo-500/40" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-indigo-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          {course.category || 'General'}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex flex-col flex-grow">
                        <h3 className="text-lg font-bold text-slate-100 mb-1 line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-slate-500 text-xs mb-4 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Enrolled: {new Date(course.enrolled_at).toLocaleDateString()}</span>
                        </p>
                        
                        {/* Progress Indicator */}
                        <div className="mt-auto space-y-2 mb-6">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-400">Progress</span>
                            <span className="text-indigo-400">{course.progress}% Completed</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900">
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
                          className="w-full bg-slate-950 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-850 hover:border-indigo-500/30 transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
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
            <section id="catalog" className="pt-6 border-t border-slate-900">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="h-5 w-5 text-indigo-400" />
                <h2 className="text-xl font-bold text-white">Explore Available Courses</h2>
              </div>

              {catalog.length === 0 ? (
                <div className="text-center py-12 border border-slate-900 rounded-3xl bg-slate-900/10">
                  <p className="text-slate-500 text-sm">Congratulations! You are enrolled in all available courses.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {catalog.map((course) => (
                    <div 
                      key={course.id}
                      className="bg-slate-900/60 border border-slate-850 hover:border-indigo-500/20 rounded-2xl overflow-hidden flex flex-col h-full shadow-md transition duration-300"
                    >
                      {/* Image */}
                      <div className="aspect-video relative overflow-hidden bg-slate-950">
                        {course.thumbnail ? (
                          <img 
                            src={course.thumbnail} 
                            alt={course.title}
                            className="object-cover w-full h-full opacity-80"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/10 to-purple-900/10">
                            <BookOpen className="h-10 w-10 text-indigo-500/20" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full">
                          {course.category || 'General'}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6 flex flex-col flex-grow">
                        <h3 className="text-lg font-bold text-slate-200 mb-2 line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-slate-400 text-xs leading-relaxed mb-6 line-clamp-3 flex-grow">
                          {course.description || 'No description available.'}
                        </p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-slate-850/80 mt-auto">
                          <span className="text-lg font-bold text-slate-200">
                            {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}
                          </span>
                          <button
                            onClick={() => handleEnroll(course.id)}
                            disabled={actionLoading === course.id}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-750 text-white font-medium py-2 px-4 rounded-xl transition duration-300 flex items-center gap-1.5 shadow-md shadow-indigo-600/15 cursor-pointer text-sm"
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
