// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import localforage from 'localforage';

const PASSWORD_KEY = 'wallet_password';
const MNEMONIC_KEY = 'wallet_mnemonic';

export default function Settings() {
  const navigate = useNavigate();
  const { setChain, setTokens } = useWallet();

  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [customNetwork, setCustomNetwork] = useState({ name: '', rpcUrl: '', chainId: '', ticker: '', explorerUrl: '' });
  const [networkError, setNetworkError] = useState('');

  const [showExportPrompt, setShowExportPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [phrase, setPhrase] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [showRemovePrompt, setShowRemovePrompt] = useState(false);

  const hashPassword = pw => {
    let h = 0;
    for (let i = 0; i < pw.length; i++) {
      h = (h << 5) - h + pw.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  };

  const handleAddNetwork = async () => {
    const { name, rpcUrl, chainId, ticker, explorerUrl } = customNetwork;
    if (!name || !rpcUrl || !chainId || !ticker || !explorerUrl) {
      setNetworkError('All fields are required');
      return;
    }
    const chainObj = { name, rpcUrl, chainId: Number(chainId), ticker, explorerUrl };
    setChain(chainObj);
    const defaultToken = { symbol: ticker, address: null, decimals: 18 };
    setTokens([defaultToken]);
    await localforage.setItem('chain', chainObj);
    await localforage.setItem('tokens', [defaultToken]);
    setCustomNetwork({ name: '', rpcUrl: '', chainId: '', ticker: '', explorerUrl: '' });
    setNetworkError('');
    setShowNetworkModal(false);
    navigate('/dashboard');
  };

  const handleExportClick = () => {
    setError('');
    setShowExportPrompt(true);
  };

  const handleConfirmExport = async () => {
    const storedHash = await localforage.getItem(PASSWORD_KEY);
    if (hashPassword(password) !== storedHash) {
      setError('Incorrect password');
      return;
    }
    const storedMnemonic = await localforage.getItem(MNEMONIC_KEY);
    if (!storedMnemonic) {
      setError('No mnemonic found');
      return;
    }
    setPhrase(storedMnemonic);
    setShowExportPrompt(false);
    setShowPhrase(true);
  };

  const handleClosePhrase = () => {
    setShowPhrase(false);
    setPassword('');
    setError('');
    setCopySuccess(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(phrase).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleRemoveWallet = async () => {
    // Clear all wallet-related data
    await localforage.removeItem(MNEMONIC_KEY);
    await localforage.removeItem(PASSWORD_KEY);
    await localforage.removeItem('chain');
    await localforage.removeItem('tokens');
    // Reset context
    setTokens([]);
    setChain({ name: '', chainId: 0, rpcUrl: '', ticker: '', explorerUrl: '' });
    // Navigate to login
    navigate('/');
  };

  return (
    <div className="h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="w-full max-w-lg bg-gray-700 bg-opacity-90 border border-yellow-500 rounded-3xl shadow-2xl p-8 space-y-6 backdrop-blur-sm text-white relative">
        <button
          className="absolute top-4 left-4 py-1 px-3 bg-gray-600 rounded hover:bg-gray-500"
          onClick={() => navigate(-1)}
        >&larr; Back</button>

        <h2 className="text-3xl font-bold text-center mb-4">Settings</h2>

        {/* Custom Network Button */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold">Custom Network</h3>
          <button
            className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600"
            onClick={() => setShowNetworkModal(true)}
          >Add Custom Network</button>
        </section>

        {/* Export mnemonic */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold">Recovery Phrase</h3>
          <button
            className="w-full py-2 bg-yellow-500 rounded hover:bg-yellow-600"
            onClick={handleExportClick}
          >Export Recovery Phrase</button>
        </section>

        {/* Remove wallet */}
        <section className="space-y-4">
          <h3 className="text-xl font-semibold">Danger Zone</h3>
          <button
            className="w-full py-2 bg-red-600 rounded hover:bg-red-700"
            onClick={() => setShowRemovePrompt(true)}
          >Remove Wallet</button>
        </section>

        {/* Network Modal */}
        {showNetworkModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-96">
              <h4 className="text-lg font-semibold text-white mb-4">Add Custom Network</h4>
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded"
                placeholder="Network Name"
                value={customNetwork.name}
                onChange={e => setCustomNetwork(c => ({ ...c, name: e.target.value }))}
              />
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded"
                placeholder="RPC URL"
                value={customNetwork.rpcUrl}
                onChange={e => setCustomNetwork(c => ({ ...c, rpcUrl: e.target.value }))}
              />
              <input
                type="number"
                className="w-full p-2 mb-2 bg-gray-700 rounded"
                placeholder="Chain ID"
                value={customNetwork.chainId}
                onChange={e => setCustomNetwork(c => ({ ...c, chainId: e.target.value }))}
              />
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded"
                placeholder="Currency Symbol"
                value={customNetwork.ticker}
                onChange={e => setCustomNetwork(c => ({ ...c, ticker: e.target.value }))}
              />
              <input
                className="w-full p-2 mb-4 bg-gray-700 rounded"
                placeholder="Block Explorer URL"
                value={customNetwork.explorerUrl}
                onChange={e => setCustomNetwork(c => ({ ...c, explorerUrl: e.target.value }))}
              />
              {networkError && <p className="text-red-400 text-sm mb-2">{networkError}</p>}
              <div className="flex justify-end space-x-2">
                <button
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white"
                  onClick={() => setShowNetworkModal(false)}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-yellow-500 rounded hover:bg-yellow-600 text-white"
                  onClick={handleAddNetwork}
                >Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Export Prompt Modal */}
        {showExportPrompt && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-80">
              <h4 className="text-lg font-semibold text-white mb-4">Confirm Export</h4>
              <p className="text-sm text-gray-300 mb-2">Enter your password to view your recovery phrase.</p>
              <div className="relative mb-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full p-2 bg-gray-700 rounded"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  className="absolute top-2 right-2 text-sm text-gray-400"
                  onClick={() => setShowPassword(prev => !prev)}
                >{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
              <div className="flex justify-end space-x-2">
                <button
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white"
                  onClick={() => setShowExportPrompt(false)}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-yellow-500 rounded hover:bg-yellow-600 text-white"
                  onClick={handleConfirmExport}
                >Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* Phrase Display Modal */}
        {showPhrase && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-80">
              <h4 className="text-lg font-semibold text-white mb-4">Your Recovery Phrase</h4>
              <textarea
                rows={3}
                className="w-full p-2 mb-4 bg-gray-700 rounded font-mono text-sm text-green-300"
                readOnly
                value={phrase}
              />
              <div className="flex justify-end items-center space-x-2">
                <button
                  className="px-4 py-2 bg-yellow-500 rounded hover:bg-yellow-600 text-white"
                  onClick={handleCopy}
                >Copy</button>
                {copySuccess && <span className="text-green-400 text-sm">Copied!</span>}
                <button
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white"
                  onClick={handleClosePhrase}
                >Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Wallet Prompt */}
        {showRemovePrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-80 max-h-full overflow-auto">
              <h4 className="text-lg font-semibold text-white mb-4">Remove Wallet</h4>
              <p className="text-sm text-gray-300 mb-4">This will delete your wallet and all data stored locally. This action cannot be undone. Are you sure?</p>
              <div className="flex justify-end space-x-2">
                <button
                  className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white"
                  onClick={() => setShowRemovePrompt(false)}
                >Cancel</button>
                <button
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-white"
                  onClick={handleRemoveWallet}
                >Remove</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
