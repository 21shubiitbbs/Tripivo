const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export type ApiHealth = {
  status: string;
  service: string;
};

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`);
  }

  return response.json() as Promise<ApiHealth>;
}