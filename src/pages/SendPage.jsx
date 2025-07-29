// src/pages/SendPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { JsonRpcProvider, Wallet, parseEther, parseUnits, formatUnits, Contract, formatEther } from 'ethers';
import localforage from 'localforage';
import { DEFAULT_CHAINS } from '../config/chains';

export default function SendPage() {
  const navigate = useNavigate();
  const { chain, currentAddress, tokens, mnemonic } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('native');
  const [gasLimit, setGasLimit] = useState('21000');
  const [gasPrice, setGasPrice] = useState('1');
  const [balances, setBalances] = useState({});
  const [showTxModal, setShowTxModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Setup provider and signer from mnemonic
  const provider = useMemo(() => new JsonRpcProvider(chain.rpcUrl, chain.chainId), [chain]);
  const signer = useMemo(() => {
    if (!mnemonic) return null;
    try {
      return Wallet.fromPhrase(mnemonic).connect(provider);
    } catch (e) {
      console.error('Invalid mnemonic', e);
      return null;
    }
  }, [mnemonic, provider]);

  // Fetch balances
  useEffect(() => {
    if (!currentAddress) return;
    (async () => {
      const res = {};
      try {
        const rawNative = await provider.getBalance(currentAddress);
        res.native = parseFloat(formatUnits(rawNative, 18)).toFixed(4);
      } catch {
        res.native = '0.0000';
      }
      for (const t of tokens.filter(t => t.address)) {
        try {
          const c = new Contract(
            t.address,
            ['function balanceOf(address)view returns(uint256)', 'function decimals()view returns(uint8)'],
            provider
          );
          const rawBal = await c.balanceOf(currentAddress);
          const dec = t.decimals ?? await c.decimals();
          res[t.symbol] = parseFloat(formatUnits(rawBal, dec)).toFixed(4);
        } catch {
          res[t.symbol] = '0.0000';
        }
      }
      setBalances(res);
    })();
  }, [currentAddress, tokens, provider]);

  // Estimate default gas limit
  useEffect(() => {
    if (!provider || !currentAddress) return;
    provider.estimateGas({ to: currentAddress, value: parseEther('0') })
      .then(val => setGasLimit(val.toString()))
      .catch(() => {});
  }, [currentAddress, provider]);

  // Estimate gas on input change
  useEffect(() => {
    if (!recipient || !amount || !signer) return;
    (async () => {
      try {
        let est;
        if (token === 'native') {
          est = await signer.estimateGas({ to: recipient, value: parseEther(amount) });
        } else {
          const info = tokens.find(t => t.symbol === token);
          const c = new Contract(info.address, ['function transfer(address,uint256)view returns(bool)'], signer);
          est = await c.estimateGas.transfer(recipient, parseUnits(amount, info.decimals));
        }
        setGasLimit(est.toString());
      } catch {}
    })();
  }, [recipient, amount, token, signer, tokens]);

  //const setMax = () => setAmount(balances[token] || '0');
  const tooMuch = parseFloat(amount || '0') > parseFloat(balances[token] || '0');

  const calculateMax = async () => {
    if (!signer) return
    setIsCalculatingMax(true)

    try {
      // 1) user’s ETH address
      const address = await signer.getAddress()

      // 2) fetch balance from the provider
      const balance = await signer.provider.getBalance(address)

      // 3) gas price & limit → bigints
      const gasPriceBI = parseUnits(gasPrice, 'gwei')
      const gasLimitBI = BigInt(gasLimit)

      // 4) fee = gasPrice × gasLimit
      const fee = gasPriceBI * gasLimitBI

      // 5) subtract and error‑check
      const maxSendable = balance - fee
      if (maxSendable < 0n) throw new Error('Balance too low to cover gas')

      // 6) set the input
      setAmount(formatUnits(maxSendable, 'ether'))
    } catch (err) {
      setErrorMsg(err.message || 'Could not compute max amount')
      setShowErrorModal(true)
    } finally {
      setIsCalculatingMax(false)
    }
  }

  // Send transaction
  const handleSend = async () => {
    if (!signer) {
      setErrorMsg('Signer not available');
      setShowErrorModal(true);
      return;
    }
    if (tooMuch) {
      setErrorMsg('Amount exceeds balance');
      setShowErrorModal(true);
      return;
    }
    setIsSending(true);
    try {
      let tx;
      const txOpts = { gasLimit, gasPrice: parseUnits(gasPrice, 'gwei') };
      if (token === 'native') {
        tx = await signer.sendTransaction({ to: recipient, value: parseEther(amount), ...txOpts });
      } else {
        const info = tokens.find(t => t.symbol === token);
        const c = new Contract(info.address, ['function transfer(address,uint256)view returns(bool)'], signer);
        tx = await c.transfer(recipient, parseUnits(amount, info.decimals), txOpts);
      }
      setTxHash(tx.hash);
      await tx.wait();
      setShowTxModal(true);
    } catch (e) {
      setErrorMsg(e.message);
      setShowErrorModal(true);
    } finally {
      setIsSending(false);
    }
  };

  const explorer = DEFAULT_CHAINS.find(c => c.chainId === chain.chainId)?.explorerUrl;

  return (
    <>
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <div className="w-full max-w-lg bg-gray-700 bg-opacity-90 border border-yellow-500 rounded-3xl shadow-2xl p-8 space-y-6 backdrop-blur-sm text-white">
          <button className="mb-2 py-1 px-3 bg-gray-600 rounded hover:bg-gray-500" onClick={() => navigate(-1)}>&larr; Back</button>
          <h2 className="text-3xl font-bold">Send Funds</h2>

        {/* Asset Selector */}
        <div className="space-y-4">
          <label>Asset</label>
          <select
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full p-2 bg-gray-800 rounded"
          >
            {/* Native ETH */}
            <option value="native">
              {chain.ticker} — {balances.native || '0.0000'}
            </option>
            {/* ERC‑20 tokens */}
            {tokens
              .filter(t => t.address)
              .map(t => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} — {balances[t.symbol] || '0.0000'}
                </option>
              ))
            }
          </select>
        </div>

        {/* Recipient */}
        <div className="space-y-4">
          <label>Recipient Address</label>
          <input className="w-full p-2 bg-gray-800 rounded" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x..." />
        </div>

        {/* Amount + Max */}
        <div className="space-y-4">
          <label>Amount</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 p-2 bg-gray-800 border rounded"
              placeholder="0.0"
            />
            <button
              onClick={calculateMax}
              disabled={isCalculatingMax}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-500 rounded disabled:opacity-50"
            >
              {isCalculatingMax
                ? <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
                : 'Max'
              }
            </button>
          </div>
          {tooMuch && <p className="text-red-400 text-sm">Exceeds balance</p>}
        </div>

        {/* Gas Limit */}
        <div className="space-y-4">
          <label>Gas Limit</label>
          <div className="flex">
            <button className="px-3 bg-gray-600 rounded-l" onClick={() => setGasLimit(String(Math.max(0, BigInt(gasLimit || '0') - 1)))}>-</button>
            <input className="flex-1 p-2 bg-gray-800 text-center" value={gasLimit} onChange={e => setGasLimit(e.target.value)} />
            <button className="px-3 bg-gray-600 rounded-r" onClick={() => setGasLimit(String(BigInt(gasLimit || '0') + 1))}>+</button>
          </div>
        </div>

        {/* Gas Price */}
        <div className="space-y-4">
          <label>Gas Price (Gwei)</label>
          <div className="flex">
            <button className="px-3 bg-gray-600 rounded-l" onClick={() => setGasPrice(String(Math.max(0, parseInt(gasPrice || '0') - 1)))}>-</button>
            <input className="flex-1 p-2 bg-gray-800 text-center" value={gasPrice} onChange={e => setGasPrice(e.target.value)} />
            <button className="px-3 bg-gray-600 rounded-r" onClick={() => setGasPrice(String(parseInt(gasPrice || '0') + 1))}>+</button>
          </div>
        </div>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="w-full py-3 rounded bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 flex items-center justify-center"
          >
            {isSending
              ? <div className="h-6 w-6 rounded-full border-4 border-gray-200 border-t-yellow-500 border-white animate-spin" />
              : 'Send'
            }
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {showTxModal && explorer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-96 max-h-full overflow-auto">
            <h4 className="text-lg font-semibold text-white mb-4">Transaction Successful</h4>
            <div className="max-h-40 overflow-y-auto mb-4">
              <pre className="text-sm text-white whitespace-pre-wrap">Tx Hash: {txHash}</pre>
            </div>
            <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline mb-4 block">View on Explorer</a>
            <div className="flex justify-end">
              <button className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white" onClick={() => setShowTxModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-red-800 p-6 rounded-2xl shadow-lg w-96 max-h-full overflow-auto">
            <h4 className="text-lg font-semibold text-white mb-4">Error</h4>
            <div className="max-h-40 overflow-y-auto mb-4">
              <pre className="text-sm text-white whitespace-pre-wrap">{errorMsg}</pre>
            </div>
            <div className="flex justify-end mt-2">
              <button
                className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-white"
                onClick={() => setShowErrorModal(false)}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
