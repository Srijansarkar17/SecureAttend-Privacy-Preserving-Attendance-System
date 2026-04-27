import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load user from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('secureattend_user');
        if (stored) {
            try {
                setUser(JSON.parse(stored));
            } catch {
                localStorage.removeItem('secureattend_user');
            }
        }
        setLoading(false);
    }, []);

    // Persist user to localStorage
    const saveUser = (userData) => {
        setUser(userData);
        localStorage.setItem('secureattend_user', JSON.stringify(userData));
    };

    // Login via backend
    const login = async (email, password) => {
        if (!email.endsWith('@srmist.edu.in')) {
            throw new Error('Only @srmist.edu.in emails are allowed');
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        saveUser(data.user);
        return data.user;
    };

    // Signup via backend
    const signup = async (email, password, fullName, role, studentId) => {
        if (!email.endsWith('@srmist.edu.in')) {
            throw new Error('Only @srmist.edu.in emails are allowed');
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        formData.append('full_name', fullName);
        formData.append('role', role);
        if (studentId) formData.append('student_id', studentId);

        const res = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Signup failed');
        }

        saveUser(data.user);
        return data.user;
    };

    // Logout
    const logout = async () => {
        setUser(null);
        localStorage.removeItem('secureattend_user');
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile: user, // alias for backward compatibility
            loading,
            login,
            signup,
            logout,
            isAuthenticated: !!user,
            isTeacher: user?.role === 'teacher',
            isStudent: user?.role === 'student',
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
