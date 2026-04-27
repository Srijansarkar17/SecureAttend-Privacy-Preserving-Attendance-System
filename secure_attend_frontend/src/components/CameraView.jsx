import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { Camera, ShieldCheck, X, Check, AlertCircle, Loader2, Shield, Lock, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../lib/supabase';

const CameraView = ({ mode, subject, onResult, onClose, onRegisterComplete, userId }) => {
    const webcamRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [result, setResult] = useState(null); // { type: 'success'|'error'|'warning', message, details }
    const [proofInfo, setProofInfo] = useState(null);

    const capture = useCallback(async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) {
            setResult({ type: 'error', message: 'Failed to capture image. Please try again.' });
            return;
        }

        setLoading(true);
        setResult(null);
        setProofInfo(null);
        const startTime = Date.now();
        
        try {
            // Convert base64 to blob
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            
            const formData = new FormData();
            formData.append('file', blob, 'capture.jpg');
            formData.append('subject', subject);
            
            if (mode === 'register') {
                if (!name.trim()) {
                    setResult({ type: 'error', message: 'Please enter the student name' });
                    setLoading(false);
                    return;
                }
                formData.append('name', name.trim());
                if (studentId.trim()) formData.append('student_id', studentId.trim());
                if (userId) formData.append('user_id', userId);

                const res = await axios.post(`${API_URL}/api/register`, formData);
                const elapsed = Date.now() - startTime;

                if (res.data.status === 'success') {
                    setResult({ 
                        type: 'success', 
                        message: `✅ ${name} registered successfully!`,
                        details: `Poseidon commitment generated in ${elapsed}ms`
                    });
                    setProofInfo({
                        hash: res.data.public_hash,
                        time: elapsed,
                    });
                    // Auto-close after 2 seconds
                    setTimeout(() => {
                        if (onRegisterComplete) onRegisterComplete();
                    }, 2500);
                } else {
                    setResult({ type: 'error', message: res.data.message || 'Registration failed' });
                }
            } else {
                const res = await axios.post(`${API_URL}/api/recognize`, formData);
                const elapsed = Date.now() - startTime;

                if (res.data.status === 'success') {
                    setResult({ 
                        type: 'success', 
                        message: `✅ ${res.data.name} — ZK Verified!`,
                        details: `Groth16 proof verified in ${elapsed}ms • Status: ${res.data.attendance_status || 'Present'}`
                    });
                    setProofInfo({
                        name: res.data.name,
                        time: elapsed,
                        verified: true,
                    });
                    setTimeout(() => {
                        onResult(res.data.name, res.data.status);
                    }, 2500);
                } else if (res.data.status === 'already_marked') {
                    setResult({ 
                        type: 'warning', 
                        message: res.data.message || `${res.data.name} already marked today`,
                    });
                    setTimeout(() => {
                        onResult(res.data.name, 'already_marked');
                    }, 2500);
                } else if (res.data.status === 'not_found') {
                    setResult({ type: 'error', message: 'Face not recognized. Student may not be registered.' });
                } else {
                    setResult({ type: 'error', message: res.data.message || 'Recognition failed' });
                }
            }
        } catch (error) {
            console.error("API error", error);
            const msg = error.response?.data?.detail || error.message || 'Error communicating with backend';
            setResult({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    }, [webcamRef, mode, subject, name, studentId, userId, onResult, onRegisterComplete]);

    return (
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl relative">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900">
                        {mode === 'register' ? 'Register Student' : 'Mark Attendance'}
                    </h3>
                    <p className="text-slate-500 font-medium">{subject}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={24} /></button>
            </div>

            {/* Camera */}
            <div className="aspect-video bg-black relative">
                <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user" }}
                />
                
                {/* Face Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none border-[20px] border-black/20" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-80 border-2 border-accent/50 border-dashed rounded-[40px] relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-2xl" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-2xl" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-2xl" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-2xl" />
                    </div>
                </div>

                {/* Loading Overlay */}
                <AnimatePresence>
                    {loading && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-primary/80 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                        >
                            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
                            <div className="font-bold tracking-widest uppercase text-xs mb-2">
                                {mode === 'register' ? 'Generating Poseidon Commitment...' : 'Generating Groth16 Proof...'}
                            </div>
                            <div className="text-white/40 text-xs flex items-center gap-2">
                                <Lock size={12} /> ZK-SNARK Security Active
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Result Overlay */}
                <AnimatePresence>
                    {result && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={`absolute inset-0 backdrop-blur-sm flex flex-col items-center justify-center text-white ${
                                result.type === 'success' ? 'bg-success/80' :
                                result.type === 'warning' ? 'bg-warning/80' :
                                'bg-danger/80'
                            }`}
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', bounce: 0.5 }}
                            >
                                {result.type === 'success' ? (
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                                        <Check size={40} />
                                    </div>
                                ) : result.type === 'warning' ? (
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                                        <AlertCircle size={40} />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                                        <X size={40} />
                                    </div>
                                )}
                            </motion.div>
                            <div className="font-bold text-lg mb-2">{result.message}</div>
                            {result.details && (
                                <div className="text-white/70 text-sm">{result.details}</div>
                            )}
                            {proofInfo?.hash && (
                                <div className="mt-4 p-3 bg-white/10 rounded-xl max-w-md">
                                    <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Poseidon Commitment</div>
                                    <div className="text-xs font-mono break-all">{proofInfo.hash}</div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="p-8 bg-slate-50 flex flex-col gap-6">
                {mode === 'register' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Student Full Name *</label>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Aditi Sharma"
                                className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Student ID (Optional)</label>
                            <input 
                                type="text" 
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="e.g. RA2211003010XXX"
                                className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold"
                            />
                        </div>
                    </div>
                )}
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-success">
                            <ShieldCheck size={18} />
                            <span className="text-xs font-bold uppercase tracking-widest">ZK-SNARK Enabled</span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Shield size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Groth16 Protocol</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="btn-secondary">Cancel</button>
                        <button 
                            disabled={loading || (result && result.type === 'success')}
                            onClick={capture} 
                            className="btn-primary px-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><Loader2 size={18} className="animate-spin" /> Processing...</>
                            ) : (
                                mode === 'register' ? 'Capture & Register' : 'Verify & Mark'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraView;
