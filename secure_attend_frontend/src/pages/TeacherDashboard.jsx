import React, { useState, useEffect, useCallback } from 'react';
import { 
    Users, 
    CheckCircle2, 
    Calendar, 
    LogOut, 
    Camera, 
    Plus, 
    Search, 
    TrendingUp, 
    Clock, 
    ShieldCheck, 
    FileText,
    BookOpen,
    BarChart3,
    RefreshCw,
    AlertCircle,
    Loader2,
    Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CameraView from '../components/CameraView';
import { API_URL } from '../lib/supabase';

// Helper to format "HH:MM:SS" or "HH:MM" into "HH:MM AM/PM"
const formatTime = (t) => {
    if (!t) return '';
    if (t.includes('AM') || t.includes('PM')) return t;
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const TeacherDashboard = () => {
    const { profile, logout } = useAuth();
    const navigate = useNavigate();
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraMode, setCameraMode] = useState('recognize'); 
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [attendanceData, setAttendanceData] = useState([]);
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState(null);

    // Fetch subjects on mount
    useEffect(() => {
        fetchSubjects();
    }, []);

    // Fetch attendance when subject changes
    useEffect(() => {
        if (selectedSubject) {
            fetchAttendance();
            fetchEnrolledStudents();
        }
    }, [selectedSubject]);

    const fetchSubjects = async () => {
        try {
            const res = await fetch(`${API_URL}/api/subjects`);
            const data = await res.json();
            setSubjects(data);
            if (data.length > 0) {
                setSelectedSubject(data[0]);
            }
        } catch (err) {
            console.error('Failed to fetch subjects:', err);
        }
    };

    const fetchAttendance = async () => {
        if (!selectedSubject) return;
        setLoadingAttendance(true);
        try {
            const res = await fetch(`${API_URL}/api/attendance/${selectedSubject.id}`);
            const data = await res.json();
            setAttendanceData(data);
        } catch (err) {
            console.error('Failed to fetch attendance:', err);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const fetchEnrolledStudents = async () => {
        if (!selectedSubject) return;
        try {
            const res = await fetch(`${API_URL}/api/students/${selectedSubject.id}`);
            const data = await res.json();
            setEnrolledStudents(data);
        } catch (err) {
            console.error('Failed to fetch students:', err);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAttendance();
        await fetchEnrolledStudents();
        setRefreshing(false);
        showToast('Data refreshed', 'success');
    };

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleResult = useCallback((name, status) => {
        setIsCameraOpen(false);
        if (status === 'already_marked') {
            showToast(`${name} already marked present today`, 'warning');
        } else {
            showToast(`✅ ${name} marked present via ZK verification`, 'success');
        }
        // Refresh attendance
        setTimeout(() => fetchAttendance(), 500);
    }, [selectedSubject]);

    const handleRegisterComplete = useCallback(() => {
        setIsCameraOpen(false);
        showToast('Student registered successfully', 'success');
        setTimeout(() => {
            fetchEnrolledStudents();
        }, 500);
    }, [selectedSubject]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    // Computed stats
    const presentCount = attendanceData.filter(a => a.status === 'Present').length;
    const lateCount = attendanceData.filter(a => a.status === 'Late').length;
    const totalEnrolled = enrolledStudents.length || attendanceData.length || 0;
    const attendancePercent = totalEnrolled > 0 ? Math.round(((presentCount + lateCount) / Math.max(totalEnrolled, presentCount + lateCount)) * 100) : 0;

    const stats = [
        { label: 'Enrolled Students', value: totalEnrolled.toString(), delta: `${enrolledStudents.length} registered`, icon: <Users size={20} />, color: 'text-accent bg-accent/10' },
        { label: "Today's Attendance", value: `${attendancePercent}%`, delta: `${presentCount + lateCount} checked in`, icon: <CheckCircle2 size={20} />, color: 'text-success bg-success/10' },
        { label: 'Subjects', value: subjects.length.toString(), delta: 'Active', icon: <Calendar size={20} />, color: 'text-warning bg-warning/10' },
        { label: 'ZK Verified', value: attendanceData.filter(a => a.zk_verified).length.toString(), delta: 'Proofs verified', icon: <ShieldCheck size={20} />, color: 'text-success bg-success/10' },
    ];

    const filteredAttendance = attendanceData.filter(a =>
        (a.student_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedSubjectLabel = selectedSubject ? `${selectedSubject.code} - ${selectedSubject.name}` : '';

    return (
        <div className="min-h-screen bg-white">
            {/* Navbar */}
            <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-12 fixed top-0 w-full z-40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-bold">S</div>
                    <span className="text-xl font-bold tracking-tight text-slate-900">SecureAttend</span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{profile?.full_name || 'Teacher'}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-right">{profile?.department || 'Computer Science'}</div>
                    </div>
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                        {(profile?.full_name || 'T').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-danger flex items-center gap-2 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 transition-all hover:bg-danger/5 hover:border-danger/20"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </header>

            <main className="pt-32 pb-20 px-12 max-w-[1600px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-slate-900 mb-2">Teacher Dashboard</h1>
                        <p className="text-slate-500 font-medium">Manage attendance and monitor student participation</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                            <select 
                                value={selectedSubject?.id || ''}
                                onChange={(e) => {
                                    const sub = subjects.find(s => s.id === e.target.value);
                                    setSelectedSubject(sub);
                                }}
                                className="pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary appearance-none cursor-pointer"
                            >
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="btn-secondary py-3.5 px-4 border-slate-200 shadow-sm"
                        >
                            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button 
                            onClick={() => { setCameraMode('register'); setIsCameraOpen(true); }}
                            className="btn-secondary py-3.5 px-6 border-slate-200 shadow-sm"
                        >
                            <Plus size={20} /> Register Student
                        </button>
                        <button 
                            onClick={() => { setCameraMode('recognize'); setIsCameraOpen(true); }}
                            className="btn-primary py-3.5 px-8 shadow-xl shadow-primary/20 bg-primary hover:bg-slate-800"
                        >
                            <Camera size={20} /> Take Attendance
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                            {stats.map((stat, i) => (
                                <div key={i} className="dashboard-card group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 rounded-2xl ${stat.color} transition-transform group-hover:scale-110`}>
                                            {stat.icon}
                                        </div>
                                        <div className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full">{stat.delta}</div>
                                    </div>
                                    <div className="text-3xl font-serif font-bold text-slate-900 mb-1">{stat.value}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Attendance Table */}
                        <div className="dashboard-card p-0 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-1">Today's Attendance</h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {selectedSubjectLabel} • <span className="text-accent">{formatTime(selectedSubject?.schedule_time)} Session</span>
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Search student..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary w-64" 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                {loadingAttendance ? (
                                    <div className="p-16 text-center">
                                        <Loader2 size={32} className="animate-spin text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-400 font-medium">Loading attendance...</p>
                                    </div>
                                ) : filteredAttendance.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <AlertCircle size={48} className="text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold mb-2">No attendance records yet</p>
                                        <p className="text-slate-300 text-sm">Click "Take Attendance" to start marking students</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">#</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Name</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Check-in Time</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">ZK Proof</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredAttendance.map((row, i) => (
                                                <motion.tr 
                                                    key={row.id || i} 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <td className="px-8 py-5 text-sm text-slate-400 font-medium">{i + 1}</td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                {(row.student_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-900">{row.student_name || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">
                                                        {row.check_in_time ? new Date(row.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            row.status === 'Present' ? 'bg-success/10 text-success' : 
                                                            row.status === 'Late' ? 'bg-warning/10 text-warning' : 
                                                            'bg-danger/10 text-danger'
                                                        }`}>
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        {row.zk_verified ? (
                                                            <div className="flex items-center gap-1.5 text-success">
                                                                <ShieldCheck size={16} />
                                                                <span className="text-xs font-bold">Verified</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="col-span-12 lg:col-span-4 space-y-8">
                        {/* Quick Stats */}
                        <div className="dashboard-card">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" /> Quick Stats
                            </h3>
                            <div className="space-y-6">
                                {[
                                    { label: 'Present', value: `${presentCount}/${Math.max(totalEnrolled, presentCount + lateCount)}`, pct: totalEnrolled > 0 ? (presentCount / Math.max(totalEnrolled, presentCount + lateCount)) : 0, color: 'bg-primary' },
                                    { label: 'Late Arrivals', value: `${lateCount}/${Math.max(totalEnrolled, presentCount + lateCount)}`, pct: totalEnrolled > 0 ? (lateCount / Math.max(totalEnrolled, presentCount + lateCount)) : 0, color: 'bg-warning' },
                                    { label: 'Absent', value: `${Math.max(0, totalEnrolled - presentCount - lateCount)}/${Math.max(totalEnrolled, presentCount + lateCount)}`, pct: totalEnrolled > 0 ? (Math.max(0, totalEnrolled - presentCount - lateCount) / Math.max(totalEnrolled, presentCount + lateCount)) : 0, color: 'bg-danger' },
                                ].map((stat, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm font-bold mb-2">
                                            <span className="text-slate-500">{stat.label}</span>
                                            <span className="text-slate-900">{stat.value}</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.round(stat.pct * 100)}%` }}
                                                transition={{ duration: 1 }}
                                                className={`h-full ${stat.color}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Class Schedule */}
                        <div className="dashboard-card">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-primary" /> Class Schedule
                            </h3>
                            <div className="space-y-4">
                                {subjects.map((s, i) => (
                                    <div 
                                        key={s.id} 
                                        onClick={() => setSelectedSubject(s)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                            selectedSubject?.id === s.id 
                                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                                            selectedSubject?.id === s.id ? 'text-white/60' : 'text-slate-400'
                                        }`}>
                                            {formatTime(s.schedule_time)} — {s.code}
                                        </div>
                                        <div className="font-bold">{s.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ZK Security Info */}
                        <div className="bg-primary p-8 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
                            <div className="relative z-10 text-white">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield size={20} />
                                    <h3 className="text-lg font-bold">ZK-SNARK Security</h3>
                                </div>
                                <p className="text-white/60 text-sm mb-6 leading-relaxed">
                                    All attendance verifications use Groth16 zero-knowledge proofs. 
                                    Face embeddings are processed through Poseidon hash commitments — 
                                    raw biometric data is never stored on the server.
                                </p>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-success rounded-full animate-pulse shadow-lg shadow-success/50" />
                                    <span className="text-xs font-bold text-success uppercase tracking-widest">Active Protection</span>
                                </div>
                            </div>
                            <ShieldCheck size={120} className="absolute -bottom-10 -right-10 text-white/5 rotate-12" />
                        </div>
                    </div>
                </div>
            </main>

            {/* Camera Modal */}
            <AnimatePresence>
                {isCameraOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <CameraView 
                            mode={cameraMode} 
                            subject={selectedSubjectLabel} 
                            onClose={() => setIsCameraOpen(false)} 
                            onResult={handleResult}
                            onRegisterComplete={handleRegisterComplete}
                            userId={profile?.id}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-8 right-8 z-50 px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 ${
                            toast.type === 'success' ? 'bg-success text-white' :
                            toast.type === 'warning' ? 'bg-warning text-white' :
                            'bg-primary text-white'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TeacherDashboard;
