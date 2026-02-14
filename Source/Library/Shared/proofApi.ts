// Source/Library/Shared/proofApi.ts
import { getApiUrl } from '../utils/env';

const API_BASE_URL = getApiUrl();

// Proof data types based on the jobs table schema
export interface ProofData {
  id: number;
  runnerId: string;
  jobName: string;
  customerName?: string;
  salesName?: string;
  proofStatus: string;
  position: number;
  createdById: number;
  createdByRole: string;
  createdByName: string;
  updatedById?: number;
  updatedByRole?: string;
  updatedByName?: string;
  formData: any; // JSON object containing form data
  createdAt: string;
  updatedAt: string;
}

export interface CreateProofParams {
  runnerId: string;
  jobName: string;
  customerName?: string;
  customerId?: string;
  salesName?: string;
  proofStatus?: string;
  position?: number;
  formData: any;
  chatUuid?: string; // Link proof to chat
}

export interface NextRunnerIDResponse {
  runnerId: string;
  prefix: string;
}

export interface ProofApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Gets the next available runner ID for a given prefix
 */
export async function getNextRunnerID(prefix: 'WMT' | 'DR' | 'NRM'): Promise<string> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof/next-runner-id?prefix=${prefix}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get next runner ID: ${response.statusText}`);
  }

  const result: ProofApiResponse<NextRunnerIDResponse> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get next runner ID');
  }

  return result.data.runnerId;
}

/**
 * Fetches all proof data entries
 */
export async function getAllProofData(): Promise<ProofData[]> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch proof data: ${response.statusText}`);
  }

  const result: ProofApiResponse<ProofData[]> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch proof data');
  }

  return result.data || [];
}

/**
 * Fetches a single proof data entry by ID
 */
export async function getProofDataById(id: number): Promise<ProofData> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch proof data: ${response.statusText}`);
  }

  const result: ProofApiResponse<ProofData> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch proof data');
  }

  if (!result.data) {
    throw new Error('Proof data not found');
  }

  return result.data;
}

/**
 * Creates a new proof data entry
 */
export async function createProofData(params: CreateProofParams): Promise<ProofData> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to create proof data: ${response.statusText}`);
  }

  const result: ProofApiResponse<ProofData> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to create proof data');
  }

  if (!result.data) {
    throw new Error('No data returned from server');
  }

  return result.data;
}

/**
 * Updates an existing proof data entry
 */
export async function updateProofData(id: number, params: CreateProofParams): Promise<ProofData> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to update proof data: ${response.statusText}`);
  }

  const result: ProofApiResponse<ProofData> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to update proof data');
  }

  if (!result.data) {
    throw new Error('No data returned from server');
  }

  return result.data;
}

/**
 * Deletes a proof data entry
 */
export async function deleteProofData(id: number): Promise<void> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/proof/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete proof data: ${response.statusText}`);
  }

  const result: ProofApiResponse = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete proof data');
  }
}