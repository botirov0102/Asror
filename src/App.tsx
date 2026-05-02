import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Send, 
  UserPlus, 
  Trophy, 
  TrendingUp, 
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle 
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { Student, OperationType, FirestoreErrorInfo } from './types';

// Error Handler
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newPoints, setNewPoints] = useState<Record<string, string>>({}); 
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('totalPoints', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData: Student[] = [];
      snapshot.forEach((doc) => {
        studentData.push({ id: doc.id, ...doc.data() } as Student);
      });
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    return () => unsubscribe();
  }, []);

  const handleUpdatePoints = async () => {
    setSending(true);
    setStatus(null);
    try {
      for (const studentId in newPoints) {
        const pointsToAdd = parseInt(newPoints[studentId]);
        if (isNaN(pointsToAdd) || pointsToAdd === 0) continue;
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
          totalPoints: student.totalPoints + pointsToAdd
        });
      }
      setNewPoints({});
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Telegramga yuborishda xatolik');
      }
      setStatus({ type: 'success', message: "Ma'lumotlar saqlandi va Telegram kanalga yuborildi!" });
    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', message: error.message || "Xatolik yuz berdi" });
    } finally {
      setSending(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      await addDoc(collection(db, 'students'), {
        name: newStudentName.trim(),
        totalPoints: 0,
        createdAt: serverTimestamp()
      });
      setNewStudentName('');
      setIsAddingUser(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const handlePointChange = (id: string, val: string) => {
    setNewPoints(prev => ({ ...prev, [id]: val }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-10 font-sans text-slate-900 border-x-0 md:border-8 border-white box-border">
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-grow">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-slate-200 pb-6 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-800">O'quvchilar Reytingi</h1>
            <p className="text-slate-500 font-medium">Barcha o'quvchilar ballari va telegram kanalga sinxronizatsiya</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
            <div className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span> Telegram Bot: Active
            </div>
            <button 
              onClick={() => setIsAddingUser(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <UserPlus size={14} />
              Yangi o'quvchi
            </button>
          </div>
        </div>

        {/* Status Notification */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`mb-6 p-4 rounded-lg flex items-center gap-3 font-bold text-xs uppercase tracking-wider ${
                status.type === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {status.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Summary Mini Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border-2 border-slate-100 p-4 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">O'quvchilar</p>
            <p className="text-2xl font-black text-slate-800">{students.length}</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">O'rtacha Ball</p>
            <p className="text-2xl font-black text-blue-600">
              {students.length > 0 
                ? Math.round(students.reduce((acc, curr) => acc + curr.totalPoints, 0) / students.length)
                : 0}
            </p>
          </div>
        </div>

        {/* List Header */}
        <div className="hidden md:grid grid-cols-2 gap-x-12 mb-4 px-4">
          <div className="grid grid-cols-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
            <div className="col-span-2">O'quvchi ismi</div>
            <div className="text-center">Hozirgi</div>
            <div className="text-right">Yangi ball</div>
          </div>
          <div className="grid grid-cols-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
            <div className="col-span-2">O'quvchi ismi</div>
            <div className="text-center">Hozirgi</div>
            <div className="text-right">Yangi ball</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs gap-3">
              <Loader2 className="animate-spin" size={20} />
              Yuklanmoqda...
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border-4 border-dashed border-slate-100 text-slate-400">
              <p className="font-bold uppercase tracking-widest text-sm mb-2">Hozircha o'quvchilar yo'q</p>
              <button onClick={() => setIsAddingUser(true)} className="text-blue-500 font-black hover:underline cursor-pointer">BIRINCHISINI QO'SHISH</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4 content-start">
              {students.map((student, index) => (
                <motion.div 
                  key={student.id}
                  layout
                  className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 flex items-center justify-between group hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 flex-shrink-0 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <span className="font-bold text-slate-700 truncate">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-lg font-mono font-bold text-blue-600">{student.totalPoints}</span>
                    <input 
                      type="number" 
                      placeholder="+" 
                      value={newPoints[student.id] || ''}
                      onChange={(e) => handlePointChange(student.id, e.target.value)}
                      className="w-16 h-10 border-2 border-slate-100 rounded text-center font-bold font-mono focus:border-blue-400 outline-none transition-colors"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Action Section / Footer */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between bg-slate-800 p-6 rounded-xl gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold tracking-tight">Telegram Sinxronizatsiya</p>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest underline decoration-sky-500/50 underline-offset-4">@Hisobot kanali orqali yuboriladi</p>
            </div>
          </div>
          <button 
            onClick={handleUpdatePoints}
            disabled={sending || Object.keys(newPoints).length === 0}
            className={`w-full md:w-auto font-black px-10 py-4 rounded-lg uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 ${
              sending || Object.keys(newPoints).length === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-900/40'
            }`}
          >
            {sending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : <Save size={20} />}
            Saqlash va Yuborish
          </button>
        </div>
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isAddingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setIsAddingUser(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md border-t-8 border-blue-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">Yangi O'quvchi</h2>
                <button 
                  onClick={() => setIsAddingUser(false)}
                  className="p-2 hover:bg-slate-100 rounded text-slate-400 transition-colors"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleAddStudent}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Ism va Familya</label>
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Asrorbek Sultonov"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-bold text-slate-700"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newStudentName.trim()}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    Qo'shish
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
