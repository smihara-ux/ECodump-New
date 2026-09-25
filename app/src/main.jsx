import React from "react";
import "./theme-accessibility.css";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const isDriverPreview =
  new URLSearchParams(location.search).get("app") === "driver";
const isConnected = new URLSearchParams(location.search).get("data") === "isolated";
const ConnectedApp = React.lazy(() => import("./integration/ConnectedApp.jsx"));
const DriverApp = React.lazy(() => import("./driver/DriverApp.jsx"));
const AdminApp = React.lazy(() => import("./AdminEntry.jsx"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={<p>画面を読み込んでいます…</p>}>
        {isConnected ? <ConnectedApp /> : isDriverPreview ? <DriverApp /> : <AdminApp />}
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
