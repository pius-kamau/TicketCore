import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MPESA_API_URL = process.env.MPESA_ENVIRONMENT === 'production' 
  ? 'https://api.safaricom.co.ke' 
  : 'https://sandbox.safaricom.co.ke';

let accessToken: string | null = null;
let tokenExpiry: Date | null = null;

export async function getAccessToken() {
  if (accessToken && tokenExpiry && new Date() < tokenExpiry) {
    return accessToken;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      `${MPESA_API_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1);
    
    return accessToken;
  } catch (error) {
    console.error('Error getting M-Pesa token:', error);
    throw error;
  }
}

export async function stkPush(phoneNumber: string, amount: number, accountReference: string, transactionDesc: string) {
  const token = await getAccessToken();
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const data = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phoneNumber,
    PartyB: shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: `${process.env.APP_URL}/api/payments/mpesa-callback`,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const response = await axios.post(
      `${MPESA_API_URL}/mpesa/stkpush/v1/processrequest`,
      data,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('STK Push error:', error);
    throw error;
  }
}