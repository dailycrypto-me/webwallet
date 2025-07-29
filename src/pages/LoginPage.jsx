// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { Wallet } from 'ethers';
import localforage from 'localforage';
import logo from '../assets/logo.png';

const PASSWORD_KEY = 'wallet_password';
const MNEMONIC_KEY = 'wallet_mnemonic';

export default function LoginPage() {
  const { importMnemonic } = useWallet();
  const navigate = useNavigate();

  const [step, setStep] = useState('menu'); // 'menu' | 'create-pw' | 'create-mnemonic' | 'import' | 'login'
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [storedHash, setStoredHash] = useState(null);
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if password & mnemonic saved
    localforage.getItem(PASSWORD_KEY).then(hash => {
      if (hash) {
        setStoredHash(hash);
        setHasPassword(true);
      }
    });
  }, []);

  const hashPassword = pw => {
    let hash = 0;
    for (let i = 0; i < pw.length; i++) {
      hash = (hash << 5) - hash + pw.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  };

  // Create wallet: password confirmation
  const handleSetPassword = async () => {
    setError('');
    if (!password || !confirmPw) {
      setError('Enter and confirm your password'); return;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match'); return;
    }
    const hash = hashPassword(password);
    await localforage.setItem(PASSWORD_KEY, hash);
    setStoredHash(hash);
    setHasPassword(true);
    setStep('create-mnemonic');
  };

  // Generate mnemonic
  const handleGenerate = () => {
    const w = Wallet.createRandom();
    setMnemonic(w.mnemonic.phrase);
    setError('');
  };

  // Continue after mnemonic
  const handleContinueCreate = async () => {
    if (!mnemonic) { setError('Generate or enter mnemonic'); return; }
    await localforage.setItem(MNEMONIC_KEY, mnemonic);
    await importMnemonic(mnemonic);
    navigate('/dashboard');
  };

  // Import wallet flow
  const handleImport = async () => {
    setError('');
    if (!mnemonic)       { setError('Enter your mnemonic');           return; }
    if (!password || !confirmPw) {
      setError('Enter and confirm a password');
      return;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match');
      return;
    }
    // mirror Create flow: save password hash
    const hash = hashPassword(password);
    await localforage.setItem(PASSWORD_KEY, hash);
    await localforage.setItem(MNEMONIC_KEY, mnemonic);
    await importMnemonic(mnemonic);
    navigate('/dashboard');
  };

  // Login flow
  const handleLogin = async () => {
    setError('');
    if (hashPassword(password) !== storedHash) { setError('Incorrect password'); return; }
    const storedMn = await localforage.getItem(MNEMONIC_KEY);
    if (!storedMn) { setError('No wallet found'); return; }
    await importMnemonic(storedMn);
    navigate('/dashboard');
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-2xl shadow-lg space-y-6 text-white">
        {step === 'menu' && (
          <>
            <img src={logo} alt="App Logo" className="block w-1/2 h-auto mb-6 mx-auto" />
            <h2 className="text-2xl font-semibold text-center">Welcome to Daily Wallet</h2>
            <button className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600" onClick={() => setStep('create-pw')}>Create New Wallet</button>
            <button className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600" onClick={() => setStep('import')}>Import Wallet</button>
            {hasPassword && <button className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600" onClick={() => setStep('login')}>Login with Password</button>}
          </>
        )}

        {step === 'create-pw' && (
          <>
            <h2 className="text-2xl font-semibold">Create a Password</h2>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full p-2 bg-gray-700 rounded focus:ring-2 focus:ring-yellow-500"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button className="absolute top-2 right-2 text-sm text-gray-400" onClick={() => setShowPw(prev => !prev)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full p-2 bg-gray-700 rounded focus:ring-2 focus:ring-yellow-500"
              placeholder="Confirm password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />
            <div className="flex items-center">
              <input type="checkbox" id="showPw" checked={showPw} onChange={() => setShowPw(prev => !prev)} className="mr-2" />
              <label htmlFor="showPw" className="text-sm text-gray-400">Show Passwords</label>
            </div>
            {error && <p className="text-red-400">{error}</p>}
            <button className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600" onClick={handleSetPassword}>Next</button>
          </>
        )}

        {step === 'create-mnemonic' && (
          <>
            <h2 className="text-2xl font-semibold">Your Recovery Phrase</h2>
            <textarea rows={3} className="w-full p-2 bg-gray-700 rounded font-mono text-sm text-green-300" readOnly value={mnemonic} />
            <button className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600" onClick={handleGenerate}>Generate New Phrase</button>
            <button className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600" onClick={handleContinueCreate}>Continue</button>
            {error && <p className="text-red-400">{error}</p>}
          </>
        )}

        {step === 'import' && (
          <>
            <h2 className="text-2xl font-semibold">Import Wallet</h2>
            <textarea
              rows={3}
              className="w-full p-2 bg-gray-700 rounded font-mono text-sm"
              placeholder="Enter your 12 or 24-word mnemonic phrase"
              value={mnemonic}
              onChange={e => setMnemonic(e.target.value)}
            />
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full p-2 bg-gray-700 rounded focus:ring-2 focus:ring-yellow-500 mt-2"
              placeholder="Choose a password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full p-2 bg-gray-700 rounded focus:ring-2 focus:ring-yellow-500 mt-2"
              placeholder="Confirm password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />
            {error && <p className="text-red-400">{error}</p>}
            <button className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600" onClick={handleImport}>Import</button>
          </>
        )}

        {step === 'login' && (
          <>
            <h2 className="text-2xl font-semibold">Unlock Wallet</h2>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full p-2 bg-gray-700 rounded focus:ring-2 focus:ring-yellow-500"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button className="absolute top-2 right-2 text-sm text-gray-400" onClick={() => setShowPw(prev => !prev)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {error && <p className="text-red-400">{error}</p>}
            <button className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600" onClick={handleLogin}>Login</button>
          </>
        )}
      </div>
    </div>
  );
}
