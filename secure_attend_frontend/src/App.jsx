import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';

// Protected route wrapper
const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && profile?.role !== requiredRole) {
        // Redirect to correct dashboard
        return <Navigate to={profile?.role === 'teacher' ? '/teacher' : '/student'} replace />;
    }

    return children;
};

function AppRoutes() {
    const { isAuthenticated, profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Initializing SecureAttend...</p>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route 
                path="/login" 
                element={
                    isAuthenticated 
                        ? <Navigate to={profile?.role === 'teacher' ? '/teacher' : '/student'} replace /> 
                        : <Login />
                } 
            />
            <Route 
                path="/teacher" 
                element={
                    <ProtectedRoute requiredRole="teacher">
                        <TeacherDashboard />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/student" 
                element={
                    <ProtectedRoute requiredRole="student">
                        <StudentDashboard />
                    </ProtectedRoute>
                } 
            />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    );
}

export default App;
