import '@testing-library/jest-dom';

// Mock Next.js Request and Response for API route testing
import { TextEncoder, TextDecoder } from 'util';

// Set up environment variables for all tests
process.env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-12345',
  NEXT_PUBLIC_COLOMBIA_TIMEZONE: 'America/Bogota',
  NEXT_PUBLIC_COLOMBIA_CURRENCY: 'COP',
  NEXT_PUBLIC_COLOMBIA_PHONE_PREFIX: '+57',
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_ENV: 'development',
  NEXT_PUBLIC_APP_VERSION: '1.0.0',
  NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_ENABLE_ANALYTICS: 'false',
};

// Mock global Request and Response
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Next.js specific globals for API routes
global.Request = global.Request || require('whatwg-fetch').Request;
global.Response = global.Response || require('whatwg-fetch').Response;
global.Headers = global.Headers || require('whatwg-fetch').Headers;