import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import RegisterClub from './pages/RegisterClub.jsx'
import Dashboard from './pages/Dashboard.jsx'
import StudentList from './pages/StudentList.jsx'
import StudentForm from './pages/StudentForm.jsx'
import CoachList from './pages/CoachList.jsx'
import CoachForm from './pages/CoachForm.jsx'
import SessionList from './pages/SessionList.jsx'
import SessionCreate from './pages/SessionCreate.jsx'
import AttendanceView from './pages/AttendanceView.jsx'
import TimingEntry from './pages/TimingEntry.jsx'
import TimingHistory from './pages/TimingHistory.jsx'
import ProgressReport from './pages/ProgressReport.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminClubDetail from './pages/AdminClubDetail.jsx'
import Profile from './pages/Profile.jsx'
import OfflineScreen from './components/OfflineScreen.jsx'

export default function App() {
  return (
    <>
    <OfflineScreen />
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterClub />} />

      {/* Coach (head + assistant) */}
      <Route element={<ProtectedRoute roles={['head_coach', 'assistant_coach']} />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/:id/edit" element={<StudentForm />} />
          <Route path="/students/:id/progress" element={<ProgressReport />} />
          <Route path="/students/:id/timings" element={<TimingHistory />} />
          <Route path="/sessions" element={<SessionList />} />
          <Route path="/sessions/new" element={<SessionCreate />} />
          <Route path="/sessions/:id/attendance" element={<AttendanceView />} />
          <Route path="/timings/entry" element={<TimingEntry />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Head coach only */}
      <Route element={<ProtectedRoute roles={['head_coach']} />}>
        <Route element={<Layout />}>
          <Route path="/coaches" element={<CoachList />} />
          <Route path="/coaches/new" element={<CoachForm />} />
        </Route>
      </Route>

      {/* Super admin */}
      <Route element={<ProtectedRoute roles={['super_admin']} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/clubs/:id" element={<AdminClubDetail />} />
      </Route>
    </Routes>
    </>
  )
}
