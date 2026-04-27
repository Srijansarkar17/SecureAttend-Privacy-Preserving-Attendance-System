import React, { useState, useEffect } from 'react';
import { 
    CheckCircle2, 
    BookOpen, 
    Calendar,
    LogOut,
    TrendingUp,
    ShieldCheck,
    Clock,
    Target,
    AlertCircle,
    Loader2,
    Shield,
    RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/supabase';

const StudentDashboard = () => {
    const { profile, user, logout } = useAuth();
    const navigate = useNavigate();
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch all subjects
            const subRes = await fetch(`${API_URL}/api/subjects`);
            const subData = await subRes.json();
            setSubjects(subData);

            // Fetch student's attendance
            const attRes = await fetch(`${API_URL}/api/student/attendance/${user.id}`);
            const attData = await attRes.json();
            setAttendanceRecords(attData);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    // Compute subject-wise stats
    const subjectStats = subjects.map(sub => {
        const records = attendanceRecords.filter(a => a.subject_id === sub.id);
        const attended = records.filter(a => a.status === 'Present' || a.status === 'Late').length;
        const total = records.length; // Total sessions where attendance was taken
        const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
        return {
            ...sub,
            attended,
            total,
            percentage,
        };
    }).filter(s => s.total > 0); // Only show subjects with attendance data

    // Overall stats
    const totalAttended = attendanceRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
    const totalSessions = attendanceRecords.length;
    const overallPercent = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

    // Recent activity
    const recentActivity = attendanceRecords.slice(0, 6).map(record => ({
        time: new Date(record.check_in_time).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }),
        text: record.status === 'Late' ? 'Late arrival' : 'Marked present',
        sub: record.subject_code || 'Unknown',
        type: record.status === 'Late' ? 'warning' : 'success',
        verified: record.zk_verified,
    }));

    // Calendar data for current month
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const presentDays = new Set(
        attendanceRecords
            .filter(a => {
                const d = new Date(a.check_in_time);
                return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            })
            .map(a => new Date(a.check_in_time).getDate())
    );

    const stats = [
        { label: 'Overall Attendance', value: `${overallPercent}%`, delta: 'Target: 75% min', icon: <TrendingUp size={20} />, color: 'text-accent bg-accent/10' },
        { label: 'Classes Attended', value: `${totalAttended}/${totalSessions}`, delta: 'This semester', icon: <CheckCircle2 size={20} />, color: 'text-success bg-success/10' },
        { label: 'Subjects', value: subjectStats.length.toString(), delta: subjectStats.every(s => s.percentage >= 85) ? 'All above 85%' : 'Active', icon: <BookOpen size={20} />, color: 'text-warning bg-warning/10' },
        { label: 'ZK Verified', value: attendanceRecords.filter(a => a.zk_verified).length.toString(), delta: 'Cryptographic proofs', icon: <ShieldCheck size={20} />, color: 'text-success bg-success/10' },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-primary mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

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
                        <div className="text-sm font-bold text-slate-900">{profile?.full_name || 'Student'}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-right">
                            {profile?.student_id || 'Student'}
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 border border-slate-200">
                        {(profile?.full_name || 'S').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <button 
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 text-slate-400 hover:text-primary flex items-center gap-2 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 transition-all"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-danger flex items-center gap-2 font-bold text-sm bg-slate-50 rounded-lg border border-slate-200 transition-all hover:bg-danger/5 hover:border-danger/20"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </header>

            <main className="pt-32 pb-20 px-12 max-w-[1600px] mx-auto">
                <div className="mb-12">
                    <h1 className="text-4xl font-serif font-bold text-slate-900 mb-2">Student Dashboard</h1>
                    <p className="text-slate-500 font-medium">Track your attendance and academic progress</p>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    {/* Left: Main Content */}
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                            {stats.map((stat, i) => (
                                <motion.div 
                                    key={i} 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="dashboard-card group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 rounded-2xl ${stat.color} transition-transform group-hover:scale-110`}>
                                            {stat.icon}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-serif font-bold text-slate-900 mb-1">{stat.value}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</div>
                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                        <AlertCircle size={10} />
                                        {stat.delta}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Subject-Wise Attendance */}
                        <div className="dashboard-card p-0 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xl font-bold text-slate-900">Subject-wise Attendance</h3>
                            </div>
                            <div className="overflow-x-auto">
                                {subjectStats.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <AlertCircle size={48} className="text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-400 font-bold mb-2">No attendance records yet</p>
                                        <p className="text-slate-300 text-sm">Your attendance will appear here once marked by your teacher</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Subject Code</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Subject Name</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Attended</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Total</th>
                                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Percentage</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {subjectStats.map((s, i) => (
                                                <motion.tr 
                                                    key={s.id} 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="hover:bg-slate-50/50 transition-colors"
                                                >
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-700">{s.code}</td>
                                                    <td className="px-8 py-5 text-sm font-bold text-slate-900">{s.name}</td>
                                                    <td className="px-8 py-5 text-sm text-slate-500 font-medium text-center">{s.attended}</td>
                                                    <td className="px-8 py-5 text-sm text-slate-500 font-medium text-center">{s.total}</td>
                                                    <td className="px-8 py-5 text-right">
                                                        <span className={`font-bold ${s.percentage >= 75 ? 'text-success' : 'text-danger'}`}>
                                                            {s.percentage}%
                                                        </span>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Sidebar */}
                    <div className="col-span-12 lg:col-span-4 space-y-8">
                        {/* Calendar */}
                        <div className="dashboard-card">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Calendar size={20} className="text-primary" /> This Month
                            </h3>
                            <div className="grid grid-cols-7 gap-1 text-center mb-4">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                                    <div key={i} className="text-[10px] font-bold text-slate-300">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {[...Array(daysInMonth)].map((_, i) => {
                                    const day = i + 1;
                                    const isPresent = presentDays.has(day);
                                    const isCurrent = day === today.getDate();
                                    const dayOfWeek = new Date(today.getFullYear(), today.getMonth(), day).getDay();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    
                                    return (
                                        <div 
                                            key={i} 
                                            className={`aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                                                isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''
                                            } ${
                                                isPresent ? 'bg-success/10 text-success' : 
                                                isWeekend ? 'text-slate-200' : 'text-slate-300'
                                            }`}
                                        >
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6 flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success/20" /> Present</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-100" /> Weekend</div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="dashboard-card">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-primary" /> Recent Activity
                            </h3>
                            {recentActivity.length === 0 ? (
                                <p className="text-slate-400 text-sm text-center py-4">No activity yet</p>
                            ) : (
                                <div className="space-y-4">
                                    {recentActivity.map((act, i) => (
                                        <div key={i} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/30">
                                            <div className="text-xs font-bold text-slate-400 mb-1">{act.time}</div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${act.type === 'success' ? 'bg-success' : 'bg-warning'}`} />
                                                    <div className="text-sm font-bold text-slate-800">
                                                        {act.text} — <span className="text-primary">{act.sub}</span>
                                                    </div>
                                                </div>
                                                {act.verified && (
                                                    <ShieldCheck size={14} className="text-success" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Goal Progress */}
                        <div className="bg-primary p-8 rounded-3xl shadow-xl shadow-primary/20 relative overflow-hidden">
                            <div className="relative z-10 text-white">
                                <h3 className="text-lg font-bold mb-2">Attendance Goal</h3>
                                <p className="text-white/60 text-sm mb-8 leading-relaxed">
                                    {overallPercent >= 75 
                                        ? "You're doing great! Keep it up to maintain above 75%" 
                                        : "You need to improve your attendance to meet the 75% threshold"}
                                </p>
                                
                                <div className="flex items-end justify-between mb-2">
                                    <div className="text-4xl font-serif font-bold">{overallPercent}%</div>
                                    <div className="text-sm font-bold text-success">75% <span className="text-white/40">Target</span></div>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-8">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(overallPercent, 100)}%` }}
                                        className={`h-full ${overallPercent >= 75 ? 'bg-success' : 'bg-warning'}`}
                                    />
                                </div>
                                
                                <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${overallPercent >= 75 ? 'text-success' : 'text-warning'}`}>
                                    {overallPercent >= 75 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {overallPercent >= 75 ? 'Goal achieved!' : 'Needs improvement'}
                                </div>
                            </div>
                            <Target size={120} className="absolute -bottom-10 -right-10 text-white/5 rotate-12" />
                        </div>

                        {/* ZK Security Badge */}
                        <div className="dashboard-card border-success/20 bg-success/5">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield size={20} className="text-success" />
                                <span className="text-sm font-bold text-success uppercase tracking-wider">Your Data is Secure</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Your face data is protected using Poseidon hash commitments and ZK-SNARK proofs. 
                                Raw biometric data is never stored — only cryptographic proofs verify your identity.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default StudentDashboard;
