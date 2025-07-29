import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './contexts/WalletContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SendPage from './pages/SendPage';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { mnemonic } = useWallet();
  return mnemonic ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/send"
            element={
              <ProtectedRoute>
                <SendPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  );
}