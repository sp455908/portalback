-- Complete Database Setup for IIFTL Backend
-- This file contains all necessary database objects that might be missing

-- 1. Create missing indexes for UserSessions table (if not already created)
CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_id" ON "UserSessions" ("userId");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_session_id" ON "UserSessions" ("sessionId");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_last_activity" ON "UserSessions" ("lastActivity");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires_at" ON "UserSessions" ("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_user_sessions_is_active" ON "UserSessions" ("isActive");

-- 2. Add foreign key constraint for UserSessions (if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_sessions_user_id' 
        AND table_name = 'UserSessions'
    ) THEN
        ALTER TABLE "UserSessions" 
        ADD CONSTRAINT "fk_user_sessions_user_id" 
        FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create function to automatically update updatedAt timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create trigger for UserSessions updatedAt (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_user_sessions_updated_at'
    ) THEN
        CREATE TRIGGER update_user_sessions_updated_at 
            BEFORE UPDATE ON "UserSessions" 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 5. Create cleanup function for expired sessions
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

-- 6. Create additional useful indexes for other tables (if missing)
-- Users table indexes
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "Users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "Users" ("role");
CREATE INDEX IF NOT EXISTS "idx_users_user_type" ON "Users" ("userType");
CREATE INDEX IF NOT EXISTS "idx_users_is_active" ON "Users" ("isActive");

-- LoginAttempts table indexes
CREATE INDEX IF NOT EXISTS "idx_login_attempts_user_id" ON "LoginAttempts" ("userId");
CREATE INDEX IF NOT EXISTS "idx_login_attempts_email" ON "LoginAttempts" ("email");
CREATE INDEX IF NOT EXISTS "idx_login_attempts_attempt_time" ON "LoginAttempts" ("attemptTime");
CREATE INDEX IF NOT EXISTS "idx_login_attempts_success" ON "LoginAttempts" ("success");
CREATE INDEX IF NOT EXISTS "idx_login_attempts_is_blocked" ON "LoginAttempts" ("isBlocked");

-- PracticeTests table indexes
CREATE INDEX IF NOT EXISTS "idx_practice_tests_category" ON "PracticeTests" ("category");
CREATE INDEX IF NOT EXISTS "idx_practice_tests_is_active" ON "PracticeTests" ("isActive");
CREATE INDEX IF NOT EXISTS "idx_practice_tests_target_user_type" ON "PracticeTests" ("targetUserType");
CREATE INDEX IF NOT EXISTS "idx_practice_tests_created_by" ON "PracticeTests" ("createdBy");

-- TestAttempts table indexes
CREATE INDEX IF NOT EXISTS "idx_test_attempts_user_id" ON "TestAttempts" ("userId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_practice_test_id" ON "TestAttempts" ("practiceTestId");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_status" ON "TestAttempts" ("status");
CREATE INDEX IF NOT EXISTS "idx_test_attempts_started_at" ON "TestAttempts" ("startedAt");

-- Batches table indexes
CREATE INDEX IF NOT EXISTS "idx_batches_admin_id" ON "Batches" ("adminId");
CREATE INDEX IF NOT EXISTS "idx_batches_status" ON "Batches" ("status");
CREATE INDEX IF NOT EXISTS "idx_batches_user_type" ON "Batches" ("userType");

-- Courses table indexes
CREATE INDEX IF NOT EXISTS "idx_courses_instructor_id" ON "Courses" ("instructorId");
CREATE INDEX IF NOT EXISTS "idx_courses_is_active" ON "Courses" ("isActive");
CREATE INDEX IF NOT EXISTS "idx_courses_target_user_type" ON "Courses" ("targetUserType");

-- 7. Create a view for active sessions (useful for monitoring)
CREATE OR REPLACE VIEW active_sessions_view AS
SELECT 
    us."id",
    us."sessionId",
    us."userId",
    u."email",
    u."firstName",
    u."lastName",
    u."role",
    us."ipAddress",
    us."lastActivity",
    us."expiresAt",
    us."createdAt",
    EXTRACT(EPOCH FROM (us."expiresAt" - NOW()))/60 as "minutesUntilExpiry"
FROM "UserSessions" us
JOIN "Users" u ON us."userId" = u."id"
WHERE us."isActive" = TRUE 
AND us."expiresAt" > NOW();

-- 8. Create a function to get user session statistics
CREATE OR REPLACE FUNCTION get_user_session_stats(user_id INTEGER)
RETURNS TABLE(
    total_sessions BIGINT,
    active_sessions BIGINT,
    expired_sessions BIGINT,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_sessions,
        COUNT(CASE WHEN "isActive" = TRUE AND "expiresAt" > NOW() THEN 1 END)::BIGINT as active_sessions,
        COUNT(CASE WHEN "expiresAt" <= NOW() THEN 1 END)::BIGINT as expired_sessions,
        MAX("lastActivity") as last_activity
    FROM "UserSessions"
    WHERE "userId" = user_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a function to cleanup old sessions (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "UserSessions" 
    WHERE "createdAt" < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 10. Grant necessary permissions (adjust as needed for your setup)
-- Uncomment and modify these lines based on your database user setup
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "UserSessions" TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE "UserSessions_id_seq" TO your_app_user;
-- GRANT SELECT ON active_sessions_view TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_user_session_stats(INTEGER) TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_sessions() TO your_app_user;

-- 11. Create a simple monitoring query
-- You can run this to check the current state of sessions
-- SELECT 
--     COUNT(*) as total_sessions,
--     COUNT(CASE WHEN "isActive" = TRUE THEN 1 END) as active_sessions,
--     COUNT(CASE WHEN "expiresAt" <= NOW() THEN 1 END) as expired_sessions
-- FROM "UserSessions";

-- 12. Optional: Create a scheduled cleanup job (requires pg_cron extension)
-- If you have pg_cron installed, you can uncomment these lines:
-- SELECT cron.schedule('cleanup-expired-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');
-- SELECT cron.schedule('cleanup-old-sessions', '0 2 * * 0', 'SELECT cleanup_old_sessions();');

-- Success message
SELECT 'Database setup completed successfully!' as status; 