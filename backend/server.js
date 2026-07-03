// Vercel deployment trigger
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// --- DATABASE SEEDING ---
async function seedAdmin() {
  try {
    const adminEmail = 'rayhan5799@gmail.com';
    const result = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    
    if (result.rows.length === 0) {
      const adminId = db.generateId();
      const passwordHash = await bcrypt.hash('Rayhan5799@#', 10);
      
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'System Admin', adminEmail, passwordHash, 'admin', 'approved', '123-456-7890']
      );
      console.log('Seeded default Admin account:');
      console.log('  Email: rayhan5799@gmail.com');
      console.log('  Password: Rayhan5799@#');
    }
  } catch (err) {
    console.error('Error seeding admin account:', err);
  }
}

// Initialize database automatically in local development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  db.initDb().then(() => {
    seedAdmin();
  });
}

// Setup / Initialize Database endpoint for Vercel Serverless
app.get('/api/admin/setup-db', async (req, res) => {
  try {
    console.log('Initializing database from Web endpoint...');
    await db.initDb();
    
    // Seed Admin account
    const adminEmail = 'rayhan5799@gmail.com';
    const check = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    
    if (check.rows.length === 0) {
      const adminId = db.generateId();
      const passwordHash = await bcrypt.hash('Rayhan5799@#', 10);
      
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'System Admin', adminEmail, passwordHash, 'admin', 'approved', '123-456-7890']
      );
      console.log('Admin account seeded successfully via Web.');
    }
    
    res.json({ message: 'EduSphere Database successfully initialized and seeded in Supabase!' });
  } catch (err) {
    console.error('Error in setup-db endpoint:', err);
    
    // Mask and debug DATABASE_URL to identify the parsing issue
    const dbUrl = process.env.DATABASE_URL || '';
    const debugUrlInfo = {
      exists: !!dbUrl,
      length: dbUrl.length,
      startsWith: dbUrl.substring(0, 30),
      endsWith: dbUrl.substring(Math.max(0, dbUrl.length - 20)),
      containsBrackets: dbUrl.includes('[') || dbUrl.includes(']'),
      containsSpaces: dbUrl.includes(' '),
      containsQuotes: dbUrl.includes('"') || dbUrl.includes("'") || dbUrl.includes('`'),
      containsDoubleEquals: dbUrl.includes('=='),
      containsPrefixDbUrl: dbUrl.toUpperCase().startsWith('DATABASE_URL')
    };

    res.status(500).json({ 
      error: err.message, 
      stack: err.stack,
      debugUrlInfo
    });
  }
});

// --- AUTHENTICATION ROUTES ---

// 1. Student Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    // Check if user already exists
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const userId = db.generateId();
    const passwordHash = await bcrypt.hash(password, 10);
    const status = 'pending'; // Default status is pending admin approval
    const role = 'student';

    await db.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, name, email, passwordHash, role, status, phone || null]
    );

    res.status(201).json({ 
      message: 'Registration successful! Your account is pending admin approval.',
      status: 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// 2. Login (Admin and Students)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Role specific checks
    if (user.role === 'student') {
      if (user.status === 'pending') {
        return res.status(403).json({ 
          message: 'Your registration is pending admin approval. You cannot log in yet.', 
          status: 'pending' 
        });
      }
      if (user.status === 'rejected') {
        return res.status(403).json({ 
          message: 'Your registration request has been rejected. Please contact support.', 
          status: 'rejected' 
        });
      }
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// 3. Get Current User Profile (Protected)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, status, phone FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
});


// --- ADMIN STUDENT MANAGEMENT ROUTES ---

// 1. Get all students
app.get('/api/admin/students', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, status, phone, created_at 
       FROM users 
       WHERE role = 'student' 
       ORDER BY created_at DESC`
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching students list' });
  }
});

// 2. Approve, Reject, or Change Status of Student
app.put('/api/admin/students/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected' or 'pending'

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    if (userCheck.rows[0].role !== 'student') {
      return res.status(400).json({ message: 'Cannot modify non-student accounts' });
    }

    await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: `Student account status updated to ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating student status' });
  }
});


// --- ADMIN ANALYTICS ROUTE ---
app.get('/api/admin/analytics', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const supa = db.getSupabase();

    if (supa) {
      // Supabase SDK approach
      const { count: totalStudents } = await supa.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const { count: pendingStudents } = await supa.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'pending');
      const { count: totalCourses } = await supa.from('courses').select('*', { count: 'exact', head: true });
      const { count: totalEnrollments } = await supa.from('enrollments').select('*', { count: 'exact', head: true });
      const { data: courses } = await supa.from('courses').select('id, title, category');
      const { data: enrollments } = await supa.from('enrollments').select('course_id');

      const coursesDistribution = (courses || []).map(c => ({
        ...c,
        enrollment_count: (enrollments || []).filter(e => e.course_id === c.id).length
      })).sort((a, b) => b.enrollment_count - a.enrollment_count);

      return res.json({ analytics: { totalStudents: totalStudents || 0, pendingStudents: pendingStudents || 0, totalCourses: totalCourses || 0, totalEnrollments: totalEnrollments || 0, coursesDistribution } });
    }

    // SQLite fallback
    const studentCountRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const pendingCountRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'pending'");
    const courseCountRes = await db.query("SELECT COUNT(*) as count FROM courses");
    const enrollCountRes = await db.query("SELECT COUNT(*) as count FROM enrollments");
    const coursesRes = await db.query('SELECT id, title, category FROM courses');
    const enrollsRes = await db.query('SELECT course_id FROM enrollments');
    const allEnrolls = enrollsRes.rows;
    const coursesDistribution = coursesRes.rows.map(c => ({ ...c, enrollment_count: allEnrolls.filter(e => e.course_id === c.id).length }));

    res.json({ analytics: {
      totalStudents: parseInt(studentCountRes.rows[0].count || 0),
      pendingStudents: parseInt(pendingCountRes.rows[0].count || 0),
      totalCourses: parseInt(courseCountRes.rows[0].count || 0),
      totalEnrollments: parseInt(enrollCountRes.rows[0].count || 0),
      coursesDistribution
    }});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving analytics' });
  }
});


// --- COURSE ROUTES (PUBLIC & PROTECTED) ---

// 1. Get all courses (Public)
app.get('/api/courses', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM courses ORDER BY created_at DESC');
    res.json({ courses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching courses' });
  }
});

// 2. Get course detail with chapters, lessons and completion check
app.get('/api/courses/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const supa = db.getSupabase();

    if (supa) {
      // Supabase SDK approach — no JOINs needed
      const { data: courseData, error: courseErr } = await supa.from('courses').select('*').eq('id', id).single();
      if (courseErr || !courseData) return res.status(404).json({ message: 'Course not found' });

      let isEnrolled = req.user.role !== 'student';
      if (req.user.role === 'student') {
        const { data: enroll } = await supa.from('enrollments').select('id').eq('student_id', userId).eq('course_id', id);
        isEnrolled = enroll && enroll.length > 0;
      }

      const { data: chapters } = await supa.from('chapters').select('*').eq('course_id', id).order('sort_order');
      const chapterIds = (chapters || []).map(ch => ch.id);
      const { data: lessons } = chapterIds.length > 0
        ? await supa.from('lessons').select('*').in('chapter_id', chapterIds).order('sort_order')
        : { data: [] };

      let completedLessonIds = [];
      if (req.user.role === 'student' && isEnrolled) {
        const lessonIds = (lessons || []).map(l => l.id);
        if (lessonIds.length > 0) {
          const { data: comps } = await supa.from('lesson_completions').select('lesson_id').eq('student_id', userId).in('lesson_id', lessonIds);
          completedLessonIds = (comps || []).map(c => c.lesson_id);
        }
      }

      const chaptersWithLessons = (chapters || []).map(ch => ({
        ...ch,
        lessons: (lessons || []).filter(l => l.chapter_id === ch.id)
      }));

      return res.json({ course: courseData, isEnrolled, chapters: chaptersWithLessons, completedLessons: completedLessonIds });
    }

    // SQLite fallback
    const courseRes = await db.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseRes.rows.length === 0) return res.status(404).json({ message: 'Course not found' });
    const course = courseRes.rows[0];

    let isEnrolled = req.user.role !== 'student';
    if (req.user.role === 'student') {
      const enrollCheck = await db.query('SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2', [userId, id]);
      isEnrolled = enrollCheck.rows.length > 0;
    }

    const chaptersRes = await db.query('SELECT * FROM chapters WHERE course_id = $1 ORDER BY sort_order ASC', [id]);
    const chapters = chaptersRes.rows;
    const chapterIds = chapters.map(ch => ch.id);

    let lessons = [];
    if (chapterIds.length > 0) {
      const lessonsRes = await db.query('SELECT * FROM lessons WHERE chapter_id IN (' + chapterIds.map((_, i) => '$' + (i + 1)).join(',') + ') ORDER BY sort_order ASC', chapterIds);
      lessons = lessonsRes.rows;
    }

    let completedLessonIds = [];
    if (req.user.role === 'student' && isEnrolled && lessons.length > 0) {
      const lessonIds = lessons.map(l => l.id);
      const compsRes = await db.query('SELECT lesson_id FROM lesson_completions WHERE student_id = $1 AND lesson_id IN (' + lessonIds.map((_, i) => '$' + (i + 2)).join(',') + ')', [userId, ...lessonIds]);
      completedLessonIds = compsRes.rows.map(r => r.lesson_id);
    }

    const chaptersWithLessons = chapters.map(ch => ({ ...ch, lessons: lessons.filter(l => l.chapter_id === ch.id) }));
    res.json({ course, isEnrolled, chapters: chaptersWithLessons, completedLessons: completedLessonIds });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving course details' });
  }
});



// --- ADMIN COURSE CRUD ---

// 1. Create Course
app.post('/api/admin/courses', authenticateToken, requireRole('admin'), async (req, res) => {
  const { title, description, thumbnail, category, price } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const courseId = db.generateId();
    await db.query(
      `INSERT INTO courses (id, title, description, thumbnail, category, price) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [courseId, title, description || '', thumbnail || '', category || 'Uncategorized', parseFloat(price) || 0]
    );

    res.status(201).json({ 
      message: 'Course created successfully', 
      course: { id: courseId, title, description, thumbnail, category, price } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating course' });
  }
});

// 2. Edit Course
app.put('/api/admin/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, description, thumbnail, category, price } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const result = await db.query(
      `UPDATE courses 
       SET title = $1, description = $2, thumbnail = $3, category = $4, price = $5 
       WHERE id = $6`,
      [title, description || '', thumbnail || '', category || 'Uncategorized', parseFloat(price) || 0, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json({ message: 'Course updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating course' });
  }
});

// 3. Delete Course
app.delete('/api/admin/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM courses WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting course' });
  }
});


// --- ADMIN COURSE CONTENT MANAGEMENT ---

// 1. Create Chapter
app.post('/api/admin/courses/:courseId/chapters', authenticateToken, requireRole('admin'), async (req, res) => {
  const { courseId } = req.params;
  const { title, sort_order } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Chapter title is required' });
  }

  try {
    const chapterId = db.generateId();
    await db.query(
      `INSERT INTO chapters (id, course_id, title, sort_order) 
       VALUES ($1, $2, $3, $4)`,
      [chapterId, courseId, title, parseInt(sort_order) || 0]
    );
    res.status(201).json({ message: 'Chapter created successfully', chapter: { id: chapterId, course_id: courseId, title, sort_order } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating chapter' });
  }
});

// 2. Edit Chapter
app.put('/api/admin/chapters/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, sort_order } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    const result = await db.query(
      'UPDATE chapters SET title = $1, sort_order = $2 WHERE id = $3',
      [title, parseInt(sort_order) || 0, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    res.json({ message: 'Chapter updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating chapter' });
  }
});

// 3. Delete Chapter
app.delete('/api/admin/chapters/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM chapters WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Chapter not found' });
    }
    res.json({ message: 'Chapter deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting chapter' });
  }
});

// 4. Create Lesson
app.post('/api/admin/chapters/:chapterId/lessons', authenticateToken, requireRole('admin'), async (req, res) => {
  const { chapterId } = req.params;
  const { title, type, drive_link, sort_order } = req.body;

  if (!title || !type) {
    return res.status(400).json({ message: 'Lesson title and type are required' });
  }
  if (!['video', 'audio', 'pdf'].includes(type)) {
    return res.status(400).json({ message: 'Invalid lesson type' });
  }

  try {
    const lessonId = db.generateId();
    await db.query(
      `INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lessonId, chapterId, title, type, drive_link || '', parseInt(sort_order) || 0]
    );
    res.status(201).json({ message: 'Lesson created successfully', lesson: { id: lessonId, chapter_id: chapterId, title, type, drive_link, sort_order } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating lesson' });
  }
});

// 5. Edit Lesson
app.put('/api/admin/lessons/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { title, type, drive_link, sort_order } = req.body;

  if (!title || !type) {
    return res.status(400).json({ message: 'Lesson title and type are required' });
  }
  if (!['video', 'audio', 'pdf'].includes(type)) {
    return res.status(400).json({ message: 'Invalid lesson type' });
  }

  try {
    const result = await db.query(
      `UPDATE lessons 
       SET title = $1, type = $2, drive_link = $3, sort_order = $4 
       WHERE id = $5`,
      [title, type, drive_link || '', parseInt(sort_order) || 0, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json({ message: 'Lesson updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating lesson' });
  }
});

// 6. Delete Lesson
app.delete('/api/admin/lessons/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM lessons WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json({ message: 'Lesson deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting lesson' });
  }
});


// --- STUDENT COURSE ENROLLMENT & TRACKING ROUTES ---

// 1. Enroll in a course
app.post('/api/student/courses/:courseId/enroll', authenticateToken, requireRole('student'), async (req, res) => {
  const { courseId } = req.params;
  const studentId = req.user.id;

  try {
    // Check if course exists
    const courseRes = await db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if already enrolled
    const check = await db.query('SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2', [studentId, courseId]);
    if (check.rows.length > 0) {
      return res.status(400).json({ message: 'You are already enrolled in this course' });
    }

    const enrollmentId = db.generateId();
    await db.query(
      'INSERT INTO enrollments (id, student_id, course_id) VALUES ($1, $2, $3)',
      [enrollmentId, studentId, courseId]
    );

    res.status(201).json({ message: 'Successfully enrolled in course' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during enrollment' });
  }
});

// 2. Get Student's Enrollments with completion percentages
app.get('/api/student/enrollments', authenticateToken, requireRole('student'), async (req, res) => {
  const studentId = req.user.id;

  try {
    const supa = db.getSupabase();

    let enrollments, chapters, lessons, completions;

    if (supa) {
      // Supabase SDK approach
      const { data: enrollData } = await supa.from('enrollments').select('id, created_at, course_id').eq('student_id', studentId).order('created_at', { ascending: false });
      const { data: coursesData } = await supa.from('courses').select('*');
      const { data: chaptersData } = await supa.from('chapters').select('id, course_id');
      const { data: lessonsData } = await supa.from('lessons').select('id, chapter_id');
      const { data: completionsData } = await supa.from('lesson_completions').select('lesson_id').eq('student_id', studentId);

      const completedIds = new Set((completionsData || []).map(c => c.lesson_id));

      const enrichedEnrollments = (enrollData || []).map(e => {
        const course = (coursesData || []).find(c => c.id === e.course_id) || {};
        const courseChapterIds = (chaptersData || []).filter(ch => ch.course_id === e.course_id).map(ch => ch.id);
        const courseLessons = (lessonsData || []).filter(l => courseChapterIds.includes(l.chapter_id));
        const totalLessons = courseLessons.length;
        const completedLessons = courseLessons.filter(l => completedIds.has(l.id)).length;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        return { enrollment_id: e.id, enrolled_at: e.created_at, ...course, totalLessons, completedLessons, progress };
      });

      return res.json({ enrollments: enrichedEnrollments });
    }

    // SQLite fallback — keep original logic
    const enrollmentsRes = await db.query('SELECT id, created_at, course_id FROM enrollments WHERE student_id = $1 ORDER BY created_at DESC', [studentId]);
    const coursesRes = await db.query('SELECT * FROM courses');
    const chaptersRes = await db.query('SELECT id, course_id FROM chapters');
    const lessonsRes = await db.query('SELECT id, chapter_id FROM lessons');
    const completionsRes = await db.query('SELECT lesson_id FROM lesson_completions WHERE student_id = $1', [studentId]);
    const completedIds = new Set(completionsRes.rows.map(c => c.lesson_id));

    const enrichedEnrollments = enrollmentsRes.rows.map(e => {
      const course = coursesRes.rows.find(c => c.id === e.course_id) || {};
      const courseChapterIds = chaptersRes.rows.filter(ch => ch.course_id === e.course_id).map(ch => ch.id);
      const courseLessons = lessonsRes.rows.filter(l => courseChapterIds.includes(l.chapter_id));
      const totalLessons = courseLessons.length;
      const completedLessons = courseLessons.filter(l => completedIds.has(l.id)).length;
      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return { enrollment_id: e.id, enrolled_at: e.created_at, ...course, totalLessons, completedLessons, progress };
    });

    res.json({ enrollments: enrichedEnrollments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving student enrollments' });
  }
});

// 3. Mark Lesson Completed
app.post('/api/student/lessons/:lessonId/complete', authenticateToken, requireRole('student'), async (req, res) => {
  const { lessonId } = req.params;
  const studentId = req.user.id;

  try {
    // Check if lesson exists
    const lessonCheck = await db.query('SELECT * FROM lessons WHERE id = $1', [lessonId]);
    if (lessonCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Verify student is enrolled in the parent course
    const enrollmentCheck = await db.query(
      `SELECT e.id FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN chapters ch ON c.id = ch.course_id
       JOIN lessons l ON ch.id = l.chapter_id
       WHERE e.student_id = $1 AND l.id = $2`,
      [studentId, lessonId]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You must be enrolled in the course to complete its lessons' });
    }

    // Insert completion (ignore if already completed due to UNIQUE constraint)
    const completionId = db.generateId();
    
    if (db.getDbType() === 'postgres') {
      await db.query(
        `INSERT INTO lesson_completions (id, student_id, lesson_id) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (student_id, lesson_id) DO NOTHING`,
        [completionId, studentId, lessonId]
      );
    } else {
      // SQLite: use INSERT OR IGNORE
      await db.query(
        `INSERT OR IGNORE INTO lesson_completions (id, student_id, lesson_id) 
         VALUES ($1, $2, $3)`,
        [completionId, studentId, lessonId]
      );
    }

    res.json({ message: 'Lesson marked as completed', completed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error marking lesson completed' });
  }
});

// 4. Mark Lesson Incomplete (Delete completion)
app.delete('/api/student/lessons/:lessonId/complete', authenticateToken, requireRole('student'), async (req, res) => {
  const { lessonId } = req.params;
  const studentId = req.user.id;

  try {
    await db.query(
      'DELETE FROM lesson_completions WHERE student_id = $1 AND lesson_id = $2',
      [studentId, lessonId]
    );
    res.json({ message: 'Lesson completion removed', completed: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error removing lesson completion' });
  }
});


// --- ADMIN THUMBNAIL UPLOAD ---
app.post('/api/admin/upload-thumbnail', authenticateToken, requireRole('admin'), async (req, res) => {
  const { base64Image, fileName, mimeType } = req.body;

  if (!base64Image) {
    return res.status(400).json({ message: 'No image data provided' });
  }

  try {
    const supa = db.getSupabase();
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const extension = mimeType ? mimeType.split('/')[1] : 'png';
    const uniqueFileName = `${db.generateId()}.${extension}`;

    if (supa) {
      // Ensure thumbnails bucket exists
      await supa.storage.createBucket('thumbnails', { public: true }).catch(() => {});

      // Upload file to Supabase Storage
      const { data, error } = await supa.storage
        .from('thumbnails')
        .upload(uniqueFileName, buffer, {
          contentType: mimeType || 'image/png',
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({ message: 'Supabase storage upload failed: ' + error.message });
      }

      // Get Public URL
      const { data: { publicUrl } } = supa.storage.from('thumbnails').getPublicUrl(uniqueFileName);
      return res.json({ url: publicUrl });
    } else {
      // Local fallback
      const localPath = path.join(__dirname, 'uploads', uniqueFileName);
      fs.writeFileSync(localPath, buffer);
      
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}/uploads/${uniqueFileName}`;
      return res.json({ url });
    }
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ message: 'Internal server error uploading image' });
  }
});


// --- TEST SUPABASE DIAGNOSTIC ---
app.get('/api/test-supabase', async (req, res) => {
  try {
    const supa = db.getSupabase();
    if (!supa) {
      return res.json({ 
        dbType: db.getDbType(),
        message: 'Supabase client is not initialized. SUPABASE_URL/SUPABASE_SECRET_KEY might be missing.' 
      });
    }

    const { data, error } = await supa.from('courses').select('*');
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error,
        message: error.message 
      });
    }

    return res.json({ 
      success: true, 
      dbType: db.getDbType(),
      count: data.length, 
      data 
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      error: err.message, 
      stack: err.stack 
    });
  }
});


// Start server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`EduSphere backend running on port ${PORT}`);
  });
}

module.exports = app;
