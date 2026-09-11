import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("ECO DUMP rendering error", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div>
          <p>ECO DUMP</p>
          <h1>画面を表示できませんでした</h1>
          <span>通信状況をご確認のうえ、画面を再読み込みしてください。</span>
          <button type="button" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </div>
      </main>
    );
  }
}
