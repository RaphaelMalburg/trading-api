// Extend express-session types to include userId
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}
