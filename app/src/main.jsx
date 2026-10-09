import { publicDemo } from "./publicDemo.mjs";
import React from "react";
import "./entry/entry.css";
import "./theme-accessibility.css";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const params = new URLSearchParams(location.search);
const showEntry = params.get("entry") === "1" || (publicDemo && !params.has("app") && !params.has("role") && !params.has("page") && !params.has("preview") && !params.has("data"));
const DemoEntry = React.lazy(() => import("./entry/DemoEntry.jsx"));
const isDriverPreview =
  new URLSearchParams(location.search).get("app") === "driver" ||
  (publicDemo && new URLSearchParams(location.search).get("role") === "driver");
const isConnected = !publicDemo && new URLSearchParams(location.search).get("data") === "isolated";
const ConnectedApp = React.lazy(() => import("./integration/ConnectedApp.jsx"));
const DriverApp = React.lazy(() => import("./driver/DriverApp.jsx"));
const AdminApp = React.lazy(() => import("./AdminEntry.jsx"));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={<p>画面を読み込んでいます…</p>}>
        {showEntry ? <DemoEntry /> : <>
          {params.get("demo") === "1" && <nav className="demo-return" aria-label="デモ共通ナビゲーション"><span>操作確認用デモ</span><a href="./?entry=1&v=20261009-share">ログイン画面に戻る</a></nav>}
          {isConnected ? <ConnectedApp /> : isDriverPreview ? <DriverApp /> : <AdminApp />}
        </>}
      </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
