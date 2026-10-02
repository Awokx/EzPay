/**
 * Stellar Wallet Integration Helpers
 * This module provides utilities for connecting to Stellar wallets
 * using the Stellar SDK and wallet connectors
 */

import * as StellarSdk from 'stellar-sdk';
import config from './config';

// TypeScript declarations for wallet extensions
declare global {
  interface Window {
    freighter?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, network: string) => Promise<string>;
      isConnected: () => Promise<boolean>;
    };
    albedo?: {
      publicKey: () => Promise<{ address: string }>;
      sign: (xdr: string, network: string) => Promise<{ signedXDR: string }>;
    };
    lobstr?: {
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string) => Promise<string>;
    };
    rabet?: {
      connect: () => Promise<string>;
      sign: (xdr: string) => Promise<string>;
    };
  }
}

export const STELLAR_CONFIG = {
  network: config.stellar.network === 'public' ? 'PUBLIC' : 'TESTNET',
  serverUrl: config.stellar.rpcUrl,
  networkPassphrase: config.stellar.networkPassphrase,
};

/**
 * Connects to a Stellar wallet (Freighter, Lobstr, Albedo, or Rabet)
 * Tries multiple wallet providers in order
 */
export async function connectWallet(): Promise<string> {
  console.log('Initiating wallet connection...');
  
  // Try Freighter first (most popular)
  if (window.freighter) {
    try {
      const address = await window.freighter.getPublicKey();
      console.log('Connected via Freighter:', address);
      return address;
    } catch (error) {
      console.error('Freighter connection failed:', error);
    }
  }
  
  // Try Albedo
  if (window.albedo) {
    try {
      const { address } = await window.albedo.publicKey();
      console.log('Connected via Albedo:', address);
      return address;
    } catch (error) {
      console.error('Albedo connection failed:', error);
    }
  }
  
  // Try Lobstr
  if (window.lobstr) {
    try {
      const address = await window.lobstr.getPublicKey();
      console.log('Connected via Lobstr:', address);
      return address;
    } catch (error) {
      console.error('Lobstr connection failed:', error);
    }
  }
  
  // Try Rabet
  if (window.rabet) {
    try {
      const address = await window.rabet.connect();
      console.log('Connected via Rabet:', address);
      return address;
    } catch (error) {
      console.error('Rabet connection failed:', error);
    }
  }
  
  throw new Error('No Stellar wallet found. Please install Freighter, Albedo, Lobstr, or Rabet.');
}

/**
 * Disconnects from the Stellar wallet
 * Note: Most wallets don't have a formal disconnect, this clears local state
 */
export async function disconnectWallet(): Promise<void> {
  console.log('Disconnecting wallet...');
  // Wallets typically don't have a disconnect method
  // The actual disconnection is handled by clearing state in the store
  return Promise.resolve();
}

/**
 * Validates a Stellar public key
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    StellarSdk.StrKey.decodeEd25519PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a short version of the address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Generates a new embedded Stellar wallet (keypair)
 * Returns both public and secret keys
 */
export function generateEmbeddedWallet(): { publicKey: string; secretKey: string } {
  console.log('Generating new embedded wallet...');
  const keypair = StellarSdk.Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();
  console.log('Embedded wallet generated. Public key:', publicKey);
  return { publicKey, secretKey };
}

/**
 * Validates an embedded wallet secret (private key)
 */
export function isValidStellarSecret(secret: string): boolean {
  try {
    StellarSdk.Keypair.fromSecret(secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Signs a transaction using the connected wallet
 */
export async function signTransaction(xdr: string): Promise<string> {
  // Try Freighter
  if (window.freighter) {
    return await window.freighter.signTransaction(xdr, STELLAR_CONFIG.networkPassphrase);
  }
  
  // Try Albedo
  if (window.albedo) {
    const result = await window.albedo.sign(xdr, STELLAR_CONFIG.networkPassphrase);
    return result.signedXDR;
  }
  
  // Try Lobstr
  if (window.lobstr) {
    return await window.lobstr.signTransaction(xdr);
  }
  
  // Try Rabet
  if (window.rabet) {
    return await window.rabet.sign(xdr);
  }
  
  throw new Error('No wallet connected for signing');
}

/**
 * Checks if a wallet is available
 */
export function isWalletAvailable(): boolean {
  return !!(window.freighter || window.albedo || window.lobstr || window.rabet);
}

/**
 * Gets the name of the connected wallet
 */
export function getConnectedWalletName(): string | null {
  if (window.freighter) return 'Freighter';
  if (window.albedo) return 'Albedo';
  if (window.lobstr) return 'Lobstr';
  if (window.rabet) return 'Rabet';
  return null;
}
