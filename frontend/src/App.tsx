import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, getCurrentUser } from './utils/api';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import PendingApproval from './pages/PendingApproval';
import StudentDashboard from './pages/StudentDashboard';
import StudentCourseViewer from './pages/StudentCourseViewer';
import AdminDashboard from './pages/AdminDashboard';

// Route protector for students
interface ProtectedRouteProps {
  children: React.ReactElement;
}

const StudentRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role === 'admin' || user.role === 'moderator') {
    return <Navigate to="/admin" replace />;
  }

  if (user.status === 'pending') {
    return <Navigate to="/pending" replace />;
  }

  if (user.status === 'rejected') {
    return <Navigate to="/auth" state={{ message: 'Access denied. Your registration request was rejected.' }} replace />;
  }

  return children;
};

// Route protector for admins
const AdminRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role !== 'admin' && user.role !== 'moderator') {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Simple route protector for pending page
const PendingRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (user.role === 'admin' || user.role === 'moderator') {
    return <Navigate to="/admin" replace />;
  }

  if (user.status === 'approved') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Authentication Page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Pending Approval Screen */}
        <Route path="/pending" element={
          <PendingRoute>
            <PendingApproval />
          </PendingRoute>
        } />

        {/* Student Panel */}
        <Route path="/dashboard" element={
          <StudentRoute>
            <StudentDashboard />
          </StudentRoute>
        } />

        <Route path="/courses/:id" element={
          <StudentRoute>
            <StudentCourseViewer />
          </StudentRoute>
        } />

        {/* Admin Panel */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
