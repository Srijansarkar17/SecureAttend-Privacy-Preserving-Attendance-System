import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, Users, BarChart3, ArrowRight, Lock, Camera } from 'lucide-react';
import { motion } from 'framer-motion';

const Home = () => {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-bold text-xl">S</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">SecureAttend</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-slate-600 font-medium hover:text-primary transition-colors">SignIn</Link>
            <Link to="/login" className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-primary/20">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 mb-6">
              <Zap size={16} className="text-amber-500 fill-amber-500" />
              <span>Future of Classroom Security</span>
            </div>
            <h1 className="text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] mb-8">
              Privacy-First <span className="text-accent underline underline-offset-8">Facial</span> Attendance
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mb-10">
              SecureAttend uses state-of-the-art ZK-SNARKs and ArcFace embeddings to verify identities without storing sensitive biometric data. Fast, secure, and tamper-proof.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link to="/login" className="btn-primary py-4 px-8 text-lg">
                Start Proving Identity <ArrowRight size={20} />
              </Link>
              <button className="btn-secondary py-4 px-8 text-lg">
                View Docs
              </button>
            </div>
            <div className="mt-12 flex items-center gap-8 grayscale opacity-50 justify-center lg:justify-start">
              <div className="font-bold text-2xl">UNESCO</div>
              <div className="font-bold text-2xl">MIT</div>
              <div className="font-bold text-2xl">STANFORD</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 relative"
          >
            <div className="w-full aspect-square bg-slate-100 rounded-3xl overflow-hidden relative shadow-2xl">
                {/* Visual Representation of Face Recognition */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                        <Camera size={200} className="text-slate-200" />
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 border-4 border-accent rounded-full -m-4"
                        />
                        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-accent/50 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </div>
                </div>
                <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center text-white">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <div className="text-white font-bold">ZK-SNARK Proof</div>
                                <div className="text-white/60 text-xs uppercase tracking-widest">Verified 0.2ms ago</div>
                            </div>
                        </div>
                        <div className="px-3 py-1 bg-success/20 text-success text-xs font-bold rounded-full border border-success/30">GROTH16</div>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="h-full bg-success shadow-[0_0_10px_#10B981]"
                        />
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4">Why SecureAttend?</h2>
            <p className="text-slate-500">Built for accuracy, designed for privacy.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: <ShieldCheck className="text-success" />, title: "Zero Data Leaks", desc: "We never store raw embeddings. Only cryptographic commitments reach the server." },
              { icon: <Zap className="text-warning" />, title: "Real-time Verification", desc: "Proof generation and verification happens in under 1 second on standard edge devices." },
              { icon: <Users className="text-accent" />, title: "Classroom Ready", desc: "Manage thousands of students with subject-wise analytics and automated logs." }
            ].map((f, i) => (
              <div key={i} className="dashboard-card p-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-8">
                  {f.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
