const db = require('./db');

async function runSeed() {
  console.log('Starting demo data database seeding...');
  await db.initDb();

  try {
    // Check if courses already exist
    const check = await db.query('SELECT COUNT(*) as count FROM courses');
    const count = parseInt(check.rows[0].count || 0);

    if (count > 0) {
      console.log('Courses already exist in database. Skipping demo data seeding.');
      process.exit(0);
    }

    // Seed Courses
    const courses = [
      {
        id: db.generateId(),
        title: 'Premium UI/UX Design Mastery',
        description: 'Learn the principles of typography, color theory, visual hierarchy, and design system building in Figma. Harness the power of glassmorphism and modern layouts to wow clients.',
        thumbnail: 'https://images.unsplash.com/photo-1541462608143-67571c6738dd?q=80&w=800&auto=format&fit=crop',
        category: 'Design',
        price: 99.99
      },
      {
        id: db.generateId(),
        title: 'Full-Stack React & Node Developer Guide',
        description: 'Build enterprise-grade SaaS web applications from scratch. Covers React 19, TypeScript, Express, database schema migrations, JWT security systems, and high-performance server configurations.',
        thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
        category: 'Development',
        price: 149.99
      },
      {
        id: db.generateId(),
        title: 'Digital Marketing & Content Copywriting Blueprint',
        description: 'Master the art of writing compelling sales copies, email newsletter funnels, and scaling ad campaigns across search and social engines to maximize conversion rates.',
        thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop',
        category: 'Marketing',
        price: 0 // Free course
      }
    ];

    for (const c of courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, thumbnail, category, price) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [c.id, c.title, c.description, c.thumbnail, c.category, c.price]
      );
      console.log(`Seeded Course: ${c.title}`);
    }

    // Fetch Course IDs to map Chapters
    const seededCourses = await db.query('SELECT * FROM courses');
    
    // Seed Chapters & Lessons for UI/UX Course
    const uiCourse = seededCourses.rows.find(c => c.title.includes('UI/UX'));
    if (uiCourse) {
      const ch1Id = db.generateId();
      await db.query(
        'INSERT INTO chapters (id, course_id, title, sort_order) VALUES ($1, $2, $3, $4)',
        [ch1Id, uiCourse.id, 'Foundations of Modern Design', 0]
      );
      
      // Insert lessons individually
      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch1Id, 'Visual Hierarchy & Colors', 'video', 'https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view', 0]
      );
      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch1Id, 'Typography Scale Rules', 'pdf', 'https://drive.google.com/file/d/1t8S3S7uYn8fOaP5C6W9uB2qW030d32gA/view', 1]
      );

      const ch2Id = db.generateId();
      await db.query(
        'INSERT INTO chapters (id, course_id, title, sort_order) VALUES ($1, $2, $3, $4)',
        [ch2Id, uiCourse.id, 'Advanced Figma Systems', 1]
      );

      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch2Id, 'Figma Auto-Layout Mastery', 'video', 'https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view', 0]
      );
      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch2Id, 'Creating Responsive Components', 'video', 'https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view', 1]
      );
      
      console.log('Seeded chapters & lessons for UI/UX Mastery.');
    }

    // Seed Chapters & Lessons for React Course
    const devCourse = seededCourses.rows.find(c => c.title.includes('React'));
    if (devCourse) {
      const ch1Id = db.generateId();
      await db.query(
        'INSERT INTO chapters (id, course_id, title, sort_order) VALUES ($1, $2, $3, $4)',
        [ch1Id, devCourse.id, 'Modern Frontend Architecture', 0]
      );

      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch1Id, 'React 19 Ecosystem Architecture', 'video', 'https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view', 0]
      );
      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch1Id, 'Tailwind CSS v4 Configuration Guide', 'pdf', 'https://drive.google.com/file/d/1t8S3S7uYn8fOaP5C6W9uB2qW030d32gA/view', 1]
      );

      const ch2Id = db.generateId();
      await db.query(
        'INSERT INTO chapters (id, course_id, title, sort_order) VALUES ($1, $2, $3, $4)',
        [ch2Id, devCourse.id, 'Backend APIs & Data Architecture', 1]
      );

      await db.query(
        'INSERT INTO lessons (id, chapter_id, title, type, drive_link, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [db.generateId(), ch2Id, 'Express.js Restful Routes', 'video', 'https://drive.google.com/file/d/1X-H54B2YhSdf9G3Jsd/view', 0]
      );
      
      console.log('Seeded chapters & lessons for Developer Guide.');
    }

    console.log('Demo database seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
}

runSeed();
