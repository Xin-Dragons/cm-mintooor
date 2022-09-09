import classnames from "classnames";
import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getAtaForMint, unwrapTransaction } from './utils';
import {
  Container,
  Snackbar,
  Paper,
  CircularProgress,
} from "@material-ui/core";
import { CTAButton } from "./MintButton";

import { PublicKey } from "@solana/web3.js";

import toast from "react-hot-toast";
// import CountUp from "react-countup";

import axios from "axios";

export default function Claim({ wlSettings, canClaim }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [tokensToClaim, setTokensToClaim] = useState();
  const [tokenBalance, setTokenBalance] = useState(0);

  async function getTokensToClaim() {
    try {
      setLoading(true);

      const options = {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_API_SECRET_KEY}`
        }
      }

      const res = await axios.get(`${process.env.REACT_APP_API_URL}/claim/${wlSettings.table}/get-claimable-tokens/${wallet.publicKey}`, options);
      const { tokens } = res.data

      setLoading(false);

      if (res.status === 200) {
        setTokensToClaim(tokens);
      }
    } catch (err) {
      console.log(err.response.data)
      setLoading(false);
      toast.error("Error getting token balance");
    }
  }

  async function getTokenBalance() {
    try {
      const [token] = await getAtaForMint(new PublicKey(wlSettings.mint), wallet.publicKey)
      const balance = await connection.getTokenAccountBalance(token);
      setTokenBalance(balance?.value?.uiAmount || 0);
    } catch (err) {
      console.log(err)
      setTokenBalance(0);
    }
  }

  useEffect(() => {
    if (!wallet.publicKey) {
      return;
    }
    getTokensToClaim();
    getTokenBalance();
  }, [wallet.publicKey, wlSettings]);

  async function claim() {
    if (!canClaim) {
      return false
    }
    try {
      setLoading(true);

      const options = {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_API_SECRET_KEY}`
        }
      }

      const res = await axios.post(`${process.env.REACT_APP_API_URL}/claim/${wlSettings.table}/get-transaction`, { publicKey: wallet.publicKey, wlToken: true }, options);

      let { transaction } = res.data;

      transaction = unwrapTransaction(transaction);
      const signedTransaction = await wallet.signTransaction(transaction, connection);
      const isVerifiedSignature = signedTransaction.verifySignatures();

      if (!isVerifiedSignature) {
        throw new Error('Error signing transaction');
      }

      const rawTransaction = signedTransaction.serialize();

      const data = {
        rawTransaction,
        publicKey: wallet.publicKey
      };

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/claim/${wlSettings.table}/send`, data, options);

      toast.success('Claim successful!');
      setLoading(false);
      setTokenBalance(tokenBalance + tokensToClaim);
      setTokensToClaim(0);

    } catch (e) {
      let message = e?.response?.data?.message || e?.response?.data || e.message || 'Something went wrong';

      if (message.includes('Timeout waiting for confirmation.')) {
        setTokensToClaim(0);
      }

      if (message.includes('Attempt to debit an account but found no record of a prior credit')) {
        message = 'Not enough SOL to create token account'
      }
      toast.error(`Claim Error: ${message}`);
      setLoading(false);
    }
  }

  return (
    <Container>
      <Container maxWidth="xs">
      <Paper>
          <main>

            {wallet.connected && (
              <div>
                <h2>{wlSettings.title}</h2>
                <h3>
                  Minting tokens to claim: { tokensToClaim }
                </h3>
                <h3>Minting token balance: {tokenBalance}</h3>
                {
                  !canClaim && <p>Minting token claim opens 15 mins before minting round</p>
                }
                <CTAButton
                  disabled={loading || tokensToClaim === 0 || !canClaim}
                  onClick={claim}
                >
                  {loading ? (
                    <CircularProgress />
                  ) : (
                    "Claim"
                  )}
                </CTAButton>
              </div>
            )}

          </main>
        </Paper>
      </Container>
    </Container>
  );
}
