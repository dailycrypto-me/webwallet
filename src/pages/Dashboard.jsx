// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { JsonRpcProvider, formatEther, parseUnits, formatUnits, Contract } from 'ethers';
import localforage from 'localforage';
import { DEFAULT_CHAINS } from '../config/chains';

const PASSWORD_KEY = 'wallet_password';

export default function Dashboard() {
  const { chain, setChain, currentAddress, tokens, setTokens } = useWallet();
  const [balance, setBalance] = useState('0.0');
  const [tokenBalances, setTokenBalances] = useState({});
  const [error, setError] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(chain.name);
  const [activeTab, setActiveTab] = useState('overview');
  const [history, setHistory] = useState([]);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState({ name: '', symbol: '', address: '', decimals: 18 });
  const [tokenError, setTokenError] = useState('');

  const navigate = useNavigate();
  const currentChainObj = DEFAULT_CHAINS.find(c => c.name === selectedNetwork) || {};

  const provider = useMemo(() => {
    try {
      return new JsonRpcProvider(chain.rpcUrl, chain.chainId);
    } catch (err) {
      console.error(err);
      setError('Network error');
      return null;
    }
  }, [chain]);

  useEffect(() => {
    if (!currentAddress || !provider) return;
    let cancel = false;
    provider.getBalance(currentAddress)
      .then(raw => !cancel && setBalance(formatEther(raw)))
      .catch(() => !cancel && setError('Failed to fetch balance'));
    return () => { cancel = true; };
  }, [currentAddress, provider]);

  useEffect(() => {
    if (!currentAddress || !provider) return;
    let cancel = false;
    (async () => {
      const b = {};
      for (const t of tokens.filter(t => t.address)) {
        if (cancel) break;
        try {
          const c = new Contract(
            t.address,
            ['function balanceOf(address)view returns(uint256)', 'function decimals()view returns(uint8)'],
            provider
          );
          const raw = await c.balanceOf(currentAddress);
          const dec = t.decimals ?? await c.decimals();
          b[t.symbol] = Number(formatUnits(raw, dec)).toFixed(4);
        } catch {
          b[t.symbol] = '0.0000';
        }
      }
      if (!cancel) setTokenBalances(b);
    })();
    return () => { cancel = true; };
  }, [currentAddress, tokens, provider]);

  useEffect(() => {
    localforage.getItem('tx_history').then(stored => stored && setHistory(stored));
  }, []);

  const handleNetworkChange = e => {
    const name = e.target.value;
    const found = DEFAULT_CHAINS.find(c => c.name === name);
    if (!found) return;
    setSelectedNetwork(name);
    setChain(found);
    const defaultToken = { symbol: found.ticker, address: null, decimals: 18 };
    setTokens([defaultToken]);
    localforage.setItem('chain', found);
    localforage.setItem('tokens', [defaultToken]);
  };

  const handleAddToken = async () => {
    const { name, symbol, address, decimals } = newToken;
    if (!name || !symbol || !address || !decimals) {
      setTokenError('All fields are required');
      return;
    }
    const updated = [...tokens, { name, symbol, address, decimals: Number(decimals) }];
    setTokens(updated);
    await localforage.setItem('tokens', updated);
    setNewToken({ name: '', symbol: '', address: '', decimals: 18 });
    setTokenError('');
    setShowTokenModal(false);
  };

  const handleLogout = async () => {
    // nukes their account permanently
    //await localforage.removeItem('mnemonic');
    //await localforage.removeItem(PASSWORD_KEY);
    navigate('/');
  };

  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-black">
      <div className="w-full max-w-xl bg-gray-700 bg-opacity-90 border border-yellow-500 rounded-3xl shadow-2xl p-6 space-y-6 backdrop-blur-sm">

        <header className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <div className="flex items-center space-x-3">
            {currentChainObj.logoUrl && (<img src={currentChainObj.logoUrl} alt={currentChainObj.name} className="h-6 w-6 rounded" />)}
            <select
              className="p-1 bg-gray-800 text-white rounded"
              value={selectedNetwork}
              onChange={handleNetworkChange}
            >
              {DEFAULT_CHAINS.map(c => <option key={c.chainId} value={c.name}>{c.name}</option>)}
            </select>
            <button className="py-1 px-3 bg-red-600 rounded hover:bg-red-700 text-white" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        <div className="flex space-x-4 justify-center mb-6">
          <Link to="/send" className="flex-1 py-3 bg-yellow-500 rounded-lg text-center hover:bg-yellow-600 text-white">Send</Link>
          <button
            className="flex-1 py-3 bg-gray-600 rounded-lg text-center hover:bg-gray-500 text-white"
            onClick={() => setShowTokenModal(true)}
          >Add Custom Token</button>
          <Link to="/settings" className="flex-1 py-3 bg-gray-600 rounded-lg text-center hover:bg-gray-500 text-white">Settings</Link>
        </div>

        <div className="flex space-x-4 border-b border-gray-600 pb-2">
          <button onClick={() => setActiveTab('overview')} className={`${activeTab==='overview'?'border-b-2 border-yellow-400 text-white':'text-gray-400'} pb-1`}>Overview</button>
          <button onClick={() => setActiveTab('history')} className={`${activeTab==='history'?'border-b-2 border-yellow-400 text-white':'text-gray-400'} pb-1`}>History</button>
        </div>

        {activeTab === 'overview' && (
          <section className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p><span className="font-medium text-gray-300">Address:</span> <span className="text-white">{currentAddress}</span></p>
              <p><span className="font-medium text-gray-300">Balance:</span> <span className="text-white">{balance} {chain.ticker}</span></p>
            </div>
            {Object.keys(tokenBalances).length > 0 && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium text-gray-300 mb-2">Token Balances</h3>
                <ul className="list-disc list-inside space-y-1 text-white">
                  {Object.entries(tokenBalances).map(([sym, bal]) => (<li key={sym}>{sym}: {bal}</li>))}
                </ul>
              </div>
            )}
          </section>
        )}

        {activeTab === 'history' && (
          <section className="space-y-2 p-2 bg-gray-800 rounded-lg">
            {history.length === 0
              ? <p className="text-gray-400 text-center">No transactions yet.</p>
              : history.map((tx, i) => (
                  <div key={i} className="p-2 bg-gray-700 rounded">
                    <p><span className="font-medium">Tx Hash:</span> {tx.hash}</p>
                    <p><span className="font-medium">Amount:</span> {tx.amount} {tx.symbol}</p>
                    <p><span className="font-medium">To:</span> {tx.to}</p>
                  </div>
                ))}
          </section>
        )}

        {showTokenModal && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-96">
              <h4 className="text-lg font-semibold text-white mb-4">Add Custom Token</h4>
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded text-white"
                placeholder="Token Name"
                value={newToken.name}
                onChange={e => setNewToken(t => ({ ...t, name: e.target.value }))}
              />
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded text-white"
                placeholder="Symbol"
                value={newToken.symbol}
                onChange={e => setNewToken(t => ({ ...t, symbol: e.target.value }))}
              />
              <input
                className="w-full p-2 mb-2 bg-gray-700 rounded text-white"
                placeholder="Contract Address"
                value={newToken.address}
                onChange={e => setNewToken(t => ({ ...t, address: e.target.value }))}
              />
              <input
                type="number"
                className="w-full p-2 mb-4 bg-gray-700 rounded text-white"
                placeholder="Decimals"
                value={newToken.decimals}
                onChange={e => setNewToken(t => ({ ...t, decimals: Number(e.target.value) }))}
              />
              {tokenError && <p className="text-red-400 text-sm mb-2">{tokenError}</p>}
              <div className="flex justify-end space-x-2">
                <button className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white" onClick={() => setShowTokenModal(false)}>Cancel</button>
                <button className="px-4 py-2 bg-yellow-500 rounded hover:bg-yellow-600 text-white" onClick={handleAddToken}>Add</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
