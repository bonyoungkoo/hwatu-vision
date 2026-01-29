import CameraPage from "@/page/camera/CameraPage";
import SetupPage from "@/page/setup/SetupPage";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  { path: "/", element: <SetupPage /> },
  { path: "/setup", element: <SetupPage /> },
  { path: "/camera", element: <CameraPage /> },
]);
