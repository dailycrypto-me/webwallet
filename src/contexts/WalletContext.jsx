// src/contexts/WalletContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Wallet } from 'ethers';
import localforage from 'localforage';

// Context to manage wallet state and derivation
const WalletContext = createContext();

const PASSWORD_KEY = 'wallet_password';
const MNEMONIC_KEY = 'wallet_mnemonic';

export function WalletProvider({ children }) {
  const [mnemonic, setMnemonic] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [currentAddress, setCurrentAddress] = useState(null);
  const [chain, setChain] = useState({
    name: 'Daily Mainnet',
    chainId: 824,
    rpcUrl: 'https://rpc.mainnet.dailycrypto.net/',
    ticker: 'DLY'
  });
  const [tokens, setTokens] = useState([
    { symbol: 'DLY', address: null, decimals: 18 }
  ]);

  // Load saved mnemonic and derive the first address on mount
  useEffect(() => {
    // if the user never set a password, auto‑load their wallet
    localforage.getItem(PASSWORD_KEY).then(hash => {
      if (!hash) {
        localforage.getItem(MNEMONIC_KEY).then(saved => {
          if (saved) {
            setMnemonic(saved);
            const wallet0 = Wallet.fromPhrase(saved, "m/44'/60'/0'/0/0");
            setAddresses([wallet0.address]);
            setCurrentAddress(wallet0.address);
          }
        });
      }
      // if they have a password, we wait for Login → handleLogin → importMnemonic
    });
  }, []);

  // Import a new mnemonic or after generation
  const importMnemonic = async (phrase) => {
    await localforage.setItem('mnemonic', phrase);
    setMnemonic(phrase);
    const wallet0 = Wallet.fromPhrase(phrase, "m/44'/60'/0'/0/0");
    setAddresses([wallet0.address]);
    setCurrentAddress(wallet0.address);
  };

  // Derive additional addresses by index
  const createAddress = (index) => {
    if (!mnemonic) return;
    const path = `m/44'/60'/0'/0/${index}`;
    const derived = Wallet.fromPhrase(mnemonic, path);
    if (!addresses.includes(derived.address)) {
      setAddresses(prev => [...prev, derived.address]);
    }
    setCurrentAddress(derived.address);
  };

  return (
    <WalletContext.Provider value={{
      mnemonic,
      addresses,
      currentAddress,
      chain,
      tokens,
      setChain,
      setTokens,
      importMnemonic,
      createAddress
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
