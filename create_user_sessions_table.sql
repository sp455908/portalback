-- Create UserSessions table for session management
CREATE TABLE IF NOT EXISTS "UserSessions" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL UNIQUE,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "ipAddress" VARCHAR(255),
    "userAgent" TEXT,
    "lastActivity" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "isActive" BOOLEAN DEFAULT TRUE,
    "deviceInfo" JSON,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_id" ON "UserSessions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_session_id" ON "UserSessions" ("sessionId");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_last_activity" ON "UserSessions" ("lastActivity");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires_at" ON "UserSessions" ("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_is_active" ON "UserSessions" ("isActive");

-- Add foreign key constraint
ALTER TABLE "UserSessions" 
ADD CONSTRAINT "fk_user_sessions_user_id" 
FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE;

-- Create a function to automatically update the updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updatedAt
CREATE TRIGGER update_user_sessions_updated_at 
    BEFORE UPDATE ON "UserSessions" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE "UserSessions" 
    SET "isActive" = FALSE 
    WHERE "expiresAt" < NOW() OR "isActive" = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to cleanup expired sessions (if using pg_cron extension)
-- This requires the pg_cron extension to be installed
-- SELECT cron.schedule('cleanup-expired-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "UserSessions" TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE "UserSessions_id_seq" TO your_app_user; 