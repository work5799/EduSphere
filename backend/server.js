const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- DATABASE SEEDING ---
async function seedAdmin() {
  try {
    const adminEmail = 'admin@edusphere.com';
    const result = await db.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
    
    if (result.rows.length === 0) {
      const adminId = db.generateId();
      const passwordHash = await bcrypt.hash('adminpassword', 10);
      
      await db.query(
        `INSERT INTO users (id, name, email, password_hash, role, status, phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, 'System Admin', adminEmail, passwordHash, 'admin', 'approved', '123-456-7890']
      );
      console.log('Seeded default Admin account:');
      console.log('  Email: admin@edusphere.com');
      console.log('  Password: adminpassword');
    }
  } catch (err) {
    console.error('Error seeding admin account:', err);
  }
}

// Initialize database and start seeding
db.initDb().then(() => {
  seedAdmin();
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
    // Total Students
    const studentCountRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalStudents = parseInt(studentCountRes.rows[0].count || 0);

    // Pending Students
    const pendingCountRes = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'pending'");
    const pendingStudents = parseInt(pendingCountRes.rows[0].count || 0);

    // Total Courses
    const courseCountRes = await db.query("SELECT COUNT(*) as count FROM courses");
    const totalCourses = parseInt(courseCountRes.rows[0].count || 0);

    // Total Enrollments
    const enrollCountRes = await db.query("SELECT COUNT(*) as count FROM enrollments");
    const totalEnrollments = parseInt(enrollCountRes.rows[0].count || 0);

    // Enrollments per Course Distribution
    const distributions = await db.query(
      `SELECT c.id, c.title, c.category, COUNT(e.id) as enrollment_count
       FROM courses c
       LEFT JOIN enrollments e ON c.id = e.course_id
       GROUP BY c.id, c.title, c.category
       ORDER BY enrollment_count DESC`
    );

    res.json({
      analytics: {
        totalStudents,
        pendingStudents,
        totalCourses,
        totalEnrollments,
        coursesDistribution: distributions.rows
      }
    });
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
    // Fetch Course details
    const courseRes = await db.query('SELECT * FROM courses WHERE id = $1', [id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const course = courseRes.rows[0];

    // Check if enrolled (for students)
    let isEnrolled = false;
    if (req.user.role === 'student') {
      const enrollCheck = await db.query(
        'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
        [userId, id]
      );
      isEnrolled = enrollCheck.rows.length > 0;
    } else {
      isEnrolled = true; // Admin has full access
    }

    // Fetch Chapters
    const chaptersRes = await db.query(
      'SELECT * FROM chapters WHERE course_id = $1 ORDER BY sort_order ASC, title ASC',
      [id]
    );
    const chapters = chaptersRes.rows;

    // Fetch Lessons for all chapters
    const lessonsRes = await db.query(
      `SELECT l.* FROM lessons l
       JOIN chapters ch ON l.chapter_id = ch.id
       WHERE ch.course_id = $1
       ORDER BY l.sort_order ASC, l.title ASC`,
      [id]
    );
    const lessons = lessonsRes.rows;

    // Fetch completions if user is student
    let completedLessonIds = [];
    if (req.user.role === 'student' && isEnrolled) {
      const completionsRes = await db.query(
        `SELECT lesson_id FROM lesson_completions lc
         JOIN lessons l ON lc.lesson_id = l.id
         JOIN chapters ch ON l.chapter_id = ch.id
         WHERE lc.student_id = $1 AND ch.course_id = $2`,
        [userId, id]
      );
      completedLessonIds = completionsRes.rows.map(row => row.lesson_id);
    }

    // Map lessons into chapters
    const chaptersWithLessons = chapters.map(ch => {
      return {
        ...ch,
        lessons: lessons.filter(l => l.chapter_id === ch.id)
      };
    });

    res.json({
      course,
      isEnrolled,
      chapters: chaptersWithLessons,
      completedLessons: completedLessonIds
    });

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
    // Get all enrolled courses
    const enrollmentsRes = await db.query(
      `SELECT e.id as enrollment_id, e.created_at as enrolled_at, c.* 
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = $1
       ORDER BY e.created_at DESC`,
      [studentId]
    );
    const enrollments = enrollmentsRes.rows;

    // For each enrollment, calculate total lessons and completed lessons
    const enrichedEnrollments = [];

    for (const enroll of enrollments) {
      // Total lessons in this course
      const lessonsCountRes = await db.query(
        `SELECT COUNT(l.id) as count FROM lessons l
         JOIN chapters ch ON l.chapter_id = ch.id
         WHERE ch.course_id = $1`,
        [enroll.id]
      );
      const totalLessons = parseInt(lessonsCountRes.rows[0].count || 0);

      // Completed lessons in this course
      const completionsCountRes = await db.query(
        `SELECT COUNT(lc.id) as count FROM lesson_completions lc
         JOIN lessons l ON lc.lesson_id = l.id
         JOIN chapters ch ON l.chapter_id = ch.id
         WHERE lc.student_id = $1 AND ch.course_id = $2`,
        [studentId, enroll.id]
      );
      const completedLessons = parseInt(completionsCountRes.rows[0].count || 0);

      // Percentage calculation
      const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      enrichedEnrollments.push({
        ...enroll,
        totalLessons,
        completedLessons,
        progress
      });
    }

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


// Start server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`EduSphere backend running on port ${PORT}`);
  });
}

module.exports = app;
