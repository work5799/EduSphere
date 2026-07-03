const API_BASE_URL = typeof window !== 'undefined' && window.location.origin.includes('localhost')
  ? 'http://localhost:5000/api'
  : '/api';

export function getToken(): string | null {
  return localStorage.getItem('edusphere_token');
}

export function setToken(token: string): void {
  localStorage.setItem('edusphere_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('edusphere_token');
  localStorage.removeItem('edusphere_user');
}

export function getCurrentUser() {
  const userJson = localStorage.getItem('edusphere_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: any): void {
  localStorage.setItem('edusphere_user', JSON.stringify(user));
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Authentication
  login: (credentials: any) => 
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  
  register: (studentData: any) => 
    request('/auth/register', { method: 'POST', body: JSON.stringify(studentData) }),
  
  getMe: () => 
    request('/auth/me'),

  // Admin Student Management
  getStudents: () => 
    request('/admin/students'),
  
  updateStudentStatus: (studentId: string, status: 'approved' | 'rejected' | 'pending') => 
    request(`/admin/students/${studentId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Admin Analytics
  getAnalytics: () =>
    request('/admin/analytics'),

  // Courses
  getCourses: () => 
    request('/courses'),
  
  getCourse: (courseId: string) => 
    request(`/courses/${courseId}`),
  
  createCourse: (courseData: any) => 
    request('/admin/courses', { method: 'POST', body: JSON.stringify(courseData) }),
  
  updateCourse: (courseId: string, courseData: any) => 
    request(`/admin/courses/${courseId}`, { method: 'PUT', body: JSON.stringify(courseData) }),
  
  deleteCourse: (courseId: string) => 
    request(`/admin/courses/${courseId}`, { method: 'DELETE' }),

  uploadThumbnail: (base64Image: string, fileName: string, mimeType: string) =>
    request('/admin/upload-thumbnail', { method: 'POST', body: JSON.stringify({ base64Image, fileName, mimeType }) }),

  // Chapters
  createChapter: (courseId: string, chapterData: any) => 
    request(`/admin/courses/${courseId}/chapters`, { method: 'POST', body: JSON.stringify(chapterData) }),
  
  updateChapter: (chapterId: string, chapterData: any) => 
    request(`/admin/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(chapterData) }),
  
  deleteChapter: (chapterId: string) => 
    request(`/admin/chapters/${chapterId}`, { method: 'DELETE' }),

  // Lessons
  createLesson: (chapterId: string, lessonData: any) => 
    request(`/admin/chapters/${chapterId}/lessons`, { method: 'POST', body: JSON.stringify(lessonData) }),
  
  updateLesson: (lessonId: string, lessonData: any) => 
    request(`/admin/lessons/${lessonId}`, { method: 'PUT', body: JSON.stringify(lessonData) }),
  
  deleteLesson: (lessonId: string) => 
    request(`/admin/lessons/${lessonId}`, { method: 'DELETE' }),

  // Student Progress & Enrollments
  enroll: (courseId: string) => 
    request(`/student/courses/${courseId}/enroll`, { method: 'POST' }),
  
  getEnrollments: () => 
    request('/student/enrollments'),
  
  completeLesson: (lessonId: string) => 
    request(`/student/lessons/${lessonId}/complete`, { method: 'POST' }),
  
  incompleteLesson: (lessonId: string) => 
    request(`/student/lessons/${lessonId}/complete`, { method: 'DELETE' })
};

// Parse Google Drive Link helper
export function parseDriveLink(link: string, mediaType?: string): { type: 'embed' | 'file'; id: string; embedUrl: string } | null {
  if (!link) return null;
  
  // Clean string
  const cleanLink = link.trim();
  
  // Extracts ID from formats like:
  // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // https://drive.google.com/open?id=FILE_ID
  // https://docs.google.com/file/d/FILE_ID/preview
  let fileId = '';
  
  const dFormat = cleanLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idFormat = cleanLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const foldersFormat = cleanLink.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  
  if (dFormat && dFormat[1]) {
    fileId = dFormat[1];
  } else if (idFormat && idFormat[1]) {
    fileId = idFormat[1];
  } else if (foldersFormat && foldersFormat[1]) {
    fileId = foldersFormat[1];
  } else if (cleanLink.length > 15 && !cleanLink.includes('.') && !cleanLink.includes('/')) {
    // Treat raw string if it looks like an ID
    fileId = cleanLink;
  }
  
  if (!fileId) return null;
  
  const pathType = mediaType === 'video' ? 'video' : 'file';
  return {
    type: 'embed',
    id: fileId,
    embedUrl: `https://drive.google.com/${pathType}/d/${fileId}/preview`
  };
}

export function getDirectImageUrl(url: string): string {
  if (!url) return '';
  const cleanLink = url.trim();
  
  const dFormat = cleanLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idFormat = cleanLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const foldersFormat = cleanLink.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  
  let fileId = '';
  if (dFormat && dFormat[1]) {
    fileId = dFormat[1];
  } else if (idFormat && idFormat[1]) {
    fileId = idFormat[1];
  } else if (foldersFormat && foldersFormat[1]) {
    fileId = foldersFormat[1];
  }

  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  if (cleanLink.startsWith('/uploads/') || cleanLink.startsWith('uploads/')) {
    const relativePath = cleanLink.startsWith('/') ? cleanLink : `/${cleanLink}`;
    const base = API_BASE_URL.replace(/\/api$/, '');
    return `${base}${relativePath}`;
  }

  return cleanLink;
}

