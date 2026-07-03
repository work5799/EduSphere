import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, getToken, getCurrentUser, removeToken } from '../utils/api';
import { Search, BookOpen, GraduationCap, ChevronRight, LogOut, LayoutDashboard } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: string;
  price: number;
}

export default function LandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    setUser(getCurrentUser());
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    setUser(null);
    navigate('/');
  };

  // Get unique categories
  const categories = ['All', ...new Set(courses.map(c => c.category || 'General'))];

  // Filter courses
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(search.toLowerCase()) || 
                          (course.description && course.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'All' || course.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCourseClick = (courseId: string) => {
    if (!getToken()) {
      navigate('/auth', { state: { message: 'Please log in or register to access the course content.' } });
    } else {
      if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(`/courses/${courseId}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Sleek Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform duration-300">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent tracking-tight">
            EduSphere
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-slate-400 hidden sm:inline">
                Welcome back, <strong className="text-slate-200">{user.name}</strong>
              </span>
              <Link 
                to={user.role === 'admin' ? '/admin' : '/dashboard'} 
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition duration-300 shadow-md shadow-indigo-600/20"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 hover:bg-slate-800 text-slate-400 hover:text-white py-2 px-4 rounded-xl transition duration-300 border border-slate-800"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/auth" 
                className="text-slate-300 hover:text-white font-medium py-2 px-4 transition"
              >
                Sign In
              </Link>
              <Link 
                to="/auth?tab=register" 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2 px-5 rounded-xl transition duration-300 shadow-lg shadow-indigo-600/25"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6 text-center border-b border-slate-900 bg-radial-at-t from-indigo-950/40 via-slate-950 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.06),transparent_40%)]" />
        
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/20 text-indigo-400 rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Empowering Approved Learners Nationwide
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            A Smart Way to Master <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Any Professional Skill</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            EduSphere is a secure Learning Management System (LMS). Register, gain admin approval, and unlock custom-designed visual courses powered by Google Drive content streaming.
          </p>

          {/* Search Box */}
          <div className="max-w-xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-30 group-focus-within:opacity-50 transition duration-300" />
            <div className="relative bg-slate-900 rounded-2xl border border-slate-800 flex items-center p-2.5">
              <Search className="h-5 w-5 text-slate-500 ml-3 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search courses, categories, topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-0 focus:outline-none focus:ring-0 text-white placeholder-slate-500 w-full px-3 text-base"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Courses Catalog Section */}
      <main className="flex-grow max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Category Filter */}
        <div className="mb-10 flex flex-wrap items-center gap-2 pb-4 border-b border-slate-900">
          <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mr-2">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition duration-300 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Loading course catalog...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-20 border border-slate-900 rounded-3xl bg-slate-900/20">
            <BookOpen className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300 mb-1">No courses found</h3>
            <p className="text-slate-500 text-sm">Try modifying your search queries or category filters.</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">Available Courses</h2>
              <span className="text-slate-500 text-sm font-medium">{filteredCourses.length} results</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => handleCourseClick(course.id)}
                  className="group bg-slate-900 hover:bg-slate-850/80 border border-slate-800 hover:border-indigo-500/30 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col h-full cursor-pointer hover:-translate-y-1.5"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-slate-950">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/30">
                        <BookOpen className="h-10 w-10 text-indigo-500/60" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-indigo-600/90 text-white text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
                      {course.category || 'General'}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-indigo-400 transition mb-2 line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed">
                      {course.description || 'No description available for this course.'}
                    </p>
                    
                    {/* Footer Info */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                      <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                        {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}
                      </span>
                      <span className="text-indigo-400 font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                        <span>Learn More</span>
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-6 text-center text-slate-600 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            <span className="font-bold text-slate-400">EduSphere LMS</span>
          </div>
          <p>© {new Date().getFullYear()} EduSphere. All rights reserved. All course streaming content is protected.</p>
        </div>
      </footer>
    </div>
  );
}
