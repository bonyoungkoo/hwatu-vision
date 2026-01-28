import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import CameraPage from "./page/camera/CameraPage";

function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/camera" replace />} />
      <Route path="/camera" element={<CameraPage />} />
    </Routes>
  );
}

export default App;
