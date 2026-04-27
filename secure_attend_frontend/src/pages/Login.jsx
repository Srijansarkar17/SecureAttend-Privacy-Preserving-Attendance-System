import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, ArrowRight, Zap, Shield, BarChart2, AlertCircle, Hash, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const [role, setRole] = useState('student');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, signup } = useAuth();

    const validateEmail = (e) => {
        if (e && !e.endsWith('@srmist.edu.in')) {
            return 'Only @srmist.edu.in emails are allowed';
        }
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const emailError = validateEmail(email);
        if (emailError) {
            setError(emailError);
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (mode === 'signup') {
            if (!fullName.trim()) {
                setError('Full name is required');
                return;
            }
            if (role === 'student' && !studentId.trim()) {
                setError('Student ID is required for students');
                return;
            }
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                const profile = await login(email, password);
                if (profile) {
                    navigate(profile.role === 'teacher' ? '/teacher' : '/student');
                }
            } else {
                const profile = await signup(email, password, fullName, role, studentId);
                if (profile) {
                    navigate(profile.role === 'teacher' ? '/teacher' : '/student');
                } else {
                    // If email confirmation is enabled
                    setError('Account created! Please check your email to confirm, then log in.');
                    setMode('login');
                }
            }
        } catch (err) {
            console.error('Auth error:', err);
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-5xl w-full grid lg:grid-cols-2 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                
                {/* Left Side: Info */}
                <div className="p-12 lg:p-16 bg-slate-50 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <Link to="/" className="flex items-center gap-2 text-slate-500 font-medium hover:text-primary transition-colors mb-12">
                            <ArrowLeft size={18} /> Back to home
                        </Link>
                        
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 bg-primary text-white flex items-center justify-center rounded-2xl font-bold text-2xl shadow-lg shadow-primary/20">S</div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 leading-tight">SecureAttend</h1>
                                <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">ZK-SNARK Secured System</p>
                            </div>
                        </div>

                        <h2 className="text-4xl font-bold text-slate-900 mb-6 font-serif">
                            {mode === 'login' ? 'Welcome back to the future of attendance' : 'Join the future of secure attendance'}
                        </h2>
                        <p className="text-lg text-slate-500 mb-12">Secure, fast, and privacy-first facial recognition for modern classrooms.</p>
                        
                        <div className="space-y-4">
                            {[
                                { icon: <Zap size={20} className="text-amber-500" />, title: "Instant Recognition", desc: "Mark attendance in under 0.8 seconds" },
                                { icon: <Shield size={20} className="text-success" />, title: "Zero-Knowledge Security", desc: "Military-grade encryption with ZK-SNARKs" },
                                { icon: <BarChart2 size={20} className="text-accent" />, title: "Real-Time Analytics", desc: "Track trends and generate insights instantly" }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                    <div className="p-2 bg-slate-50 rounded-xl">{item.icon}</div>
                                    <div>
                                        <div className="font-bold text-slate-900">{item.title}</div>
                                        <div className="text-xs text-slate-500">{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-12 flex items-center gap-10">
                        <div>
                            <div className="text-2xl font-bold font-serif">SRM IST</div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Institution</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold font-serif">ZK</div>
                            <div className="text-xs text-slate-500 uppercase font-bold">SNARK Protocol</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold font-serif">99.8%</div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Accuracy</div>
                        </div>
                    </div>

                    {/* Decorative Blobs */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-success/5 rounded-full blur-3xl" />
                </div>

                {/* Right Side: Form */}
                <div className="p-12 lg:p-16 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        {/* Mode Toggle */}
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-10">
                            <button 
                                onClick={() => { setMode('login'); setError(''); }}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'login' ? 'bg-white shadow-xl text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Sign In
                            </button>
                            <button 
                                onClick={() => { setMode('signup'); setError(''); }}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'signup' ? 'bg-white shadow-xl text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-3xl font-bold text-slate-900 mb-2">
                                {mode === 'login' ? 'Welcome back' : 'Create account'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                                {mode === 'login' ? 'Enter your credentials to access your dashboard' : 'Sign up with your SRM IST email'}
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-danger/5 border border-danger/20 rounded-2xl flex items-start gap-3">
                                <AlertCircle size={18} className="text-danger mt-0.5 shrink-0" />
                                <p className="text-sm text-danger font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Role Selection (signup only) */}
                            {mode === 'signup' && (
                                <div>
                                    <label className="text-sm font-bold text-slate-700 mb-2 block uppercase tracking-wider">I am a</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => setRole('teacher')}
                                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${role === 'teacher' ? 'border-primary bg-primary text-white shadow-xl shadow-primary/20' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                                        >
                                            <div className="text-2xl">👨‍🏫</div>
                                            <div className="font-bold">Teacher</div>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setRole('student')}
                                            className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${role === 'student' ? 'border-primary bg-primary text-white shadow-xl shadow-primary/20' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                                        >
                                            <div className="text-2xl">🎓</div>
                                            <div className="font-bold">Student</div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Full Name (signup only) */}
                            {mode === 'signup' && (
                                <div className="group">
                                    <label className="text-sm font-bold text-slate-700 mb-2 block uppercase tracking-wider">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                                        <input 
                                            type="text" 
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300 font-medium"
                                            placeholder="John Doe"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Student ID (signup + student role) */}
                            {mode === 'signup' && role === 'student' && (
                                <div className="group">
                                    <label className="text-sm font-bold text-slate-700 mb-2 block uppercase tracking-wider">Student ID</label>
                                    <div className="relative">
                                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                                        <input 
                                            type="text" 
                                            value={studentId}
                                            onChange={(e) => setStudentId(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300 font-medium"
                                            placeholder="RA2211003010XXX"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            <div className="group">
                                <label className="text-sm font-bold text-slate-700 mb-2 block uppercase tracking-wider">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                                    <input 
                                        type="email" 
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        onBlur={() => { const err = validateEmail(email); if (err) setError(err); }}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300 font-medium"
                                        placeholder="you@srmist.edu.in"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">Only @srmist.edu.in emails accepted</p>
                            </div>

                            {/* Password */}
                            <div className="group">
                                <label className="text-sm font-bold text-slate-700 mb-2 block uppercase tracking-wider">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300 font-medium"
                                        placeholder="••••••••"
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full btn-primary py-4 rounded-2xl text-lg shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><Loader2 size={20} className="animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
                                ) : (
                                    <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={20} /></>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-slate-400">
                                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button 
                                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                                    className="text-primary font-bold hover:underline"
                                >
                                    {mode === 'login' ? 'Sign Up' : 'Sign In'}
                                </button>
                            </p>
                        </div>

                        <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield size={14} className="text-success" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-success">ZK-SNARK Security</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Your biometric data never leaves your device in raw form. 
                                Only cryptographic commitments (Poseidon hashes) are stored on the server, 
                                ensuring complete privacy through zero-knowledge proofs.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="fixed bottom-8 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-4">
                <span>Protected by ZK-SNARK encryption</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span>SRM IST</span>
            </div>
        </div>
    );
};

export default Login;
