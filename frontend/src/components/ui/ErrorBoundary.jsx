import React from 'react';
import Button from './Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 [ErrorBoundary] Unhandled UI error caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F7F4] flex items-center justify-center p-6 text-[#191B1D]">
          <div className="max-w-md w-full bg-white border border-[#E6E5DE] rounded-3xl p-8 shadow-sm space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FBE8E8] border border-[#F5C2BE] flex items-center justify-center mx-auto text-[#9E2A2B]">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="font-editorial text-2xl text-[#191B1D]">
                Unexpected Interface Error
              </h2>
              <p className="text-xs text-[#7E828B] leading-relaxed">
                A rendering exception occurred in this view. The application has safeguarded your data and prevented a complete crash.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3.5 rounded-xl bg-[#F0EFEA] border border-[#E6E5DE] text-left">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7E828B] block mb-1">
                  Diagnostics
                </span>
                <p className="text-xs font-mono text-[#9E2A2B] break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={Home}
                onClick={this.handleGoHome}
              >
                Return to Dashboard
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={this.handleReload}
              >
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
